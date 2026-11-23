import { expect, test } from "@playwright/test";
import { addGame, cards, choosePlatform, loadDemo, openApp } from "./helpers";

test("añadir un juego, editarlo y conservar los cambios tras recargar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();

  await addGame(page, { title: "Hollow Knight", platform: "Switch", format: "Digital" });
  await expect(page.getByText("1 título · 1 copia")).toBeVisible();

  await cards(page).getByRole("link", { name: /Hollow Knight/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();

  await page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" }).click();
  await page.getByRole("button", { name: "8 de 10", exact: true }).click();
  await page.getByRole("button", { name: /^Tu valoración/ }).click();
  await page.getByLabel("Tu valoración").fill("8,5");
  await page.getByLabel("Tu valoración").press("Enter");
  await page.getByRole("button", { name: /^Horas jugadas/ }).click();
  await page.getByLabel("Horas jugadas").fill("12");
  await page.getByLabel("Horas jugadas").press("Enter");
  await page.getByRole("button", { name: /^Notas/ }).click();
  await page.getByRole("textbox", { name: "Notas", exact: true }).fill("Me falta el Panteón.");
  await page.getByRole("textbox", { name: "Notas", exact: true }).blur();

  // La copia se rellena en el inventario: precio y estantería, como digital con caja decorativa.
  const inventory = page.getByRole("region", { name: "Inventario" });
  await inventory.getByRole("button", { name: /^Precio/ }).click();
  await inventory.getByLabel("Precio").fill("14,99");
  await inventory.getByLabel("Precio").press("Enter");
  await inventory.getByLabel("Tengo caja (decorativa)").check();
  await inventory.getByLabel("Tiene la carátula completa").check();
  await inventory.getByRole("button", { name: /^Ubicación/ }).click();
  await inventory.getByLabel("Ubicación").fill("Balda 2");
  await inventory.getByLabel("Ubicación").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Ubicación: Balda 2/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /^Tu valoración: 8,5/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Horas jugadas: 12 h/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Notas: Me falta el Panteón\./ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tus récords" }).getByText("14,99 €")).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Precio: 14,99/ })).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Ubicación: Balda 2/ })).toBeVisible();
  await expect(inventory.getByLabel("Tengo caja (decorativa)")).toBeChecked();
  await expect(inventory.getByLabel("Tiene la carátula completa")).toBeChecked();
  await expect(inventory.getByLabel("Carátula pendiente de imprimir")).toHaveCount(0);
  // La caja decorativa no cambia el formato.
  await expect(inventory.getByRole("radio", { name: "Digital" })).toHaveAttribute("aria-checked", "true");
});

test("validación del alta: sin título ni plataforma no se guarda", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByText("Escribe el título del juego.")).toBeVisible();
  await expect(dialog.getByText("Elige una plataforma para guardar la copia.")).toBeVisible();
  await expect(dialog.getByLabel("Título")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();
});

test("registrar dos copias del mismo título sin duplicar el juego", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico", status: "Completado" });

  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("celeste");
  await expect(dialog.getByText(/Ya tienes «Celeste»/)).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Añadir otra copia" })).toHaveAttribute("aria-checked", "true");
  await choosePlatform(dialog, "PC");
  await dialog.getByRole("radio", { name: "Digital", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir copia" }).click();
  await expect(dialog.getByRole("button", { name: "Añadir otro" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar" }).click();

  await expect(page.getByText("1 título · 2 copias")).toBeVisible();
  await expect(cards(page)).toHaveCount(2); // aparece en el separador de cada plataforma
  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("2 copias");
  await expect(cards(page).first().locator(".tag")).toHaveText(["Switch", "PC"]);

  await page.goto("/estadisticas");
  const kpi = (label: string) => page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");
  await expect(kpi("Títulos")).toHaveText("1");
  await expect(kpi("Copias")).toHaveText("2");
});

test("buscar, filtrar por plataforma, formato y estado, y ordenar", async ({ page }) => {
  await loadDemo(page);

  await page.getByPlaceholder("Buscar por título").fill("hollow");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Hollow Knight");
  await expect(page).toHaveURL(/q=hollow/);

  await page.getByPlaceholder("Buscar por título").fill("zzz");
  await expect(page.getByRole("heading", { name: "Ningún juego coincide" })).toBeVisible();
  await page.getByRole("button", { name: "Restablecer filtros" }).click();
  // Sin filtros, el número solo está en la cabecera («22 títulos · 24 copias»).
  await expect(page.getByText("22 títulos", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: /PS5/ }).click();
  await expect(page.getByText("6 de 22 títulos")).toBeVisible();
  const ps5 = await cards(page).allInnerTexts();
  expect(ps5).toHaveLength(6);
  for (const text of ps5) expect(text).toContain("PS5");

  await page.getByRole("button", { name: "Completado" }).click();
  await page.getByRole("tab", { name: /Todas/ }).click();
  await expect(page).toHaveURL(/estado=completado/);
  await expect(page).not.toHaveURL(/plataforma=/);
  await expect(page.getByText("4 de 22 títulos")).toBeVisible();
  for (const text of await cards(page).allInnerTexts()) expect(text).toContain("Completado");

  await page.getByRole("button", { name: "Digital", exact: true }).click();
  await expect(page.getByText(/de 22 títulos/)).toBeVisible();
  await page.getByRole("button", { name: "Restablecer", exact: true }).click();
  // Sin filtros, el número solo está en la cabecera («22 títulos · 24 copias»).
  await expect(page.getByText("22 títulos", { exact: true })).toHaveCount(0);

  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");
  // Por defecto, por título de la A a la Z; sin nada en la dirección.
  await expect(page.getByRole("combobox").filter({ hasText: "Título (A–Z)" })).toHaveValue("titulo");
  await expect(page).not.toHaveURL(/orden=/);
  await expect(cards(page).first()).toContainText("A Short Hike");
  const titles = await cards(page).locator("[data-card-title]").allInnerTexts();
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
  expect(titles).toEqual(sorted);

  await page.getByRole("combobox").filter({ hasText: "Título (A–Z)" }).selectOption("valoracion");
  await expect(page).toHaveURL(/orden=valoracion/);
  await expect(cards(page).first()).toContainText("The Legend of Zelda");
});

test("recreativa: cada juego en su cabina, «Elegido» sigue al cursor y las flechas lo mueven", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");

  // El estado se dice como en una recreativa, en español, sin perder el nombre de siempre.
  const shortHike = cards(page).first();
  await expect(shortHike).toContainText("NUEVA PARTIDA");
  await expect(shortHike).toContainText("Pendiente");
  await expect(cards(page).filter({ hasText: "Disco Elysium" })).toContainText("FIN DEL JUEGO");

  // Pasar por encima o llegar con el teclado muestra el juego en «Elegido».
  const chosen = page.getByRole("region", { name: "Elegido" });
  const celeste = cards(page).filter({ hasText: "Celeste" }).getByRole("link");
  const box = (await celeste.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(chosen).toContainText("Celeste");

  // Con el ratón quieto, una cabina que queda debajo (al reordenar o al cargar) no pasa a ser la elegida.
  const hike = cards(page).filter({ hasText: "A Short Hike" }).getByRole("link");
  await hike.dispatchEvent("pointerover", { pointerType: "mouse", bubbles: true });
  await hike.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await page.waitForTimeout(200);
  await expect(chosen).toContainText("Celeste");
  await cards(page).filter({ hasText: "Celeste" }).getByRole("link").hover();
  await expect(chosen).toContainText("Celeste");
  await expect(chosen).toContainText("¡SUPERADO!");

  await cards(page).first().getByRole("link").focus();
  await page.keyboard.press("ArrowRight");
  await expect(cards(page).nth(1).getByRole("link")).toBeFocused();
  await expect(chosen).toContainText((await cards(page).nth(1).locator("[data-card-title]").textContent())!);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/juego\//);
  await page.goBack();

  // La tabla de récords ordena por horas de toda la colección.
  const hiscore = page.getByRole("region", { name: "Récords de horas" }).getByRole("listitem");
  await expect(hiscore.first()).toContainText("The Legend of Zelda");
  await expect(hiscore.first()).toContainText("132 h");
  // El puesto con punto: en la letra de píxeles, «1º» se lee «19».
  await expect(hiscore.first()).toContainText(/^1\./);
  await expect(page.getByRole("region", { name: "Récords de horas" })).not.toContainText("º");
});

test("un título largo cabe en el rótulo de la cabina sin cortarse a media línea", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page, "/biblioteca");
    if (width === 1440) await addGame(page, { title: "The Legend of Zelda: Ocarina of Time", platform: "Switch 2" });
    const card = cards(page).filter({ hasText: "Ocarina of Time" });
    const marquee = card.locator("[data-card-title]");
    // Nada del rótulo queda escondido por debajo: o cabe entero, o termina en «…».
    const hidden = await marquee.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(hidden).toBeLessThanOrEqual(0);
    // El nombre y el estado se leen sin esfuerzo: nada de letra de 8 px.
    const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    expect(await marquee.evaluate(size)).toBeGreaterThanOrEqual(16);
    expect(await card.locator("[data-status]").evaluate(size)).toBeGreaterThanOrEqual(16);
    await expect(card.getByRole("link")).toHaveAttribute("title", "The Legend of Zelda: Ocarina of Time");
  }
});

test("cambiar el estado desde la lista compacta y conservarlo tras recargar", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: "Tabla" }).click();
  const select = page.getByLabel("Estado de Outer Wilds");
  await select.selectOption("jugando");
  await expect(page.getByText("«Outer Wilds» pasa a Jugando")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Estado de Outer Wilds")).toHaveValue("jugando");

  // Deshacer devuelve el estado anterior.
  await page.getByLabel("Estado de Outer Wilds").selectOption("completado");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Estado de Outer Wilds")).toHaveValue("jugando");
});

test("eliminar un juego pide confirmación y se puede deshacer", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("link", { name: /Inside/ }).first().click();
  await page.getByRole("button", { name: "Eliminar «Inside»" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar juego" }).click();
  await expect(page.getByText("21 títulos · 23 copias")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
});

test("no hay listas personales: ni enlace en la biblioteca, ni apartado en la ficha, ni pantalla", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mis listas/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Hades/ }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Hades" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Listas" })).toHaveCount(0);
  await page.goto("/listas");
  await expect(page.getByRole("heading", { name: "Esta página no está en tu ludoteca" })).toBeVisible();
});

test("«Elegido» enseña solo los datos que hay, sin filas de «---»", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  const chosen = page.getByRole("region", { name: "Elegido" });
  // A Short Hike, el primero, aún no se ha jugado.
  await expect(chosen).toContainText("A Short Hike");
  await expect(chosen).not.toContainText("---");
  await expect(chosen).toContainText("Sin partidas todavía");
  // Hades tiene horas y nota: se ven, sin el aviso.
  await cards(page).filter({ hasText: "Hades" }).getByRole("link").hover();
  await expect(chosen).toContainText("Hades");
  await expect(chosen).toContainText("41 h");
  await expect(chosen).not.toContainText("Sin partidas todavía");
});

const pick = (page: import("@playwright/test").Page, title: string) => page.getByRole("checkbox", { name: `Elegir «${title}»` });
const statusOf = (page: import("@playwright/test").Page, title: string) => page.getByRole("combobox", { name: `Estado de ${title}` });

test("la tabla agrupa como las cabinas: por plataforma, por estado o sin agrupar", async ({ page }) => {
  await loadDemo(page);
  const table = page.getByRole("table", { name: "Juegos" });
  const groupNames = () => table.getByRole("rowgroup").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const rows = table.getByRole("row").filter({ has: page.getByRole("combobox") });
  // Por plataforma, lo de siempre: una balda por plataforma, y cada juego una sola vez.
  // (Antes de leer la tabla, se espera a que la biblioteca termine de cargar y se pinte.)
  await openApp(page, "/biblioteca?vista=lista");
  await expect(rows).toHaveCount(22);
  expect((await groupNames()).length).toBeGreaterThan(1);
  const titles = await table.getByRole("row").filter({ has: page.getByRole("combobox") }).getByRole("link").allTextContents();
  expect(new Set(titles).size).toBe(titles.length);
  expect(titles).toHaveLength(22);
  // Por estado: una cabecera por estado, con su recuento.
  await openApp(page, "/biblioteca?vista=lista&agrupar=estado");
  await expect(table.getByRole("rowgroup")).toHaveCount(5);
  expect(await groupNames()).toEqual(["Pendiente", "Jugando", "Pausado", "Completado", "Abandonado"]);
  const playing = table.getByRole("rowgroup", { name: "Jugando" });
  await expect(playing).toContainText("5 juegos");
  await expect(playing.getByRole("row").filter({ has: page.getByRole("combobox") })).toHaveCount(5);
  // Sin agrupar, una sola lista.
  await openApp(page, "/biblioteca?vista=lista&agrupar=ninguno");
  await expect(rows).toHaveCount(22);
  expect(await groupNames()).toEqual([]);
});

test("en la tabla se eligen varios juegos y se les cambia el estado de una vez", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  for (const title of ["Hades", "Celeste", "Hollow Knight"]) await pick(page, title).check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  await expect(bar).toContainText("3 elegidos");
  await bar.getByLabel("Cambiar estado a…").selectOption("abandonado");
  await bar.getByRole("button", { name: "Cambiar", exact: true }).click();
  await expect(page.getByText("3 juegos pasan a Abandonado")).toBeVisible();
  for (const title of ["Hades", "Celeste", "Hollow Knight"]) await expect(statusOf(page, title)).toHaveValue("abandonado");
  await expect(bar).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(statusOf(page, "Hades")).toHaveValue("jugando");
  await expect(statusOf(page, "Celeste")).toHaveValue("completado");
  await expect(statusOf(page, "Hollow Knight")).toHaveValue("pausado");
});

test("elegir todos los que se ven respeta el filtro, y Esc quita la selección", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  // Filtrar desde la propia pantalla: la selección vive mientras no se recarga.
  await page.getByRole("button", { name: "Jugando", exact: true }).click();
  await expect(page).toHaveURL(/estado=jugando/);
  const rows = await page.getByRole("checkbox", { name: /^Elegir «/ }).count();
  await page.getByRole("checkbox", { name: "Elegir todos los que se ven" }).check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  await expect(bar).toContainText(`${rows} elegidos`);
  // Al quitar el filtro, los elegidos siguen siendo los mismos.
  await page.getByRole("button", { name: "Jugando", exact: true }).click();
  await expect(page).not.toHaveURL(/estado=jugando/);
  await expect(page.getByRole("checkbox", { name: /^Elegir «/ })).not.toHaveCount(rows);
  await expect(bar).toContainText(`${rows} elegidos`);
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
});

test("con el teclado, moverse por «Cambiar estado a…» no cambia nada hasta pulsar «Cambiar»", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  await pick(page, "Hades").check();
  await pick(page, "Celeste").check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  const select = bar.getByLabel("Cambiar estado a…");
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByText(/pasan? a /)).toHaveCount(0);
  await expect(statusOf(page, "Hades")).toHaveValue("jugando");
  await expect(statusOf(page, "Celeste")).toHaveValue("completado");
  await expect(bar).toContainText("2 elegidos");
});

test("un filtro que oculta un juego elegido lo saca de la selección", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  await pick(page, "Hades").check();
  await pick(page, "Celeste").check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  await expect(bar).toContainText("2 elegidos");
  await page.getByRole("button", { name: "Jugando", exact: true }).click();
  await expect(bar).toContainText("1 elegido");
});

test("en el cambio en grupo solo cuentan los que cambian", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  await pick(page, "Celeste").check();
  await pick(page, "Inside").check();
  let bar = page.getByRole("region", { name: "Cambio en grupo" });
  await bar.getByLabel("Cambiar estado a…").selectOption("completado");
  await bar.getByRole("button", { name: "Cambiar", exact: true }).click();
  await expect(page.getByText(/pasan? a Completado/)).toHaveCount(0);
  await pick(page, "Celeste").check();
  await pick(page, "Hades").check();
  bar = page.getByRole("region", { name: "Cambio en grupo" });
  await bar.getByLabel("Cambiar estado a…").selectOption("completado");
  await bar.getByRole("button", { name: "Cambiar", exact: true }).click();
  await expect(page.getByText("«Hades» pasa a Completado")).toBeVisible();
});

test("en un portátil pequeño, «/» en la biblioteca va a su buscador sin perder los filtros", async ({ page }) => {
  await loadDemo(page);
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/biblioteca?vista=lista&estado=jugando");
  await page.locator("body").click({ position: { x: 5, y: 400 } });
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Buscar por título" })).toBeFocused();
  await expect(page).toHaveURL(/vista=lista/);
  await expect(page).toHaveURL(/estado=jugando/);
});

test("la biblioteca dice su recuento una sola vez", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  await expect(page.getByText(/22 títulos/)).toHaveCount(1);
  await page.getByRole("button", { name: "Jugando", exact: true }).click();
  await expect(page.getByText(/^\d+ de 22 títulos$/)).toBeVisible();
});

test("«NUEVA PARTIDA» parpadea al llegar, no para siempre", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca");
  const badge = page.locator('[class*="badge"][data-status="pendiente"]').first();
  await expect(badge).toBeVisible();
  expect(await badge.evaluate((el) => getComputedStyle(el).animationName)).not.toBe("none");
  const iterations = await badge.evaluate((el) => getComputedStyle(el).animationIterationCount);
  expect(iterations).not.toBe("infinite");
  expect(Number(iterations)).toBeLessThanOrEqual(4);
});

test("Esc en un buscador no quita la selección del cambio en grupo", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  await pick(page, "Hades").check();
  await page.getByRole("searchbox", { name: "Buscar por título" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Cambio en grupo" })).toContainText("1 elegido");
});

test("al cerrar la barra del cambio en grupo, el foco vuelve a la tabla", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/biblioteca?vista=lista");
  await pick(page, "Hades").check();
  await pick(page, "Celeste").check();
  const bar = page.getByRole("region", { name: "Cambio en grupo" });
  await bar.getByLabel("Cambiar estado a…").selectOption("pausado");
  await bar.getByRole("button", { name: "Cambiar", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Elegir todos los que se ven" })).toBeFocused();
  await pick(page, "Hades").check();
  await page.getByRole("region", { name: "Cambio en grupo" }).getByRole("button", { name: "Quitar la selección" }).click();
  await expect(page.getByRole("checkbox", { name: "Elegir todos los que se ven" })).toBeFocused();
});

test("las plataformas van por familias y cada filtro lleva su rótulo", async ({ page }) => {
  test.setTimeout(90_000);
  await loadDemo(page);
  await addGame(page, { title: "Halo Infinite", platform: "Xbox Series" });
  await addGame(page, { title: "Beat Saber", platform: "Meta Quest" });
  // PC primero; luego PlayStation, Xbox, Nintendo y las demás, cada familia junta y de la más nueva a la más antigua.
  const tabs = page.getByRole("tablist", { name: "Plataforma" }).getByRole("tab");
  await expect(tabs).toHaveText([/^Todas/, /^PC/, /^PS5/, /^PS4/, /^Xbox Series/, /^Switch/, /^Meta Quest/]);
  // Cada grupo de botones dice a la vista qué filtra.
  const filters = page.getByRole("region", { name: "Filtros" });
  for (const name of ["Estado", "Formato", "Favoritos"]) {
    await expect(filters.getByRole("group", { name }).getByText(name, { exact: true })).toBeVisible();
  }
  // El género, desplegable como el orden, va con ellos en la barra de búsqueda.
  await expect(page.getByRole("search").getByRole("combobox", { name: "Género" })).toBeVisible();
});
