import { type Page, expect, test } from "@playwright/test";
import { type Game, createGame, gameSchema } from "../../src/lib/model";
import { archiveRun, finishDates, reopenSameDayRun, runNumber, timesFinished } from "../../src/lib/runs";
import { computeStats } from "../../src/lib/stats";
import { reachedStages } from "../../src/app/juego/[id]/progress";
import { addGame, loadDemo } from "./helpers";

/* Rejugar un juego ya superado: las vueltas anteriores se guardan con su inicio y su fin. */

const game = (patch: Partial<Game>): Game => ({ ...createGame({ title: "Ocarina of Time" }), ...patch });

test("las vueltas: número, veces superado y fechas de fin", () => {
  const replaying = game({ pastRuns: [{ start: "2019-03-12", end: "2019-05-02" }], startedAt: "2026-11-23", finishedAt: null });
  expect(runNumber(replaying)).toBe(2);
  expect(timesFinished(replaying)).toBe(1);
  expect(finishDates(replaying)).toEqual(["2019-05-02"]);
  const finished = { ...replaying, finishedAt: "2026-11-30" };
  expect(timesFinished(finished)).toBe(2);
  expect(finishDates(finished)).toEqual(["2019-05-02", "2026-11-30"]);
});

test("archivar una vuelta la guarda y deja la nueva vacía", () => {
  const done = game({ startedAt: "2019-03-12", finishedAt: "2019-05-02", pastRuns: [] });
  const archived = archiveRun(done);
  expect(archived.pastRuns).toEqual([{ start: "2019-03-12", end: "2019-05-02" }]);
  expect(archived.startedAt).toBeNull();
  expect(archived.finishedAt).toBeNull();
  // Sin vuelta terminada no hay nada que archivar.
  const unfinished = game({ startedAt: "2026-11-01", finishedAt: null });
  expect(archiveRun(unfinished)).toBe(unfinished);
});

test("el error del mismo día recupera la vuelta", () => {
  const today = "2026-11-23";
  const reopened = reopenSameDayRun(game({ pastRuns: [{ start: "2026-11-01", end: today }], startedAt: today, finishedAt: null }), today);
  expect(reopened?.pastRuns).toEqual([]);
  expect(reopened?.startedAt).toBe("2026-11-01");
  expect(reopened?.finishedAt).toBe(today);
  // Una vuelta que acabó otro día es de verdad otra vuelta.
  expect(reopenSameDayRun(game({ pastRuns: [{ start: null, end: "2026-11-20" }], startedAt: today, finishedAt: null }), today)).toBeNull();
});

test("una copia antigua, sin vueltas, se sigue leyendo", () => {
  const { pastRuns, ...old } = game({});
  void pastRuns;
  expect(gameSchema.parse(old).pastRuns).toEqual([]);
});

test("Estadísticas cuenta cada vuelta terminada en su año y su mes", () => {
  const replayed = game({ status: "completado", pastRuns: [{ start: null, end: "2026-01-10" }], startedAt: "2026-11-01", finishedAt: "2026-11-23" });
  const stats = computeStats({ games: [replayed], copies: [], wishlist: [] }, new Date("2026-11-25T12:00:00"));
  expect(stats.finishedThisYear).toBe(2);
  expect(stats.finishedByMonth[0]).toBe(1);
  expect(stats.finishedByMonth[10]).toBe(1);
  // «El último»: la vuelta terminada hoy, no la de enero.
  expect(stats.lastFinished?.finishedAt).toBe("2026-11-23");
});

test("el mapa mantiene «Terminado» mientras rejuegas", () => {
  const replaying = game({ status: "jugando", startedAt: "2026-11-23", finishedAt: null, pastRuns: [{ start: "2019-03-12", end: "2019-05-02" }] });
  expect(reachedStages(replaying, [])[5]).toBe(true);
});

const ZELDA = "The Legend of Zelda: Tears of the Kingdom";

async function openGame(page: Page, title: string) {
  await page.goto("/biblioteca?agrupar=ninguno");
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}
const status = (page: Page, name: string) => page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name });
const lap = (page: Page) => page.getByText(/^Vuelta \d+$/);

test("rejugar un juego superado empieza la vuelta 2 sin perder la primera", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await page.getByRole("button", { name: "Rejugar" }).click();
  await expect(status(page, "Jugando")).toHaveAttribute("aria-checked", "true");
  await expect(lap(page)).toHaveText("Vuelta 2");
  await expect(page.getByText(`«${ZELDA}» empieza la vuelta 2`)).toBeVisible();
  // Mientras se rejuega no se ofrece otra vuelta: aún no ha terminado esta.
  await expect(page.getByRole("button", { name: "Rejugar" })).toHaveCount(0);
  await page.reload();
  await expect(lap(page)).toHaveText("Vuelta 2");
});

test("deshacer «Rejugar» lo deja como estaba", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await page.getByRole("button", { name: "Rejugar" }).click();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(status(page, "Completado")).toHaveAttribute("aria-checked", "true");
  await expect(lap(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rejugar" })).toBeVisible();
});

test("de Completado a Jugando a mano también es una vuelta nueva; dos veces el mismo día cuenta una", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await status(page, "Jugando").click();
  await expect(lap(page)).toHaveText("Vuelta 2");
  // Terminada hace meses: volver a Completado hoy es la vuelta 2 terminada, no un error.
  await status(page, "Completado").click();
  await expect(lap(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rejugar" })).toBeVisible();

  // Un juego terminado hoy, pasado a Jugando y otra vez a Completado por error: sigue siendo una sola vuelta.
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital", status: "Completado" });
  await openGame(page, "Tunic");
  await status(page, "Jugando").click();
  await expect(lap(page)).toHaveText("Vuelta 2");
  await status(page, "Completado").click();
  await page.getByRole("button", { name: "Rejugar" }).click();
  await expect(lap(page)).toHaveText("Vuelta 2");
});

test("pasar un superado a Pausado o Abandonado no archiva la vuelta", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await status(page, "Abandonado").click();
  await expect(lap(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rejugar" })).toBeVisible();
});

test("borrar el fin de la vuelta 2 no toca la primera", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await page.getByRole("button", { name: "Rejugar" }).click();
  const finished = page.getByRole("region", { name: "Misiones" }).getByRole("checkbox", { name: "Termina la historia" });
  await finished.click();
  await expect(status(page, "Completado")).toHaveAttribute("aria-checked", "true");
  await finished.click();
  await expect(status(page, "Jugando")).toHaveAttribute("aria-checked", "true");
  await expect(lap(page)).toHaveText("Vuelta 2");
});

test("un juego sin final no tiene «Rejugar»", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await expect(page.getByRole("button", { name: "Rejugar" })).toBeVisible();
  await page.getByRole("button", { name: "Sin final" }).click();
  await expect(page.getByRole("button", { name: "Rejugar" })).toHaveCount(0);
});

test("una biblioteca guardada antes de las vueltas se puede rejugar", async ({ page }) => {
  await loadDemo(page);
  // Como la de antes de este cambio: los juegos guardados no traen «pastRuns».
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.transaction("library", "readwrite").objectStore("library");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c) return resolve();
            const value = c.value as { games?: Record<string, unknown>[] };
            if (value.games) for (const g of value.games) delete g.pastRuns;
            c.update(value);
            c.continue();
          };
        };
      }),
  );
  await openGame(page, ZELDA);
  await page.getByRole("button", { name: "Rejugar" }).click();
  await expect(lap(page)).toHaveText("Vuelta 2");
});

test("la ficha enseña las vueltas con inicio, fin y días", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  const records = page.getByRole("region", { name: "Tus récords" });
  // Una sola vuelta: no hay lista que enseñar.
  await expect(records.getByRole("list", { name: "Vueltas" })).toHaveCount(0);
  await page.getByRole("button", { name: "Rejugar" }).click();
  const laps = records.getByRole("list", { name: "Vueltas" }).getByRole("listitem");
  await expect(laps).toHaveCount(2);
  await expect(laps.nth(0)).toContainText(/^1\..+→.+\d+ días$/);
  await expect(laps.nth(1)).toContainText(/^2\..+→ en curso$/);
});

test("recuperar el mismo día una vuelta desde «Termina la historia» conserva su inicio", async ({ page }) => {
  await loadDemo(page);
  // Hades se empezó hace semanas: terminarlo hoy deja una vuelta con inicio antiguo y fin de hoy.
  await openGame(page, "Hades");
  const quests = page.getByRole("region", { name: "Misiones" });
  const started = quests.getByRole("button", { name: /^Empezado: / });
  const startedName = await started.getAttribute("aria-label") ?? (await started.textContent());
  const finished = quests.getByRole("checkbox", { name: "Termina la historia" });
  await finished.click();
  await page.getByRole("button", { name: "Rejugar" }).click();
  // Sin «Deshacer» a mano: se vuelve a marcar «Termina la historia» el mismo día.
  await finished.click();
  await expect(lap(page)).toHaveCount(0);
  await expect(quests.getByRole("button", { name: /^Empezado: / })).toHaveAccessibleName(startedName!);
});

test("un superado pausado que vuelve a Jugando es otra vuelta, también con «Inserta moneda»", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, ZELDA);
  await status(page, "Pausado").click();
  await status(page, "Jugando").click();
  await expect(lap(page)).toHaveText("Vuelta 2");
  await expect(page.getByRole("button", { name: "Rejugar" })).toHaveCount(0);

  await openGame(page, "Inside");
  await status(page, "Pausado").click();
  await page.getByRole("button", { name: /Inserta moneda/ }).click();
  await expect(status(page, "Jugando")).toHaveAttribute("aria-checked", "true");
  await expect(lap(page)).toHaveText("Vuelta 2");
});
