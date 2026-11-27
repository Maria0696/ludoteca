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
} from "../../src/lib/achievements";
import { createBackup, parseBackup, planImport, resolveImport } from "../../src/lib/backup";
import { type Achievement, type GameAchievements, type Library, createGame, emptyLibrary } from "../../src/lib/model";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";
import { openApp } from "./helpers";

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
