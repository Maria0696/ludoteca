import { daysBetween } from "./backup-reminder";
import { type PriceRecord, type WishItem, normalizeTitle } from "./model";

/*
 * Precios de la lista de deseos que la app mira sola: el eShop de Nintendo España y la tienda de Steam. Aquí, la parte
 * sin red: con qué producto del eShop enlazar un deseo, qué precios apuntar en su historial, si está en oferta y qué
 * avisos salen en Inicio. Las consultas a las tiendas están en store-prices.ts (servidor).
 */

export const ESHOP = "Nintendo eShop";
export const STEAM = "Steam";

/** Lo que dice una tienda de un juego ahora: lo que cuesta, lo que costaría sin rebaja y hasta cuándo (si lo dice). */
export type Quote = { amount: number; regular: number; until: string | null };
/** Un producto del catálogo del eShop que podría ser el deseo. `amount`, su precio de ahora, si se sabe. */
export type EshopCandidate = { nsuid: string; title: string; platform: string; amount: number | null };
export type Offer = { store: string; amount: number; regular: number; percent: number; until: string | null };

/** Las consolas del eShop en las que vale un deseo de cada plataforma: Switch 2 también juega a lo de Switch. */
export const ESHOP_SYSTEMS: Record<string, string[]> = {
  Switch: ["Nintendo Switch"],
  "Switch 2": ["Nintendo Switch 2", "Nintendo Switch"],
};
/** Si un deseo de esta plataforma se puede vigilar en el eShop. */
export const isEshopPlatform = (platform: string | null | undefined): platform is string => platform != null && platform in ESHOP_SYSTEMS;

/** Días que vale un precio de Steam sin fecha de fin: pasado eso, la oferta puede haber acabado. */
const STEAM_FRESH_DAYS = 2;

/**
 * El producto del eShop con el que enlazar un deseo, solo si no hay dudas: un único producto con el mismo título (sin
 * mayúsculas, tildes ni signos). Con varios iguales (ediciones, paquetes de mejora) o ninguno, `null`: se elige a mano.
 */
export function pickEshop(title: string, candidates: EshopCandidate[]): { nsuid: string } | null {
  const want = normalizeTitle(title);
  const same = [...new Set(candidates.filter((c) => normalizeTitle(c.title) === want).map((c) => c.nsuid))];
  return same.length === 1 ? { nsuid: same[0] } : null;
}

/** El último precio apuntado de una tienda (por fecha; con la misma fecha, el que se apuntó después). */
function lastOf(wish: WishItem, store: string): PriceRecord | undefined {
  let last: PriceRecord | undefined;
  for (const p of wish.prices) if (p.store === store && (!last || p.date >= last.date)) last = p;
  return last;
}

/**
 * Los precios nuevos que apuntar en el historial de un deseo: uno por tienda, solo si cambia el importe, el precio sin
 * rebaja o el fin de la oferta respecto al último de esa tienda. Así el historial no se llena del mismo precio cada día.
 */
export function newPriceRecords(wish: WishItem, quotes: { store: string; quote: Quote }[], today: string, id: () => string): PriceRecord[] {
  return quotes.flatMap(({ store, quote }) => {
    const last = lastOf(wish, store);
    const same = last && last.amount === quote.amount && (last.regular ?? null) === quote.regular && (last.until ?? null) === quote.until;
    return same ? [] : [{ id: id(), amount: quote.amount, regular: quote.regular, until: quote.until, store, date: today }];
  });
}

/**
 * La oferta de ahora de un deseo, si la hay: en cada tienda vigilada, su último precio, si está rebajado y sigue vigente
 * (en el eShop, hasta su fecha de fin; en Steam, que no la dice, si se vio hace menos de 2 días). Con varias, la más barata.
 */
export function currentOffer(wish: WishItem, now: Date): Offer | null {
  let best: Offer | null = null;
  for (const store of [ESHOP, STEAM]) {
    const p = lastOf(wish, store);
    if (!p || p.regular == null || p.regular <= p.amount) continue;
    const valid = p.until ? new Date(p.until).getTime() > now.getTime() : daysBetween(new Date(`${p.date}T12:00:00`), now) < STEAM_FRESH_DAYS;
    if (!valid) continue;
    const offer = { store, amount: p.amount, regular: p.regular, percent: Math.round((1 - p.amount / p.regular) * 100), until: p.until ?? null };
    if (!best || offer.amount < best.amount) best = offer;
  }
  return best;
}

/** Para Inicio: los deseos (propios) en oferta que estén por debajo de su precio objetivo, o en oferta si no lo tienen. */
export function offerAlerts(wishlist: WishItem[], now: Date): { wish: WishItem; offer: Offer }[] {
  return wishlist.flatMap((wish) => {
    if (wish.demo) return [];
    const offer = currentOffer(wish, now);
    if (!offer || (wish.targetPrice != null && offer.amount > wish.targetPrice)) return [];
    return [{ wish, offer }];
  });
}
