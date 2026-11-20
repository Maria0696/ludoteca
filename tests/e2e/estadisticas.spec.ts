import { expect, test } from "@playwright/test";
import { loadDemo } from "./helpers";

/* Estadísticas: lo que cuenta cada sección, con los datos de demostración. */

test("el marcador y tu estantería cuentan la colección entera", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const board = page.getByRole("region", { name: "Marcador" });
  const value = (label: string) => board.locator("dt", { hasText: new RegExp(`^${label}`) }).locator("xpath=following-sibling::dd[1]");
  await expect(value("Títulos")).toHaveText("22");
  await expect(value("Copias")).toHaveText("24");
  await expect(value("Por jugar")).toHaveText("8");
  await expect(board.locator("dt", { hasText: /^Superados en \d{4}$/ })).toBeVisible();

  // Un cuadro por juego, del color de su estado, y cada estado lleva a la biblioteca filtrada.
  const shelf = page.getByRole("region", { name: "Tu estantería" });
  const waffle = shelf.getByRole("img", { name: /^22 juegos:/ });
  await expect(waffle.locator("i")).toHaveCount(22);
  await expect(waffle).toHaveAttribute("aria-label", /8 pendientes/);
  await expect(shelf.getByRole("link", { name: /^Pendiente 8$/ })).toHaveAttribute("href", "/biblioteca?estado=pendiente&agrupar=ninguno");
});

test("superados mes a mes, con el último que terminaste", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const months = page.getByRole("region", { name: "Superados mes a mes" });
  await expect(months.getByRole("img", { name: /^Juegos superados cada mes de \d{4}:/ }).locator("[data-month]")).toHaveCount(12);
  // Los números de las columnas suman los superados del marcador.
  const total = Number(await page.getByRole("region", { name: "Marcador" }).locator("dt", { hasText: /^Superados en/ }).locator("xpath=following-sibling::dd[1]").textContent());
  const counts = await months.locator("[data-month]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-count"))));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(total);
});

test("joyas por jugar: los pendientes con mejor nota, con enlace a su ficha", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const gems = page.getByRole("region", { name: "Joyas por jugar" }).getByRole("listitem");
  await expect(gems).toHaveCount(6);
  await expect(gems.first()).toContainText("Baldur's Gate 3");
  await expect(gems.first()).toContainText("96");
  const scores = await gems.evaluateAll((els) => els.map((e) => Number(e.querySelector("[data-score]")?.textContent)));
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  await gems.first().getByRole("link", { name: "Baldur's Gate 3" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Baldur's Gate 3" })).toBeVisible();
});

test("de dónde vienen, géneros, nota y año de salida", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  // Las familias de plataforma, como en la biblioteca, y el PC desglosado por tienda.
  const families = page.getByRole("region", { name: "De dónde vienen" });
  await expect(families.locator("dt")).toHaveText(["PC", "PlayStation", "Nintendo"]);
  await expect(families.locator("dd[data-count]")).toHaveText(["6", "8", "10"]);
  await expect(families).toContainText("Steam 4 · GOG 1");
  await expect(families).toContainText("PS5 6 · PS4 2");

  // Géneros como clasificación: con puesto y enlace a la biblioteca filtrada.
  const genres = page.getByRole("region", { name: "Géneros" }).getByRole("listitem");
  await expect(genres.first()).toContainText(/1º\s*Aventura\s*5/);
  await expect(genres.first().getByRole("link", { name: "Aventura" })).toHaveAttribute("href", "/biblioteca?genero=Aventura");

  await expect(page.getByRole("region", { name: "Nota en Metacritic" })).toContainText(/Media \d+(,\d)? en 22 juegos con nota/);
  await expect(page.getByRole("region", { name: "Año de salida" })).toContainText("El más antiguo: Stardew Valley (2016).");

  // Las horas y el gasto, que casi nunca están completos, en una línea que dice cuántos tienen el dato.
  const noted = page.locator("p", { hasText: /^Lo anotado a mano:/ });
  await expect(noted).toBeVisible();
  await expect(noted).toContainText(/h jugadas en \d+ juegos/);
  await expect(noted).toContainText(/en \d+ copias compradas con precio/);
});
