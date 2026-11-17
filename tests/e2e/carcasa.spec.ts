import { type Locator, expect, test } from "@playwright/test";
import { expectCarcasaText, loadDemo, openApp } from "./helpers";

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

test("la barra superior: Ludoteca en píxeles y el destino actual en dorado", async ({ page }) => {
  await openApp(page, "/deseos");
  const nav = page.getByRole("navigation", { name: "Principal" }).first();
  const current = nav.getByRole("link", { name: "Deseos" });
  const [family, size] = await font(current);
  expect(family).toMatch(/VT323/i);
  expect(size).toBeGreaterThanOrEqual(18);
  expect(await current.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 215, 106)");
  const [brand] = await font(page.getByRole("link", { name: "Ludoteca, inicio" }));
  expect(brand).toMatch(/Press.Start.2P/i);
});

test("los avisos: letra de la carcasa y «Deshacer» visible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^(He jugado hoy|Retomar)$/ }).click();
  const toast = page.locator("[data-sonner-toast]").first();
  const undo = toast.getByRole("button", { name: "Deshacer" });
  await expect(undo).toBeVisible();
  const [family] = await font(toast);
  expect(family).toMatch(/VT323/i);
  // Con el teclado, «Deshacer» enseña el foco.
  await undo.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(undo).toBeFocused();
  expect(await undo.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
});

/** Contraste entre dos colores `rgb(...)` según WCAG. */
function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = c.match(/\d+/g)!.slice(0, 3).map((v) => {
      const s = Number(v) / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("en Mis listas, el número de juegos de la lista elegida se lee", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/listas");
  const current = page.locator('button[aria-current="true"]').first();
  const colors = await current.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector("small")!).color]);
  expect(contrast(colors[0], colors[1])).toBeGreaterThanOrEqual(4.5);
});

test("el estado se dice igual en toda la app: etiqueta arcade y nombre normal", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  // Cada propuesta es un <li> con el enlace «Ficha de …».
  const proposal = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Ficha de / }) }).first();
  await expect(proposal).toContainText("EN PARTIDA");
  await expect(proposal).toContainText("Jugando");
  await page.goto("/listas");
  await expect(page.getByText("PRESS START").first()).toBeVisible();
  // En una tarjeta estrecha, el nombre baja de línea antes que cortarse.
  const state = page.locator(".state").first();
  const overflow = await state.evaluate((el) => {
    const card = el.closest("li")!.getBoundingClientRect();
    return Math.max(...[...el.childNodes].map((n) => {
      const r = document.createRange();
      r.selectNodeContents(n);
      return r.getBoundingClientRect().right;
    })) - card.right;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test("un solo nombre para cada cosa: Estadísticas en el inicio y Récords en la biblioteca", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  const menu = page.getByRole("group", { name: "Menú principal" });
  await expect(menu.getByRole("button", { name: "Estadísticas", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Récords", exact: true })).toHaveCount(0);
  await page.goto("/biblioteca");
  await expect(page.getByRole("region", { name: "Récords de horas" }).getByRole("heading")).toHaveText("Récords · horas");
});

test("la utilidad de la carcasa detecta letra antigua y texto pequeño", async ({ page }) => {
  await openApp(page, "/estadisticas");
  // Estadísticas aún no está migrada (paso 3): su título usa Bricolage.
  await expect(expectCarcasaText(page.locator("main"))).rejects.toThrow(/Bricolage|Albert/);
});

test("Deseos en la carcasa: título en píxeles, una ventana y todo legible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/deseos");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Lista de deseos" }));
  expect(family).toMatch(/Press.Start.2P/i);
  const win = page.getByRole("region", { name: "Deseos" });
  expect(await win.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  const rowFrames = await win.getByRole("listitem").evaluateAll((els) => els.map((e) => getComputedStyle(e).boxShadow));
  for (const shadow of rowFrames) expect(shadow).toBe("none");
  await expectCarcasaText(page.locator("main"));
  // Editar y quitar dicen lo que hacen.
  await expect(page.getByRole("button", { name: "Editar Hollow Knight: Silksong" })).toHaveText("Editar");
  await expect(page.getByRole("button", { name: "Quitar Hollow Knight: Silksong de la lista" })).toHaveText("Quitar");
});

test("Deseos: un deseo sin carátula no enseña texto diminuto en la miniatura", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: "Añadir el primer deseo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Un juego con un título larguísimo que no tiene carátula todavía");
  await dialog.getByRole("button", { name: "Añadir deseo" }).click();
  await expect(dialog).toBeHidden();
  await expectCarcasaText(page.locator("main"));
});

test("la página que no existe se ve como una ventana de la carcasa", async ({ page }) => {
  await openApp(page, "/no-existe");
  const heading = page.getByRole("heading", { name: "Esta página no está en tu ludoteca" });
  const [family] = await font(heading);
  expect(family).toMatch(/Press.Start.2P/i);
});
