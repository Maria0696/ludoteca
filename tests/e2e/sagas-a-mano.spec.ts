import { type Page, expect, test } from "@playwright/test";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Game, type SagaExtra, createGame, emptyLibrary } from "../../src/lib/model";
import { absorbExtras, buildStories, findOwned, isWished, missingFrom, orderStory, ownedExtras, placeInStory, storyStops } from "../../src/lib/sagas";
import { loadDemo, openApp } from "./helpers";

/* Sagas a mano: juegos de una saga que no tienes (guardados aparte), buscados en IGDB, con «Añadir a deseos». */

const stamp = "2026-11-25T10:00:00.000Z";
const extra = (patch: Partial<SagaExtra>): SagaExtra => ({
  id: crypto.randomUUID(),
  series: "Jedi",
  title: "Jedi: precuela",
  igdbId: 9,
  coverUrl: null,
  releaseDate: "2015-01-01",
  seriesOrder: null,
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
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return resolve();
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
  await loadDemo(page);
  await seed(
    page,
    { Hades: { series: "Prueba" } },
    {
      extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })],
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
const fallen = game("Jedi: Fallen Order", { series: "Jedi", releaseDate: "2019-11-15", igdbId: 1 });
const survivor = game("Jedi: Survivor", { series: "Jedi", releaseDate: "2023-04-28", igdbId: 2 });
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
    { kind: "falta", id: prequel.id, seriesOrder: 1 },
    { kind: "juego", id: survivor.id, seriesOrder: 2 },
    { kind: "juego", id: fallen.id, seriesOrder: 3 },
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
  modes: [], moods: [], lengthHours: null, criticRating: null, summary: null, developer: null, saga: null, series: null, releaseDate, ageRating: null,
});
const stopsOf = (page: Page) => page.getByRole("list", { name: "Juegos de la saga" }).getByRole("listitem");

async function searchAndPick(page: Page, dialogName: RegExp, query: string, title: string) {
  const dialog = page.getByRole("dialog", { name: dialogName });
  await dialog.getByRole("searchbox", { name: "Buscar en IGDB" }).fill(query);
  await dialog.getByRole("button", { name: new RegExp(`^${title}`) }).click();
}

test("sin historias, la pantalla es el mapa en blanco", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/sagas");
  await expect(page.getByText("Tu primer mapa está por dibujar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Traer sagas de IGDB" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva saga" })).toBeVisible();
});

test("añadir a una saga un juego que no tienes lo pone en el camino; uno que tienes entra como tuyo", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" }, "Hollow Knight": { igdbId: 888 } });
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
  await page.reload();
  await expect(stopsOf(page)).toHaveCount(4);
});

test("los que faltan se enseñan u ocultan, se añaden a deseos y se quitan de la saga", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } }, { extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })] });
  await openApp(page, "/sagas?saga=Prueba");
  const toggle = page.getByRole("switch", { name: "Los que me faltan" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(0);
  await toggle.click();
  await page.getByRole("button", { name: "Añadir «Hades II» a deseos" }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("En deseos");
  await page.getByRole("button", { name: "Quitar «Hades II» de la saga" }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toHaveCount(1);
  await openApp(page, "/deseos");
  await expect(page.getByRole("region", { name: "Deseos" })).toContainText("Hades II");
});

test("quitar de la saga un juego tuyo lo deja sin historia", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" }, "Hollow Knight": { series: "Prueba" } });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Quitar «Hollow Knight» de la saga" }).click();
  await expect(stopsOf(page)).toHaveCount(2);
});

test("buscar los que faltan: IGDB propone y tú eliges", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba", igdbId: 1 }, Celeste: { series: "Prueba" } });
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
  await loadDemo(page);
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
  await expect(page.getByRole("link", { name: "Saga: Mi saga · 1 de 1" })).toBeVisible();
});

test("un juego que llega toma la historia y el puesto de su parada hueca, aunque IGDB le dé otra", () => {
  const hollow = extra({ series: "Prueba", title: "Hades II", igdbId: 555, seriesOrder: 2 });
  const twin = extra({ series: "Otra", title: "Hades II", igdbId: 555 });
  const arriving = game("Hades II", { igdbId: 555, series: "Supergiant" });
  const { games, dropped } = absorbExtras([arriving], [hollow, twin]);
  expect(games[0].series).toBe("Prueba");
  expect(games[0].seriesOrder).toBe(2);
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
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } }, { extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555, releaseDate: "2025-09-25" })] });
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [{ ...catalogGame(555, "Hades II", "2025-09-25"), series: "Supergiant" }] } }));
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
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
  const backup = { app: "ludoteca", version: 1, exportedAt: stamp, data: { games: [], copies: [], wishlist: [], extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555 })] } };
  await openApp(page, "/importar?origen=copia");
  await page.getByTestId("importar-archivo").setInputFiles({ name: "copia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  await expect(page.getByRole("heading", { name: "Copia terminada" })).toBeVisible();
  await openApp(page, "/sagas?saga=Prueba");
  await expect(stopsOf(page).filter({ hasText: "Hades II" })).toContainText("No lo tienes");
});

test("al unir dos sagas con «Cambiar nombre», los que faltan de la otra también vuelven al orden de lanzamiento", async ({ page }) => {
  await loadDemo(page);
  await seed(
    page,
    {
      Hades: { series: "Prueba", releaseDate: "2020-09-17" },
      Celeste: { series: "Prueba", releaseDate: "2018-01-25" },
      "Hollow Knight": { series: "Otra", releaseDate: "2017-02-24", seriesOrder: 2 },
    },
    { extras: [extra({ series: "Otra", title: "Precuela", igdbId: 555, releaseDate: "2030-01-01", seriesOrder: 1 })] },
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
  await loadDemo(page);
  await seed(
    page,
    { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" }, "Hollow Knight": { series: "Otra" }, Unpacking: { series: "Otra" } },
    { extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555 })] },
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
  await loadDemo(page);
  await seed(
    page,
    { Celeste: { series: "Prueba" }, Unpacking: { series: "Prueba" } },
    { extras: [extra({ series: "Solo faltan", title: "Uno", igdbId: 1 }), extra({ series: "Solo faltan", title: "Dos", igdbId: 2 }), extra({ series: "Prueba", title: "Tres", igdbId: 3 })] },
  );
  await openApp(page, "/sagas?saga=Solo%20faltan");
  await expect(page.getByText("Aún no tienes ninguno")).toBeVisible();
  await expect(page.getByText("Saga completada")).toHaveCount(0);
  // Los dos tuyos están superados, pero falta uno.
  await openApp(page, "/sagas?saga=Prueba");
  await expect(page.getByText("Superados los que tienes")).toBeVisible();
  await expect(page.getByText("Saga completada")).toHaveCount(0);
});

test("quitar una saga avisa de que los que no tienes se van con ella", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } }, { extras: [extra({ series: "Prueba", title: "Hades II", igdbId: 555 })] });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Quitar saga" }).click();
  const alert = page.getByRole("region", { name: "Prueba" }).getByRole("alert");
  await expect(alert).toContainText("Sus 2 juegos se quedan en tu biblioteca");
  await expect(alert).toContainText("El que no tienes desaparece con ella");
});

test("buscar los que faltan enseña que está buscando", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
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
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
  await page.route("**/api/catalogo?*", (route) => route.fulfill({ json: { ok: true, results: [] } }));
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Añadir a la saga" }).click();
  const search = page.getByRole("dialog", { name: /^Añadir a «Prueba»/ }).getByRole("searchbox", { name: "Buscar en IGDB" });
  await search.fill("zz");
  await expect(page.getByText("Nada con «zz» en IGDB.")).toBeVisible();
  await search.fill("z");
  await expect(page.getByText("Nada con «zz» en IGDB.")).toHaveCount(0);
});
