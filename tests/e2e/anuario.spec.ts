import { type Page, expect, test } from "@playwright/test";
import { activeYears, compareLine, computeYear } from "../../src/lib/anuario";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Copy, type Game, type Library, type YearWrap, createCopy, createGame, emptyLibrary } from "../../src/lib/model";
import { loadDemo, openApp } from "./helpers";

/* Anuario: el resumen de cada año, calculado de las fechas que hay y congelado al cerrarlo. */

const game = (title: string, patch: Partial<Game> = {}): Game => ({ ...createGame({ title }), ...patch });
const copy = (g: Game, patch: Partial<Copy> = {}): Copy => ({ ...createCopy(g.id, { platform: "PS5", format: "digital" }), ...patch });
const lib = (games: Game[], copies: Copy[] = []): Library => ({ ...emptyLibrary(), games, copies });

test("terminados: cada juego una vez y las vueltas aparte", () => {
  const twice = game("Hades", { pastRuns: [{ start: "2026-01-02", end: "2026-02-01" }], startedAt: "2026-05-01", finishedAt: "2026-06-01" });
  const once = game("Celeste", { startedAt: "2026-03-01", finishedAt: "2026-03-20" });
  const data = computeYear(lib([twice, once]), 2026);
  expect(data.finished).toEqual({ games: 2, replays: 1 });
  expect(data.started).toBe(2);
});

test("las fechas del borde caen cada una en su año", () => {
  const nochevieja = game("Nochevieja", { finishedAt: "2025-12-31" });
  const anoNuevo = game("Año nuevo", { finishedAt: "2026-01-01" });
  expect(computeYear(lib([nochevieja, anoNuevo]), 2025).finished.games).toBe(1);
  expect(computeYear(lib([nochevieja, anoNuevo]), 2026).first?.title).toBe("Año nuevo");
  expect(computeYear(lib([nochevieja, anoNuevo]), 2026).finished.games).toBe(1);
});

test("por mes, el mes fuerte, el primero y el último", () => {
  const a = game("A", { finishedAt: "2026-06-03" });
  const b = game("B", { finishedAt: "2026-06-20" });
  const c = game("C", { finishedAt: "2026-02-10" });
  const data = computeYear(lib([a, b, c]), 2026);
  expect(data.byMonth).toHaveLength(12);
  expect(data.byMonth[5]).toBe(2);
  expect(data.byMonth[1]).toBe(1);
  expect(data.bestMonth).toBe(5);
  expect(data.first?.title).toBe("C");
  expect(data.last?.title).toBe("B");
  expect(computeYear(lib([]), 2026).bestMonth).toBeNull();
});

test("favoritos: los terminados del año con nota, de mejor a peor, como mucho 3", () => {
  const games = [
    game("Sin nota", { finishedAt: "2026-01-05" }),
    game("Siete", { finishedAt: "2026-01-06", rating: 7 }),
    game("Diez", { finishedAt: "2026-01-07", rating: 10 }),
    game("Nueve", { finishedAt: "2026-01-08", rating: 9 }),
    game("Ocho", { finishedAt: "2026-01-09", rating: 8 }),
    game("De otro año", { finishedAt: "2025-01-09", rating: 10 }),
  ];
  expect(computeYear(lib(games), 2026).favorites.map((g) => g.title)).toEqual(["Diez", "Nueve", "Ocho"]);
  expect(computeYear(lib([game("Sin nota", { finishedAt: "2026-01-05" })]), 2026).favorites).toEqual([]);
});

test("tu ludoteca creció: copias del año, juegos nuevos, gasto, regalos, gratis y cuántas no tienen fecha", () => {
  const nuevo = game("Nuevo");
  const viejo = game("Viejo");
  const copies = [
    copy(nuevo, { acquiredAt: "2026-04-01", pricePaid: 30 }),
    copy(viejo, { acquiredAt: "2024-01-01", pricePaid: 10 }),
    copy(viejo, { acquiredAt: "2026-05-01", priceKind: "regalo" }),
    copy(nuevo, { acquiredAt: "2026-06-01", priceKind: "gratis" }),
    copy(nuevo, { acquiredAt: "2026-07-01", pricePaid: 15 }),
    copy(viejo, { acquiredAt: null }),
  ];
  expect(computeYear(lib([nuevo, viejo], copies), 2026).library).toEqual({ copies: 4, newGames: 1, spent: 45, gifts: 1, free: 1, undatedCopies: 1 });
});

test("lo de demostración no cuenta, y una carátula subida a mano no se guarda", () => {
  const demo = game("Demo", { finishedAt: "2026-03-01", demo: true });
  const subida = game("Subida", { finishedAt: "2026-03-02", coverUrl: "data:image/png;base64,AAAA" });
  const data = computeYear(lib([demo, subida]), 2026);
  expect(data.finished.games).toBe(1);
  expect(data.first).toMatchObject({ title: "Subida", coverUrl: null, date: "2026-03-02" });
  expect(data.version).toBe(1);
});

test("perfil: géneros, plataforma y tipo de experiencia de lo terminado, con su frase", () => {
  const rol = game("Rol", { finishedAt: "2026-03-01", genres: ["Rol", "Aventura"], moods: ["historia"] });
  const rol2 = game("Rol 2", { finishedAt: "2026-04-01", genres: ["Rol"], moods: ["historia", "reto"] });
  const data = computeYear(lib([rol, rol2], [copy(rol, { platform: "PS5" }), copy(rol2, { platform: "PS4" })]), 2026);
  expect(data.profile.genres).toEqual(["Rol", "Aventura"]);
  expect(data.profile.family).toBe("PlayStation");
  expect(data.profile.moods[0]).toBe("historia");
  expect(data.profile.line).toContain("rol");
});

test("los años con algo, de más nuevo a más viejo", () => {
  const games = [game("A", { finishedAt: "2026-02-01" }), game("B", { startedAt: "2025-02-01" })];
  expect(activeYears(lib(games))).toEqual([2026, 2025]);
});

test("la comparación con el año anterior", () => {
  expect(compareLine(16, 10, 2025)).toBe("+6 que en 2025");
  expect(compareLine(8, 10, 2025)).toBe("−2 que en 2025");
  expect(compareLine(3, 3, 2025)).toBe("Igual que en 2025");
  expect(compareLine(5, undefined, 2025)).toBeNull();
});

const wrap = (year: number, patch: Partial<YearWrap> = {}): YearWrap => ({
  id: crypto.randomUUID(),
  year,
  data: computeYear(lib([]), year),
  frozenAt: "2027-01-03T10:00:00.000Z",
  createdAt: "2027-01-03T10:00:00.000Z",
  updatedAt: "2027-01-03T10:00:00.000Z",
  ...patch,
});

test("los años guardados van en las copias de seguridad; al importar, solo entran los que no tienes", () => {
  const mine = { ...lib([]), wraps: [wrap(2025)] };
  const backup = createBackup({ ...lib([]), wraps: [wrap(2025), wrap(2024)] });
  expect(backup.data.wraps.map((w) => w.year)).toEqual([2025, 2024]);
  const plan = planImport(mine, backup);
  expect(plan.newWraps.map((w) => w.year)).toEqual([2024]);
  expect(resolveImport(plan, {}).wraps.map((w) => w.year)).toEqual([2024]);
  // Una copia de antes, sin años guardados, se sigue leyendo.
  const old = JSON.stringify({ ...backup, data: { ...backup.data, wraps: undefined } });
  const parsed = parseBackup(old);
  expect(parsed.ok && parsed.backup.data.wraps).toEqual([]);
});

/** Lo guardado en el navegador, tal cual. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ wraps?: { year: number; data: { finished: { games: number } } }[] }>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("library").objectStore("library").get("data");
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );

test("a partir del 1 de enero, el año anterior se congela solo, una sola vez", async ({ page }) => {
  await loadDemo(page);
  // Los juegos de demostración no cuentan: uno de verdad, terminado en 2026.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const req = store.get("data");
          req.onsuccess = () => {
            const value = req.result;
            const hades = value.games.find((g: { title: string }) => g.title === "Hades");
            Object.assign(hades, { demo: false, finishedAt: "2026-05-01", pastRuns: [] });
            store.put(value, "data").onsuccess = () => resolve();
          };
        };
      }),
  );
  await page.clock.setFixedTime(new Date("2027-01-03T10:00:00"));
  await openApp(page, "/");
  await expect.poll(async () => (await stored(page)).wraps?.map((w) => w.year)).toEqual([2026]);
  expect((await stored(page)).wraps?.[0].data.finished.games).toBe(1);
  await openApp(page, "/biblioteca");
  await openApp(page, "/");
  await page.waitForTimeout(300);
  expect((await stored(page)).wraps).toHaveLength(1);
});

