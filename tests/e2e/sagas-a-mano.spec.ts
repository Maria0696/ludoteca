import { type Page, expect, test } from "@playwright/test";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type SagaExtra, createGame, emptyLibrary } from "../../src/lib/model";
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
