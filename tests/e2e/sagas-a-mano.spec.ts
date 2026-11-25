import { type Page, expect, test } from "@playwright/test";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Game, type SagaExtra, createGame, emptyLibrary } from "../../src/lib/model";
import { buildStories, missingFrom, orderStory, placeInStory, storyStops } from "../../src/lib/sagas";
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
  await openApp(page, "/sagas?historia=Prueba");
  const stops = page.getByRole("list", { name: "Juegos de la historia" }).getByRole("listitem");
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
