import { type Locator, expect, test } from "@playwright/test";
import { openApp } from "./helpers";

const font = (l: Locator) => l.evaluate((el) => [getComputedStyle(el).fontFamily, parseFloat(getComputedStyle(el).fontSize)] as const);

/* La carcasa común de «una sola máquina»: ventanas de píxeles para toda la app. */

test("la carcasa común: fondo morado oscuro y las dos letras cargadas", async ({ page }) => {
  await openApp(page, "/estadisticas");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(26, 21, 38)");
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return [s.getPropertyValue("--font-pixel"), s.getPropertyValue("--font-term")];
  });
  expect(vars[0]).toMatch(/Press.Start.2P/i);
  expect(vars[1]).toMatch(/VT323/i);
});

test("las piezas comunes: diálogo, botones y campos en la carcasa", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: "Añadir el primer deseo" }).click();
  const dialog = page.getByRole("dialog", { name: "Añadir a la lista de deseos" });
  const [titleFont] = await font(dialog.getByRole("heading").first());
  expect(titleFont).toMatch(/Press.Start.2P/i);
  const submit = dialog.getByRole("button", { name: "Añadir deseo" });
  for (const control of [dialog.getByLabel("Título"), submit]) {
    const [family, size] = await font(control);
    expect(family).toMatch(/VT323/i);
    expect(size).toBeGreaterThanOrEqual(18);
  }
  // El foco de teclado se ve también sobre el botón dorado.
  await submit.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(submit).toBeFocused();
  const outline = await submit.evaluate((el) => [getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineColor]);
  expect(outline).toEqual(["solid", "rgb(255, 255, 255)"]);
});

test("la página que no existe se ve como una ventana de la carcasa", async ({ page }) => {
  await openApp(page, "/no-existe");
  const heading = page.getByRole("heading", { name: "Esta página no está en tu ludoteca" });
  const [family] = await font(heading);
  expect(family).toMatch(/Press.Start.2P/i);
});
