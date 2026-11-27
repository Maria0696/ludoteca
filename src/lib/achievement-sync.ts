"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { GameResult } from "./steam-achievements";
import { type Game, type GameAchievements, type Library, newId, nowIso, todayIso } from "./model";
import { type SteamCandidate, pickSteam } from "./price-watch";
import { useLibrary } from "./store";

/*
 * La app mira sola los logros de Steam de los juegos de la biblioteca: como mucho una vez al día al abrirse, y también
 * con «Mirar ahora». Primero enlaza con Steam los juegos de PC que no lo están (por título, si hay uno solo igual; si
 * no, quedan «por elegir») y luego pide los logros de los que tocan: los nunca mirados, los jugados en las últimas dos
 * semanas y los que llevan más de un mes sin mirarse (para que la rareza no se quede vieja). Lo que recuerda (cuándo
 * miró, a quién intentó enlazar hoy, quién está por elegir y si el perfil es privado) se queda en este navegador.
 */

const LAST_KEY = "ludoteca:logros-mirados";
const TRIED_KEY = "ludoteca:logros-intentados";
const PENDING_KEY = "ludoteca:logros-por-elegir";
const PRIVATE_KEY = "ludoteca:logros-privado";
const CHANGE_EVENT = "ludoteca:logros-cambiados";
const EVERY_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 10;

type Actions = Pick<ReturnType<typeof useLibrary>["actions"], "updateGame" | "saveAchievements">;
type Done = Exclude<GameResult, string>;
export type AchievementSyncResult = { linked: number; updated: number; pending: number; privado: boolean; failed: boolean };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: se repetirá la próxima vez, sin más.
  }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as T;
}

/** Los juegos propios con alguna copia de PC: los que pueden estar en Steam. */
const onPc = (library: Library) => {
  const pc = new Set(library.copies.filter((c) => !c.demo && c.platform === "PC").map((c) => c.gameId));
  return library.games.filter((g) => !g.demo && pc.has(g.id));
};

/** Los logros mirados de un juego, listos para guardar (con el mismo id si ya los tenía). */
function toRecord(game: Game, appId: number, result: Done | null, before: GameAchievements | undefined): GameAchievements {
  const stamp = nowIso();
  return {
    id: before?.id ?? newId(),
    gameId: game.id,
    steamAppId: appId,
    total: result?.total ?? 0,
    unlocked: result?.unlocked ?? 0,
    items: result?.items ?? [],
    checkedAt: stamp,
    createdAt: before?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

const same = (a: GameAchievements | undefined, b: GameAchievements) =>
  a != null && a.steamAppId === b.steamAppId && a.total === b.total && a.unlocked === b.unlocked && JSON.stringify(a.items) === JSON.stringify(b.items);

async function run(library: Library, actions: Actions, { force = false, gameId }: { force?: boolean; gameId?: string }): Promise<AchievementSyncResult> {
  const result: AchievementSyncResult = { linked: 0, updated: 0, pending: 0, privado: false, failed: false };
  const steamId = library.settings.steamId;
  if (!steamId) return result;
  const today = todayIso();
  const tried = readJson<Record<string, string>>(TRIED_KEY, {});
  const pending = new Set(readJson<string[]>(PENDING_KEY, []));
  const appOf = new Map(library.games.map((g) => [g.id, g.steamAppId ?? null]));

  // 1. Enlazar los de PC sin número de Steam (uno al día por juego, salvo con «Mirar ahora»).
  for (const g of onPc(library).filter((g) => g.steamAppId == null && (force || tried[g.id] !== today) && (!gameId || g.id === gameId))) {
    try {
      const res = await call<{ ok: boolean; candidates?: SteamCandidate[] }>(`/api/precios/steam/buscar?q=${encodeURIComponent(g.title)}`);
      if (!res.ok) {
        result.failed = true;
        continue;
      }
      const pick = pickSteam(g.title, res.candidates ?? []);
      if (pick) {
        actions.updateGame(g.id, { steamAppId: pick.appId });
        appOf.set(g.id, pick.appId);
        pending.delete(g.id);
        result.linked++;
      } else if (res.candidates?.length) pending.add(g.id);
      tried[g.id] = today;
    } catch {
      result.failed = true;
    }
  }

  // 2. Qué juegos mirar.
  const records = new Map(library.achievements.map((a) => [a.gameId, a]));
  const linked = library.games.filter((g) => !g.demo && appOf.get(g.id) != null && (!gameId || g.id === gameId));
  let recent = new Set<number>();
  if (!force && !gameId) {
    try {
      const res = await call<{ ok: boolean; appIds?: number[] }>(`/api/logros/recientes?steamId=${steamId}`);
      if (res.ok) recent = new Set(res.appIds ?? []);
    } catch {
      result.failed = true;
    }
  }
  const now = Date.now();
  const due = linked.filter((g) => {
    if (force || gameId) return true;
    const rec = records.get(g.id);
    return !rec || rec.steamAppId !== appOf.get(g.id) || recent.has(appOf.get(g.id)!) || now - new Date(rec.checkedAt).getTime() > STALE_MS;
  });

  // 3. Pedirlos en tandas y guardar los que han cambiado (o los que se renuevan por viejos).
  const appIds = [...new Set(due.map((g) => appOf.get(g.id)!))];
  for (let i = 0; i < appIds.length; i += BATCH) {
    const part = appIds.slice(i, i + BATCH);
    try {
      const res = await call<{ ok: boolean; reason?: string; games?: Record<string, Done>; sinLogros?: number[]; failed?: number[] }>("/api/logros", { steamId, appIds: part });
      if (!res.ok) {
        if (res.reason === "privado") result.privado = true;
        else result.failed = true;
        break;
      }
      if (res.failed?.length) result.failed = true;
      const none = new Set(res.sinLogros ?? []);
      const save: GameAchievements[] = [];
      for (const g of due.filter((g) => part.includes(appOf.get(g.id)!))) {
        const appId = appOf.get(g.id)!;
        const done = res.games?.[String(appId)];
        if (!done && !none.has(appId)) continue;
        const before = records.get(g.id);
        const next = toRecord(g, appId, done ?? null, before);
        if (same(before, next) && now - new Date(before!.checkedAt).getTime() <= STALE_MS) continue;
        save.push(next);
      }
      if (save.length) {
        actions.saveAchievements(save);
        result.updated += save.length;
      }
    } catch {
      result.failed = true;
    }
  }

  const ids = new Set(library.games.map((g) => g.id));
  const stillPending = [...pending].filter((id) => ids.has(id) && appOf.get(id) == null);
  result.pending = stillPending.length;
  writeJson(TRIED_KEY, Object.fromEntries(Object.entries(tried).filter(([id]) => ids.has(id))));
  writeJson(PENDING_KEY, stillPending);
  writeJson(PRIVATE_KEY, result.privado ? true : null);
  if (!gameId) writeJson(LAST_KEY, new Date().toISOString());
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return result;
}

let running: Promise<AchievementSyncResult> | null = null;

/** Enlaza y mira los logros (todos con `force`, o solo un juego). Si ya hay una vuelta en marcha, devuelve esa. */
export function syncAchievements(library: Library, actions: Actions, options: { force?: boolean; gameId?: string } = {}): Promise<AchievementSyncResult> {
  running ??= run(library, actions, options).finally(() => {
    running = null;
  });
  return running;
}

/** Enlaza un juego con el juego de Steam elegido y mira sus logros enseguida. */
export async function chooseSteamForGame(library: Library, game: Game, appId: number, actions: Actions): Promise<void> {
  actions.updateGame(game.id, { steamAppId: appId });
  writeJson(
    PENDING_KEY,
    readJson<string[]>(PENDING_KEY, []).filter((id) => id !== game.id),
  );
  window.dispatchEvent(new Event(CHANGE_EVENT));
  const updated = { ...library, games: library.games.map((g) => (g.id === game.id ? { ...g, steamAppId: appId } : g)) };
  await syncAchievements(updated, actions, { gameId: game.id });
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/** Cuándo se miraron los logros por última vez en este navegador (fecha ISO), o `null` si nunca. */
export function useLastAchievementCheck(): string | null {
  const raw = useStored(LAST_KEY);
  try {
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

/** Los juegos que Steam tiene con varias opciones y hay que elegir. */
export function usePendingSteamGames(): Set<string> {
  const raw = useStored(PENDING_KEY);
  try {
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Si la última vez Steam dijo que el perfil no deja ver los logros. */
export function useSteamProfilePrivate(): boolean {
  return useStored(PRIVATE_KEY) === "true";
}

/** Al abrir la app (con la biblioteca cargada y un perfil guardado), mira los logros si hace más de un día. */
export function AchievementWatch() {
  const { state, library, actions } = useLibrary();
  const steamId = library.settings.steamId;
  useEffect(() => {
    if (state !== "ready" || !steamId) return;
    const last = readJson<string | null>(LAST_KEY, null);
    if (last && Date.now() - new Date(last).getTime() < EVERY_MS) return;
    void syncAchievements(library, actions);
    // Una vez al cargar (o al guardar el perfil): no a cada cambio de la biblioteca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, steamId]);
  return null;
}
