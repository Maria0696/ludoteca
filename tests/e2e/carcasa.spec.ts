import { type Locator, expect, test } from "@playwright/test";
import { addGame, cards, expectCarcasaText, loadDemo, openApp } from "./helpers";

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
  await expect(proposal).toContainText(/EN PARTIDA ·\s*Jugando/);
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
  // Contenido fijo: la prueba no depende de que quede alguna pantalla sin migrar.
  await page.setContent(`<main><p style="font-family: 'Albert Sans'">antigua</p><p style="font-family: VT323; font-size: 14px">pequeña</p></main>`);
  await expect(expectCarcasaText(page.locator("main"))).rejects.toThrow(/Albert[\s\S]*VT323 14px/);
});

test("Estadísticas en la carcasa: título en píxeles, una ventana por sección y todo legible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Estadísticas" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["En cifras", "Copias por plataforma", "Títulos por estado", "Formato de las copias", "Horas y gasto registrados"]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await expectCarcasaText(page.locator("main"));
});

test("Estadísticas: las cifras grandes no se parten ni se salen a ningún ancho", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Juego carísimo", platform: "PC", format: "Físico" });
  await cards(page).getByRole("link", { name: /Juego carísimo/ }).click();
  await page.getByRole("button", { name: /^Horas jugadas/ }).click();
  await page.getByLabel("Horas jugadas").fill("12345");
  await page.getByLabel("Horas jugadas").press("Enter");
  await page.getByRole("button", { name: /^Precio/ }).click();
  await page.getByLabel("Precio").fill("12345,67");
  await page.getByLabel("Precio").press("Enter");
  await expect(page.getByText("12.345,67 €").first()).toBeVisible();

  await page.goto("/estadisticas");
  const registro = page.getByRole("region", { name: "Horas y gasto registrados" });
  await expect(registro.getByText("12.345,67 €")).toBeVisible();
  for (const width of [390, 920, 1000, 1100, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Cada cifra en una sola línea y dentro de su celda.
    const cells = await page.locator("main dd").evaluateAll((els) =>
      els.map((e) => ({
        text: e.textContent,
        spill: e.scrollWidth - e.clientWidth,
        lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
      })),
    );
    for (const c of cells) {
      expect(c.spill, `«${c.text}» se sale a ${width}px`).toBeLessThanOrEqual(0);
      expect(c.lines, `«${c.text}» se parte a ${width}px`).toBe(1);
    }
  }
});

test("¿A qué juego? en la carcasa: sesión y propuestas en ventanas, con el arte detrás", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "¿A qué juego?" }));
  expect(family).toMatch(/Press.Start.2P/i);
  // Un form con nombre accesible tiene el rol «form»; la sección de resultados, «region».
  for (const box of [page.getByRole("form", { name: "Tu sesión" }), page.getByRole("region", { name: /^Mis propuestas/ })]) {
    expect(await box.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  const picks = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Ficha de / }) });
  for (const shadow of await picks.evaluateAll((els) => els.map((e) => getComputedStyle(e).boxShadow))) expect(shadow).toBe("none");
  await expect(picks.first().locator("img[aria-hidden]")).toHaveCount(1); // el arte difuminado se conserva
  await expectCarcasaText(page.locator("main"));
});

test("Ajustes en la carcasa: una ventana por ajuste y diálogos legibles", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Ajustes" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["Dónde se guardan tus datos", "Copia de seguridad", "Eliminar todos los juegos"]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await page.getByText(/Ver las \d+ obras/).click(); // créditos desplegados
  await expectCarcasaText(page.locator("main"));
  // Los avisos de eliminar todo, en la carcasa.
  await page.getByRole("button", { name: "Eliminar todos los juegos" }).click();
  const dialog = page.getByRole("dialog");
  await expectCarcasaText(dialog);
  await dialog.getByRole("button", { name: "Sí, continuar" }).click();
  await expectCarcasaText(dialog);
  await dialog.getByText("Entiendo que mis juegos se borrarán para siempre").click();
  await dialog.getByRole("button", { name: "Continuar" }).click();
  await expect(dialog.getByRole("textbox")).toBeVisible();
  await expectCarcasaText(dialog);
  // En el móvil el último aviso es una hoja a lo ancho: nada se sale de ella.
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  for (const s of await dialog.getByRole("button").evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth))) expect(s).toBeLessThanOrEqual(0);
});

test("el texto suelto de los diálogos está en la carcasa", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Retirar datos de demostración" }).click();
  await expectCarcasaText(page.getByRole("dialog"));
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
  // En el diálogo de editar, quitar un precio también dice lo que hace.
  await page.getByRole("button", { name: "Editar Hollow Knight: Silksong" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Quitar el precio de/ }).first()).toHaveText("Quitar");
  await page.keyboard.press("Escape");
  // Sus diálogos también están en la carcasa.
  for (const open of [/^Precio$/, "Ya lo tengo", "Editar Hollow Knight: Silksong"]) {
    await page.getByRole("button", { name: open }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectCarcasaText(dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
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

test("Mis listas en la carcasa: dos ventanas, tarjetas legibles y foco visible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/listas");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Mis listas" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["Tus listas", /^Lista /]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await expectCarcasaText(page.locator("main"));
  // Con el teclado, el foco se ve también en la lista elegida (papel).
  const current = page.locator('button[aria-current="true"]').first();
  await current.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(current).toBeFocused();
  expect(await current.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  // La tarjeta no recorta su marco ni el contorno del foco.
  expect(await page.locator("main li").filter({ has: page.getByRole("link") }).first().evaluate((el) => getComputedStyle(el).contentVisibility)).not.toBe("auto");
  // El diálogo de añadir juegos a la lista, también.
  await page.getByRole("button", { name: "Añadir juegos" }).click();
  await expectCarcasaText(page.getByRole("dialog"));
  await page.keyboard.press("Escape");

  // El error al crear una lista sin nombre, en la carcasa y en rojo.
  await page.getByRole("button", { name: "Crear" }).click();
  const error = page.getByText("Ponle un nombre a la lista.");
  await expect(error).toBeVisible();
  expect(await error.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(255, 107, 107)");
  await expectCarcasaText(page.locator("main"));

  // Una lista vacía: su aviso no lleva un segundo marco dentro de la ventana.
  await page.getByLabel("Nombre de la nueva lista").fill("Vacía");
  await page.getByRole("button", { name: "Crear" }).click();
  const empty = page.getByRole("heading", { name: "Lista vacía" }).locator("..");
  expect(await empty.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
});

test("la página que no existe se ve como una ventana de la carcasa", async ({ page }) => {
  await openApp(page, "/no-existe");
  const heading = page.getByRole("heading", { name: "Esta página no está en tu ludoteca" });
  const [family] = await font(heading);
  expect(family).toMatch(/Press.Start.2P/i);
});
