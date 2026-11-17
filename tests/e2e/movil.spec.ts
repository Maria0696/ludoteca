import { expect, test } from "@playwright/test";
import { cards, choosePlatform, loadDemo } from "./helpers";

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
  // A menos de 16 px el iPhone hace zoom al tocar el campo.
  expect(await dialog.getByLabel("Título").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  await dialog.getByLabel("Título").fill("Tetris Effect");
  await choosePlatform(dialog, "PS5");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByRole("heading", { name: "¡Has conseguido Tetris Effect!" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar" }).click();

  // Objetivos táctiles de al menos 44 px en la barra inferior.
  const heights = await nav.getByRole("link").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);

  // En un móvil estrecho, la barra inferior cabe y su letra se lee.
  await page.setViewportSize({ width: 360, height: 780 });
  const sizes = await nav.getByRole("link").evaluateAll((els) => els.map((e) => [parseFloat(getComputedStyle(e).fontSize), getComputedStyle(e).fontFamily] as const));
  for (const [size, family] of sizes) {
    expect(size).toBeGreaterThanOrEqual(18);
    expect(family).toMatch(/VT323/i);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // Cada nombre cabe en su columna, sin invadir la de al lado.
  const spill = await nav.getByRole("link").evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
  for (const s of spill) expect(s).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 412, height: 915 });

  // El menú del inicio cabe en el móvil y cambia de apartado al tocarlo.
  await nav.getByRole("link", { name: "Inicio" }).click();
  await expect(page.getByRole("heading", { name: "Partidas guardadas" })).toBeVisible();
  await page.getByRole("group", { name: "Menú principal" }).getByRole("button", { name: "Estadísticas" }).click();
  await expect(page.getByRole("heading", { name: "Tu colección" })).toBeVisible();
  const overflowInicio = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflowInicio).toBeLessThanOrEqual(0);
});
