import { type Page, expect, test } from "@playwright/test";
import {
  type SteamPlayerAchievement,
  type SteamSchemaAchievement,
  achievementTotals,
  achievementsOfYear,
  completion,
  mergeAchievements,
  missingSorted,
  nearlyDone,
  rarityTier,
} from "../../src/lib/achievements";
import { computeYear } from "../../src/lib/anuario";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Achievement, type GameAchievements, type Library, createCopy, createGame, emptyLibrary } from "../../src/lib/model";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";
import { gamesVisible, parsePercents, parsePlayer, parseSchema, parseSummary } from "../../src/lib/steam-achievements";
import { openAjustes, openApp } from "./helpers";

/* Logros de Steam: la ficha, la vista de todos, el Anuario y Estadísticas. */

const stamp = "2026-11-27T10:00:00.000Z";
const item = (api: string, percent: number | null, unlockedAt: string | null = null, hidden = false): Achievement => ({
  api,
  name: `Logro ${api}`,
  description: `Descripción de ${api}`,
  hidden,
  percent,
  unlockedAt,
  icon: null,
});
const record = (gameId: string, items: Achievement[], patch: Partial<GameAchievements> = {}): GameAchievements => ({
  id: crypto.randomUUID(),
  gameId,
  steamAppId: 1145360,
  total: items.length,
  unlocked: items.filter((i) => i.unlockedAt).length,
  items,
  checkedAt: stamp,
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});

test("los logros salen de juntar lo del jugador, el esquema del juego y la rareza", () => {
  const player: SteamPlayerAchievement[] = [
    { apiname: "A", achieved: 1, unlocktime: 1767225600, name: "Primera huida", description: "Escapa una vez" },
    { apiname: "B", achieved: 0, unlocktime: 0, name: "Sin un rasguño", description: "" },
  ];
  const schema: SteamSchemaAchievement[] = [
    { name: "A", displayName: "Primera huida (esquema)", hidden: 0, description: "Escapa una vez", icon: "https://cdn/a.jpg" },
    { name: "B", hidden: 1, icon: "https://cdn/b.jpg" },
    { name: "C", displayName: "Coleccionista", description: "Todas las armas" },
  ];
  const merged = mergeAchievements(player, schema, { A: 78.1, C: 12.4 });
  expect(merged.total).toBe(3);
  expect(merged.unlocked).toBe(1);
  expect(merged.items).toEqual([
    { api: "A", name: "Primera huida (esquema)", description: "Escapa una vez", hidden: false, percent: 78.1, unlockedAt: "2026-01-01T00:00:00.000Z", icon: "https://cdn/a.jpg" },
    { api: "B", name: "Sin un rasguño", description: null, hidden: true, percent: null, unlockedAt: null, icon: "https://cdn/b.jpg" },
    { api: "C", name: "Coleccionista", description: "Todas las armas", hidden: false, percent: 12.4, unlockedAt: null, icon: null },
  ]);
});

test("los que faltan, del más raro al más común; los que no tienen rareza, al final", () => {
  const items = [item("a", 12.4), item("b", null), item("c", 0.8), item("d", 3.2), item("e", 1, "2026-01-01T00:00:00.000Z")];
  expect(missingSorted(items).map((i) => i.api)).toEqual(["c", "d", "a", "b"]);
});

test("el porcentaje de completado, redondeado hacia abajo", () => {
  expect(completion({ total: 41, unlocked: 23 })).toBe(56);
  expect(completion({ total: 3, unlocked: 2 })).toBe(66);
  expect(completion({ total: 0, unlocked: 0 })).toBe(0);
});

test("la vista de todos: primero los más cerca del 100 %, luego los sin empezar y los completos al final", () => {
  const done = "2026-01-01T00:00:00.000Z";
  const list = [
    record("sin-logros", [], { total: 0, unlocked: 0 }),
    record("cero", [item("a", 5), item("b", 5)]),
    record("completo", [item("a", 5, done)]),
    record("mitad", [item("a", 5, done), item("b", 5)]),
    record("casi", [item("a", 5, done), item("b", 5, done), item("c", 5, done), item("d", 5)]),
    record("casi-largo", [...Array.from({ length: 6 }, (_, i) => item(`x${i}`, 5, done)), item("y", 5), item("z", 5)]),
  ];
  expect(nearlyDone(list).map((g) => g.gameId)).toEqual(["casi", "casi-largo", "mitad", "cero", "completo"]);
});

test("el año de logros: cuántos, los juegos que llegaron al 100 % y el más raro, en hora de Madrid", () => {
  const hades = createGame({ title: "Hades" });
  const celeste = createGame({ title: "Celeste" });
  const list = [
    // Las 00:30 del 1 de enero en Madrid: cuenta para 2026.
    record(hades.id, [item("a", 40, "2025-12-31T23:30:00Z"), item("b", 0.8, "2026-03-01T10:00:00Z"), item("c", 30, "2025-06-01T10:00:00Z")]),
    record(celeste.id, [item("a", 50, "2026-05-01T10:00:00Z"), item("b", 2, null)]),
  ];
  const y = achievementsOfYear(list, [hades, celeste], 2026);
  expect(y.count).toBe(3);
  expect(y.completed).toEqual([{ gameId: hades.id, title: "Hades", date: "2026-03-01T10:00:00Z" }]);
  expect(y.rarest).toEqual({ title: "Hades", name: "Logro b", percent: 0.8 });
  expect(achievementsOfYear(list, [hades, celeste], 2024)).toEqual({ count: 0, completed: [], rarest: null });
});

test("los totales: conseguidos, juegos al 100 %, la media de los empezados y los 5 más raros", () => {
  const done = "2026-01-01T00:00:00.000Z";
  const list = [
    record("a", [item("1", 0.5, done), item("2", 1, done)]),
    record("b", [item("1", 2, done), item("2", 3, done), item("3", 4), item("4", 50)]),
    record("c", [item("1", 9)]),
    record("d", [item("1", 0.1, done), item("2", 7, done), item("3", 8, done)]),
  ];
  const t = achievementTotals(list);
  expect(t.unlocked).toBe(7);
  expect(t.complete).toBe(2);
  // (100 + 50 + 100) / 3: el que no tiene ninguno no cuenta.
  expect(t.average).toBe(83);
  expect(t.rarest.map((r) => r.item.percent)).toEqual([0.1, 0.5, 1, 2, 3]);
});

const STEAM_ID = "76561197960287930";

test("los logros y el perfil de Steam se guardan en las copias y en la nube; las copias de antes se leen sin ellos", () => {
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  const lib: Library = { ...emptyLibrary(), games: [hades], achievements: [record(hades.id, [item("a", 5, stamp), item("b", 0.8)])], settings: { steamId: STEAM_ID } };
  const parsed = parseBackup(JSON.stringify(createBackup(lib)));
  if (!parsed.ok) throw new Error(parsed.errors.join(", "));
  expect(parsed.backup.data.achievements).toEqual(lib.achievements);
  expect(parsed.backup.data.settings).toEqual({ steamId: STEAM_ID });
  const back = libraryFromRows(libraryToRows(lib));
  expect(back.achievements).toEqual(lib.achievements);
  expect(back.settings).toEqual({ steamId: STEAM_ID });

  // Una copia de antes, sin logros ni ajustes.
  const old = createBackup(lib) as unknown as { data: Record<string, unknown> };
  delete old.data.achievements;
  delete old.data.settings;
  const parsedOld = parseBackup(JSON.stringify(old));
  if (!parsedOld.ok) throw new Error(parsedOld.errors.join(", "));
  expect(parsedOld.backup.data.achievements).toEqual([]);
  expect(parsedOld.backup.data.settings).toEqual({ steamId: null });
  expect(libraryFromRows({ games: [] }).settings).toEqual({ steamId: null });

  // Al importarla en una biblioteca vacía, entran los logros de sus juegos y el perfil.
  const changes = resolveImport(planImport(emptyLibrary(), parsed.backup), {});
  expect(changes.achievements).toEqual(lib.achievements);
  expect(changes.settings).toEqual({ steamId: STEAM_ID });
  // Si ya tienes perfil, se queda el tuyo; y los logros de un juego que no se importa no entran.
  const mine = { ...emptyLibrary(), games: [{ ...hades, updatedAt: "otra" }], settings: { steamId: "76561197960287931" } };
  const kept = resolveImport(planImport(mine, parsed.backup), {});
  expect(kept.settings).toBeUndefined();
  expect(kept.achievements).toEqual([]);
});

/** Una biblioteca escrita directamente en el navegador, sin abrir la app. */
async function seed(page: Page, lib: Library) {
  await page.goto("/offline.html");
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("library");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("library", "readwrite");
          tx.objectStore("library").put(value, "data");
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { ...lib, format: 2 },
  );
}

const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Library>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("library", "readonly").objectStore("library").get("data");
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );

test("al eliminar un juego se van también sus logros", async ({ page }) => {
  const inside = createGame({ title: "Inside", steamAppId: 304430 });
  const tunic = createGame({ title: "Tunic", steamAppId: 553420 });
  await seed(page, { ...emptyLibrary(), games: [inside, tunic], achievements: [record(inside.id, [item("a", 5, stamp)]), record(tunic.id, [item("a", 5)])] });
  await openApp(page, `/juego/${inside.id}`);
  await page.getByRole("button", { name: "Eliminar «Inside»" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar juego" }).click();
  await expect.poll(async () => (await stored(page)).achievements.map((a) => a.gameId)).toEqual([tunic.id]);
});

test("se leen bien las respuestas de Steam: los tuyos, el esquema, la rareza, el perfil privado y el juego sin logros", () => {
  expect(
    parsePlayer({ playerstats: { steamID: "1", success: true, achievements: [{ apiname: "A", achieved: 1, unlocktime: 1767225600, name: "Uno", description: "D" }] } }),
  ).toEqual({ ok: true, items: [{ apiname: "A", achieved: 1, unlocktime: 1767225600, name: "Uno", description: "D" }] });
  expect(parsePlayer({ playerstats: { error: "Profile is not public", success: false } })).toEqual({ ok: false, reason: "privado" });
  expect(parsePlayer({ playerstats: { error: "Requested app has no stats", success: false } })).toEqual({ ok: false, reason: "sin-logros" });
  // Un juego con estadísticas pero sin logros responde bien, sin la lista.
  expect(parsePlayer({ playerstats: { steamID: "1", success: true } })).toEqual({ ok: false, reason: "sin-logros" });
  expect(parsePlayer(null)).toEqual({ ok: false, reason: "error" });

  expect(
    parseSchema({ game: { availableGameStats: { achievements: [{ name: "A", displayName: "Uno", hidden: 1, icon: "https://cdn/a.jpg", icongray: "x" }] } } }),
  ).toEqual([{ name: "A", displayName: "Uno", hidden: 1, icon: "https://cdn/a.jpg" }]);
  expect(parseSchema({ game: {} })).toEqual([]);

  // Steam da el porcentaje como texto; a veces, como número.
  expect(parsePercents({ achievementpercentages: { achievements: [{ name: "A", percent: "81.8" }, { name: "B", percent: 3.25 }, { name: "C", percent: "x" }] } })).toEqual({
    A: 81.8,
    B: 3.25,
  });
  expect(parsePercents({})).toEqual({});

  // Si Steam da tu lista de juegos (aunque esté vacía), los detalles de juego son públicos; si no, no.
  expect(gamesVisible({ response: { game_count: 3, games: [] } })).toBe(true);
  expect(gamesVisible({ response: { game_count: 0 } })).toBe(true);
  expect(gamesVisible({ response: {} })).toBe(false);
  expect(gamesVisible(null)).toBe(false);

  // Tu nombre y tu avatar, para la tarjeta de Ajustes.
  expect(parseSummary({ response: { players: [{ steamid: "1", personaname: "Mindanao96", avatarfull: "https://avatars/x_full.jpg", avatarmedium: "https://avatars/x_medium.jpg" }] } })).toEqual({
    name: "Mindanao96",
    avatar: "https://avatars/x_full.jpg",
  });
  expect(parseSummary({ response: { players: [{ personaname: "Sin foto" }] } })).toEqual({ name: "Sin foto", avatar: null });
  expect(parseSummary({ response: { players: [] } })).toBeNull();
  expect(parseSummary(null)).toBeNull();
});

test("la rareza de cada logro: rarísimo por debajo del 5 %, raro por debajo del 20 % y común el resto", () => {
  expect(rarityTier(0.9)).toBe("rarisimo");
  expect(rarityTier(4.99)).toBe("rarisimo");
  expect(rarityTier(5)).toBe("raro");
  expect(rarityTier(19.9)).toBe("raro");
  expect(rarityTier(20)).toBe("comun");
  expect(rarityTier(null)).toBeNull();
});

test("la ruta de los logros comprueba lo que se le pide y, sin clave de Steam, lo dice", async ({ request }) => {
  const ok = { steamId: STEAM_ID, appIds: [1145360] };
  expect((await request.post("/api/logros", { data: { ...ok, steamId: "123" } })).status()).toBe(400);
  expect((await request.post("/api/logros", { data: { ...ok, appIds: Array.from({ length: 11 }, (_, i) => i + 1) } })).status()).toBe(400);
  expect(await (await request.post("/api/logros", { data: ok })).json()).toMatchObject({ ok: false, reason: "no-configurado" });
  expect((await request.get("/api/logros/recientes?steamId=123")).status()).toBe(400);
  expect(await (await request.get(`/api/logros/recientes?steamId=${STEAM_ID}`)).json()).toMatchObject({ ok: false, reason: "no-configurado" });
});

/** Steam, simulado: qué encuentra la tienda por título, qué juegos son recientes y los logros de cada juego. */
async function fakeSteam(
  page: Page,
  opts: { search?: unknown[]; recent?: number[]; games?: Record<string, unknown>; privado?: boolean; noTuyos?: number[]; hang?: number[] } = {},
) {
  const asked = { search: [] as string[], logros: [] as number[][] };
  await page.route("**/api/precios/steam/buscar?*", (route) => {
    asked.search.push(new URL(route.request().url()).searchParams.get("q") ?? "");
    return route.fulfill({ json: { ok: true, candidates: opts.search ?? [] } });
  });
  await page.route("**/api/logros/recientes?*", (route) => route.fulfill({ json: { ok: true, appIds: opts.recent ?? [] } }));
  await page.route("**/api/logros", (route) => {
    const body = route.request().postDataJSON() as { appIds: number[] };
    asked.logros.push(body.appIds);
    if (opts.privado) return route.fulfill({ json: { ok: false, reason: "privado", message: "Steam no deja ver tus logros." } });
    // Una tanda que Steam tarda en contestar: no se responde nunca.
    if (body.appIds.some((id) => opts.hang?.includes(id))) return;
    const games = Object.fromEntries(Object.entries(opts.games ?? {}).filter(([id]) => body.appIds.includes(Number(id))));
    const noTuyos = (opts.noTuyos ?? []).filter((id) => body.appIds.includes(id));
    return route.fulfill({ json: { ok: true, games, sinLogros: [], noTuyos, failed: [] } });
  });
  return asked;
}

/** La biblioteca sembrada con logros «aún sin mirar hoy» (borra la marca que traen las pruebas). */
async function seedFresh(page: Page, lib: Library) {
  await seed(page, lib);
  await page.evaluate(() => localStorage.removeItem("ludoteca:logros-mirados"));
}

const HADES_LOGROS = {
  total: 2,
  unlocked: 1,
  items: [item("a", 40, "2026-03-01T10:00:00.000Z"), item("b", 0.8)],
};

test("al abrir la app, un juego de PC escrito a mano se enlaza con Steam por su título y se guardan sus logros", async ({ page }) => {
  const hades = createGame({ title: "Hades" });
  await seedFresh(page, { ...emptyLibrary(), games: [hades], copies: [createCopy(hades.id, { platform: "PC", format: "digital" })], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { search: [{ appId: 1145360, title: "Hades", amount: 6.12 }], games: { "1145360": HADES_LOGROS } });
  await openApp(page, "/");
  await expect.poll(async () => (await stored(page)).achievements.map((a) => [a.gameId, a.unlocked, a.total])).toEqual([[hades.id, 1, 2]]);
  expect((await stored(page)).games[0].steamAppId).toBe(1145360);
  expect(asked.search).toEqual(["Hades"]);
  expect(asked.logros).toEqual([[1145360]]);
});

test("sin perfil de Steam guardado, no se pregunta nada a Steam", async ({ page }) => {
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  await seedFresh(page, { ...emptyLibrary(), games: [hades] });
  const asked = await fakeSteam(page, { games: { "1145360": HADES_LOGROS } });
  await openApp(page, "/");
  await page.waitForTimeout(1500);
  expect(asked.logros).toEqual([]);
  expect(asked.search).toEqual([]);
});

test("cada día solo se miran los nuevos, los jugados hace poco y los que llevan un mes sin mirarse", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-27T10:00:00Z"));
  const [nuevo, reciente, viejo, quieto] = ["Nuevo", "Reciente", "Viejo", "Quieto"].map((title, i) => createGame({ title, steamAppId: 100 + i }));
  const old = record(viejo.id, [item("a", 5)], { steamAppId: 102, checkedAt: "2026-10-01T10:00:00.000Z" });
  const recent = record(reciente.id, [item("a", 5)], { steamAppId: 101, checkedAt: "2026-11-26T10:00:00.000Z" });
  const still = record(quieto.id, [item("a", 5)], { steamAppId: 103, checkedAt: "2026-11-26T10:00:00.000Z" });
  await seedFresh(page, { ...emptyLibrary(), games: [nuevo, reciente, viejo, quieto], achievements: [old, recent, still], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { recent: [101] });
  await openApp(page, "/");
  await expect.poll(() => asked.logros.flat().sort()).toEqual([100, 101, 102]);
});

test("el perfil de Steam se guarda y se quita en Ajustes, y al importar de Steam también se guarda", async ({ page }) => {
  await seed(page, { ...emptyLibrary(), games: [createGame({ title: "Tunic" })] });
  await page.route("**/api/steam", (route) => route.fulfill({ json: { ok: true, games: [], steamId: STEAM_ID } }));
  let visible = true;
  await page.route("**/api/logros/perfil?*", (route) => route.fulfill({ json: { ok: true, name: "Alguien", avatar: null, gamesVisible: visible } }));
  await openAjustes(page, "traer");
  const form = page.getByRole("form", { name: "Tu perfil de Steam" });
  await form.getByRole("textbox", { name: "Perfil de Steam" }).fill("https://steamcommunity.com/id/alguien");
  await form.getByRole("button", { name: "Guardar" }).click();
  // Guardado, una tarjeta con tu nombre de Steam; sin la pista de privacidad, que no hace falta.
  await expect(form).toContainText("Alguien");
  await expect(form).toContainText("Logros de Steam: activados");
  await expect(form).not.toContainText("«Detalles de juego»");
  await expect.poll(async () => (await stored(page)).settings?.steamId).toBe(STEAM_ID);
  // «Cambiar» vuelve a enseñar el campo; «Cancelar», la tarjeta.
  await form.getByRole("button", { name: "Cambiar" }).click();
  await expect(form.getByRole("textbox", { name: "Perfil de Steam" })).toBeVisible();
  await form.getByRole("button", { name: "Cancelar" }).click();
  await expect(form).toContainText("Alguien");
  // Si Steam no deja ver tus juegos, la tarjeta lo dice.
  visible = false;
  await openAjustes(page, "traer");
  await expect(form).toContainText("«Detalles de juego» en Público");
  await form.getByRole("button", { name: "Quitar" }).click();
  await expect.poll(async () => (await stored(page)).settings?.steamId).toBeNull();
  await expect(form).toContainText("«Detalles de juego»");

  // Al buscar tus juegos para importarlos, el perfil queda guardado también.
  await page.route("**/api/steam", (route) => route.fulfill({ json: { ok: true, games: [{ appId: 1, name: "Celeste", minutes: 60, icon: null }], steamId: STEAM_ID } }));
  await openApp(page, "/importar?origen=steam");
  await page.getByLabel("Tu perfil de Steam").fill("alguien");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect.poll(async () => (await stored(page)).settings?.steamId).toBe(STEAM_ID);
});

/** Hades con 4 logros: 2 conseguidos y 2 que faltan (uno, oculto). */
function hadesWithAchievements() {
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  const items = [
    item("huida", 78.1, "2026-03-01T10:00:00.000Z"),
    item("armas", 12.4),
    { ...item("final", 3.2), name: "El verdadero final", description: "Llega al final de la historia", hidden: true },
    item("rasguno", 40, "2026-05-02T10:00:00.000Z"),
  ];
  return { hades, rec: record(hades.id, items) };
}

test("la ficha enseña los logros: el progreso, los que faltan del más raro al más común y los conseguidos con su fecha", async ({ page }) => {
  const { hades, rec } = hadesWithAchievements();
  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [rec], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { games: { "1145360": HADES_LOGROS } });
  await openApp(page, `/juego/${hades.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  await expect(panel).toContainText("2 de 4 · 50 %");
  const missing = panel.getByRole("list", { name: "Te faltan" }).getByRole("listitem");
  await expect(missing).toHaveCount(2);
  // El oculto va primero (3,2 %), tapado; «Ver» lo destapa.
  await expect(missing.nth(0)).toContainText("Logro oculto");
  await expect(missing.nth(0)).toContainText(/3,2\s%/);
  await expect(missing.nth(0)).toContainText("Rarísimo");
  await expect(missing.nth(1)).toContainText("Raro");
  await expect(missing.nth(0)).not.toContainText("El verdadero final");
  await missing.nth(0).getByRole("button", { name: "Ver el logro oculto" }).click();
  await expect(missing.nth(0)).toContainText("El verdadero final");
  await expect(missing.nth(1)).toContainText("Logro armas");
  const got = panel.getByRole("list", { name: "Conseguidos" }).getByRole("listitem");
  // Del más reciente al más antiguo, con su fecha.
  await expect(got.nth(0)).toContainText("Logro rasguno");
  await expect(got.nth(0)).toContainText("2 may 2026");
  await expect(got.nth(1)).toContainText("1 mar 2026");
  await expect(got.nth(1)).toContainText("Común");
  // «Mirar ahora» va arriba, junto al progreso, y abajo ya no queda pie: a todos los logros se llega desde el menú.
  const look = panel.getByRole("button", { name: "Mirar ahora" });
  expect((await look.boundingBox())!.y).toBeLessThan((await panel.getByRole("list", { name: "Te faltan" }).boundingBox())!.y);
  await expect(panel).toContainText("Mirados");
  await expect(panel.getByRole("link", { name: "Todos tus logros" })).toHaveCount(0);
  await look.click();
  await expect.poll(() => asked.logros).toEqual([[1145360]]);
});

test("los logros tienen su sitio en la barra de navegación del ordenador", async ({ page }) => {
  const { hades, rec } = hadesWithAchievements();
  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [rec], settings: { steamId: STEAM_ID } });
  await openApp(page, "/");
  const nav = page.getByRole("navigation", { name: "Principal" }).first();
  await nav.getByRole("link", { name: "Logros" }).click();
  await expect(page).toHaveURL(/\/logros$/, { timeout: 20000 });
  await expect(nav.getByRole("link", { name: "Logros" })).toHaveAttribute("aria-current", "page");
});

test("en la ficha, sin perfil de Steam lo pide; con el perfil privado, explica cómo arreglarlo", async ({ page }) => {
  const { hades, rec } = hadesWithAchievements();
  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [rec] });
  await openApp(page, `/juego/${hades.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  await expect(panel).toContainText("Guarda tu perfil de Steam para ver sus logros");
  await expect(panel.getByRole("link", { name: "Ir a Ajustes" })).toHaveAttribute("href", "/ajustes?apartado=traer");

  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [rec], settings: { steamId: STEAM_ID } });
  await fakeSteam(page, { privado: true });
  await openApp(page, `/juego/${hades.id}`);
  await page.getByRole("region", { name: "Logros" }).getByRole("button", { name: "Mirar ahora" }).click();
  await expect(page.getByRole("region", { name: "Logros" })).toContainText("«Detalles de juego» en Público");
});

test("un juego de PC sin enlazar se elige en Steam desde su ficha, y se miran sus logros", async ({ page }) => {
  const inside = createGame({ title: "Inside Ultimate" });
  await seed(page, { ...emptyLibrary(), games: [inside], copies: [createCopy(inside.id, { platform: "PC", format: "digital" })], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { search: [{ appId: 304430, title: "INSIDE", amount: 19.99 }], games: { "304430": HADES_LOGROS } });
  await openApp(page, `/juego/${inside.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  await panel.getByRole("button", { name: "Elegir en Steam" }).click();
  const dialog = page.getByRole("dialog", { name: /Steam/ });
  await dialog.getByRole("button", { name: /^INSIDE/ }).click();
  await expect(panel).toContainText("1 de 2 · 50 %");
  expect((await stored(page)).games[0].steamAppId).toBe(304430);
  expect(asked.logros).toContainEqual([304430]);
});

test("la vista de todos ordena por lo cerca que está cada juego del 100 % y lleva a su ficha", async ({ page }) => {
  const done = "2026-01-01T00:00:00.000Z";
  const [casi, mitad, completo, cero] = ["Celeste", "Hollow Knight", "Inside", "Tunic"].map((title, i) => createGame({ title, steamAppId: 200 + i }));
  await seed(page, {
    ...emptyLibrary(),
    games: [casi, mitad, completo, cero],
    achievements: [
      record(mitad.id, [item("a", 5, done), item("b", 5)], { steamAppId: 201 }),
      record(cero.id, [item("a", 5)], { steamAppId: 203 }),
      record(completo.id, [item("a", 5, done)], { steamAppId: 202 }),
      record(casi.id, [item("a", 5, done), item("b", 5, done), item("c", 5, done), item("d", 5)], { steamAppId: 200 }),
    ],
    settings: { steamId: STEAM_ID },
  });
  await openApp(page, "/logros");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Logros");
  const rows = page.getByRole("list", { name: "Tus juegos con logros" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Celeste");
  await expect(rows.nth(0)).toContainText("75 % · te falta 1");
  await expect(rows.nth(1)).toContainText("50 % · te falta 1");
  await expect(rows.nth(2)).toContainText("Tunic");
  await expect(rows.nth(3)).toContainText("100 %");
  await rows.nth(0).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/juego/${casi.id}$`), { timeout: 20000 });
});

/** Una biblioteca de 2026 con un juego terminado y logros: Hades, completo en marzo, con uno rarísimo. */
function yearWithAchievements() {
  const hades = createGame({ title: "Hades", steamAppId: 1145360, status: "completado", finishedAt: "2026-03-10" });
  const celeste = createGame({ title: "Celeste", steamAppId: 504230 });
  const achievements = [
    record(hades.id, [item("a", 40, "2026-01-05T10:00:00Z"), { ...item("b", 0.8, "2026-03-01T10:00:00Z"), name: "Sin un rasguño" }]),
    record(celeste.id, [item("a", 50, "2026-05-01T10:00:00Z"), item("b", 2)], { steamAppId: 504230 }),
  ];
  return { hades, celeste, lib: { ...emptyLibrary(), games: [hades, celeste], achievements, settings: { steamId: STEAM_ID } } as Library };
}

test("el Anuario guarda los logros del año: cuántos, los juegos completados y el más raro", () => {
  const { hades, lib } = yearWithAchievements();
  const data = computeYear(lib, 2026);
  expect(data.achievements).toMatchObject({ count: 3, completed: [{ id: hades.id, title: "Hades" }], rarest: { title: "Hades", name: "Sin un rasguño", percent: 0.8 } });
  expect(computeYear(lib, 2025).achievements).toBeUndefined();
});

test("el Anuario enseña la pantalla de logros del año", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
  const { lib } = yearWithAchievements();
  await seed(page, lib);
  await openApp(page, "/anuario/2026");
  const pausa = page.getByRole("button", { name: "Pausar" });
  if (await pausa.count()) await pausa.click();
  const screen = page.getByRole("region", { name: /^Pantalla \d+ de \d+$/ });
  for (let i = 0; i < 12 && !(await screen.textContent())?.includes("logros"); i++) await page.keyboard.press("ArrowRight");
  await expect(screen).toContainText("Este año conseguiste");
  await expect(screen).toContainText("3");
  await expect(screen).toContainText("Completaste al 100 %: Hades");
  await expect(screen).toContainText("«Sin un rasguño»");
  await expect(screen).toContainText(/0,8\s%/);
});

test("Estadísticas tiene un apartado de logros con los totales y lleva a la vista de todos", async ({ page }) => {
  const { lib } = yearWithAchievements();
  await seed(page, lib);
  await openApp(page, "/estadisticas");
  const section = page.getByRole("region", { name: "Logros" });
  await expect(section).toContainText("3");
  await expect(section).toContainText("Juegos al 100 %");
  await expect(section).toContainText("Sin un rasguño");
  const rare = section.getByRole("list", { name: "Tus logros más raros" }).getByRole("listitem");
  await expect(rare.first()).toContainText("Sin un rasguño");
  await expect(rare.first()).toContainText("Rarísimo");
  await expect(rare.first().getByRole("link", { name: "Hades" })).toBeVisible();
  await section.getByRole("link", { name: "Ver todos" }).click();
  await expect(page).toHaveURL(/\/logros$/, { timeout: 20000 });
});

test("un juego enlazado que no tienes en Steam no cuenta como perfil privado: se apunta sin logros y se sigue con los demás", async ({ page }) => {
  const kh = createGame({ title: "Kingdom Hearts HD 1.5 + 2.5 Remix", steamAppId: 2552430 });
  const juegos = Array.from({ length: 10 }, (_, i) => createGame({ title: `Juego ${i}`, steamAppId: 500 + i }));
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  await seedFresh(page, { ...emptyLibrary(), games: [kh, ...juegos, hades], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { games: { "1145360": HADES_LOGROS }, noTuyos: [2552430] });
  await openApp(page, "/");
  await expect.poll(async () => (await stored(page)).achievements.find((a) => a.gameId === hades.id)?.unlocked).toBe(1);
  expect(asked.logros.length).toBe(2);
  const khRec = (await stored(page)).achievements.find((a) => a.gameId === kh.id);
  expect(khRec).toMatchObject({ steamAppId: 2552430, total: 0, unlocked: 0 });
  expect(await page.evaluate(() => localStorage.getItem("ludoteca:logros-privado"))).toBeNull();
});

test("«Mirar ahora» en la ficha mira ese juego enseguida, aunque la vuelta de toda la biblioteca siga en marcha", async ({ page }) => {
  const { hades, rec } = hadesWithAchievements();
  const celeste = createGame({ title: "Celeste", steamAppId: 504230 });
  await seedFresh(page, { ...emptyLibrary(), games: [hades, celeste], achievements: [rec], settings: { steamId: STEAM_ID } });
  // La vuelta diaria pide Celeste (nunca mirado) y Steam no contesta.
  const asked = await fakeSteam(page, { games: { "1145360": HADES_LOGROS }, hang: [504230] });
  await openApp(page, `/juego/${hades.id}`);
  await expect.poll(() => asked.logros).toEqual([[504230]]);
  const panel = page.getByRole("region", { name: "Logros" });
  await panel.getByRole("button", { name: "Mirar ahora" }).click();
  await expect.poll(() => asked.logros).toEqual([[504230], [1145360]]);
  await expect(panel).toContainText("1 de 2 · 50 %");
});

test("en la ficha, un juego aún sin mirar invita a mirar sus logros", async ({ page }) => {
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  await seed(page, { ...emptyLibrary(), games: [hades], settings: { steamId: STEAM_ID } });
  const asked = await fakeSteam(page, { games: { "1145360": HADES_LOGROS } });
  await openApp(page, `/juego/${hades.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  await expect(panel).toContainText("Todavía no has mirado sus logros");
  await panel.getByRole("button", { name: "Mirar ahora" }).click();
  await expect.poll(() => asked.logros).toEqual([[1145360]]);
  await expect(panel).toContainText("1 de 2 · 50 %");
});

test("la ficha enseña todos los logros de una vez, sin «Ver los restantes»", async ({ page }) => {
  const hades = createGame({ title: "Hades", steamAppId: 1145360 });
  const items = Array.from({ length: 30 }, (_, i) => item(`l${i}`, i + 1, i < 15 ? "2026-03-01T10:00:00.000Z" : null));
  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [record(hades.id, items)], settings: { steamId: STEAM_ID } });
  await openApp(page, `/juego/${hades.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  await expect(panel.getByRole("list", { name: "Te faltan" }).getByRole("listitem")).toHaveCount(15);
  await expect(panel.getByRole("list", { name: "Conseguidos" }).getByRole("listitem")).toHaveCount(15);
  await expect(panel.getByRole("button", { name: /restantes/ })).toHaveCount(0);
});

test("en la ficha se eligen los logros que se ven: todos, los que te faltan o los conseguidos", async ({ page }) => {
  const { hades, rec } = hadesWithAchievements();
  await seed(page, { ...emptyLibrary(), games: [hades], achievements: [rec], settings: { steamId: STEAM_ID } });
  await openApp(page, `/juego/${hades.id}`);
  const panel = page.getByRole("region", { name: "Logros" });
  const pick = panel.getByRole("radiogroup", { name: "Qué logros ver" });
  const missing = panel.getByRole("list", { name: "Te faltan" });
  const got = panel.getByRole("list", { name: "Conseguidos" });
  // De entrada, todos.
  await expect(pick.getByRole("radio", { name: /Todos/ })).toHaveAttribute("aria-checked", "true");
  await expect(missing).toBeVisible();
  await expect(got).toBeVisible();
  await pick.getByRole("radio", { name: /Conseguidos/ }).click();
  await expect(missing).toHaveCount(0);
  await expect(got.getByRole("listitem")).toHaveCount(2);
  await pick.getByRole("radio", { name: /Te faltan/ }).click();
  await expect(got).toHaveCount(0);
  await expect(missing.getByRole("listitem")).toHaveCount(2);
  await pick.getByRole("radio", { name: /Todos/ }).click();
  await expect(got).toBeVisible();
});
