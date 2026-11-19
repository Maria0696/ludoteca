import { type Page, expect, test } from "@playwright/test";
import { STAGES, currentStage, keeperLine, progressPercent, reachedStages } from "../../src/app/juego/[id]/progress";
import { isoToDmy, parseDmy } from "../../src/lib/format";
import type { Copy, Game } from "../../src/lib/model";
import { addGame, cards, loadDemo, openApp } from "./helpers";

const base = { status: "pendiente", completed100: false, rating: null, hoursPlayed: null, lengthHours: null, startedAt: null, finishedAt: null, lastPlayedAt: null } as unknown as Game;
const withData = (patch: Partial<Game>) => ({ ...base, ...patch }) as Game;
const copy = {} as Copy;

/** Da de alta, desde las sugerencias, un juego que el catálogo simulado devuelva. */
async function addFromCatalog(page: Page, title: string) {
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").fill("cr");
  await dialog.getByRole("option", { name: new RegExp(title) }).click();
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await dialog.getByRole("button", { name: "Ver ficha" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test("los niveles salen de los datos de la ficha", () => {
  expect(reachedStages(base, [])).toEqual([true, false, false, false, false, false, false]);
  expect(STAGES[currentStage(reachedStages(base, [copy]))]).toBe("Tu copia");
  const played = reachedStages(withData({ startedAt: "2026-01-01", hoursPlayed: 3, rating: 7 }), [copy]);
  expect(STAGES[currentStage(played)]).toBe("Tu nota");
  // Marcar Completado cuenta aunque no haya fecha de fin.
  expect(reachedStages(withData({ status: "completado" }), [copy])[5]).toBe(true);
  expect(STAGES[currentStage(reachedStages(withData({ completed100: true }), [copy]))]).toBe("Al 100 %");

  expect(progressPercent(withData({ hoursPlayed: 20, lengthHours: 40 }))).toBe(50);
  expect(progressPercent(withData({ hoursPlayed: 90, lengthHours: 40 }))).toBe(100);
  expect(progressPercent(withData({ hoursPlayed: 20 }))).toBeNull();
});

test("la guardiana comenta cómo va el juego", () => {
  const today = new Date(2026, 10, 8, 12);
  expect(keeperLine(base, today)).toContain("aún no ha empezado");
  expect(keeperLine(withData({ status: "pausado", lastPlayedAt: "2026-10-27" }), today)).toBe("Llevas 12 días sin volver. La aventura te espera.");
  expect(keeperLine(withData({ status: "jugando", lastPlayedAt: "2026-11-08" }), today)).toContain("¡Hoy has jugado!");
  expect(keeperLine(withData({ status: "jugando", completed100: true }), today)).toContain("Al 100 %");
});

test("jugar hoy supera niveles y el 100 % da un trofeo que se conserva", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });
  await cards(page).getByRole("link", { name: /Tunic/ }).click();
  await expect(page.getByRole("button", { name: "Tu copia, conseguido" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Primera partida, pendiente" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tus récords" }).getByText("PC", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /He jugado hoy/ }).click();
  await expect(page.getByText("¡Nivel superado: Primera partida!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Primera partida, conseguido" })).toBeVisible();

  // Pulsar un nivel lleva a su misión y la resalta.
  await page.getByRole("button", { name: /^Tu nota, / }).click();
  await expect(page.locator('[data-stage="4"][data-selected]')).toBeVisible();

  await page.getByRole("button", { name: "100 %", exact: true }).click();
  await expect(page.getByText(/Has completado Tunic del todo/)).toBeVisible();
  await page.getByText(/Has completado Tunic del todo/).click();
  await expect(page.getByText(/Has completado Tunic del todo/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("img", { name: "Trofeo del 100 %" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tus récords" }).getByText("Al 100 %")).toBeVisible();
  await expect(page.getByText(/Este trofeo se queda para siempre/)).toBeVisible();
  // Al recargar no se repite la celebración.
  await expect(page.getByText(/Has completado Tunic del todo/)).toHaveCount(0);

  await page.getByRole("button", { name: "Al 100 %", exact: true }).click();
  await expect(page.getByRole("img", { name: "Trofeo del 100 %" })).toHaveCount(0);
});

test("el nombre y los estados van en una sola línea, y los recuadros igualados", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "The Legend of Zelda: Tears of the Kingdom", platform: "Switch", format: "Físico" });
  await cards(page).getByRole("link", { name: /Tears of the Kingdom/ }).click();
  const heading = page.getByRole("heading", { level: 1, name: /Tears of the Kingdom/ });
  await expect(heading).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const lines = await heading.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBe(1);
  const tops = await page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  const left = await page.getByRole("region", { name: "Misiones" }).boundingBox();
  const right = await page.getByRole("region", { name: "Tus récords" }).locator("xpath=..").boundingBox();
  expect(Math.round(left!.height)).toBe(Math.round(right!.height));

  // El inventario va entre la carátula y las misiones.
  const inventoryBox = await page.getByRole("region", { name: "Inventario" }).boundingBox();
  expect(inventoryBox!.y).toBeLessThan(left!.y);
  expect(Math.round(inventoryBox!.x)).toBe(Math.round(left!.x));

  // Los recuadros de abajo se alinean con los de arriba.
  const techBox = await page.getByRole("region", { name: "Ficha técnica" }).boundingBox();
  const moreBox = await page.getByRole("region", { name: "Más datos" }).boundingBox();
  expect(Math.round(techBox!.x)).toBe(Math.round(left!.x));
  expect(Math.round(techBox!.width)).toBe(Math.round(left!.width));
  expect(Math.round(moreBox!.x)).toBe(Math.round(right!.x));
  expect(Math.round(moreBox!.width)).toBe(Math.round(right!.width));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("la nota de Metacritic se apunta a mano, junto a la tuya, y se conserva", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Hades", platform: "Switch" });
  await cards(page).getByRole("link", { name: /Hades/ }).click();
  const records = page.getByRole("region", { name: "Tus récords" });
  await expect(records.getByRole("listitem").nth(3)).toContainText("Tu nota");
  await expect(records.getByRole("listitem").nth(4)).toContainText("Metacritic");

  await records.getByRole("button", { name: "Nota de Metacritic: añadir" }).click();
  await records.getByLabel("Nota de Metacritic").fill("120");
  await records.getByLabel("Nota de Metacritic").press("Enter");
  await expect(records.getByText("Tiene que estar entre 0 y 100.")).toBeVisible();
  await records.getByLabel("Nota de Metacritic").fill("92,5");
  await records.getByLabel("Nota de Metacritic").press("Enter");
  await expect(records.getByText("Escribe un número entero.")).toBeVisible();
  await records.getByLabel("Nota de Metacritic").fill("93");
  await records.getByLabel("Nota de Metacritic").press("Enter");
  await expect(records.getByRole("button", { name: /^Nota de Metacritic: 93 \/ 100/ })).toBeVisible();

  await page.reload();
  await expect(records.getByRole("button", { name: /^Nota de Metacritic: 93 \/ 100/ })).toBeVisible();

  // Se puede borrar dejándola en blanco.
  await records.getByRole("button", { name: /^Nota de Metacritic: 93/ }).click();
  await records.getByLabel("Nota de Metacritic").fill("");
  await records.getByLabel("Nota de Metacritic").press("Enter");
  await expect(records.getByRole("button", { name: "Nota de Metacritic: añadir" })).toBeVisible();
});

test("las fechas se leen como día/mes/año", () => {
  expect(parseDmy("3/10/2025")).toEqual({ ok: true, iso: "2025-10-03" });
  expect(parseDmy(" 03-10-2025 ")).toEqual({ ok: true, iso: "2025-10-03" });
  expect(parseDmy("3.10.2025")).toEqual({ ok: true, iso: "2025-10-03" });
  expect(parseDmy("03102025")).toEqual({ ok: true, iso: "2025-10-03" });
  expect(parseDmy("29/02/2024")).toEqual({ ok: true, iso: "2024-02-29" });
  expect(parseDmy("")).toEqual({ ok: true, iso: null });
  expect(parseDmy("29/02/2025").ok).toBe(false);
  expect(parseDmy("13/13/2025").ok).toBe(false);
  expect(parseDmy("03/10/25")).toEqual({ ok: false, error: "Escribe el año con cuatro cifras, por ejemplo 2025." });
  expect(parseDmy("ayer").ok).toBe(false);
  expect(isoToDmy("2025-10-03")).toBe("03/10/2025");
});

test("la fecha se escribe como día/mes/año, se elige en el calendario y una mal escrita avisa", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "PC" });
  await cards(page).getByRole("link", { name: /Celeste/ }).click();
  const quests = page.getByRole("region", { name: "Misiones" });
  const finished = quests.getByLabel("Terminado", { exact: true });
  const saved = quests.getByRole("button", { name: "Terminado: 3 oct 2025. Editar" });

  // Siempre día/mes/año, sea cual sea el idioma del navegador.
  await quests.getByRole("button", { name: "Terminado: añadir" }).click();
  await finished.fill("3/10/2025");
  await finished.press("Enter");
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(finished).toHaveValue("03/10/2025");

  // Una fecha imposible o con el año en dos cifras avisa y no toca la guardada.
  await finished.fill("31/02/2025");
  await finished.press("Enter");
  await expect(quests.getByText("Esa fecha no existe", { exact: false })).toBeVisible();
  await finished.fill("05/10/25");
  await finished.blur();
  await expect(quests.getByText("Escribe el año con cuatro cifras", { exact: false })).toBeVisible();
  await finished.press("Escape");
  await expect(saved).toBeVisible();

  // El día elegido en el calendario pasa al texto y se guarda al salir.
  await saved.click();
  await quests.getByLabel("Elegir en el calendario").fill("2024-12-24");
  await expect(finished).toHaveValue("24/12/2024");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(quests.getByRole("button", { name: "Terminado: 24 dic 2024. Editar" })).toBeVisible();

  await page.reload();
  await expect(quests.getByRole("button", { name: "Terminado: 24 dic 2024. Editar" })).toBeVisible();
});

test("la nota de la crítica llega con las sugerencias y se puede traer después", async ({ page }) => {
  const game = { year: 2020, coverUrl: null, backdropUrl: null, genres: [], platforms: ["PC"], modes: [], moods: [], lengthHours: null };
  const catalog = (results: object[]) => ({ json: { ok: true, results } });
  let byId: object = catalog([]);
  await page.route("**/api/catalogo?*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("id")) return route.fulfill(byId);
    return route.fulfill(
      catalog([
        { ...game, igdbId: 1, title: "Con crítica", criticRating: 91 },
        { ...game, igdbId: 2, title: "Sin crítica", criticRating: null },
      ]),
    );
  });

  const record = page.getByRole("region", { name: "Tus récords" }).getByRole("listitem").filter({ hasText: "Crítica IGDB" });

  await openApp(page, "/biblioteca");
  await addFromCatalog(page, "Con crítica");
  await expect(record).toContainText("91 / 100");

  await page.goto("/biblioteca");
  await addFromCatalog(page, "Sin crítica");
  const search = record.getByRole("button", { name: "Buscar la nota de la crítica en IGDB" });

  // Si el catálogo falla se puede reintentar; si no la tiene, lo dice.
  byId = { json: { ok: false, reason: "error", message: "Sin conexión" } };
  await search.click();
  await expect(search).toHaveText("Reintentar");
  byId = catalog([{ ...game, igdbId: 2, title: "Sin crítica", criticRating: 84 }]);
  await search.click();
  await expect(record).toContainText("84 / 100");

  await page.reload();
  await expect(record).toContainText("84 / 100");
});

test("la ficha técnica llega con las sugerencias y solo rellena huecos", async ({ page }) => {
  const game = { year: 2020, coverUrl: null, backdropUrl: null, genres: [], platforms: ["PC"], modes: [], moods: [], lengthHours: null, criticRating: null };
  const details = { summary: "Una historia de ejemplo.", developer: "Estudio Ola", saga: "Saga del mar", releaseDate: "2020-09-17", ageRating: "PEGI 16" };
  const empty = { summary: null, developer: null, saga: null, releaseDate: null, ageRating: null };
  const catalog = (results: object[]) => ({ json: { ok: true, results } });
  let byId: object = catalog([{ ...game, ...empty, igdbId: 2, title: "Cr sin ficha" }]);
  await page.route("**/api/catalogo?*", (route) => {
    if (new URL(route.request().url()).searchParams.has("id")) return route.fulfill(byId);
    return route.fulfill(
      catalog([
        { ...game, ...details, igdbId: 1, title: "Cr con ficha" },
        { ...game, ...empty, igdbId: 2, title: "Cr sin ficha" },
      ]),
    );
  });
  const sheet = page.getByRole("region", { name: "Ficha técnica" });
  const bring = (what: string) => sheet.getByRole("button", { name: `Traer de IGDB: ${what}` });

  await openApp(page, "/biblioteca");
  await addFromCatalog(page, "Cr con ficha");
  await expect(sheet.getByRole("button", { name: /^Sinopsis: Una historia de ejemplo/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: Estudio Ola/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Saga: Saga del mar/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Lanzamiento: .*2020/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Edad: PEGI 16/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Traer de IGDB/ })).toHaveCount(0);

  await page.goto("/biblioteca");
  await addFromCatalog(page, "Cr sin ficha");

  // Si IGDB no tiene un dato, lo dice en ese dato y los demás siguen disponibles.
  await bring("saga").click();
  await expect(sheet.getByRole("status")).toHaveText("IGDB no tiene este dato");
  await expect(bring("saga")).toHaveCount(0);
  await expect(bring("desarrolladora")).toBeVisible();
  await page.reload();

  // Lo escrito a mano se queda y su botón desaparece.
  await sheet.getByRole("button", { name: "Desarrolladora: añadir" }).click();
  await sheet.getByRole("textbox", { name: "Desarrolladora" }).fill("La mía");
  await sheet.getByRole("textbox", { name: "Desarrolladora" }).press("Enter");
  await expect(bring("desarrolladora")).toHaveCount(0);

  // Cada botón trae solo su dato.
  byId = catalog([{ ...game, ...details, igdbId: 2, title: "Cr sin ficha" }]);
  await bring("saga").click();
  await expect(sheet.getByRole("button", { name: /^Saga: Saga del mar/ })).toBeVisible();
  await expect(bring("saga")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Edad: añadir" })).toBeVisible();
  await bring("edad").click();
  await expect(sheet.getByRole("button", { name: /^Edad: PEGI 16/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: La mía/ })).toBeVisible();
  await expect(bring("sinopsis")).toBeVisible();
  await expect(bring("lanzamiento")).toBeVisible();

  await page.reload();
  await expect(sheet.getByRole("button", { name: /^Edad: PEGI 16/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: La mía/ })).toBeVisible();
});

test("«Para elegir» trae de IGDB solo lo que falta y distingue un fallo de un dato que no existe", async ({ page }) => {
  const game = { year: 2020, coverUrl: null, backdropUrl: null, genres: [], platforms: ["PC"], criticRating: null, summary: null, developer: null, saga: null, releaseDate: null, ageRating: null };
  const bare = { ...game, igdbId: 3, title: "Cr para elegir", modes: [], moods: [], lengthHours: null };
  const noLength = { ...game, igdbId: 4, title: "Cr sin duración", modes: ["solo"], moods: ["accion"], lengthHours: null };
  const catalog = (results: object[]) => ({ json: { ok: true, results } });
  let byId: object = catalog([noLength]);
  const asked: string[] = [];
  await page.route("**/api/catalogo?*", (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("id")) return route.fulfill(catalog([bare, noLength]));
    asked.push(url.search);
    return route.fulfill(byId);
  });
  const panel = page.getByRole("region", { name: "Para elegir a qué jugar" });
  const bringLength = panel.getByRole("button", { name: "Traer de IGDB: duración total" });
  const bringModes = panel.getByRole("button", { name: "Traer de IGDB: cómo se juega" });
  const bringMoods = panel.getByRole("button", { name: "Traer de IGDB: tipo de experiencia" });

  // El botón solo sale en el dato que falta.
  await openApp(page, "/biblioteca");
  await addFromCatalog(page, "Cr sin duración");
  await expect(bringModes).toHaveCount(0);
  await expect(bringMoods).toHaveCount(0);
  await bringLength.click();
  await expect(panel.getByRole("status")).toHaveText("IGDB no tiene este dato");
  expect(asked[0]).toContain("duracion=1");

  await page.goto("/biblioteca");
  await addFromCatalog(page, "Cr para elegir");
  await expect(bringModes).toBeVisible();
  await panel.getByRole("button", { name: "Competitivo" }).click();
  await expect(bringModes).toHaveCount(0);

  // Un fallo no se confunde con que IGDB no lo tenga.
  byId = { status: 502, json: { ok: false, reason: "error", message: "IGDB respondió 500." } };
  await bringLength.click();
  await expect(bringLength).toContainText("Reintentar");
  await expect(panel.getByRole("status")).toHaveCount(0);

  // Cada botón trae solo su dato y no pisa lo marcado a mano.
  byId = catalog([{ ...bare, modes: ["solo"], moods: ["historia"], lengthHours: 12.5 }]);
  await bringLength.click();
  await expect(panel.getByRole("button", { name: /^Duración total.*12,5 h/ })).toBeVisible();
  await expect(bringLength).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Historia" })).toHaveAttribute("aria-pressed", "false");
  await bringMoods.click();
  await expect(panel.getByRole("button", { name: "Historia" })).toHaveAttribute("aria-pressed", "true");
  await expect(bringMoods).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Competitivo" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByRole("button", { name: "Un jugador" })).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(panel.getByRole("button", { name: /^Duración total.*12,5 h/ })).toBeVisible();
});

test("un juego escrito a mano no enseña la fila de la crítica: no hay nota que buscar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "PC" });
  await cards(page).getByRole("link", { name: /Celeste/ }).click();
  const records = page.getByRole("region", { name: "Tus récords" });
  await expect(records).toContainText("Tu nota");
  await expect(records).not.toContainText("Crítica IGDB");
});

test("un dato mal escrito avisa y no se guarda", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });
  await cards(page).getByRole("link", { name: /Celeste/ }).click();
  await page.getByRole("button", { name: /^Horas jugadas/ }).click();
  await page.getByLabel("Horas jugadas").fill("muchas");
  await page.getByLabel("Horas jugadas").press("Enter");
  await expect(page.getByText("Escribe un número, por ejemplo 12,5.")).toBeVisible();
  await page.getByLabel("Horas jugadas").fill("3,5");
  await page.getByLabel("Horas jugadas").press("Enter");
  await expect(page.getByRole("button", { name: /^Horas jugadas: 3,5 h/ })).toBeVisible();
});

const PISTAS = "ludoteca:pistas-vistas";
const openFicha = async (page: Page, title: RegExp) => {
  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: title }).first().click();
  await expect(page.getByRole("status", { name: "Guardiana", exact: true })).toBeVisible();
  return page.getByRole("status", { name: "Pista de la guardiana" });
};
const freshHints = (page: Page, seen: string[] = []) =>
  page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("pistas-preparadas")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("pistas-preparadas", "1");
      }
    },
    [PISTAS, JSON.stringify(seen)],
  );

/** Lo que tapa el bocadillo: casillas, sus nombres, la carátula y el cuadro de la guardiana. */
const coveredBy = (page: Page) =>
  page.evaluate(() => {
    const bubble = document.querySelector('[aria-label="Pista de la guardiana"]')!.getBoundingClientRect();
    const map = document.querySelector('[aria-label="Guardiana"]')!.parentElement!;
    const nodes = [...map.querySelectorAll("button[aria-label$='conseguido'], button[aria-label$='pendiente']")];
    const targets = [
      ...nodes.flatMap((n) => [n, n.nextElementSibling].filter(Boolean) as Element[]),
      document.querySelector('[aria-label="Guardiana"]')!,
      document.querySelector('[class*="coverWrap"]')!,
    ];
    return targets
      .map((t) => ({ name: t.getAttribute("aria-label") ?? t.textContent?.trim().slice(0, 30) ?? "", r: t.getBoundingClientRect() }))
      .filter(({ r }) => r.width && r.height && r.left < bubble.right && r.right > bubble.left && r.top < bubble.bottom && r.bottom > bubble.top)
      .map(({ name }) => name);
  });

test("la primera ficha, la guardiana explica el mapa en un bocadillo, una sola vez", async ({ page }) => {
  await freshHints(page);
  await loadDemo(page);
  let hint = await openFicha(page, /Hades/);
  await expect(hint).toContainText("¡Toca una!");
  await expect(hint.getByRole("link", { name: "Ver el manual" })).toHaveAttribute("href", "/manual?pagina=3");
  // La guardiana sigue con su frase de siempre en su cuadro.
  await expect(page.getByRole("status", { name: "Guardiana", exact: true })).not.toContainText("¡Toca una!");
  hint = await openFicha(page, /Celeste/);
  await expect(hint).toContainText("se cambia tocándolo");
  hint = await openFicha(page, /Hollow Knight/);
  await expect(hint).toHaveCount(0);
});

test("el bocadillo se cierra al tocar la equis", async ({ page }) => {
  await freshHints(page);
  await loadDemo(page);
  const hint = await openFicha(page, /Hades/);
  await hint.getByRole("button", { name: "Cerrar la pista" }).click();
  await expect(hint).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Guardiana", exact: true })).toBeVisible();
});

test("la primera moneda, la guardiana cuenta qué apunta", async ({ page }) => {
  await freshHints(page, ["mapa", "datos"]);
  await loadDemo(page);
  const hint = await openFicha(page, /Hades/);
  await expect(hint).toHaveCount(0);
  await page.getByRole("button", { name: /Inserta moneda/ }).click();
  await expect(hint).toContainText("¡Moneda echada!");
  await expect(hint.getByRole("link", { name: "Ver el manual" })).toHaveAttribute("href", "/manual?pagina=4");
  await expect(page.getByRole("status", { name: "Guardiana", exact: true })).toContainText("¡Hoy has jugado!");
  await page.reload();
  await expect(page.getByRole("status", { name: "Pista de la guardiana" })).toHaveCount(0);
});

test("sin almacenamiento, la ficha abre sin pistas", async ({ page }) => {
  await loadDemo(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "ludoteca:pistas-vistas") throw new Error("almacenamiento bloqueado");
      return original.call(this, key);
    };
  });
  const hint = await openFicha(page, /Hades/);
  await expect(page.getByRole("heading", { level: 1, name: "Hades" })).toBeVisible();
  await expect(hint).toHaveCount(0);
});

test("con el almacenamiento lleno, la pista no se repite en cada visita", async ({ page }) => {
  await loadDemo(page);
  await page.addInitScript(() => {
    localStorage.removeItem("ludoteca:pistas-vistas");
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "ludoteca:pistas-vistas") throw new DOMException("cuota llena", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const hint = await openFicha(page, /Hades/);
  await expect(page.getByRole("heading", { level: 1, name: "Hades" })).toBeVisible();
  await expect(hint).toHaveCount(0);
});

test("una ficha que no existe no gasta la pista del mapa", async ({ page }) => {
  await freshHints(page);
  await loadDemo(page);
  await page.goto("/juego/no-existe");
  await expect(page.getByRole("heading", { name: "Este juego no está en tu biblioteca" })).toBeVisible();
  const hint = await openFicha(page, /Hades/);
  await expect(hint).toContainText("¡Toca una!");
});

test("en el ordenador, el bocadillo va junto a la guardiana sin tapar casillas, nombres ni la carátula", async ({ page }) => {
  await loadDemo(page);
  for (const [width, height] of [[1920, 1000], [1920, 880], [1440, 900], [1366, 650], [1280, 800], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => localStorage.removeItem("ludoteca:pistas-vistas"));
    const hint = await openFicha(page, /Hades/);
    await expect(hint).toBeVisible();
    expect(await coveredBy(page), `a ${width}×${height}`).toEqual([]);
    // Junto a ella: a menos de 160 px de la guardiana.
    const keeper = (await page.locator('[class*="keeper"]').first().boundingBox())!;
    const box = (await hint.boundingBox())!;
    const dx = Math.max(0, box.x - (keeper.x + keeper.width), keeper.x - (box.x + box.width));
    const dy = Math.max(0, box.y - (keeper.y + keeper.height), keeper.y - (box.y + box.height));
    expect(Math.hypot(dx, dy), `lejos de la guardiana a ${width}×${height}`).toBeLessThanOrEqual(160);
    // El enlace al manual se puede pulsar.
    if (width === 1440) {
      await hint.getByRole("link", { name: "Ver el manual" }).click({ timeout: 5000 });
      await expect(page.getByRole("region", { name: "El mapa de la ficha" })).toBeVisible();
    }
  }
});
