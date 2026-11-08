import { expect, test } from "@playwright/test";
import { STAGES, currentStage, keeperLine, progressPercent, reachedStages } from "../../src/app/juego/[id]/progress";
import type { Copy, Game } from "../../src/lib/model";
import { addGame, cards, openApp } from "./helpers";

const base = { status: "pendiente", completed100: false, rating: null, hoursPlayed: null, lengthHours: null, startedAt: null, finishedAt: null, lastPlayedAt: null } as unknown as Game;
const withData = (patch: Partial<Game>) => ({ ...base, ...patch }) as Game;
const copy = {} as Copy;

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

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
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
