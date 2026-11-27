import { type Page, expect, test } from "@playwright/test";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Game, type SagaExtra, createGame, emptyLibrary } from "../../src/lib/model";
import {
  absorbExtras,
  buildStories,
  findOwned,
  groupMarks,
  isWished,
  missingFrom,
  nextInGroups,
  orderStory,
  ownedExtras,
  placeInStory,
  roleOf,
  storyGroups,
  storyStops,
} from "../../src/lib/sagas";
import { openApp, reloadApp, seedDemo } from "./helpers";

/* Sagas a mano: juegos de una saga que no tienes (guardados aparte), buscados en IGDB, con «Añadir a deseos». */

const stamp = "2026-11-25T10:00:00.000Z";
const extra = (patch: Partial<SagaExtra>): SagaExtra => ({
  id: crypto.randomUUID(),
  saga: "Jedi",
  title: "Jedi: precuela",
  igdbId: 9,
  coverUrl: null,
  releaseDate: "2015-01-01",
  sagaOrder: null,
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});

/** Cambia la biblioteca guardada en el navegador (juegos por título, y lo que se añade a cada colección). */
async function seed(page: Page, patches: Record<string, Record<string, unknown>>, add: { extras?: unknown[]; wishlist?: unknown[] } = {}) {
  await page.evaluate(
    ({ patches, add }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("library", "readwrite");
          // Hasta que la transacción no termina, lo escrito no está guardado: ir a otra página antes lo perdería.
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          const cursor = tx.objectStore("library").openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return;
            const value = c.value as { games?: Record<string, unknown>[]; extras?: unknown[]; wishlist?: unknown[] };
            for (const g of value.games ?? []) Object.assign(g, patches[g.title as string] ?? {});
            if (add.extras) value.extras = [...(value.extras ?? []), ...add.extras];
            if (add.wishlist) value.wishlist = [...(value.wishlist ?? []), ...add.wishlist];
            c.update(value);
            c.continue();
          };
        };
      }),
    { patches, add },
  );
}

test("las copias de seguridad guardan los juegos de saga que no tienes; las antiguas, sin ellos, siguen sirviendo", () => {
  const library = { ...emptyLibrary(), games: [createGame({ title: "Jedi" })], extras: [extra({})] };
  const backup = createBackup(library);
  expect(backup.data.extras).toHaveLength(1);
  const parsed = parseBackup(JSON.stringify(backup));
  if (!parsed.ok) throw new Error(parsed.errors.join(", "));
  expect(parsed.backup.data.extras).toHaveLength(1);
  // En una biblioteca vacía, vuelven al importarla.
  expect(resolveImport(planImport(emptyLibrary(), parsed.backup), {}).extras).toHaveLength(1);
  // Una copia de antes no los trae, y se sigue leyendo.
  const old = parseBackup(JSON.stringify({ ...backup, data: { games: backup.data.games, copies: [], wishlist: [] } }));
  if (!old.ok) throw new Error(old.errors.join(", "));
  expect(old.backup.data.extras).toEqual([]);
});

test("un juego que faltaba en una saga llega desde Deseos y ocupa su sitio", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    { Hades: { saga: "Prueba" } },
    {
      extras: [extra({ saga: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })],
      wishlist: [{ id: crypto.randomUUID(), title: "Hades II", igdbId: 555, platform: "PC", priority: "media", genres: [], prices: [], createdAt: stamp, updatedAt: stamp }],
    },
  );
  await openApp(page, "/deseos");
  await page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: "Hades II" }).getByRole("button", { name: "Ya lo tengo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Pasar a la biblioteca" }).click();
  await expect(page.getByText("«Hades II» ya está en tu biblioteca")).toBeVisible();
  // En la saga ya es suyo: dos paradas propias y ninguna hueca.
  await openApp(page, "/sagas?saga=Prueba");
  const stops = page.getByRole("list", { name: "Juegos de la saga" }).getByRole("listitem");
  await expect(stops).toHaveCount(2);
  await expect(stops.filter({ hasText: "No lo tienes" })).toHaveCount(0);
  await expect(stops.nth(1)).toContainText("Hades II");
});

const game = (title: string, patch: Partial<Game>): Game => ({ ...createGame({ title }), ...patch });
const fallen = game("Jedi: Fallen Order", { saga: "Jedi", releaseDate: "2019-11-15", igdbId: 1 });
const survivor = game("Jedi: Survivor", { saga: "Jedi", releaseDate: "2023-04-28", igdbId: 2 });
const prequel = extra({ title: "Jedi: precuela", releaseDate: "2015-01-01", igdbId: 3 });
const titleOf = (s: { kind: string; game?: Game; extra?: SagaExtra }) => (s.kind === "juego" ? s.game!.title : s.extra!.title);

test("las paradas mezclan los tuyos y los que faltan, en su orden", () => {
  const [story] = buildStories([survivor, fallen], [prequel]);
  expect(storyStops(story, "lanzamiento", true).map(titleOf)).toEqual(["Jedi: precuela", "Jedi: Fallen Order", "Jedi: Survivor"]);
  expect(storyStops(story, "lanzamiento", false).map(titleOf)).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  // Los tuyos, solos, para el puesto y «Siguiente».
  expect(orderStory(story, "lanzamiento").map((g) => g.title)).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  // Uno tuyo y uno que falta ya son una historia.
  expect(buildStories([fallen], [prequel])).toHaveLength(1);
});

test("con los que faltan ocultos, mover uno tuyo no los mueve", () => {
  const [story] = buildStories([fallen, survivor], [prequel]);
  expect(placeInStory(story, survivor.id, 0, false)).toEqual([
    { kind: "falta", id: prequel.id, sagaOrder: 1 },
    { kind: "juego", id: survivor.id, sagaOrder: 2 },
    { kind: "juego", id: fallen.id, sagaOrder: 3 },
  ]);
  // Con todos a la vista, se coloca entre todos.
  expect(placeInStory(story, prequel.id, 2, true).map((p) => p.id)).toEqual([fallen.id, survivor.id, prequel.id]);
});

test("lo que falta en IGDB descarta lo que ya tienes o ya está", () => {
  const [story] = buildStories([fallen, survivor], [prequel]);
  const catalog = [1, 2, 3, 4].map((igdbId) => ({ igdbId, title: `Juego ${igdbId}`, coverUrl: null, releaseDate: null }));
  expect(missingFrom(story, catalog, [fallen, survivor]).map((c) => c.igdbId)).toEqual([4]);
});

/** Un juego del catálogo, como lo devuelve /api/catalogo. */
const catalogGame = (igdbId: number, title: string, releaseDate: string | null = null) => ({
  igdbId, title, year: releaseDate ? Number(releaseDate.slice(0, 4)) : null, coverUrl: null, backdropUrl: null, genres: [], platforms: ["PC"],
  modes: [], moods: [], lengthHours: null, criticRating: null, summary: null, developer: null, franchise: null, saga: null, gameType: null, baseGame: null, releaseDate, ageRating: null,
});
/** Pulsa «Deshacer» en el aviso que dice `text`. */
const toastUndo = (page: Page, text: string) =>
  page.getByRole("region", { name: /^Notifications/ }).getByRole("listitem").filter({ hasText: text }).getByRole("button", { name: "Deshacer" }).click();

const stopsOf = (page: Page) => page.getByRole("list", { name: "Juegos de la saga" }).getByRole("listitem");

async function searchAndPick(page: Page, dialogName: RegExp, query: string, title: string) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.getByRole("searchbox", { name: "Buscar en IGDB" }).fill(query);
  await dialog.getByRole("button", { name: new RegExp(`^${title}`) }).click();
}

test("sin historias, la pantalla es el mapa en blanco", async ({ page }) => {
  await seedDemo(page);
  await openApp(page, "/sagas");
  await expect(page.getByText("Tu primer mapa está por dibujar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Traer sagas de IGDB" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva saga" })).toBeVisible();
});

test("añadir a una saga un juego que no tienes lo pone en el camino; uno que tienes entra como tuyo", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { igdbId: 888 } });
  await page.route("**/api/catalogo?*", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({ json: { ok: true, results: q.startsWith("hol") ? [catalogGame(888, "Hollow Knight", "2017-02-24")] : [catalogGame(777, "Hades II", "2025-09-25")] } });
  });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  await searchAndPick(page, /^Añadir a «Prueba»/, "hades", "Hades II");
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("No lo tienes");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  await searchAndPick(page, /^Añadir a «Prueba»/, "hollow", "Hollow Knight");
  await expect(stopsOf(page)).toHaveCount(4);
  await expect(stopsOf(page).filter({ hasText: "Hollow Knight" })).not.toContainText("No lo tienes");
  await reloadApp(page);
  await expect(stopsOf(page)).toHaveCount(4);
});

test("los que faltan se enseñan u ocultan, se añaden a deseos y se quitan de la saga", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } }, { extras: [extra({ saga: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })] });
  await openApp(page, "/sagas?saga=Prueba");
  const toggle = page.getByRole("switch", { name: "Los que me faltan" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(0);
  await toggle.click();
  // Un corazón, sin texto: así las sagas no van tan cargadas.
  const wish = page.getByRole("button", { name: "Añadir «Hades II» a deseos" });
  await expect(wish).toHaveText("");
  await wish.click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("En deseos");
  await expect(stopsOf(page).filter({ hasText: "Hades II" }).locator("[data-en-deseos]")).toHaveCount(1);
  // El corazón rojo lo quita de deseos (y se puede deshacer).
  await page.getByRole("button", { name: "Quitar «Hades II» de deseos" }).click();
  await expect(page.getByRole("button", { name: "Añadir «Hades II» a deseos" })).toBeVisible();
  // Cada «Deshacer», el de su aviso: el anterior puede seguir saliendo de la pantalla cuando llega el siguiente.
  await toastUndo(page, "quitado de la lista de deseos");
  await expect(page.getByRole("button", { name: "Quitar «Hades II» de deseos" })).toBeVisible();
  await page.getByRole("button", { name: "Quitar «Hades II» de la saga" }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(0);
  await toastUndo(page, "quitado de la saga");
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(1);
  await openApp(page, "/deseos");
  await expect(page.getByRole("region", { name: "Deseos" })).toContainText("Hades II");
});

test("quitar de la saga un juego tuyo lo saca del mapa, pero su ficha conserva la saga", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { saga: "Prueba" } });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Quitar «Hollow Knight» de la saga" }).click();
  await expect(stopsOf(page)).toHaveCount(2);
  await reloadApp(page);
  await expect(stopsOf(page)).toHaveCount(2);
  await openApp(page, "/biblioteca?agrupar=ninguno");
  await page.getByRole("link", { name: /^Hollow Knight/ }).first().click();
  await expect(page.getByRole("region", { name: "Ficha técnica" }).getByRole("button", { name: /^Saga: Prueba/ })).toBeVisible();
});

test("buscar los que faltan: IGDB propone y tú eliges", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba", igdbId: 1 }, Celeste: { saga: "Prueba" } });
  await page.route("**/api/catalogo/serie", (route) =>
    route.fulfill({ json: { ok: true, games: [catalogGame(1, "Hades", "2020-09-17"), catalogGame(901, "Hades II", "2025-09-25"), catalogGame(902, "Hades III", "2030-01-01")] } }),
  );
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Buscar los que faltan" }).click();
  const review = page.getByRole("dialog", { name: "IGDB conoce 2 que te faltan" });
  await review.getByRole("radiogroup", { name: "Hades III" }).getByRole("radio", { name: "No" }).click();
  await review.getByRole("button", { name: "Añadir 1" }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(1);
  await expect(stopsOf(page).filter({ hasText: "Hades III" })).toHaveCount(0);
});

test("nueva saga: nombre y sus primeros juegos, buscándolos", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { igdbId: 1 } });
  await page.route("**/api/catalogo?*", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    return route.fulfill({ json: { ok: true, results: q.startsWith("had") ? [catalogGame(1, "Hades", "2020-09-17")] : [catalogGame(903, "Juego nuevo", "2026-01-01")] } });
  });
  await openApp(page, "/sagas");
  await page.getByRole("button", { name: "Nueva saga" }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva saga" });
  await dialog.getByRole("textbox", { name: "Nombre de la saga" }).fill("Mi saga");
  await searchAndPick(page, /^Nueva saga/, "hades", "Hades");
  await searchAndPick(page, /^Nueva saga/, "nuevo", "Juego nuevo");
  await dialog.getByRole("button", { name: "Crear saga" }).click();
  await expect(page).toHaveURL(/saga=Mi%20saga/);
  await expect(stopsOf(page)).toHaveCount(2);
  await expect(stopsOf(page).filter({ hasText: "Juego nuevo" })).toContainText("No lo tienes");
  // La ficha de Hades lleva a su saga, aunque el otro juego no lo tengas.
  await stopsOf(page).getByRole("link", { name: "Hades" }).click();
  await expect(page.getByRole("link", { name: "Saga Mi saga: juego 1 de 1" })).toBeVisible();
});

test("un juego que llega toma la historia y el puesto de su parada hueca, aunque IGDB le dé otra", () => {
  const hollow = extra({ saga: "Prueba", title: "Hades II", igdbId: 555, sagaOrder: 2 });
  const twin = extra({ saga: "Otra", title: "Hades II", igdbId: 555 });
  const arriving = game("Hades II", { igdbId: 555, saga: "Supergiant" });
  // Si su parada estaba oculta (saga quitada), llega oculto también.
  expect(absorbExtras([arriving], [{ ...hollow, hidden: true }]).games[0].sagaHidden).toBe(true);
  const { games, dropped } = absorbExtras([arriving], [hollow, twin]);
  expect(games[0].saga).toBe("Prueba");
  expect(games[0].sagaOrder).toBe(2);
  expect(dropped.sort()).toEqual([hollow.id, twin.id].sort());
  // Al revés: una parada hueca de algo que ya tienes sobra.
  expect(ownedExtras([hollow], [arriving])).toEqual([hollow.id]);
});

test("«Ya lo tienes» y «En deseos» no confunden un remake con el original", () => {
  const original = game("Resident Evil 4", { igdbId: 100 });
  const manual = game("Okami", { igdbId: null });
  expect(findOwned([original], { igdbId: 200, title: "Resident Evil 4" })).toBeUndefined();
  expect(findOwned([original], { igdbId: 100, title: "RE4" })?.id).toBe(original.id);
  // Sin número de IGDB, cuenta el título.
  expect(findOwned([manual], { igdbId: 300, title: "Ōkami" })?.id).toBe(manual.id);
  const wish = { igdbId: 100, title: "Resident Evil 4" };
  expect(isWished([wish], { igdbId: 200, title: "Resident Evil 4" })).toBe(false);
  expect(isWished([{ igdbId: null, title: "Resident Evil 4" }], { igdbId: 200, title: "Resident Evil 4" })).toBe(true);
});

test("añadir desde el catálogo un juego que estaba como parada hueca lo pone en su sitio", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } }, { extras: [extra({ saga: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })] });
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [{ ...catalogGame(555, "Hades II", "2025-09-25"), saga: "Supergiant" }] } }));
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").fill("ha");
  await dialog.getByRole("option", { name: /Hades II/ }).click();
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByRole("button", { name: "Ver ficha" })).toBeVisible();
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page)).toHaveCount(3);
  await expect(stopsOf(page).filter({ hasText: "No lo tienes" })).toHaveCount(0);
});

test("una copia de seguridad que solo trae juegos que no tienes se puede importar", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  // Una copia del formato 1: la saga del que no tienes era «series».
  const { saga, sagaOrder, ...rest } = extra({ saga: "Prueba", title: "Hades II", igdbId: 555 });
  const old = { ...rest, series: saga, seriesOrder: sagaOrder };
  const backup = { app: "ludoteca", version: 1, exportedAt: stamp, data: { games: [], copies: [], wishlist: [], extras: [old] } };
  await openApp(page, "/importar?origen=copia");
  await page.getByTestId("importar-archivo").setInputFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  await expect(page.getByRole("heading", { name: "Copia terminada" })).toBeVisible();
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("No lo tienes");
});

test("al unir dos sagas con «Cambiar nombre», los que faltan de la otra también vuelven al orden de lanzamiento", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    {
      Hades: { saga: "Prueba", releaseDate: "2020-09-17" },
      Celeste: { saga: "Prueba", releaseDate: "2018-01-25" },
      "Hollow Knight": { saga: "Otra", releaseDate: "2017-02-24", sagaOrder: 2 },
    },
    { extras: [extra({ saga: "Otra", title: "Precuela", igdbId: 555, releaseDate: "2030-01-01", sagaOrder: 1 })] },
  );
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Cambiar nombre" }).click();
  await page.getByRole("textbox", { name: "Nombre de la saga" }).fill("Otra");
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByRole("radio", { name: "Cronología" }).click();
  await expect(stopsOf(page)).toHaveCount(4);
  await expect(stopsOf(page).last()).toContainText("Precuela");
});

test("un juego que no tienes solo está en una saga: añadirlo a otra lo mueve", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { saga: "Otra" }, Unpacking: { saga: "Otra" } },
    { extras: [extra({ saga: "Prueba", title: "Hades II", igdbId: 555 })] },
  );
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [catalogGame(555, "Hades II", "2025-09-25")] } }));
  await openApp(page, "/sagas?saga=Otra");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  await searchAndPick(page, /^Añadir a «Otra»/, "hades", "Hades II");
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(1);
  // Sin recargar: recargar justo después podría adelantarse a lo que se guarda.
  await page.getByRole("region", { name: "Sagas" }).getByRole("link", { name: /^Prueba/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Prueba" })).toBeVisible();
  await expect(stopsOf(page)).toHaveCount(2);
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(0);
});

test("una saga no está completada si no tienes ninguno, o te faltan algunos", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    { Celeste: { saga: "Prueba" }, Unpacking: { saga: "Prueba" } },
    { extras: [extra({ saga: "Solo faltan", title: "Uno", igdbId: 1 }), extra({ saga: "Solo faltan", title: "Dos", igdbId: 2 }), extra({ saga: "Prueba", title: "Tres", igdbId: 3 })] },
  );
  await openApp(page, "/sagas?saga=Solo%20faltan");
  await expect(page.getByText("Aún no tienes ninguno")).toBeVisible();
  await expect(page.getByText("Saga completada")).toHaveCount(0);
  // Los dos tuyos están superados, pero falta uno.
  await openApp(page, "/sagas?saga=Prueba");
  await expect(page.getByText("Superados los que tienes")).toBeVisible();
  await expect(page.getByText("Saga completada")).toHaveCount(0);
});

test("quitar una saga guarda los que no tienes y vuelven con ella", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } }, { extras: [extra({ saga: "Prueba", title: "Hades II", igdbId: 555 })] });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Quitar saga" }).click();
  const alert = page.getByRole("region", { name: "Prueba" }).getByRole("alert");
  await expect(alert).toContainText("Sus 2 juegos la conservan en su ficha");
  await expect(alert).toContainText("El que no tienes se guarda");
  await alert.getByRole("button", { name: "Quitar saga" }).click();
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  await page.getByRole("dialog", { name: "IGDB propone 1 saga" }).getByRole("button", { name: "Añadir 1 saga" }).click();
  await expect(stopsOf(page)).toHaveCount(3);
});

test("buscar los que faltan enseña que está buscando", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  let answer: () => void = () => {};
  const waiting = new Promise<void>((resolve) => (answer = resolve));
  await page.route("**/api/catalogo/serie", async (route) => {
    await waiting;
    await route.fulfill({ json: { ok: true, games: [] } });
  });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Buscar los que faltan" }).click();
  await expect(page.getByRole("button", { name: "Buscando…" })).toBeDisabled();
  answer();
  await expect(page.getByRole("button", { name: "Buscar los que faltan" })).toBeEnabled();
});

test("el buscador de IGDB no deja a la vista el mensaje de una búsqueda anterior", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [] } }));
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  const search = page.getByRole("dialog", { name: /^Añadir a «Prueba»/ }).getByRole("searchbox", { name: "Buscar en IGDB" });
  await search.fill("zz");
  await expect(page.getByText("Nada con «zz» en IGDB.")).toBeVisible();
  await search.fill("z");
  await expect(page.getByText("Nada con «zz» en IGDB.")).toHaveCount(0);
});

test("las copias de seguridad van en el formato 2, con franquicia y saga; las del 1 se siguen leyendo", () => {
  const jedi = game("Jedi: Survivor", { franchise: "Star Wars", saga: "Star Wars Jedi", sagaOrder: 2 });
  const fresh = createBackup({ games: [jedi], copies: [], wishlist: [], extras: [extra({ saga: "Star Wars Jedi" })], wraps: [], achievements: [], settings: { steamId: null } });
  expect(fresh.version).toBe(2);
  const text = JSON.stringify(fresh);
  expect(text).toContain('"franchise":"Star Wars"');
  expect(text).not.toContain('"series"');
  // El formato 1: «saga» era la franquicia, «series» la saga y lo descartado, «Sin historia».
  const { franchise, saga, sagaOrder, ...rest } = jedi;
  void franchise;
  void saga;
  void sagaOrder;
  const old = {
    app: "ludoteca",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      games: [
        { ...rest, saga: "Star Wars", series: "Star Wars Jedi", seriesOrder: 2 },
        { ...rest, id: crypto.randomUUID(), title: "Quitado", saga: "Sin saga", series: "Sin historia", seriesOrder: null },
      ],
      copies: [],
      wishlist: [],
      extras: [{ ...extra({}), saga: undefined, series: "Star Wars Jedi", seriesOrder: 1 }],
    },
  };
  const parsed = parseBackup(JSON.stringify(old));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  const [a, b] = parsed.backup.data.games;
  expect([a.franchise, a.saga, a.sagaOrder]).toEqual(["Star Wars", "Star Wars Jedi", 2]);
  expect([b.franchise, b.saga]).toEqual([null, "Sin saga"]);
  expect(parsed.backup.data.extras.map((x) => [x.saga, x.sagaOrder])).toEqual([["Star Wars Jedi", 1]]);
});


test("en el mapa cada juego dice qué es, también al buscarlos para añadir", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { saga: "Prueba", gameType: "main" }, Celeste: { saga: "Prueba", gameType: "remake" } });
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [{ ...catalogGame(555, "Hades II", "2025-09-25"), gameType: "dlc" }] } }));
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page).filter({ hasText: "Celeste" })).toContainText("Remake");
  await expect(stopsOf(page).filter({ hasText: "Hades" }).first()).toContainText("Juego base");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  const dialog = page.getByRole("dialog", { name: /^Añadir a «Prueba»/ });
  await dialog.getByRole("searchbox", { name: "Buscar en IGDB" }).fill("hades");
  await expect(dialog.getByRole("button", { name: /^Hades II/ })).toContainText("DLC");
  await dialog.getByRole("button", { name: /^Hades II/ }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("DLC");
});

test("Ajustes completa desde IGDB el tipo de los juegos que no lo tienen", async ({ page }) => {
  await seedDemo(page);
  await seed(page, { Hades: { igdbId: 101 }, Celeste: { igdbId: 102 }, "Hollow Knight": { igdbId: 103, gameType: "remaster" } });
  let asked: number[] = [];
  await page.route("**/api/catalogo/tipos", async (route) => {
    asked = (route.request().postDataJSON() as { igdbIds: number[] }).igdbIds;
    await route.fulfill({ json: { ok: true, types: { "101": { gameType: "dlc", baseGame: "Algo" }, "102": { gameType: "main", baseGame: null } } } });
  });
  await openApp(page, "/ajustes?apartado=traer");
  await page.getByRole("button", { name: "Completar el tipo desde IGDB (2 juegos)" }).click();
  await expect(page.getByText("Tipo completado en 2 juegos")).toBeVisible();
  // Solo se piden los que no tienen tipo.
  expect(asked.sort()).toEqual([101, 102]);
  await expect(page.getByRole("button", { name: /^Completar el tipo desde IGDB/ })).toHaveCount(0);
});

const leadTitle = (g: { lead: { kind: string; game?: Game; extra?: SagaExtra } }) => titleOf(g.lead);

test("las versiones del mismo juego van dentro de la parada del original, por fecha", () => {
  const iii = game("God of War III", { saga: "GoW", igdbId: 30, releaseDate: "2010-03-16" });
  const remaster = extra({ saga: "GoW", title: "God of War III Remastered", igdbId: 31, versionOf: 30, releaseDate: "2015-07-14" });
  const remake = extra({ saga: "GoW", title: "God of War III Remake", igdbId: 32, versionOf: 30, releaseDate: null });
  const ascension = extra({ saga: "GoW", title: "God of War: Ascension", igdbId: 40, versionOf: 0, releaseDate: "2013-03-12" });
  // Su original no está en la saga: va sola.
  const lonely = extra({ saga: "GoW", title: "Edición suelta", igdbId: 50, versionOf: 99, releaseDate: "2020-01-01" });
  const [story] = buildStories([iii], [remake, ascension, remaster, lonely]);
  const groups = storyGroups(story, "lanzamiento");
  expect(groups.map((g) => [leadTitle(g), g.versions.map(titleOf)])).toEqual([
    ["God of War III", ["God of War III Remastered", "God of War III Remake"]],
    ["God of War: Ascension", []],
    ["Edición suelta", []],
  ]);
  // Sin los que faltan, solo los tuyos.
  expect(storyGroups(story, "lanzamiento", false).map(leadTitle)).toEqual(["God of War III"]);
  // Mover el original mueve sus versiones: todas toman el puesto de su parada.
  const placed = placeInStory(story, iii.id, 2);
  const order = (id: string) => placed.find((p) => p.id === id)?.sagaOrder;
  expect([order(ascension.id), order(lonely.id), order(iii.id), order(remaster.id), order(remake.id)]).toEqual([1, 2, 3, 3, 3]);
});

test("la marca de cada parada: según su tipo, o la que ponga ella; los números cuentan solo las principales", () => {
  expect(roleOf({ gameType: "dlc" })).toBe("dlc");
  expect(roleOf({ gameType: "expansion" })).toBe("dlc");
  expect(roleOf({ gameType: "main" })).toBe("main");
  expect(roleOf({})).toBe("main");
  expect(roleOf({ gameType: "dlc", sagaRole: "optional" })).toBe("optional");
  const a = game("A", { saga: "S", releaseDate: "2001-01-01" });
  const b = game("B", { saga: "S", releaseDate: "2002-01-01", sagaRole: "optional" });
  const c = game("C", { saga: "S", releaseDate: "2003-01-01", gameType: "dlc" });
  const d = game("D", { saga: "S", releaseDate: "2004-01-01" });
  const [story] = buildStories([a, b, c, d]);
  const groups = storyGroups(story, "lanzamiento");
  expect(groupMarks(groups)).toEqual([1, "optional", "dlc", 2]);
  // «Siguiente», solo entre las principales.
  expect(nextInGroups(groups)?.title).toBe("A");
  const [done] = buildStories([{ ...a, status: "completado" }, b, c, d]);
  expect(nextInGroups(storyGroups(done, "lanzamiento"))?.title).toBe("D");
});

test("en el mapa: cada juego dice qué es, las versiones van dentro y cada parada lleva su marca", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    {
      Hades: { saga: "Prueba", igdbId: 10, gameType: "main", releaseDate: "2020-09-17", versionOf: 0 },
      Celeste: { saga: "Prueba", igdbId: 20, gameType: "main", releaseDate: "2018-01-25", versionOf: 0 },
    },
    {
      extras: [
        extra({ saga: "Prueba", title: "Hades Remastered", igdbId: 11, versionOf: 10, gameType: "remaster", releaseDate: "2024-01-01" }),
        extra({ saga: "Prueba", title: "Hades: Ecos", igdbId: 12, versionOf: 0, gameType: "dlc", releaseDate: "2021-01-01" }),
      ],
    },
  );
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page)).toHaveCount(3);
  const celeste = stopsOf(page).filter({ hasText: "Celeste" });
  const hades = stopsOf(page).filter({ hasText: "Hades Remastered" });
  const dlc = stopsOf(page).filter({ hasText: "Hades: Ecos" });
  await expect(celeste).toContainText("Juego base");
  await expect(hades.getByRole("group", { name: "Versiones de «Hades»" })).toContainText("Remaster");
  await expect(celeste.locator("[data-marca='principal']")).toHaveText("1");
  await expect(hades.locator("[data-marca='principal']")).toHaveText("2");
  await expect(dlc.locator("[data-marca='dlc']")).toHaveCount(1);

  // Celeste, opcional: Hades pasa a ser la 1.
  await page.getByRole("button", { name: "Opciones de «Celeste»" }).click();
  await page.getByRole("radiogroup", { name: "Marca de «Celeste»" }).getByRole("radio", { name: "Opcional" }).click();
  await expect(celeste.locator("[data-marca='opcional']")).toHaveCount(1);
  await expect(hades.locator("[data-marca='principal']")).toHaveText("1");
  await reloadApp(page);
  await expect(stopsOf(page).filter({ hasText: "Celeste" }).locator("[data-marca='opcional']")).toHaveCount(1);

  // A mano: Celeste, versión de Hades; y luego, parada propia otra vez.
  await page.getByRole("button", { name: "Opciones de «Celeste»" }).click();
  await page.getByRole("combobox", { name: "Es versión de" }).selectOption({ label: "Hades" });
  await expect(stopsOf(page)).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Versiones de «Hades»" })).toContainText("Celeste");
  await page.getByRole("button", { name: "Opciones de «Celeste»" }).click();
  await page.getByRole("combobox", { name: "Es versión de" }).selectOption({ label: "Parada propia" });
  await expect(stopsOf(page)).toHaveCount(3);
});

test("de qué es versión y qué es cada juego lo pregunta a IGDB, solo por lo que aún no se sabe", async ({ page }) => {
  await seedDemo(page);
  await seed(
    page,
    {
      Hades: { saga: "Prueba", igdbId: 10, releaseDate: "2020-09-17" },
      Celeste: { saga: "Prueba", igdbId: 20, versionOf: 0, gameType: "main", releaseDate: "2018-01-25" },
    },
    {
      extras: [
        extra({ saga: "Prueba", title: "Hades Remastered", igdbId: 11, gameType: "remaster", releaseDate: "2024-01-01" }),
        // Uno que no tienes, añadido antes de saber su tipo.
        extra({ saga: "Prueba", title: "Hades: Ecos", igdbId: 12, versionOf: 0, releaseDate: "2021-01-01" }),
      ],
    },
  );
  let asked: number[] = [];
  await page.route("**/api/catalogo/versiones", async (route) => {
    asked = (route.request().postDataJSON() as { igdbIds: number[] }).igdbIds;
    await route.fulfill({
      json: {
        ok: true,
        originals: { "10": 0, "11": 10, "12": 0 },
        types: { "10": { gameType: "main", baseGame: null }, "11": { gameType: "remaster", baseGame: null }, "12": { gameType: "dlc", baseGame: "Hades" } },
      },
    });
  });
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page)).toHaveCount(3);
  await expect(page.getByRole("group", { name: "Versiones de «Hades»" })).toContainText("Hades Remastered");
  const hades = stopsOf(page).filter({ hasText: "Hades Remastered" });
  await expect(hades).toContainText("Juego base");
  const ecos = stopsOf(page).filter({ hasText: "Hades: Ecos" });
  await expect(ecos).toContainText("DLC");
  await expect(ecos.locator("[data-marca='dlc']")).toHaveCount(1);
  expect(asked.sort()).toEqual([10, 11, 12]);

  // El tipo también se pone a mano, aunque no lo tengas.
  await page.getByRole("button", { name: "Opciones de «Hades: Ecos»" }).click();
  await page.getByRole("combobox", { name: "Tipo de «Hades: Ecos»" }).selectOption({ label: "Expansión" });
  await expect(ecos).toContainText("Expansión");
});

