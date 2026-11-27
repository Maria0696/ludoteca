"use client";

import { useEffect, useSyncExternalStore } from "react";
import { type WishItem, newId, todayIso } from "./model";
import { ESHOP, type EshopCandidate, type Quote, STEAM, type SteamCandidate, isEshopPlatform, newPriceRecords, pickEshop, pickSteam } from "./price-watch";
import { useLibrary } from "./store";

/*
 * La app mira sola los precios de la lista de deseos (eShop de Nintendo España y Steam), como mucho cada 6 horas al
 * abrirse, y también al pulsar «Mirar ahora». Primero enlaza los deseos que aún no lo están (Steam por IGDB y, si no,
 * por título; el eShop por título, y si hay dudas, «por elegir») y luego apunta los precios que hayan cambiado. Lo que recuerda
 * (cuándo miró, a quién ya intentó enlazar hoy, quién está por elegir) se queda en este navegador.
 */

const LAST_KEY = "ludoteca:precios-mirados";
const TRIED_KEY = "ludoteca:precios-intentados";
const PENDING_KEY = "ludoteca:eshop-por-elegir";
const CHANGE_EVENT = "ludoteca:precios-cambiados";
const EVERY_MS = 6 * 60 * 60 * 1000;

type UpdateWish = (id: string, patch: Partial<WishItem>) => void;
type Links = Map<string, { eshop: string | null; steam: number | null }>;
export type SyncResult = { linkedEshop: number; linkedSteam: number; pending: number; updated: number; failed: boolean };

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
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento: se repetirá la próxima vez, sin más.
  }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as T;
}

/** Pide los precios de ahora de estos deseos y apunta los que hayan cambiado. */
async function refreshPrices(wishes: WishItem[], links: Links, updateWish: UpdateWish): Promise<{ updated: number; failed: boolean }> {
  const linked = wishes.filter((w) => links.get(w.id)?.eshop || links.get(w.id)?.steam);
  const eshop = [...new Set(linked.flatMap((w) => links.get(w.id)?.eshop ?? []))];
  const steam = [...new Set(linked.flatMap((w) => links.get(w.id)?.steam ?? []))];
  if (!eshop.length && !steam.length) return { updated: 0, failed: false };
  const res = await call<{ ok: boolean; eshop?: Record<string, Quote>; steam?: Record<string, Quote>; failed?: string[] }>("/api/precios", { eshop, steam });
  if (!res.ok) return { updated: 0, failed: true };
  const today = todayIso();
  let updated = 0;
  for (const w of linked) {
    const link = links.get(w.id)!;
    const quotes = [
      ...(link.eshop && res.eshop?.[link.eshop] ? [{ store: ESHOP, quote: res.eshop[link.eshop] }] : []),
      ...(link.steam && res.steam?.[String(link.steam)] ? [{ store: STEAM, quote: res.steam[String(link.steam)] }] : []),
    ];
    const records = newPriceRecords(w, quotes, today, newId);
    if (records.length) {
      updateWish(w.id, { prices: [...w.prices, ...records] });
      updated++;
    }
  }
  return { updated, failed: Boolean(res.failed?.length) };
}

async function run(wishlist: WishItem[], updateWish: UpdateWish, force: boolean): Promise<SyncResult> {
  const today = todayIso();
  const tried = readJson<Record<string, string>>(TRIED_KEY, {});
  const pending = new Set(readJson<string[]>(PENDING_KEY, []));
  const own = wishlist.filter((w) => !w.demo);
  const links: Links = new Map(own.map((w) => [w.id, { eshop: w.eshopNsuid ?? null, steam: w.steamAppId ?? null }]));
  // Cada deseo se intenta enlazar una vez al día (salvo al pulsar «Buscar en las tiendas»).
  const due = (kind: string, w: WishItem) => force || tried[`${kind}:${w.id}`] !== today;
  const result: SyncResult = { linkedEshop: 0, linkedSteam: 0, pending: 0, updated: 0, failed: false };

  const steamTodo = own.filter((w) => w.platform === "PC" && w.igdbId != null && w.steamAppId == null && due("steam", w));
  if (steamTodo.length) {
    try {
      const res = await call<{ ok: boolean; steam?: Record<string, number> }>("/api/precios/steam", { igdbIds: [...new Set(steamTodo.map((w) => w.igdbId!))] });
      if (res.ok) {
        for (const w of steamTodo) {
          const appId = res.steam?.[String(w.igdbId)];
          if (appId) {
            updateWish(w.id, { steamAppId: appId });
            links.get(w.id)!.steam = appId;
            result.linkedSteam++;
          }
          tried[`steam:${w.id}`] = today;
        }
      }
    } catch {
      result.failed = true;
    }
  }

  // Los de PC que IGDB no ha enlazado (escritos a mano, o sin su número de Steam): por título, si solo hay un juego igual.
  for (const w of own.filter((w) => w.platform === "PC" && links.get(w.id)!.steam == null && due("steamtitulo", w))) {
    try {
      const res = await call<{ ok: boolean; candidates?: SteamCandidate[] }>(`/api/precios/steam/buscar?q=${encodeURIComponent(w.title)}`);
      if (!res.ok) {
        result.failed = true;
        continue;
      }
      const pick = pickSteam(w.title, res.candidates ?? []);
      if (pick) {
        updateWish(w.id, { steamAppId: pick.appId });
        links.get(w.id)!.steam = pick.appId;
        result.linkedSteam++;
      }
      tried[`steamtitulo:${w.id}`] = today;
    } catch {
      result.failed = true;
    }
  }

  for (const w of own.filter((w) => isEshopPlatform(w.platform) && w.eshopNsuid == null && due("eshop", w))) {
    try {
      const res = await call<{ ok: boolean; candidates?: EshopCandidate[] }>(`/api/precios/eshop?q=${encodeURIComponent(w.title)}&plataforma=${encodeURIComponent(w.platform!)}`);
      if (!res.ok) {
        result.failed = true;
        continue;
      }
      const pick = pickEshop(w.title, res.candidates ?? []);
      if (pick) {
        updateWish(w.id, { eshopNsuid: pick.nsuid });
        links.get(w.id)!.eshop = pick.nsuid;
        pending.delete(w.id);
        result.linkedEshop++;
      } else if (res.candidates?.length) pending.add(w.id);
      else pending.delete(w.id);
      tried[`eshop:${w.id}`] = today;
    } catch {
      result.failed = true;
    }
  }

  try {
    const prices = await refreshPrices(own, links, updateWish);
    result.updated = prices.updated;
    result.failed ||= prices.failed;
  } catch {
    result.failed = true;
  }

  const ids = new Set(own.map((w) => w.id));
  const stillPending = [...pending].filter((id) => ids.has(id) && !links.get(id)?.eshop);
  result.pending = stillPending.length;
  writeJson(TRIED_KEY, Object.fromEntries(Object.entries(tried).filter(([key]) => ids.has(key.split(":")[1]))));
  writeJson(PENDING_KEY, stillPending);
  writeJson(LAST_KEY, new Date().toISOString());
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return result;
}

let running: Promise<SyncResult> | null = null;

/** Enlaza y mira los precios. Si ya hay una vuelta en marcha, devuelve esa. */
export function syncPrices(wishlist: WishItem[], updateWish: UpdateWish, { force = false } = {}): Promise<SyncResult> {
  running ??= run(wishlist, updateWish, force).finally(() => {
    running = null;
  });
  return running;
}

/** Productos del eShop que podrían ser este deseo, con su precio, para elegir. */
export async function eshopOptions(wish: WishItem): Promise<EshopCandidate[]> {
  const res = await call<{ ok: boolean; candidates?: EshopCandidate[] }>(`/api/precios/eshop?q=${encodeURIComponent(wish.title)}&plataforma=${encodeURIComponent(wish.platform ?? "")}`);
  if (!res.ok) throw new Error("El eShop no responde ahora.");
  return res.candidates ?? [];
}

/** Juegos de la tienda de Steam que podrían ser este título, con su precio, para elegir. */
export async function steamOptions(title: string): Promise<SteamCandidate[]> {
  const res = await call<{ ok: boolean; candidates?: SteamCandidate[] }>(`/api/precios/steam/buscar?q=${encodeURIComponent(title)}`);
  if (!res.ok) throw new Error("Steam no responde ahora.");
  return res.candidates ?? [];
}

/** Enlaza un deseo con el juego de Steam elegido y mira su precio enseguida. */
export async function chooseSteam(wish: WishItem, appId: number, updateWish: UpdateWish): Promise<void> {
  updateWish(wish.id, { steamAppId: appId });
  await refreshPrices([wish], new Map([[wish.id, { eshop: wish.eshopNsuid ?? null, steam: appId }]]), updateWish);
}

/** Enlaza un deseo con el producto del eShop elegido y mira su precio enseguida. */
export async function chooseEshop(wish: WishItem, nsuid: string, updateWish: UpdateWish): Promise<void> {
  updateWish(wish.id, { eshopNsuid: nsuid });
  writeJson(
    PENDING_KEY,
    readJson<string[]>(PENDING_KEY, []).filter((id) => id !== wish.id),
  );
  window.dispatchEvent(new Event(CHANGE_EVENT));
  await refreshPrices([wish], new Map([[wish.id, { eshop: nsuid, steam: wish.steamAppId ?? null }]]), updateWish);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Los deseos que el eShop tiene con varias opciones y hay que elegir (sus ids, en texto estable). */
export function usePendingEshop(): Set<string> {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(PENDING_KEY) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  return new Set(JSON.parse(raw) as string[]);
}

/** Cuándo se miraron los precios por última vez en este navegador (fecha ISO), o `null` si nunca. */
export function useLastPriceCheck(): string | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(LAST_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  try {
    return raw ? (JSON.parse(raw) as string) : null;
  } catch {
    return null;
  }
}

/** Al abrir la app (con la biblioteca cargada), mira los precios si hace más de 6 horas de la última vez. */
export function usePriceWatch() {
  const { state, library, actions } = useLibrary();
  useEffect(() => {
    if (state !== "ready") return;
    const last = readJson<string | null>(LAST_KEY, null);
    if (last && Date.now() - new Date(last).getTime() < EVERY_MS) return;
    void syncPrices(library.wishlist, actions.updateWish);
  }, [state, library.wishlist, actions]);
}

export function PriceWatch() {
  usePriceWatch();
  return null;
}
