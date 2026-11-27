import { ESHOP_SYSTEMS, type EshopCandidate, type Quote, type SteamCandidate } from "./price-watch";

/*
 * Consultas a las tiendas, desde el servidor (el navegador no puede preguntarles directamente). Todo en euros y en
 * España. Ninguna necesita clave:
 * - eShop de Nintendo: el catálogo de Nintendo Europa y su precio por código (no son oficiales: los usa la comunidad).
 * - Steam: el precio de cada juego en su tienda.
 */

const ESHOP_SEARCH = "https://searching.nintendo-europe.com/es/select";
const ESHOP_PRICE = "https://api.ec.nintendo.com/v1/price";
const STEAM_PRICE = "https://store.steampowered.com/api/appdetails";
const STEAM_SEARCH = "https://store.steampowered.com/api/storesearch/";
/** El eShop da hasta 50 precios por consulta; a Steam se le piden menos para no pasarse de su límite. */
const ESHOP_BATCH = 50;
const STEAM_BATCH = 25;

const SYSTEM_PLATFORM: Record<string, string> = { "Nintendo Switch": "Switch", "Nintendo Switch 2": "Switch 2" };

type EshopPrice = {
  title_id?: number | string;
  sales_status?: string;
  regular_price?: { raw_value?: string };
  discount_price?: { raw_value?: string; end_datetime?: string };
};

/** Precios del eShop por código. Los que no están a la venta o sin precio no vuelven. */
export function parseEshopPrices(json: unknown): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const p of ((json as { prices?: EshopPrice[] })?.prices ?? [])) {
    const regular = Number(p.regular_price?.raw_value);
    if (p.title_id == null || p.sales_status !== "onsale" || !Number.isFinite(regular)) continue;
    const sale = Number(p.discount_price?.raw_value);
    out[String(p.title_id)] = Number.isFinite(sale) ? { amount: sale, regular, until: p.discount_price?.end_datetime ?? null } : { amount: regular, regular, until: null };
  }
  return out;
}

type SteamEntry = { success?: boolean; data?: { price_overview?: { initial?: number; final?: number } } | unknown[] };

/** Precios de Steam por número de juego, en euros (Steam los da en céntimos). Los gratuitos no tienen precio y no vuelven. */
export function parseSteamPrices(json: unknown): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const [id, entry] of Object.entries((json ?? {}) as Record<string, SteamEntry>)) {
    const price = entry?.success && !Array.isArray(entry.data) ? entry.data?.price_overview : undefined;
    if (price?.final == null || price.initial == null) continue;
    out[id] = { amount: price.final / 100, regular: price.initial / 100, until: null };
  }
  return out;
}

type SteamSearchItem = { type?: string; name?: string; id?: number; price?: { final?: number } };

/** Del buscador de la tienda de Steam, los juegos (no los paquetes), con su precio en euros; los gratuitos, sin precio. */
export function parseSteamSearch(json: unknown): SteamCandidate[] {
  return ((json as { items?: SteamSearchItem[] } | null)?.items ?? []).flatMap((item) =>
    item.type === "app" && item.name && Number.isInteger(item.id) && item.id! > 0
      ? [{ appId: item.id!, title: item.name, amount: typeof item.price?.final === "number" ? item.price.final / 100 : null }]
      : [],
  );
}

type EshopDoc = { title?: string; system_names_txt?: string[]; nsuid_txt?: string[] };

/** Del catálogo, un candidato por producto y código, solo de las consolas en que vale un deseo de `platform`. */
export function parseEshopSearch(json: unknown, platform: string): EshopCandidate[] {
  const systems = ESHOP_SYSTEMS[platform] ?? [];
  return ((json as { response?: { docs?: EshopDoc[] } })?.response?.docs ?? []).flatMap((doc) => {
    const system = doc.system_names_txt?.find((s) => systems.includes(s));
    if (!doc.title || !system) return [];
    return (doc.nsuid_txt ?? []).filter((n) => /^\d{14}$/.test(n)).map((nsuid) => ({ nsuid, title: doc.title!, platform: SYSTEM_PLATFORM[system], amount: null }));
  });
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`La tienda respondió ${res.status}.`);
  return res.json();
}

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchEshopPrices(nsuids: string[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  for (const part of batches([...new Set(nsuids)], ESHOP_BATCH)) {
    Object.assign(out, parseEshopPrices(await getJson(`${ESHOP_PRICE}?country=ES&lang=es&ids=${part.join(",")}`)));
  }
  return out;
}

export async function fetchSteamPrices(appIds: number[]): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  for (const part of batches([...new Set(appIds)], STEAM_BATCH)) {
    Object.assign(out, parseSteamPrices(await getJson(`${STEAM_PRICE}?appids=${part.join(",")}&cc=es&filters=price_overview`)));
  }
  return out;
}

/** Productos del eShop que podrían ser este título en esta plataforma, con su precio de ahora para poder elegir. */
export async function searchEshop(title: string, platform: string): Promise<EshopCandidate[]> {
  const params = new URLSearchParams({ q: title, fq: "type:GAME", rows: "12", wt: "json", fl: "title,nsuid_txt,system_names_txt" });
  const candidates = parseEshopSearch(await getJson(`${ESHOP_SEARCH}?${params}`), platform);
  if (!candidates.length) return [];
  const prices = await fetchEshopPrices(candidates.map((c) => c.nsuid)).catch((): Record<string, Quote> => ({}));
  return candidates.map((c) => ({ ...c, amount: prices[c.nsuid]?.amount ?? null }));
}

/** Juegos de la tienda de Steam (España, en euros) que podrían ser este título, con su precio de ahora. */
export async function searchSteam(title: string): Promise<SteamCandidate[]> {
  const params = new URLSearchParams({ term: title, l: "spanish", cc: "ES" });
  return parseSteamSearch(await getJson(`${STEAM_SEARCH}?${params}`));
}
