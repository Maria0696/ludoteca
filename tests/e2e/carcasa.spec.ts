import { type Locator, expect, test } from "@playwright/test";
import { addGame, cards, expectCarcasaText, loadDemo, openAjustes, openApp } from "./helpers";

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

test("la barra superior cabe en cualquier ancho de ordenador sin aplastar sus botones", async ({ page }) => {
  // Con la demostración el chip de modo es el más largo: «Modo local · Demostración».
  await loadDemo(page);
  await page.goto("/deseos");
  const header = page.locator("header").first();
  for (let width = 900; width <= 1440; width += 20) {
    await page.setViewportSize({ width, height: 800 });
    const m = await header.evaluate((el) => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      bar: el.scrollWidth - el.clientWidth,
      right: Math.max(...[...el.children].map((c) => c.getBoundingClientRect().right)) - el.getBoundingClientRect().right,
      buttons: [...el.querySelectorAll(".btn")]
        .filter((b) => b.getBoundingClientRect().width > 0)
        .map((b) => Math.round(b.getBoundingClientRect().width)),
    }));
    expect(m.page, `la página se desplaza a los lados a ${width}px`).toBeLessThanOrEqual(0);
    expect(m.bar, `la barra desborda a ${width}px`).toBeLessThanOrEqual(0);
    expect(m.right, `algo se sale de la barra a ${width}px`).toBeLessThanOrEqual(0);
    for (const w of m.buttons) expect(w, `un botón de la barra se aplasta a ${width}px`).toBeGreaterThanOrEqual(36);
    // Si se ve el buscador, su texto de ayuda cabe entero.
    const search = header.getByRole("combobox", { name: "Buscar en tu biblioteca" });
    if (await search.isVisible()) {
      const room = await search.evaluate((el) => {
        const s = getComputedStyle(el);
        const ctx = document.createElement("canvas").getContext("2d")!;
        ctx.font = `${s.fontSize} ${s.fontFamily}`;
        const box = el.getBoundingClientRect().width;
        const free = box - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
        return free - ctx.measureText((el as HTMLInputElement).placeholder).width;
      });
      expect(room, `el texto del buscador se corta a ${width}px`).toBeGreaterThanOrEqual(0);
    }
  }
  // Compacta, la barra sigue diciendo qué es cada cosa.
  await page.setViewportSize({ width: 960, height: 800 });
  await expect(header.getByRole("link", { name: /Modo local · Demostración/ })).toBeVisible();
  await expect(header.getByRole("button", { name: "Añadir juego" })).toBeVisible();
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

test("el estado se dice igual en toda la app: etiqueta arcade y nombre normal", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  // Cada propuesta es un <li> con el enlace «Ficha de …».
  const proposal = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Ficha de / }) }).first();
  await expect(proposal).toContainText(/EN PARTIDA ·\s*Jugando/);
  // El manual lo explica con la misma etiqueta.
  await openApp(page, "/manual?pagina=2");
  await expect(page.locator("main")).toContainText(/NUEVA PARTIDA ·\s*Pendiente/);
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

test("Estadísticas en la carcasa: título en píxeles, una ventana por sección, filas parejas y todo legible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Estadísticas" }));
  expect(family).toMatch(/Press.Start.2P/i);
  const sections = ["Marcador", "Tu estantería", "Superados mes a mes", "Joyas por jugar", "De dónde vienen", "Géneros", "Nota en Metacritic", "Año de salida", "Horas y gasto"];
  for (const name of sections) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  // Las ventanas de una misma fila miden lo mismo: ninguna se queda corta a media altura.
  const boxes = await Promise.all(sections.map((name) => page.getByRole("region", { name }).boundingBox()));
  const rows = new Map<number, number[]>();
  for (const b of boxes) rows.set(Math.round(b!.y), [...(rows.get(Math.round(b!.y)) ?? []), b!.height]);
  expect([...rows.values()].some((h) => h.length > 1)).toBe(true);
  for (const heights of rows.values()) expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
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
  await expect(page.getByText("12.345,67 €")).toBeVisible();
  await expect(page.getByText("12.345 h")).toBeVisible();
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
  // La sesión, como el menú de opciones de un juego: una fila por pregunta, sin cajas; el valor cambia con las flechas o eligiéndolo.
  const session = page.getByRole("form", { name: "Tu sesión" });
  await expect(session.getByRole("radio")).toHaveCount(0);
  const values: [string, string][] = [["Tiempo", "1 h"], ["Plataforma", "Cualquiera"], ["Partida", "Me da igual"], ["Compañía", "Sola"], ["Experiencia", "Cualquiera"]];
  for (const [name, value] of values) await expect(session.getByRole("combobox", { name, exact: true }).locator("option:checked")).toHaveText(value);
  const time = session.getByRole("combobox", { name: "Tiempo", exact: true });
  expect(await time.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");
  await session.getByRole("button", { name: "Tiempo: siguiente" }).click();
  await expect(time.locator("option:checked")).toHaveText("2 h");
  // Da la vuelta, como en un juego: tras «Sin prisa» vuelve «15 min».
  await session.getByRole("button", { name: "Tiempo: siguiente" }).click();
  await session.getByRole("button", { name: "Tiempo: siguiente" }).click();
  await expect(time.locator("option:checked")).toHaveText("15 min");
  await session.getByRole("button", { name: "Tiempo: anterior" }).click();
  await expect(time.locator("option:checked")).toHaveText("Sin prisa");
  // En el ordenador la sesión está a la vista: el resumen con «Ajustar» es solo del móvil.
  await expect(page.getByRole("button", { name: "Ajustar la sesión" })).toBeHidden();
  await expectCarcasaText(page.locator("main"));
});

test("Ajustes en la carcasa: una ventana por apartado y diálogos legibles", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Ajustes" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const [apartado, name] of [["cuenta", "Cuenta"], ["partida", "Partida guardada"], ["pantalla", "Pantalla"], ["borrar", "Borrar todo"]]) {
    await openAjustes(page, apartado);
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
    await expectCarcasaText(page.locator("main"));
  }
  await openAjustes(page, "demostracion");
  await page.getByText(/Ver las \d+ obras/).click(); // créditos desplegados
  await expectCarcasaText(page.locator("main"));
  // Los avisos de eliminar todo, en la carcasa.
  await openAjustes(page, "borrar");
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
  await openAjustes(page, "demostracion");
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

test("Deseos: el precio es una etiqueta bajo el título y solo «Ya lo tengo» va enmarcado", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/deseos");
  const row = (title: string) => page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: title });
  // Con precio: la etiqueta con la cifra y su veredicto, debajo del título; al lado, tienda, fecha y objetivo.
  const silksong = row("Hollow Knight: Silksong");
  const tag = silksong.getByText("19,50 €", { exact: true });
  await expect(silksong.getByText("4,50 € por encima", { exact: true })).toBeVisible();
  const title = (await silksong.getByText("Hollow Knight: Silksong", { exact: true }).boundingBox())!;
  const tagBox = (await tag.boundingBox())!;
  expect(tagBox.y).toBeGreaterThan(title.y);
  expect(tagBox.x - title.x).toBeLessThan(30);
  const meta = silksong.getByText(/Nintendo eShop/);
  await expect(meta).toHaveText(/^Nintendo eShop · .+ · objetivo 15,00\s€$/);
  // Sin precio visto: la etiqueta dice el objetivo.
  await expect(row("Okami HD").getByText("Objetivo 12,00 €", { exact: true })).toBeVisible();
  await expect(row("Okami HD")).toContainText("sin precio visto");
  // Sin precio ni objetivo: nada que leer, ni rayas ni frases de relleno.
  await expect(row("Pentiment")).not.toContainText("€");
  await expect(row("Pentiment")).not.toContainText("—");
  await expect(row("Pentiment")).not.toContainText("todavía");
  // Una sola acción enmarcada; las demás, calladas y con su nombre.
  const background = (name: string | RegExp) => silksong.getByRole("button", { name }).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await background("Ya lo tengo")).not.toBe("rgba(0, 0, 0, 0)");
  for (const name of [/^Precio/, /^Editar/, /^Quitar/]) expect(await background(name)).toBe("rgba(0, 0, 0, 0)");
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

test("la bienvenida de una biblioteca vacía es una ventana de la carcasa", async ({ page }) => {
  await openApp(page, "/");
  const heading = page.getByRole("heading", { name: "Bienvenida a tu ludoteca" });
  const [family] = await font(heading);
  expect(family).toMatch(/Press.Start.2P/i);
  const welcome = page.getByRole("region", { name: "Bienvenida a tu ludoteca" });
  const box = await welcome.evaluate((el) => [getComputedStyle(el).boxShadow, getComputedStyle(el).borderRadius]);
  expect(box[0]).toContain("rgb(243, 234, 210)"); // el marco de papel de las ventanas
  expect(box[1]).toBe("0px");
  // En el inicio la barra flota sobre el contenido: la ventana empieza por debajo de ella.
  const bar = (await page.locator("header").first().boundingBox())!;
  expect((await welcome.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  await expectCarcasaText(page.locator("main"));
  // Sin jerga técnica: el modo local se explica igual que en el inicio, con el mismo enlace.
  await expect(welcome).not.toContainText("Supabase");
  await expect(welcome.getByRole("link", { name: "Haz una copia o conecta la sincronización" })).toHaveAttribute("href", "/ajustes");
  // La demostración tranquiliza: se puede retirar.
  await expect(welcome.getByText(/se retiran de una vez desde Ajustes/)).toBeVisible();
  await expect(welcome.getByRole("button", { name: "Añadir el primer juego" })).toBeVisible();
});

test("la app habla español: sin rótulos en inglés ni jerga técnica", async ({ page }) => {
  await loadDemo(page);
  const english = /select game|press start|clear!|game over|créditos|pulsa start/i;
  await page.goto("/biblioteca");
  // La pantalla dice lo que es.
  await expect(page.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  await expect(page.getByText(/^22 títulos · 24 copias$/)).toBeVisible();
  for (const url of ["/", "/biblioteca", "/que-juego"]) {
    await page.goto(url);
    await expect(page.locator("main")).not.toHaveText(english);
  }
  await page.goto("/biblioteca");
  await expect(page.getByRole("region", { name: "Elegido" }).getByRole("link", { name: /Ver ficha/ })).toBeVisible();
  // Ajustes sin nombres de variables ni de servicios por dentro.
  for (const apartado of ["partida", "traer", "pantalla", "ayuda", "cuenta", "demostracion", "borrar"]) {
    await openAjustes(page, apartado);
    await expect(page.locator("main")).not.toHaveText(/README|IGDB_CLIENT|Twitch|Supabase/);
  }
});

test("los estados tienen el mismo color en la biblioteca, la ficha y el alta", async ({ page }) => {
  // Los colores de --st-* en globals.css: los mismos que en las cabinas de la biblioteca.
  const expected = { Pendiente: "rgb(255, 233, 77)", Completado: "rgb(63, 242, 255)", Abandonado: "rgb(255, 77, 109)" };
  const dots = (group: Locator) =>
    Promise.all(
      Object.keys(expected).map(async (name) => [
        name,
        await group.getByRole("radio", { name }).evaluate((el) => getComputedStyle(el.firstElementChild!).backgroundColor),
      ]),
    ).then(Object.fromEntries);

  await loadDemo(page);
  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: /Hades/ }).first().click();
  expect(await dots(page.getByRole("radiogroup", { name: "Estado" }))).toEqual(expected);

  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  expect(await dots(page.getByRole("dialog").getByRole("radiogroup", { name: "Estado" }))).toEqual(expected);
});

test("el formulario del cofre va en las letras de la carcasa", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  const [titleFont] = await font(dialog.getByRole("heading", { name: "¿Qué has encontrado?" }));
  expect(titleFont).toMatch(/Press.Start.2P/i);
  const parts: [string, Locator][] = [
    ["la etiqueta «Título»", dialog.getByText("Título", { exact: true })],
    ["la plataforma «PS5»", dialog.getByRole("radio", { name: "PS5", exact: true })],
    ["el formato «Físico»", dialog.getByRole("radio", { name: "Físico", exact: true })],
    ["el estado «Pendiente»", dialog.getByRole("radio", { name: "Pendiente", exact: true })],
    ["el botón de añadir", dialog.getByRole("button", { name: "Añadir a la biblioteca" })],
    ["la pista", dialog.getByText(/^Precio, edición, horas/)],
  ];
  for (const [what, el] of parts) {
    const [family, size] = await font(el);
    expect(family, what).toMatch(/VT323|Press.Start.2P/i);
    if (/VT323/i.test(family)) expect(size, what).toBeGreaterThanOrEqual(18);
  }
  // La escena del cofre se conserva.
  await dialog.getByLabel("Título").fill("Celeste");
  await dialog.getByRole("radio", { name: "Switch", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByRole("heading", { name: "¡Has conseguido Celeste!" })).toBeVisible();
});

test("en la ficha, el punto del estado elegido se ve sobre el blanco", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: /Hades/ }).first().click();
  const chosen = page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { checked: true });
  // Los neones sobre blanco no llegan a 2:1: el punto lleva un aro oscuro, como en el alta.
  const ring = await chosen.evaluate((el) => getComputedStyle(el.firstElementChild!).boxShadow);
  expect(ring).toContain("rgb(18, 16, 31)");
});

test("Ajustes como los de una consola: iconos de píxeles en una columna y el panel cabe sin desplazarse", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  const tiles = page.getByRole("navigation", { name: "Apartados de Ajustes" });
  // Cada apartado lleva su icono de píxeles, y el elegido se ve en dorado.
  for (const img of await tiles.locator("img").all()) expect(await img.evaluate((el) => getComputedStyle(el).imageRendering)).toBe("pixelated");
  const current = tiles.locator('[aria-current="page"]');
  expect(await current.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(255, 215, 106)");
  // Borrar todo va aparte y en rojo, nunca en dorado.
  await page.goto("/ajustes?apartado=borrar");
  expect(await tiles.locator('[aria-current="page"]').evaluate((el) => getComputedStyle(el).boxShadow)).not.toContain("rgb(255, 215, 106)");
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  await expectCarcasaText(page.locator("main"));
});
test("el manual de instrucciones se lee página a página, como el librito de un juego", async ({ page }) => {
  await openApp(page, "/manual");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Manual de instrucciones" }));
  expect(family).toMatch(/Press.Start.2P/i);
  const book = page.getByRole("region", { name: "Juegos y copias" });
  await expect(book).toBeVisible();
  expect(await book.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  await expect(page.getByText("Página 1 de 7")).toBeVisible();
  await expectCarcasaText(page.locator("main"));
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page).toHaveURL(/\?pagina=2$/);
  const states = page.getByRole("region", { name: "Estados" });
  for (const label of ["NUEVA PARTIDA", "EN PARTIDA", "PAUSA", "¡SUPERADO!", "FIN DEL JUEGO"]) await expect(states).toContainText(label);
  // Con el teclado también se pasa de página.
  await page.keyboard.press("ArrowRight");
  const map = page.getByRole("region", { name: "El mapa de la ficha" });
  for (const stage of ["Llegó a tu ludoteca", "Tu copia", "Primera partida", "En marcha", "Tu nota", "Terminado", "Al 100 %"]) await expect(map).toContainText(stage);
  await expect(page.getByText("Página 3 de 7")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Página 2 de 7")).toBeVisible();
  // Cada página, en la carcasa; la última deja volver a ver las pistas.
  for (let n = 1; n <= 7; n++) {
    await openApp(page, `/manual?pagina=${n}`);
    await expect(page.getByText(`Página ${n} de 7`)).toBeVisible();
    await expectCarcasaText(page.locator("main"));
  }
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  await page.getByRole("button", { name: "Volver a ver las pistas de la guardiana" }).click();
  await expect(page.getByText("Las pistas volverán a salir en las fichas")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ludoteca:pistas-vistas"))).toBeNull();
});

test("las sugerencias del catálogo al añadir, sin esquinas redondeadas", async ({ page }) => {
  await page.route("**/api/catalogo?*", (route) =>
    route.fulfill({
      json: {
        ok: true,
        results: [
          { igdbId: 1, title: "Cr de prueba", year: 2020, coverUrl: "https://images.example/c.jpg", backdropUrl: null, genres: [], platforms: ["PC"], modes: [], moods: [], lengthHours: null, criticRating: null },
        ],
      },
    }),
  );
  await page.route("https://images.example/**", (route) => route.fulfill({ status: 404 }));
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").fill("cr");
  await expect(dialog.getByRole("option", { name: /Cr de prueba/ })).toBeVisible();
  const rounded = await dialog.evaluate((root) =>
    [...root.querySelectorAll("*")]
      .filter((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // Los puntos de color de estado son círculos a propósito.
        return r.width > 14 && ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius"].some((k) => parseFloat(s[k as "borderTopLeftRadius"]) > 0);
      })
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 30)}`),
  );
  expect(rounded).toEqual([]);
});

for (const [ruta, nombre, texto] of [
  ["/que-juego", "¿A qué juego?", "Cada propuesta explica por qué"],
  ["/importar", "Importar de Steam", "no se duplica nada"],
] as const) {
  test(`la guardiana explica ${nombre} la primera vez, y no vuelve tras cerrarla`, async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("pistas-preparadas")) {
        localStorage.setItem("ludoteca:pistas-vistas", JSON.stringify(["mapa", "moneda", "datos"]));
        sessionStorage.setItem("pistas-preparadas", "1");
      }
    });
    await loadDemo(page);
    await page.goto(ruta);
    const hint = page.getByRole("status", { name: "Pista de la guardiana" });
    await expect(hint).toContainText(texto);
    await expectCarcasaText(hint);
    await hint.getByRole("button", { name: "Cerrar la pista" }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("status", { name: "Pista de la guardiana" })).toHaveCount(0);
  });
}

test("en el ordenador, Deseos no repite los filtros en un botón «Filtros»", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/deseos");
  await expect(page.getByRole("group", { name: "Prioridad" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Filtros/ })).toBeHidden();
});

