import { expect, test } from "@playwright/test";
import { cards, choosePlatform, expectCarcasaText, loadDemo } from "./helpers";

const LONG_TITLE = "Un juego con un título larguísimo que no tiene carátula todavía";

test("Estadísticas, ¿A qué juego? y Ajustes caben en el móvil", async ({ page }) => {
  await loadDemo(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await page.goto("/estadisticas");
  await expect(page.getByRole("region", { name: "En cifras" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  // Las cifras grandes caben en su celda.
  const spill = await page.getByRole("region", { name: "En cifras" }).locator("dd").evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
  for (const s of spill) expect(s).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));

  await page.goto("/que-juego");
  await expect(page.getByRole("heading", { name: /^Mis propuestas/ })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});

test("Deseos y Mis listas caben en el móvil", async ({ page }) => {
  await loadDemo(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await page.goto("/deseos");
  await page.getByRole("button", { name: "Añadir deseo" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(LONG_TITLE);
  // Una nota con una dirección larga, sin espacios, no puede salirse de la ventana.
  await dialog.getByLabel("Notas").fill("https://www.ejemplo-de-tienda.es/ofertas/videojuegos/un-juego-con-un-titulo-larguisimo");
  await dialog.getByRole("button", { name: "Añadir deseo" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: LONG_TITLE })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
  // Las acciones de cada deseo se tocan con el pulgar: 44 px de alto.
  const actionHeights = await page.getByRole("region", { name: "Deseos" }).getByRole("button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of actionHeights) expect(h).toBeGreaterThanOrEqual(44);

  // Mis listas: dos tarjetas por fila, como en el resto de rejillas del móvil.
  await page.goto("/listas");
  const tops = await page.locator("main li").filter({ has: page.getByRole("link") }).evaluateAll((els) => els.slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops[0]).toBe(tops[1]);

  // Nombres largos: la fila de listas se desplaza sin desbordar la página y cada nombre se parte en líneas.
  for (const name of ["Para jugar con mi pareja los domingos por la tarde", "Pendientes de terminar antes del verano", "Regalos que me gustaría recibir"]) {
    await page.getByLabel("Nombre de la nueva lista").fill(name);
    await page.getByRole("button", { name: "Crear" }).click();
  }
  const lists = page.getByRole("list", { name: "Listas" });
  await expect(lists.getByRole("button")).toHaveCount(6);
  expect(await overflow()).toBeLessThanOrEqual(0);
  expect(await lists.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const longest = lists.getByRole("button", { name: /domingos por la tarde/ });
  expect(await longest.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(270);
  expect(await longest.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});

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
