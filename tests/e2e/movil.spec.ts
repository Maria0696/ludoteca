import { expect, test } from "@playwright/test";
import { cards, loadDemo } from "./helpers";

test("en el móvil se navega con la barra inferior y se añade desde la hoja", async ({ page }) => {
  await loadDemo(page);
  const nav = page.getByRole("navigation", { name: "Principal" }).last();
  await nav.getByRole("link", { name: "Jugar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "¿A qué juego?" })).toBeVisible();
  await nav.getByRole("link", { name: "Biblioteca" }).click();
  await expect(cards(page).first()).toBeVisible();

  // Nada desborda horizontalmente.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Filtros y orden en la hoja inferior.
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const sheet = page.getByRole("dialog", { name: "Ordenar y filtrar" });
  await sheet.getByRole("button", { name: "Jugando" }).click();
  await sheet.getByRole("button", { name: /^Ver \d+ juegos?$/ }).click();
  for (const text of await cards(page).allInnerTexts()) expect(text).toContain("Jugando");

  // Alta rápida con el botón de la barra superior.
  await page.getByRole("button", { name: "Añadir juego" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").fill("Tetris Effect");
  await dialog.getByLabel("Plataforma").selectOption("PS5");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(page.getByText("«Tetris Effect» añadido a tu biblioteca")).toBeVisible();

  // Objetivos táctiles de al menos 44 px en la barra inferior.
  const heights = await nav.getByRole("link").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});
