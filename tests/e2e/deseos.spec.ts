import { type Page, expect, test } from "@playwright/test";
import { type WishItem, createGame } from "../../src/lib/model";
import { openApp } from "./helpers";

/* La lista de deseos: un mismo juego deseado en varias plataformas sale en una sola tarjeta, con una fila por plataforma. */

const stamp = "2026-11-27T10:00:00.000Z";
const wish = (patch: Partial<WishItem>): WishItem => ({
  id: crypto.randomUUID(),
  title: "",
  coverUrl: null,
  igdbId: null,
  platform: null,
  priority: "media",
  targetPrice: null,
  notes: null,
  genres: [],
  prices: [],
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});

/** Una biblioteca con un juego y estos deseos, escrita directamente en el navegador. */
async function withWishes(page: Page, wishes: WishItem[]) {
  await page.goto("/offline.html");
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("library");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("library", "readwrite");
          tx.objectStore("library").put(value, "data");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { games: [createGame({ title: "Tunic" })], copies: [], wishlist: wishes, extras: [], wraps: [], format: 2 },
  );
}

/** Las tarjetas de la lista (sin contar las filas de dentro). */
const cards = (page: Page) => page.locator("section[aria-label='Deseos'] > ul > li");

test("un juego deseado en varias plataformas sale en una sola tarjeta, con una fila por plataforma y su precio", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-27T12:00:00"));
  await withWishes(page, [
    wish({ title: "007 First Light", platform: "PS5", igdbId: 999 }),
    // Mismo juego (mismo de IGDB) aunque el título se escriba distinto.
    wish({ title: "007: First Light", platform: "PC", igdbId: 999, prices: [{ id: "p", amount: 34.99, regular: 69.98, until: null, store: "Steam", date: "2026-11-27" }] }),
    wish({ title: "Hades II", platform: "Switch" }),
  ]);
  await openApp(page, "/deseos");
  // La cabecera cuenta juegos, no entradas.
  await expect(page.getByText("2 juegos", { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(2);

  const card = cards(page).filter({ hasText: "First Light" });
  const rows = card.getByRole("list", { name: "Plataformas de 007 First Light" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "PC" })).toContainText("34,99");
  await expect(rows.filter({ hasText: "PC" })).toContainText("−50 %");
  await expect(rows.filter({ hasText: "PS5" })).toContainText("sin precio visto");
  // Cada plataforma, con sus botones.
  await expect(card.getByRole("button", { name: "Ya lo tengo" })).toHaveCount(2);
  await expect(card.getByRole("button", { name: "Quitar 007 First Light (PS5) de la lista" })).toBeVisible();

  // Con el filtro de plataforma, solo la fila de esa plataforma.
  await page.getByRole("combobox").filter({ hasText: "Todas las plataformas" }).selectOption("PC");
  await expect(cards(page)).toHaveCount(1);
  await expect(card.getByRole("button", { name: "Ya lo tengo" })).toHaveCount(1);
  await page.getByRole("combobox").filter({ hasText: "PC" }).first().selectOption("");

  // Si queda una sola plataforma, la tarjeta vuelve a ser la de siempre.
  await card.getByRole("button", { name: "Quitar 007 First Light (PS5) de la lista" }).click();
  await expect(card.getByRole("list", { name: /^Plataformas de/ })).toHaveCount(0);
  await expect(card).toContainText("34,99");
});
