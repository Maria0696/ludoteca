import { expect, test } from "@playwright/test";
import { addGame, cards, choosePlatform, expectCarcasaText, loadDemo, openApp } from "./helpers";

const LONG_TITLE = "Un juego con un título larguísimo que no tiene carátula todavía";

test("la bienvenida de una biblioteca vacía cabe en el móvil y se toca con el pulgar", async ({ page }) => {
  await openApp(page, "/");
  const welcome = page.getByRole("region", { name: "Bienvenida a tu ludoteca" });
  for (const width of [390, 360]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `se sale a ${width}px`).toBeLessThanOrEqual(0);
    const box = await welcome.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    // Nada de dentro se sale de la ventana, ni queda tapado por la barra superior.
    const spill = await welcome.evaluate((el) => {
      const right = el.getBoundingClientRect().right;
      return Math.max(...[...el.querySelectorAll("*")].map((c) => c.getBoundingClientRect().right - right));
    });
    expect(spill, `algo se sale de la ventana a ${width}px`).toBeLessThanOrEqual(0);
    const barBottom = (await page.locator("header").first().boundingBox())!;
    expect(box!.y, `la ventana queda bajo la barra a ${width}px`).toBeGreaterThanOrEqual(barBottom.y + barBottom.height);
    await expectCarcasaText(page.locator("main"));
    for (const name of ["Añadir el primer juego", "Probar con datos de demostración"]) {
      const button = welcome.getByRole("button", { name });
      await expect(button).toBeInViewport();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("Estadísticas, ¿A qué juego? y Ajustes caben en el móvil", async ({ page }) => {
  await loadDemo(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  await page.goto("/estadisticas");
  await expect(page.getByRole("region", { name: "Marcador" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  // Las cifras grandes caben en su celda.
  const spill = await page.getByRole("region", { name: "Marcador" }).locator("dd").evaluateAll((els) => els.map((e) => e.scrollWidth - e.clientWidth));
  for (const s of spill) expect(s).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));

  await page.goto("/que-juego");
  await expect(page.getByRole("heading", { name: /^Mis propuestas/ })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));

  await page.goto("/ajustes");
  await expect(page.getByRole("heading", { level: 1, name: "Ajustes" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});

test("Deseos cabe en el móvil", async ({ page }) => {
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

test("¿A qué juego? en el móvil: las propuestas primero y la sesión en una hoja", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  const results = page.getByRole("region", { name: /^Mis propuestas/ });
  // La primera propuesta se ve sin bajar: la respuesta va antes que las preguntas.
  await expect(results.getByRole("heading", { level: 3 }).first()).toBeInViewport();
  await expect(page.getByRole("form", { name: "Tu sesión" })).toBeHidden();
  // La sesión, resumida en una línea, con «Ajustar».
  const summary = results.getByText("1 h · Cualquier plataforma · Sola");
  await expect(summary).toBeVisible();
  await results.getByRole("button", { name: "Ajustar la sesión" }).click();
  const sheet = page.getByRole("dialog", { name: "Tu sesión" });
  await expect(sheet).toBeVisible();
  await expectCarcasaText(sheet);
  await sheet.getByRole("combobox", { name: "Compañía", exact: true }).selectOption({ label: "Acompañada" });
  // El valor más largo cabe entre las flechas sin cortarse.
  const mood = sheet.getByRole("combobox", { name: "Experiencia", exact: true });
  await mood.selectOption({ label: "Partida rápida" });
  const room = await mood.evaluate((el) => {
    const select = el as HTMLSelectElement;
    const s = getComputedStyle(select);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${s.fontSize} ${s.fontFamily}`;
    return select.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - ctx.measureText(select.options[select.selectedIndex].text).width;
  });
  expect(room).toBeGreaterThanOrEqual(0);
  await mood.selectOption({ label: "Cualquiera" });
  // Las flechas, a un toque del pulgar: de «1 h» a «2 h».
  const next = sheet.getByRole("button", { name: "Tiempo: siguiente" });
  expect((await next.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  await next.click();
  await sheet.getByRole("button", { name: /^Ver \d+ propuestas?$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(results.getByText("2 h · Cualquier plataforma · Acompañada")).toBeVisible();
  await expect(results.getByText("Se puede jugar acompañada.").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});

/** Que se vea entero y que la barra inferior no lo tape. */
async function expectReachable(page: import("@playwright/test").Page, target: import("@playwright/test").Locator, what: string) {
  await expect(target, `${what}: a la vista`).toBeInViewport({ ratio: 1 });
  const nav = (await page.getByRole("navigation", { name: "Principal" }).last().boundingBox())!;
  const box = (await target.boundingBox())!;
  expect(box.y + box.height, `${what}: por encima de la barra inferior`).toBeLessThanOrEqual(nav.y);
}

test("en el móvil, lo frecuente queda al alcance del pulgar sin bajar", async ({ page }) => {
  await loadDemo(page);
  // Un texto que no cabe en su botón se parte o se corta: ni lo uno ni lo otro.
  const fits = async (target: import("@playwright/test").Locator, what: string) => {
    const [w, h] = await target.evaluate((el) => [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight]);
    expect(w, `${what}: el texto cabe a lo ancho`).toBeLessThanOrEqual(0);
    expect(h, `${what}: el texto cabe a lo alto`).toBeLessThanOrEqual(0);
  };
  for (const [width, height] of [[390, 844], [360, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const played = page.getByRole("button", { name: "He jugado hoy" });
    await expectReachable(page, played, `Inicio a ${width}px, «He jugado hoy»`);
    await fits(played, `Inicio a ${width}px, «He jugado hoy»`);
    await fits(page.getByRole("link", { name: "Ver ficha" }), `Inicio a ${width}px, «Ver ficha»`);
    // Al recorrer las partidas, las acciones siguen a mano.
    await page.getByRole("group", { name: "Partidas guardadas" }).getByRole("button").last().click();
    await expectReachable(page, page.getByRole("button", { name: /^(He jugado hoy|Retomar)$/ }), `Inicio a ${width}px, acción de la partida elegida`);

    await page.goto("/biblioteca");
    await cards(page).getByRole("link", { name: /Hades/ }).first().click();
    // Los cinco estados a la vista, sin desplazar la fila, y del tamaño de un dedo.
    for (const radio of await page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio").all()) {
      await expectReachable(page, radio, `Ficha a ${width}px, estado «${await radio.textContent()}»`);
      expect((await radio.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expectReachable(page, page.getByRole("button", { name: /Inserta moneda/ }), `Ficha a ${width}px, «Inserta moneda»`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});

test("el cofre cabe en el móvil con una plataforma de nombre largo", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /^Otra/ }).click();
  await dialog.getByRole("textbox").last().fill("Plataforma de recreativa de los noventa");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await expectCarcasaText(dialog);
});

test("tras añadir, los botones de la escena del cofre caben en el móvil", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Un juego con un título larguísimo para ver la escena");
  await choosePlatform(dialog, "Switch");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  for (const name of ["Apuntar detalles", "Añadir otro"]) {
    const button = dialog.getByRole("button", { name });
    await expect(button).toBeVisible();
    const [w, h] = await button.evaluate((el) => [el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight]);
    expect(w, `${name}: cabe a lo ancho`).toBeLessThanOrEqual(0);
    expect(h, `${name}: cabe a lo alto`).toBeLessThanOrEqual(0);
  }
});

test("en un móvil estrecho, «Añadir a la biblioteca» va en una sola línea", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const go = page.getByRole("dialog").getByRole("button", { name: "Añadir a la biblioteca" });
  const lines = await go.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  });
  expect(lines).toBe(1);
});

test("en el móvil, la cabecera de la biblioteca es corta y los juegos empiezan antes", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  const head = page.locator("main header").first();
  await expect(head.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  // Dos filas: título con las vistas, y el recuento en una sola línea.
  expect((await head.boundingBox())!.height).toBeLessThanOrEqual(110);
  const credits = head.getByText(/^22 títulos · 24 copias$/);
  const lines = await credits.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
  });
  expect(lines).toBe(1);
  // Sin «Mis listas»: la fila de plataformas solo tiene plataformas.
  await expect(page.getByRole("link", { name: /Mis listas/ })).toHaveCount(0);
  // «Importar…» sale de la cabecera en el móvil; se llega desde Ajustes, en «Traer juegos».
  await expect(head.getByRole("link", { name: "Importar…" })).toBeHidden();
  await page.goto("/ajustes?apartado=traer");
  const steam = page.getByRole("region", { name: "Traer juegos" }).getByRole("link", { name: /^Steam/ });
  await expect(steam).toBeVisible();
  await expect(steam).toHaveAttribute("href", "/importar?origen=steam");
});

test("en el móvil, el inicio enseña sus cinco opciones y los datos de cada partida se leen", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  const menu = page.getByRole("group", { name: "Menú principal" });
  // Las cinco a la vista, sin deslizar el menú.
  for (const name of ["Continuar", "Nueva partida", "Elegir modo", "Novedades", "Estadísticas"]) {
    await expect(menu.getByRole("button", { name }), `«${name}» a la vista`).toBeInViewport({ ratio: 1 });
  }
  expect(await menu.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  // Los datos de cada partida guardada, a 18 px o más.
  const detail = page.getByRole("group", { name: "Partidas guardadas" }).getByRole("button").first().locator("small");
  expect(await detail.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("en el móvil, el enlace del bocadillo lleva al manual, que cabe en la pantalla", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("pistas-preparadas")) {
      localStorage.removeItem("ludoteca:pistas-vistas");
      sessionStorage.setItem("pistas-preparadas", "1");
    }
  });
  await loadDemo(page);
  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: /Hades/ }).first().click();
  await page.getByRole("status", { name: "Pista de la guardiana" }).getByRole("link", { name: "Ver el manual" }).click();
  await expect(page.getByRole("region", { name: "El mapa de la ficha" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("en el móvil, el bocadillo de la guardiana no tapa las casillas del mapa", async ({ page }) => {
  await loadDemo(page);
  for (const [width, height] of [[390, 844], [360, 740]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.removeItem("ludoteca:pistas-vistas"));
    await page.goto("/biblioteca");
    await cards(page).getByRole("link", { name: /Hades/ }).first().click();
    const hint = page.getByRole("status", { name: "Pista de la guardiana" });
    await expect(hint).toContainText("¡Toca una!");
    // «¡Toca una!»: todas las casillas tienen que poder tocarse mientras lo dice.
    for (const node of await page.getByRole("button", { name: /, (conseguido|pendiente)$/ }).all()) {
      const covered = await node.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !(hit && (hit === el || el.contains(hit)));
      });
      expect(covered, `${await node.getAttribute("aria-label")} tapada a ${width}px`).toBe(false);
    }
    const box = (await hint.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    // El cuadro de la guardiana no tapa el título.
    const talk = (await page.getByRole("status", { name: "Guardiana", exact: true }).boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1, name: "Hades" }).boundingBox())!;
    expect(talk.y + talk.height).toBeLessThanOrEqual(title.y);
  }
});

test("en el móvil, Ajustes son iconos de dos en dos y el panel del elegido justo debajo", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  const tiles = page.getByRole("navigation", { name: "Apartados de Ajustes" });
  const links = tiles.getByRole("link");
  const [first, second] = await Promise.all([links.nth(0).boundingBox(), links.nth(1).boundingBox()]);
  expect(Math.round(first!.y)).toBe(Math.round(second!.y));
  for (const link of await links.all()) expect(Math.round((await link.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await tiles.getByRole("link", { name: /^Cuenta/ }).click();
  await expect(page).toHaveURL(/\?apartado=cuenta$/);
  await expect(page.getByRole("heading", { level: 2, name: "Cuenta" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});

test("el manual cabe en el móvil en todas sus páginas", async ({ page }) => {
  for (let n = 1; n <= 7; n++) {
    await openApp(page, `/manual?pagina=${n}`);
    await expect(page.getByText(`Página ${n} de 7`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `página ${n}`).toBeLessThanOrEqual(0);
    await expectCarcasaText(page.locator("main"));
    for (const name of ["Anterior", "Siguiente"]) expect(Math.round((await page.getByRole("button", { name }).boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  }
});

test("en el móvil, la barra del cambio en grupo queda encima de la barra inferior", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  const box = page.getByRole("checkbox", { name: "Elegir «Hades»" });
  const hit = await box.evaluate((el) => (el.closest("label") ?? el).getBoundingClientRect());
  expect(Math.round(hit.height)).toBeGreaterThanOrEqual(44);
  expect(Math.round(hit.width)).toBeGreaterThanOrEqual(44);
  await box.check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  await expect(bar).toBeInViewport({ ratio: 1 });
  const nav = (await page.getByRole("navigation", { name: "Principal" }).last().boundingBox())!;
  const b = (await bar.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(nav.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await expectCarcasaText(bar);
});

test("¿A qué juego? en el móvil: el aviso de datos que faltan va después de las propuestas", async ({ page }) => {
  await loadDemo(page);
  // Un juego sin modos de juego: la sesión es «Sola» y no se sabe si se juega así.
  await addGame(page, { title: "Juego sin datos", platform: "PC", format: "Digital" });
  await openApp(page, "/que-juego");
  const results = page.getByRole("region", { name: /^Mis propuestas/ });
  await expect(results.getByText(/no indican si admiten jugar acompañada/)).toBeAttached();
  // La respuesta primero: el aviso no empuja la primera propuesta.
  await expect(results.getByRole("heading", { level: 3 }).first()).toBeInViewport();
  const afterPicks = await results.evaluate((r) => {
    const picks = r.querySelector("ol")!;
    const note = [...r.querySelectorAll("p")].find((p) => /no indican si admiten/.test(p.textContent ?? ""))!;
    return Boolean(picks.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(afterPicks).toBe(true);
});

test("en el móvil, «Jugar a este» de la primera propuesta se ve sin bajar", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  const play = page.getByRole("button", { name: "Jugar a este" }).first();
  await expect(play).toBeInViewport({ ratio: 1 });
  const nav = (await page.getByRole("navigation", { name: "Principal" }).last().boundingBox())!;
  const b = (await play.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(nav.y);
});

test("en el móvil, Deseos filtra con una hoja, como la biblioteca, y el primer deseo se ve antes", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/deseos");
  const wishes = page.getByRole("region", { name: "Deseos" });
  // Arriba solo el buscador y «Filtros»: los demás controles esperan en la hoja.
  await expect(page.getByRole("group", { name: "Prioridad" })).toBeHidden();
  const first = (await wishes.getByRole("listitem").first().boundingBox())!;
  expect(first.y).toBeLessThan(420);
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrar y ordenar" });
  await sheet.getByRole("button", { name: "Alta" }).click();
  await sheet.getByRole("button", { name: /^Ver \d+ deseos?$/ }).click();
  await expect(sheet).toBeHidden();
  for (const text of await wishes.getByRole("listitem").allInnerTexts()) expect(text).toContain("prioridad alta");
  await expect(page.getByRole("button", { name: "Filtros · 1" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("el manual deja su margen en el móvil", async ({ page }) => {
  await openApp(page, "/manual?pagina=1");
  const gap = await page.locator("main p").evaluateAll((els) => Math.min(...els.map((e) => window.innerWidth - e.getBoundingClientRect().right)));
  expect(gap).toBeGreaterThanOrEqual(16);
});

test("en el móvil, la tabla de la biblioteca enseña los títulos enteros", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  const titles = page.getByRole("table", { name: "Juegos" }).getByRole("link");
  await expect(titles.first()).toBeVisible();
  const cut = await titles.evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  expect(cut).toEqual([]);
  // Un título de longitud normal (hasta 24 letras) cabe en dos líneas; uno muy largo puede usar más, pero entero.
  const tall = await titles.evaluateAll((els) =>
    els
      .filter((e) => (e.textContent ?? "").length <= 24)
      .filter((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) > 2)
      .map((e) => e.textContent),
  );
  expect(tall).toEqual([]);
  // Y el estado se lee entero, sin que la flecha del desplegable lo corte.
  const statusCut = await page.getByRole("combobox", { name: /^Estado de / }).evaluateAll((els) =>
    els
      .map((el) => {
        const s = getComputedStyle(el);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = `${s.fontSize} ${s.fontFamily}`;
        const text = (el as HTMLSelectElement).selectedOptions[0].text;
        const free = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
        return free - ctx.measureText(text).width < 0 ? text : null;
      })
      .filter(Boolean),
  );
  expect(statusCut).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("en el móvil, «Ficha técnica» y «Más datos» empiezan plegados y se abren al tocarlos", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: /Stardew/ }).first().click();
  const sheet = page.getByRole("region", { name: "Ficha técnica" });
  await expect(sheet.getByRole("heading", { name: "Ficha técnica" })).toBeVisible();
  const toggle = sheet.getByRole("button", { name: "Mostrar Ficha técnica" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(sheet.getByText("Desarrolladora")).toBeHidden();
  await toggle.click();
  await expect(sheet.getByText("Desarrolladora")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Ocultar Ficha técnica" })).toHaveAttribute("aria-expanded", "true");
  const more = page.getByRole("region", { name: "Más datos" });
  await expect(more.getByRole("button", { name: /Eliminar/ })).toBeHidden();
  await more.getByRole("button", { name: "Mostrar Más datos" }).click();
  await expect(more.getByRole("button", { name: /Eliminar/ })).toBeVisible();
});

test("en el móvil, el campo del perfil de Steam va a lo ancho y se lee entero", async ({ page }) => {
  await openApp(page, "/importar?origen=steam");
  const field = page.getByLabel("Tu perfil de Steam");
  const room = await field.evaluate((el) => {
    const s = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${s.fontSize} ${s.fontFamily}`;
    const free = el.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
    return free - ctx.measureText((el as HTMLInputElement).placeholder).width;
  });
  expect(room).toBeGreaterThanOrEqual(0);
  const button = (await page.getByRole("button", { name: "Buscar", exact: true }).boundingBox())!;
  expect(Math.round(button.height)).toBeGreaterThanOrEqual(44);
});

test("en el móvil, copiar desde la copia de seguridad cabe sin desplazarse de lado", async ({ page }) => {
  await openApp(page, "/importar?origen=copia");
  await expect(page.getByRole("region", { name: "Ludoteca" })).toBeVisible();
  // Si algo no cabe, el móvil ensancha la página entera en vez de desplazarla: se compara con el ancho del aparato.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expectCarcasaText(page.locator("main"));
});
