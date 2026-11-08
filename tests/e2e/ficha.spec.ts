import { type Page, expect, test } from "@playwright/test";
import { STAGES, currentStage, keeperLine, progressPercent, reachedStages } from "../../src/app/juego/[id]/progress";
import type { Copy, Game } from "../../src/lib/model";
import { addGame, cards, openApp } from "./helpers";

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
  const bring = sheet.getByRole("button", { name: "Traer los datos de IGDB" });

  await openApp(page, "/biblioteca");
  await addFromCatalog(page, "Cr con ficha");
  await expect(sheet.getByRole("button", { name: /^Sinopsis: Una historia de ejemplo/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: Estudio Ola/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Saga: Saga del mar/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Lanzamiento: .*2020/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Edad: PEGI 16/ })).toBeVisible();
  await expect(bring).toHaveCount(0);

  await page.goto("/biblioteca");
  await addFromCatalog(page, "Cr sin ficha");

  // Si IGDB no tiene nada, lo dice.
  await bring.click();
  await expect(sheet.getByRole("status")).toHaveText("IGDB no tiene más datos");
  await expect(bring).toHaveCount(0);
  await page.reload();

  // Lo escrito a mano no se pisa.
  await sheet.getByRole("button", { name: "Desarrolladora: añadir" }).click();
  await sheet.getByLabel("Desarrolladora").fill("La mía");
  await sheet.getByLabel("Desarrolladora").press("Enter");
  byId = catalog([{ ...game, ...details, igdbId: 2, title: "Cr sin ficha" }]);
  await bring.click();
  await expect(sheet.getByRole("button", { name: /^Saga: Saga del mar/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: La mía/ })).toBeVisible();
  await expect(bring).toHaveCount(0);

  await page.reload();
  await expect(sheet.getByRole("button", { name: /^Edad: PEGI 16/ })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Desarrolladora: La mía/ })).toBeVisible();
});

test("un juego escrito a mano no tiene nota de la crítica que buscar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "PC" });
  await cards(page).getByRole("link", { name: /Celeste/ }).click();
  const record = page.getByRole("region", { name: "Tus récords" }).getByRole("listitem").filter({ hasText: "Crítica IGDB" });
  await expect(record).toContainText("---");
  await expect(record.getByRole("button")).toHaveCount(0);
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
