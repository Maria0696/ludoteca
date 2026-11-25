import { type Page, expect, test } from "@playwright/test";
import { type Game, createGame, gameSchema } from "../../src/lib/model";
import { pickSeries, seriesForIgdbGame, singleGameSeries } from "../../src/lib/igdb-maps";
import { buildStories, groupByBrand, moveInStory, nextInStory, orderStory, placeInStory, proposeStories } from "../../src/lib/sagas";
import { loadDemo, openApp } from "./helpers";

/* Sagas: los juegos de cada historia, en orden de lanzamiento o en el de la historia (puesto a mano). */

const game = (title: string, patch: Partial<Game>): Game => ({ ...createGame({ title }), ...patch });
const titles = (games: Game[]) => games.map((g) => g.title);

test("las sagas reúnen dos o más juegos, bajo su franquicia si la tienen", () => {
  const stories = buildStories([
    game("Jedi: Fallen Order", { saga: "Star Wars Jedi", franchise: "Star Wars" }),
    game("Jedi: Survivor", { saga: "Star Wars Jedi", franchise: "Star Wars" }),
    game("KOTOR", { saga: "Star Wars: KOTOR", franchise: "Star Wars" }),
    game("Half-Life", { saga: "Half-Life" }),
    game("Half-Life 2", { saga: "Half-Life" }),
  ]);
  expect(stories.map((s) => [s.name, s.brand])).toEqual([
    ["Half-Life", null],
    ["Star Wars Jedi", "Star Wars"],
  ]);
  expect(groupByBrand(stories).map((g) => [g.brand, g.stories.map((s) => s.name)])).toEqual([
    [null, ["Half-Life"]],
    ["Star Wars", ["Star Wars Jedi"]],
  ]);
});

const fallen = game("Jedi: Fallen Order", { saga: "Jedi", releaseDate: "2019-11-15" });
const survivor = game("Jedi: Survivor", { saga: "Jedi", releaseDate: "2023-04-28" });

test("orden de lanzamiento y orden de la historia", () => {
  const [story] = buildStories([survivor, fallen]);
  expect(titles(orderStory(story, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  // Sin orden puesto, la historia es el lanzamiento.
  expect(titles(orderStory(story, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  const [ordered] = buildStories([{ ...survivor, sagaOrder: 1 }, { ...fallen, sagaOrder: 2 }]);
  expect(titles(orderStory(ordered, "historia"))).toEqual(["Jedi: Survivor", "Jedi: Fallen Order"]);
  expect(titles(orderStory(ordered, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
});

test("mover un juego guarda el orden de todos; uno nuevo va al final", () => {
  const [story] = buildStories([fallen, survivor]);
  expect(moveInStory(story, survivor.id, -1)).toEqual([
    { kind: "juego", id: survivor.id, sagaOrder: 1 },
    { kind: "juego", id: fallen.id, sagaOrder: 2 },
  ]);
  expect(moveInStory(story, fallen.id, -1)).toEqual([]);
  // Uno que entra sin puesto va al final de la historia, aunque saliera antes.
  const prequel = game("Jedi: precuela", { saga: "Jedi", releaseDate: "2015-01-01" });
  const [grown] = buildStories([{ ...fallen, sagaOrder: 1 }, { ...survivor, sagaOrder: 2 }, prequel]);
  expect(titles(orderStory(grown, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor", "Jedi: precuela"]);
});

test("el siguiente es el primero sin superar ni abandonar", () => {
  const done = game("Uno", { status: "completado", finishedAt: "2024-01-01" });
  const dropped = game("Dos", { status: "abandonado" });
  const waiting = game("Tres", { status: "pendiente" });
  expect(nextInStory([done, dropped, waiting])?.title).toBe("Tres");
  expect(nextInStory([done])).toBeNull();
});

test("una copia antigua, sin saga, se sigue leyendo", () => {
  const { saga, sagaOrder, ...old } = game("Viejo", {});
  void saga;
  void sagaOrder;
  const parsed = gameSchema.parse(old);
  expect(parsed.saga ?? null).toBeNull();
  expect(parsed.sagaOrder ?? null).toBeNull();
});

test("de varias series de IGDB, la más concreta", () => {
  const many = Array.from({ length: 40 }, (_, i) => i + 1);
  expect(pickSeries([{ name: "Star Wars", games: many }, { name: "Star Wars Jedi", games: [1, 2] }], "Star Wars")).toBe("Star Wars Jedi");
  // Si la única serie se llama como la marca, es esa.
  expect(pickSeries([{ name: "Resident Evil", games: many }], "Resident Evil")).toBe("Resident Evil");
  // Entre varias que no se llaman como la marca, la de menos juegos.
  expect(pickSeries([{ name: "LEGO Star Wars", games: [1, 2, 3] }, { name: "Star Wars: Squadrons", games: [1] }], "Star Wars")).toBe("Star Wars: Squadrons");
  expect(pickSeries(undefined, "Star Wars")).toBeNull();
});

test("una serie de IGDB que es un solo juego (con sus remakes y versiones) no es una saga", () => {
  const ocarina = { name: "The Legend of Zelda: Ocarina of Time", games: [{ id: 1, remakes: [2] }, { id: 2 }, { id: 3, version_parent: 1 }] };
  const zelda = { name: "The Legend of Zelda", games: [1, 2, 3, 4, 5].map((id) => ({ id })) };
  // Con marca: la serie de la marca.
  expect(pickSeries([zelda, ocarina], "The Legend of Zelda")).toBe("The Legend of Zelda");
  expect(seriesForIgdbGame({ franchise: { name: "The Legend of Zelda" }, collections: [ocarina] })).toBe("The Legend of Zelda");
  // Sin marca ni otra serie: ninguna.
  expect(seriesForIgdbGame({ collections: [ocarina] })).toBeNull();
  // Una secuela sí hace saga, aunque la serie se llame como el primero.
  expect(pickSeries([{ name: "Hades", games: [{ id: 1 }, { id: 2 }] }], null)).toBe("Hades");
  expect(pickSeries([{ name: "Dark Souls", games: [{ id: 1, remasters: [4] }, { id: 2 }, { id: 3 }, { id: 4 }] }], null)).toBe("Dark Souls");
  // Un juego con su contenido descargable y sus versiones, tampoco.
  const witcher = { name: "The Witcher 3", games: [{ id: 7 }, { id: 8, parent_game: 7 }, { id: 9, ports: [7] }] };
  expect(pickSeries([witcher, { name: "The Witcher", games: [{ id: 6 }, { id: 7 }] }], null)).toBe("The Witcher");
  // Las series de un solo juego, para limpiar las que ya se pusieron.
  expect(singleGameSeries({ collections: [zelda, ocarina] })).toEqual(["The Legend of Zelda: Ocarina of Time"]);
  expect(singleGameSeries({ version_parent: { collections: [ocarina] } })).toEqual(["The Legend of Zelda: Ocarina of Time"]);
  expect(singleGameSeries({ collections: [{ name: "Hades", games: [1, 2] }] })).toEqual([]);
});

/** Cambia juegos de la demostración guardados en el navegador (por título) y recarga. */
async function seed(page: Page, patches: Record<string, Record<string, unknown>>) {
  await page.evaluate(
    (patches) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return resolve();
            const value = c.value as { games?: Record<string, unknown>[] };
            for (const g of value.games ?? []) Object.assign(g, patches[g.title as string] ?? {});
            c.update(value);
            c.continue();
          };
        };
      }),
    patches,
  );
}

const storyGames = (page: Page) => page.getByRole("list", { name: "Juegos de la saga" }).getByRole("link");

test("la pantalla Sagas enseña cada historia con el siguiente que toca", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  await openApp(page, "/");
  await page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Sagas" }).click();
  await expect(page).toHaveURL(/\/sagas$/);
  const sagas = page.getByRole("region", { name: "Sagas" });
  const row = sagas.getByRole("link", { name: /^Prueba/ });
  await expect(row).toContainText("2 juegos · 1 superados");
  // Sin elegir, se abre la primera. En el mapa, Celeste (2018) está superado y el siguiente es Hades (2020).
  const next = page.getByRole("list", { name: "Juegos de la saga" }).getByRole("listitem").filter({ hasText: "Siguiente" });
  await expect(next).toContainText("Hades");
});

test("cambiar el orden de la historia no toca el de lanzamiento", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  await openApp(page, "/sagas?saga=Prueba");
  const order = page.getByRole("radiogroup", { name: "Orden" });
  await order.getByRole("radio", { name: "Cronología" }).click();
  await expect(storyGames(page)).toHaveText([/Celeste/, /Hades/]);
  await page.getByRole("button", { name: "Bajar «Celeste»" }).click();
  await expect(storyGames(page)).toHaveText([/Hades/, /Celeste/]);
  await page.reload();
  await expect(order.getByRole("radio", { name: "Cronología" })).toHaveAttribute("aria-checked", "true");
  await expect(storyGames(page)).toHaveText([/Hades/, /Celeste/]);
  await order.getByRole("radio", { name: "Lanzamiento" }).click();
  await expect(storyGames(page)).toHaveText([/Celeste/, /Hades/]);
});

test("traer de IGDB rellena las historias vacías y no pisa las corregidas", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { igdbId: 101 }, Celeste: { igdbId: 102, saga: "Mi historia" }, "Hollow Knight": { igdbId: 103 } });
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, sagas: { "101": "Supergiant", "102": "Celeste", "103": "Supergiant" } } }));
  await openApp(page, "/sagas");
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  // IGDB propone y ella elige: aquí, todas.
  const review = page.getByRole("dialog", { name: /IGDB propone/ });
  await expect(review.getByRole("radiogroup", { name: "Supergiant" })).toBeVisible();
  await review.getByRole("button", { name: "Añadir 1 saga" }).click();
  await expect(review).toBeHidden();
  const sagas = page.getByRole("region", { name: "Sagas" });
  await expect(sagas.getByRole("link", { name: /^Supergiant/ })).toContainText("2 juegos");
  // Celeste conserva la historia que se le puso a mano.
  await expect(sagas.getByRole("link", { name: /^Celeste/ })).toHaveCount(0);
});

async function openGame(page: Page, title: string) {
  await openApp(page, "/biblioteca?agrupar=ninguno");
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

async function setStory(page: Page, title: string, story: string | null) {
  await openGame(page, title);
  const sheet = page.getByRole("region", { name: "Ficha técnica" });
  await sheet.getByRole("button", { name: /^Saga: / }).click();
  // Con historias ya puestas, el campo ofrece sugerencias (y se anuncia como combobox).
  const field = sheet.getByLabel("Saga", { exact: true });
  await field.fill(story ?? "");
  await field.press("Enter");
}

test("la ficha lleva a su historia con su puesto", async ({ page }) => {
  await loadDemo(page);
  await setStory(page, "Hades", "Prueba");
  await setStory(page, "Celeste", "Prueba");
  // Celeste (2018) va antes que Hades (2020).
  await page.getByRole("link", { name: "Saga: Prueba · 1 de 2" }).click();
  await expect(page).toHaveURL(/\/sagas\?saga=Prueba$/);
  await expect(page.getByRole("heading", { level: 2, name: "Prueba" })).toBeVisible();
});

test("vaciar la historia de un juego deja la historia fuera si se queda con uno", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" } });
  await setStory(page, "Hades", null);
  await expect(page.getByRole("link", { name: /^Saga: / })).toHaveCount(0);
  await openApp(page, "/sagas");
  await expect(page.getByRole("heading", { level: 2, name: "Tu primer mapa está por dibujar" })).toBeVisible();
});

test("cambiar el nombre de una historia lo cambia en todos sus juegos y une las que se llaman igual", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { saga: "Otra" }, Spiritfarer: { saga: "Otra" } });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Cambiar nombre" }).click();
  await page.getByRole("textbox", { name: "Nombre de la saga" }).fill("Otra");
  await page.getByRole("textbox", { name: "Nombre de la saga" }).press("Enter");
  await expect(page).toHaveURL(/saga=Otra$/);
  await expect(storyGames(page)).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Sagas" }).getByRole("link", { name: /^Prueba/ })).toHaveCount(0);
});

test("sin marca en IGDB, la historia sigue siendo la serie más concreta", () => {
  // Sin «franchise», la serie amplia no se toma por marca para descartarla.
  expect(seriesForIgdbGame({ collections: [{ name: "Star Wars Jedi", games: [1, 2] }, { name: "Star Wars", games: Array.from({ length: 40 }, (_, i) => i) }] })).toBe("Star Wars Jedi");
  expect(seriesForIgdbGame({ franchise: { name: "Star Wars" }, collections: [{ name: "Star Wars", games: [1] }] })).toBe("Star Wars");
  // Una edición sin serie propia toma la de su juego original.
  expect(seriesForIgdbGame({ version_parent: { collections: [{ name: "Tomb Raider", games: [1, 2] }] } })).toBe("Tomb Raider");
  expect(seriesForIgdbGame({ parent_game: { collections: [{ name: "Alan Wake", games: [1, 2] }] } })).toBe("Alan Wake");
  expect(seriesForIgdbGame({ collections: [{ name: "Propia", games: [1] }], version_parent: { collections: [{ name: "Original", games: [1] }] } })).toBe("Propia");
  expect(seriesForIgdbGame({ version_parent: {} })).toBeNull();
});

test("cambiar un juego de historia lo saca de su puesto: entra al final, sin inventar un orden", async ({ page }) => {
  await loadDemo(page);
  await seed(page, {
    Hades: { saga: "A", sagaOrder: 1 },
    Celeste: { saga: "A", sagaOrder: 2 },
    "Hollow Knight": { saga: "B" },
    Spiritfarer: { saga: "B" },
  });
  await setStory(page, "Hades", "B");
  await openApp(page, "/sagas?saga=B");
  await page.getByRole("radiogroup", { name: "Orden" }).getByRole("radio", { name: "Cronología" }).click();
  // B no tiene orden puesto: su historia es el lanzamiento (Hollow Knight 2017, Spiritfarer y Hades 2020).
  await expect(storyGames(page)).toHaveText([/Hollow Knight/, /Spiritfarer/, /Hades/]);
});

test("una historia quitada a mano no vuelve al traer de IGDB", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { igdbId: 101, saga: "Mala" }, Celeste: { igdbId: 102, saga: "Mala" } });
  await setStory(page, "Hades", null);
  await expect(page.getByRole("region", { name: "Ficha técnica" }).getByRole("button", { name: /^Saga: Sin saga/ })).toBeVisible();
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, sagas: { "101": "Mala", "102": "Mala" } } }));
  await openApp(page, "/sagas");
  await expect(page.getByRole("heading", { level: 2, name: "Tu primer mapa está por dibujar" })).toBeVisible();
  // Nada nuevo: Hades se dejó sin historia a propósito y Celeste ya la tiene. Se ofrece lo descartado, sin marcar.
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  const review = page.getByRole("dialog", { name: "Sagas que descartaste" });
  await expect(review.getByRole("radiogroup", { name: "Mala" }).getByRole("radio", { name: "No" })).toHaveAttribute("aria-checked", "true");
});

test("«Cambiar nombre» no se pasa a otra historia al cambiar de historia", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "A" }, Celeste: { saga: "A" }, "Hollow Knight": { saga: "B" }, Spiritfarer: { saga: "B" } });
  await openApp(page, "/sagas?saga=A");
  await page.getByRole("button", { name: "Cambiar nombre" }).click();
  await page.getByRole("region", { name: "Sagas" }).getByRole("link", { name: /^B/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "B" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nombre de la saga" })).toHaveCount(0);
});

test("mover un juego guarda la biblioteca una sola vez", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { saga: "Prueba" } });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("radiogroup", { name: "Orden" }).getByRole("radio", { name: "Cronología" }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __puts: number };
    w.__puts = 0;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      w.__puts++;
      return put.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Bajar «Hollow Knight»" }).click();
  await expect(storyGames(page)).toHaveText([/Celeste/, /Hollow Knight/, /Hades/]);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as unknown as { __puts: number }).__puts)).toBe(1);
});

test("colocar un juego en la cronología pone el puesto de todos", () => {
  const prequel = game("Jedi: precuela", { saga: "Jedi", releaseDate: "2015-01-01" });
  const [story] = buildStories([fallen, survivor, prequel]);
  // La precuela salió antes, pero aquí se coloca la última.
  expect(placeInStory(story, prequel.id, 2)).toEqual([
    { kind: "juego", id: fallen.id, sagaOrder: 1 },
    { kind: "juego", id: survivor.id, sagaOrder: 2 },
    { kind: "juego", id: prequel.id, sagaOrder: 3 },
  ]);
  expect(placeInStory(story, "no-existe", 0)).toEqual([]);
});

test("IGDB propone por historia los juegos que no tienen", () => {
  const hades = game("Hades", { igdbId: 1 });
  const hades2 = game("Hades II", { igdbId: 2 });
  const celeste = game("Celeste", { igdbId: 3, saga: "Mía" });
  const quitada = game("Quitada", { igdbId: 4, saga: "Sin saga" });
  const proposals = proposeStories([hades, hades2, celeste, quitada], { "1": "Hades", "2": "Hades", "3": "Celeste", "4": "Otra" });
  // Solo los que no tienen historia (ni la tienen quitada a propósito).
  expect(proposals.map((p) => [p.name, p.games.map((g) => g.title)])).toEqual([["Hades", ["Hades", "Hades II"]]]);
  // Y, si se piden, solo los descartados.
  expect(proposeStories([hades, hades2, celeste, quitada], { "1": "Hades", "4": "Otra" }, { discarded: true }).map((p) => p.name)).toEqual(["Otra"]);
});

test("en el ordenador, la cronología se ordena arrastrando", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba" }, Celeste: { saga: "Prueba" }, "Hollow Knight": { saga: "Prueba" } });
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("radiogroup", { name: "Orden" }).getByRole("radio", { name: "Cronología" }).click();
  await expect(storyGames(page)).toHaveText([/Hollow Knight/, /Celeste/, /Hades/]);
  const items = page.getByRole("list", { name: "Juegos de la saga" }).getByRole("listitem");
  await items.filter({ hasText: "Hades" }).dragTo(items.filter({ hasText: "Hollow Knight" }));
  await expect(storyGames(page)).toHaveText([/Hades/, /Hollow Knight/, /Celeste/]);
  await page.reload();
  await expect(storyGames(page)).toHaveText([/Hades/, /Hollow Knight/, /Celeste/]);
});

test("quitar una saga deja sus juegos, se puede deshacer y Traer la vuelve a proponer", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "Prueba", igdbId: 101 }, Celeste: { saga: "Prueba", igdbId: 102 }, "Hollow Knight": { saga: "Otra" }, Spiritfarer: { saga: "Otra" } });
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, sagas: { "101": "Prueba", "102": "Prueba" } } }));
  await openApp(page, "/sagas?saga=Prueba");
  await page.getByRole("button", { name: "Quitar saga" }).click();
  const alert = page.getByRole("region", { name: "Prueba" }).getByRole("alert");
  await expect(alert).toContainText("Sus 2 juegos se quedan en tu biblioteca");
  await expect(alert).toContainText("Traer de IGDB te la puede volver a proponer.");
  await page.getByRole("region", { name: "Prueba" }).getByRole("alert").getByRole("button", { name: "Quitar saga" }).click();
  const sagas = page.getByRole("region", { name: "Sagas" });
  await expect(sagas.getByRole("link", { name: /^Prueba/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(sagas.getByRole("link", { name: /^Prueba/ })).toBeVisible();
  // Quitada de verdad: sus juegos siguen en la biblioteca, sin saga, y Traer la vuelve a proponer, marcada.
  await page.getByRole("button", { name: "Quitar saga" }).click();
  await page.getByRole("region", { name: "Prueba" }).getByRole("alert").getByRole("button", { name: "Quitar saga" }).click();
  await expect(sagas.getByRole("link", { name: /^Prueba/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  const review = page.getByRole("dialog", { name: "IGDB propone 1 saga" });
  await expect(review.getByRole("radiogroup", { name: "Prueba" }).getByRole("radio", { name: "Añadir" })).toHaveAttribute("aria-checked", "true");
  await review.getByRole("button", { name: "Añadir 1 saga" }).click();
  await expect(sagas.getByRole("link", { name: /^Prueba/ })).toContainText("2 juegos");
});

test("lo que no se añade al traer de IGDB no se vuelve a proponer", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { igdbId: 101 }, Spiritfarer: { igdbId: 104 }, Celeste: { igdbId: 102 }, "Hollow Knight": { igdbId: 103 } });
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, sagas: { "101": "Supergiant", "104": "Supergiant", "102": "Montaña", "103": "Montaña" } } }));
  await openApp(page, "/sagas");
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  const review = page.getByRole("dialog", { name: "IGDB propone 2 sagas" });
  await review.getByRole("radiogroup", { name: "Montaña" }).getByRole("radio", { name: "No" }).click();
  await review.getByRole("button", { name: "Añadir 1 saga" }).click();
  const sagas = page.getByRole("region", { name: "Sagas" });
  await expect(sagas.getByRole("link", { name: /^Supergiant/ })).toBeVisible();
  await expect(sagas.getByRole("link", { name: /^Montaña/ })).toHaveCount(0);
  // Ya no hay nada nuevo: Traer ofrece lo descartado, sin marcar, por si cambias de idea.
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  const again = page.getByRole("dialog", { name: "Sagas que descartaste" });
  await expect(again.getByRole("radiogroup", { name: "Supergiant" })).toHaveCount(0);
  await expect(again.getByRole("button", { name: /^Añadir/ })).toBeDisabled();
  await again.getByRole("radiogroup", { name: "Montaña" }).getByRole("radio", { name: "Añadir" }).click();
  await again.getByRole("button", { name: "Añadir 1 saga" }).click();
  await expect(sagas.getByRole("link", { name: /^Montaña/ })).toContainText("2 juegos");
  await expect(sagas.getByRole("link", { name: /^Supergiant/ })).toContainText("2 juegos");
});

test("lo guardado en el navegador con el formato de antes se lee con su franquicia y su saga", async ({ page }) => {
  await loadDemo(page);
  // Formato 1: «saga» era la franquicia, «series» la saga y lo descartado, «Sin historia».
  await page.evaluate(
    (patches) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const req = store.get("data");
          req.onsuccess = () => {
            const value = req.result as { format?: number; games: Record<string, unknown>[] };
            delete value.format;
            for (const g of value.games) {
              const { franchise, saga, sagaOrder, ...rest } = g;
              void franchise;
              Object.keys(g).forEach((k) => delete g[k]);
              Object.assign(g, rest, { saga: null, series: saga, seriesOrder: sagaOrder }, patches[rest.title as string] ?? {});
            }
            store.put(value, "data").onsuccess = () => resolve();
          };
        };
      }),
    {
      Hades: { igdbId: 101, saga: "Supergiant", series: "Sin historia" },
      Celeste: { igdbId: 102, series: "Sin historia" },
      "Hollow Knight": { saga: "Team Cherry", series: "Hollow Knight", seriesOrder: 2 },
      Spiritfarer: { saga: "Sin saga", series: "Hollow Knight", seriesOrder: 1 },
    } as Record<string, Record<string, unknown>>,
  );
  await openGame(page, "Hades");
  const sheet = page.getByRole("region", { name: "Ficha técnica" });
  await expect(sheet.getByRole("button", { name: /^Franquicia: Supergiant/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Saga: Sin saga/ })).toBeVisible();
  // «Sin saga» como franquicia era no tenerla.
  await openGame(page, "Spiritfarer");
  await expect(sheet.getByRole("button", { name: "Franquicia: añadir" })).toBeVisible();
  await openApp(page, "/sagas?saga=Hollow%20Knight");
  await page.getByRole("radiogroup", { name: "Orden" }).getByRole("radio", { name: "Cronología" }).click();
  await expect(storyGames(page)).toHaveText([/Spiritfarer/, /Hollow Knight/]);
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, sagas: { "101": "Mala", "102": "Mala" } } }));
  await openApp(page, "/sagas");
  await page.getByRole("button", { name: "Traer sagas de IGDB" }).click();
  await expect(page.getByRole("dialog", { name: "Sagas que descartaste" }).getByRole("radiogroup", { name: "Mala" })).toBeVisible();
});

test("los enlaces de antes, con ?historia=, siguen abriendo su saga", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { saga: "A" }, Celeste: { saga: "A" }, "Hollow Knight": { saga: "B" }, Spiritfarer: { saga: "B" } });
  await openApp(page, "/sagas?historia=B");
  await expect(page.getByRole("heading", { level: 2, name: "B" })).toBeVisible();
});

test("la limpieza saca de las sagas que en IGDB son un solo juego, una sola vez", async ({ page }) => {
  await loadDemo(page);
  await seed(page, {
    Hades: { igdbId: 101, saga: "Hades" },
    Celeste: { igdbId: 102, saga: "Celeste", sagaOrder: 3 },
    "Hollow Knight": { igdbId: 103, saga: "Mi saga" },
    Spiritfarer: { igdbId: 104, saga: "Mi saga" },
  });
  let calls = 0;
  await page.route("**/api/catalogo/series", (route) => {
    calls++;
    return route.fulfill({
      json: { ok: true, sagas: { "101": "Hades", "102": "Montaña", "103": null, "104": null }, single: { "102": ["Celeste"], "103": [] } },
    });
  });
  await openApp(page, "/sagas");
  await expect(page.getByText("1 juego cambia de saga: la que tenía era solo ese juego y sus versiones.")).toBeVisible();
  // Hades sigue en la suya; «Mi saga» la puso ella y no se toca.
  await openGame(page, "Celeste");
  await expect(page.getByRole("region", { name: "Ficha técnica" }).getByRole("button", { name: /^Saga: Montaña/ })).toBeVisible();
  await openGame(page, "Hades");
  await expect(page.getByRole("region", { name: "Ficha técnica" }).getByRole("button", { name: /^Saga: Hades/ })).toBeVisible();
  await openGame(page, "Hollow Knight");
  await expect(page.getByRole("region", { name: "Ficha técnica" }).getByRole("button", { name: /^Saga: Mi saga/ })).toBeVisible();
  // Una vez hecha, no se repite.
  const before = calls;
  await openApp(page, "/sagas");
  await expect(page.getByRole("region", { name: "Sagas" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(calls).toBe(before);
});
