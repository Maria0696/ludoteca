import { type Page, expect, test } from "@playwright/test";
import { type Game, createGame, gameSchema } from "../../src/lib/model";
import { pickSeries } from "../../src/lib/igdb-maps";
import { buildStories, groupByBrand, moveInStory, nextInStory, orderStory } from "../../src/lib/sagas";
import { loadDemo, openApp } from "./helpers";

/* Sagas: los juegos de cada historia, en orden de lanzamiento o en el de la historia (puesto a mano). */

const game = (title: string, patch: Partial<Game>): Game => ({ ...createGame({ title }), ...patch });
const titles = (games: Game[]) => games.map((g) => g.title);

test("las historias reúnen dos o más juegos y la marca «Sin saga» no cuenta", () => {
  const stories = buildStories([
    game("Jedi: Fallen Order", { series: "Star Wars Jedi", saga: "Star Wars" }),
    game("Jedi: Survivor", { series: "Star Wars Jedi", saga: "Star Wars" }),
    game("KOTOR", { series: "Star Wars: KOTOR", saga: "Star Wars" }),
    game("Half-Life", { series: "Half-Life", saga: "Sin saga" }),
    game("Half-Life 2", { series: "Half-Life", saga: "Sin saga" }),
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

const fallen = game("Jedi: Fallen Order", { series: "Jedi", releaseDate: "2019-11-15" });
const survivor = game("Jedi: Survivor", { series: "Jedi", releaseDate: "2023-04-28" });

test("orden de lanzamiento y orden de la historia", () => {
  const [story] = buildStories([survivor, fallen]);
  expect(titles(orderStory(story, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  // Sin orden puesto, la historia es el lanzamiento.
  expect(titles(orderStory(story, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  const [ordered] = buildStories([{ ...survivor, seriesOrder: 1 }, { ...fallen, seriesOrder: 2 }]);
  expect(titles(orderStory(ordered, "historia"))).toEqual(["Jedi: Survivor", "Jedi: Fallen Order"]);
  expect(titles(orderStory(ordered, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
});

test("mover un juego guarda el orden de todos; uno nuevo va al final", () => {
  const [story] = buildStories([fallen, survivor]);
  expect(moveInStory(story, survivor.id, -1)).toEqual([
    { id: survivor.id, seriesOrder: 1 },
    { id: fallen.id, seriesOrder: 2 },
  ]);
  expect(moveInStory(story, fallen.id, -1)).toEqual([]);
  // Uno que entra sin puesto va al final de la historia, aunque saliera antes.
  const prequel = game("Jedi: precuela", { series: "Jedi", releaseDate: "2015-01-01" });
  const [grown] = buildStories([{ ...fallen, seriesOrder: 1 }, { ...survivor, seriesOrder: 2 }, prequel]);
  expect(titles(orderStory(grown, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor", "Jedi: precuela"]);
});

test("el siguiente es el primero sin superar ni abandonar", () => {
  const done = game("Uno", { status: "completado", finishedAt: "2024-01-01" });
  const dropped = game("Dos", { status: "abandonado" });
  const waiting = game("Tres", { status: "pendiente" });
  expect(nextInStory([done, dropped, waiting])?.title).toBe("Tres");
  expect(nextInStory([done])).toBeNull();
});

test("una copia antigua, sin historia, se sigue leyendo", () => {
  const { series, seriesOrder, ...old } = game("Viejo", {});
  void series;
  void seriesOrder;
  const parsed = gameSchema.parse(old);
  expect(parsed.series ?? null).toBeNull();
  expect(parsed.seriesOrder ?? null).toBeNull();
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

const storyGames = (page: Page) => page.getByRole("list", { name: "Juegos de la historia" }).getByRole("link");

test("la pantalla Sagas enseña cada historia con el siguiente que toca", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
  await openApp(page, "/");
  await page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Sagas" }).click();
  await expect(page).toHaveURL(/\/sagas$/);
  const sagas = page.getByRole("region", { name: "Sagas" });
  const row = sagas.getByRole("link", { name: /^Prueba/ });
  await expect(row).toContainText("2 juegos");
  // Celeste (2018) está superado: el siguiente es Hades (2020).
  await expect(row).toContainText("Siguiente: Hades");
});

test("cambiar el orden de la historia no toca el de lanzamiento", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
  await openApp(page, "/sagas?historia=Prueba");
  const order = page.getByRole("radiogroup", { name: "Orden" });
  await order.getByRole("radio", { name: "Historia" }).click();
  await expect(storyGames(page)).toHaveText([/Celeste/, /Hades/]);
  await page.getByRole("button", { name: "Bajar «Celeste»" }).click();
  await expect(storyGames(page)).toHaveText([/Hades/, /Celeste/]);
  await page.reload();
  await expect(order.getByRole("radio", { name: "Historia" })).toHaveAttribute("aria-checked", "true");
  await expect(storyGames(page)).toHaveText([/Hades/, /Celeste/]);
  await order.getByRole("radio", { name: "Lanzamiento" }).click();
  await expect(storyGames(page)).toHaveText([/Celeste/, /Hades/]);
});

test("traer de IGDB rellena las historias vacías y no pisa las corregidas", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { igdbId: 101 }, Celeste: { igdbId: 102, series: "Mi historia" }, "Hollow Knight": { igdbId: 103 } });
  await page.route("**/api/catalogo/series", (route) => route.fulfill({ json: { ok: true, series: { "101": "Supergiant", "102": "Celeste", "103": "Supergiant" } } }));
  await openApp(page, "/sagas");
  await page.getByRole("button", { name: "Traer historias de IGDB" }).click();
  await expect(page.getByText("2 historias rellenadas")).toBeVisible();
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
  await sheet.getByRole("button", { name: /^Historia: / }).click();
  // Con historias ya puestas, el campo ofrece sugerencias (y se anuncia como combobox).
  const field = sheet.getByLabel("Historia", { exact: true });
  await field.fill(story ?? "");
  await field.press("Enter");
}

test("la ficha lleva a su historia con su puesto", async ({ page }) => {
  await loadDemo(page);
  await setStory(page, "Hades", "Prueba");
  await setStory(page, "Celeste", "Prueba");
  // Celeste (2018) va antes que Hades (2020).
  await page.getByRole("link", { name: "Historia: Prueba · 1 de 2" }).click();
  await expect(page).toHaveURL(/\/sagas\?historia=Prueba$/);
  await expect(page.getByRole("heading", { level: 2, name: "Prueba" })).toBeVisible();
});

test("vaciar la historia de un juego deja la historia fuera si se queda con uno", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" } });
  await setStory(page, "Hades", null);
  await expect(page.getByRole("link", { name: /^Historia: / })).toHaveCount(0);
  await openApp(page, "/sagas");
  await expect(page.getByRole("heading", { level: 2, name: "Aún no hay historias" })).toBeVisible();
});

test("cambiar el nombre de una historia lo cambia en todos sus juegos y une las que se llaman igual", async ({ page }) => {
  await loadDemo(page);
  await seed(page, { Hades: { series: "Prueba" }, Celeste: { series: "Prueba" }, "Hollow Knight": { series: "Otra" }, Spiritfarer: { series: "Otra" } });
  await openApp(page, "/sagas?historia=Prueba");
  await page.getByRole("button", { name: "Cambiar nombre" }).click();
  await page.getByRole("textbox", { name: "Nombre de la historia" }).fill("Otra");
  await page.getByRole("textbox", { name: "Nombre de la historia" }).press("Enter");
  await expect(page).toHaveURL(/historia=Otra$/);
  await expect(storyGames(page)).toHaveCount(4);
  await expect(page.getByRole("region", { name: "Sagas" }).getByRole("link", { name: /^Prueba/ })).toHaveCount(0);
});
