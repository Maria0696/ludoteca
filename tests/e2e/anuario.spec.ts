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

/** Marca juegos de la demostración como tuyos (los de demostración no cuentan) y les pone datos, por título. */
async function seedGames(page: Page, patches: Record<string, Record<string, unknown>>) {
  await page.evaluate(
    (patches) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const req = store.get("data");
          req.onsuccess = () => {
            const value = req.result;
            for (const g of value.games) if (patches[g.title]) Object.assign(g, { demo: false, pastRuns: [] }, patches[g.title]);
            store.put(value, "data").onsuccess = () => resolve();
          };
        };
      }),
    patches,
  );
}

/**
 * Pausa las pantallas y vuelve a la primera: avanzan solas cada 6 s y, con el equipo cargado, pueden haber avanzado
 * antes del clic. Para recorrerlas a mano, no deben moverse solas.
 */
async function pause(page: Page) {
  const button = page.getByRole("button", { name: "Pausar" });
  if (!(await button.count())) return;
  await button.click();
  const region = page.getByRole("region", { name: /^Pantalla \d+ de \d+$/ });
  for (let i = 0; i < 10 && !(await region.getAttribute("aria-label"))?.startsWith("Pantalla 1 de"); i++) await page.keyboard.press("ArrowLeft");
}

/**
 * Abre el año con el reloj puesto: el 26 de noviembre de 2026, con 2026 en curso. Las pantallas quedan en pausa
 * (con el equipo cargado la prueba va más lenta y avanzarían solas), salvo que se pida verlas avanzar.
 */
async function openYear(page: Page, patches: Record<string, Record<string, unknown>>, year = 2026, { play = false } = {}) {
  await page.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
  await loadDemo(page);
  await seedGames(page, patches);
  await openApp(page, `/anuario/${year}`);
  if (!play) await pause(page);
}

const screen = (page: Page) => page.getByRole("region", { name: /^Pantalla \d+ de \d+$/ });
const total = async (page: Page) => Number((await screen(page).getAttribute("aria-label"))!.match(/de (\d+)$/)![1]);

test("las pantallas de un año se pasan con los botones y las flechas, y Esc vuelve a los años", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01", rating: 9, genres: ["Rol"] }, Celeste: { finishedAt: "2026-03-01" } });
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 1 de/);
  await expect(screen(page)).toContainText("Tu 2026");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 2 de/);
  await expect(screen(page)).toContainText("2");
  await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 3 de/);
  await page.keyboard.press("ArrowLeft");
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 2 de/);
  await page.keyboard.press("Escape");
  // Con el equipo muy cargado (muchas pruebas a la vez contra un solo servidor), la navegación puede tardar.
  await expect(page).toHaveURL(/\/anuario$/, { timeout: 20000 });
});

test("el podio se lee en orden, del primero al tercero, aunque se vea con el primero en el centro", async ({ page }) => {
  await openYear(page, {
    Hades: { finishedAt: "2026-05-01", rating: 8 },
    Celeste: { finishedAt: "2026-03-01", rating: 10 },
    "Hollow Knight": { finishedAt: "2026-06-01", rating: 9 },
  });
  while (!(await screen(page).textContent())?.includes("Tu podio del año")) await page.keyboard.press("ArrowRight");
  const podium = screen(page).getByRole("list", { name: "Tu podio del año" });
  await expect(podium.getByRole("listitem")).toHaveCount(3);
  await expect(podium.getByRole("listitem").nth(0)).toContainText("Celeste");
  await expect(podium.getByRole("listitem").nth(1)).toContainText("Hollow Knight");
  await expect(podium.getByRole("listitem").nth(2)).toContainText("Hades");
  // A la vista, el primero va en el centro y más alto.
  const box = async (i: number) => (await podium.getByRole("listitem").nth(i).boundingBox())!;
  const [first, second, third] = [await box(0), await box(1), await box(2)];
  expect(second.x).toBeLessThan(first.x);
  expect(third.x).toBeGreaterThan(first.x);
});

test("el perfil es una ficha de jugadora: tu género estrella, los demás y tu plataforma", async ({ page }) => {
  await openYear(page, {
    Hades: { finishedAt: "2026-05-01", genres: ["Rol", "Acción"] },
    Celeste: { finishedAt: "2026-03-01", genres: ["Rol", "Plataformas"] },
  });
  while (!(await screen(page).textContent())?.includes("Tu año fue de rol")) await page.keyboard.press("ArrowRight");
  const sheet = screen(page).getByRole("definition");
  await expect(screen(page).getByRole("term").first()).toHaveText("Género estrella");
  await expect(sheet.first()).toHaveText("Rol");
});

test("sin notas no hay pantalla de favoritos", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01", rating: 9 }, Celeste: { finishedAt: "2026-03-01", rating: null } });
  const withRating = await total(page);
  await seedGames(page, { Hades: { finishedAt: "2026-05-01", rating: null } });
  await openApp(page, "/anuario/2026");
  await pause(page);
  await expect.poll(() => total(page)).toBe(withRating - 1);
});

test("cerrar el año lo guarda tal cual: aunque luego se borre un juego, el recuerdo sigue entero", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" }, Celeste: { finishedAt: "2026-03-01" } });
  const n = await total(page);
  for (let i = 1; i < n; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Cerrar el año" }).click();
  await page.getByRole("alert").getByRole("button", { name: "Cerrar el año" }).click();
  await expect(screen(page)).toContainText("Guardado el");
  // Se borra Celeste: el año guardado sigue contándola y nombrándola.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const store = open.result.transaction("library", "readwrite").objectStore("library");
          const req = store.get("data");
          req.onsuccess = () => {
            const value = req.result;
            value.games = value.games.filter((g: { title: string }) => g.title !== "Celeste");
            store.put(value, "data").onsuccess = () => resolve();
          };
        };
      }),
  );
  await openApp(page, "/anuario/2026");
  await pause(page);
  await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toContainText("2");
  while (!(await screen(page).textContent())?.includes("Primero y último")) await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toContainText("Celeste");
});

test("con «Reducir movimiento», las pantallas entran solo con un fundido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openYear(page, { Hades: { finishedAt: "2026-05-01" } });
  await page.getByRole("button", { name: "Siguiente" }).click();
  // La animación de entrada de la pantalla nueva, por su nombre.
  const anims = () => page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
  await expect.poll(anims).toContain("anuario-fundido");
  expect(await anims()).not.toContain("anuario-entra");
});

test("si varios meses empatan, todos son tu mes", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-07-01" }, Celeste: { finishedAt: "2026-11-02" } });
  while (!(await screen(page).textContent())?.match(/Tus? mes/)) await page.keyboard.press("ArrowRight");
  await expect(screen(page)).toContainText("Tus meses");
  await expect(screen(page)).toContainText("Julio y noviembre");
  await expect(screen(page)).toContainText("1 juego terminado en cada uno");
});

test("todos los años: el guardado y el en curso, cada uno con sus cifras, y la tabla para compararlos", async ({ page }) => {
  // 2025 se congela solo al abrir la app (ya acabó); 2026 está en curso.
  await openYear(page, { Hades: { finishedAt: "2026-05-01" }, Celeste: { finishedAt: "2025-03-01" } });
  await openApp(page, "/anuario");
  const years = page.getByRole("region", { name: "Tus años" });
  await expect(years.getByRole("link", { name: /^2026/ })).toContainText("En curso");
  await expect(years.getByRole("link", { name: /^2025/ })).toContainText("Guardado el");
  await expect(years.getByRole("link", { name: /^2026/ })).toContainText("1 terminado");
  await expect(years.getByRole("link", { name: /^2026/ })).toContainText("Ver tu 2026");
  // El año en curso va primero y en grande.
  const [now, past] = [await years.getByRole("link", { name: /^2026/ }).boundingBox(), await years.getByRole("link", { name: /^2025/ }).boundingBox()];
  expect(now!.width).toBeGreaterThan(past!.width);
  // Para comparar, una fila por año con sus barras.
  const table = page.getByRole("table", { name: "Tus años, uno al lado del otro" });
  await expect(table.getByRole("columnheader")).toHaveText(["Año", "Terminados", "Empezados", "Copias"]);
  await expect(table.getByRole("row", { name: /^2026/ })).toContainText("1");
  await years.getByRole("link", { name: /^2026/ }).click();
  await expect(page).toHaveURL(/\/anuario\/2026$/);
});

test("un año sin nada lo dice y no ofrece guardarlo", async ({ page }) => {
  await openYear(page, {}, 2019);
  await expect(page.getByText("No hay nada de 2019 en tu ludoteca.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar este año|Cerrar el año/ })).toHaveCount(0);
});

test("desde Estadísticas se llega al año en curso del Anuario", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" } });
  await openApp(page, "/estadisticas");
  const banner = page.getByRole("region", { name: "Tu 2026 en el Anuario" });
  await expect(banner).toContainText("1 terminado");
  await banner.getByRole("link", { name: "Ver tu 2026" }).click();
  await expect(page).toHaveURL(/\/anuario\/2026$/);
});

test("del 15 de diciembre al 31 de enero, Inicio avisa de que ya puedes ver tu año", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" } });
  const notice = page.getByRole("link", { name: "Ya puedes ver tu 2026" });
  for (const [day, visible] of [
    ["2026-12-20T10:00:00", true],
    ["2027-01-15T10:00:00", true],
    ["2027-02-10T10:00:00", false],
    ["2026-11-26T10:00:00", false],
  ] as const) {
    await page.clock.setFixedTime(new Date(day));
    await page.evaluate(() => localStorage.setItem("ludoteca:titulo-visto", new Date().toISOString().slice(0, 10)));
    await openApp(page, "/");
    await expect(notice, day).toHaveCount(visible ? 1 : 0);
  }
  await page.clock.setFixedTime(new Date("2026-12-20T10:00:00"));
  await page.evaluate(() => localStorage.setItem("ludoteca:titulo-visto", new Date().toISOString().slice(0, 10)));
  await openApp(page, "/");
  await notice.click();
  await expect(page).toHaveURL(/\/anuario\/2026$/);
});

test("el año ocupa toda la pantalla, por encima de la cabecera", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" } });
  const onTop = await page.evaluate(() => {
    const hit = document.elementFromPoint(window.innerWidth / 2, 20);
    return Boolean(hit?.closest("[data-anuario]"));
  });
  expect(onTop).toBe(true);
});

test("las pantallas avanzan solas; manteniendo pulsado o con «Pausar», se paran", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" }, Celeste: { finishedAt: "2026-03-01" } }, 2026, { play: true });
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 1 de/);
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 2 de/, { timeout: 9000 });
  // En pausa no avanza.
  await page.getByRole("button", { name: "Pausar" }).click();
  await page.waitForTimeout(7000);
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 2 de/);
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(screen(page)).toHaveAttribute("aria-label", /^Pantalla 3 de/, { timeout: 9000 });
});

test("las cifras grandes suben como una puntuación hasta su número", async ({ page }) => {
  await openYear(page, { Hades: { finishedAt: "2026-05-01" }, Celeste: { finishedAt: "2026-03-01" } });
  await page.keyboard.press("ArrowRight");
  const big = screen(page).locator("[data-cifra]");
  await expect(big).toHaveText("2");
  expect(await big.getAttribute("data-cifra")).toBe("2");
});

