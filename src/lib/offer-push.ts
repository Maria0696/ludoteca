import { formatMoney } from "./format";
import type { PriceRecord, WishItem } from "./model";
import { ESHOP, type Quote, STEAM, newPriceRecords, storeIn, untilLabel } from "./price-watch";

/*
 * Notificaciones de ofertas: la parte sin red. Con los precios de ahora de los deseos vigilados, qué precios apuntar
 * en su historial, de cuáles avisar y con qué texto. La usa la ruta /api/avisos-ofertas, que llama una tarea de GitHub
 * dos veces al día (ver docs/superpowers/specs/2026-11-27-avisos-ofertas-design.md). Sin React ni servidor.
 */

/** Lo que dijo cada tienda, por código. Si una tienda falta, es que no respondió: sus deseos no se tocan. */
export type StorePrices = { eshop?: Record<string, Quote>; steam?: Record<string, Quote> };
/** Un deseo del que avisar y el precio nuevo que lo ha puesto en su objetivo. */
export type AlertItem = { wish: WishItem; record: PriceRecord };
/** Lo que enseña la notificación y a dónde lleva al tocarla. */
export type PushPayload = { title: string; body: string; url: string };

const URL = "/deseos";

/** La notificación de «Probar». */
export const TEST_PAYLOAD: PushPayload = {
  title: "Avisos de ofertas activados",
  body: "Así te avisaré cuando un deseo baje de su precio objetivo.",
  url: URL,
};

/** El último precio apuntado de una tienda (por fecha; con la misma fecha, el que se apuntó después). */
function lastOf(prices: PriceRecord[], store: string): PriceRecord | undefined {
  let last: PriceRecord | undefined;
  for (const p of prices) if (p.store === store && (!last || p.date >= last.date)) last = p;
  return last;
}

/**
 * Los precios que apuntar y los deseos de los que avisar. Se avisa de un precio nuevo si el deseo tiene objetivo, el
 * precio está en él o por debajo y es más barato que el último visto en esa tienda (o no había ninguno). Así cada oferta
 * se avisa una vez: si solo se alarga su fin, o la app ya la había visto al abrirse, no se repite. Por deseo, un aviso
 * como mucho, con el precio más barato.
 */
export function planAlerts(
  wishes: WishItem[],
  prices: StorePrices,
  today: string,
  id: () => string,
): { changes: { id: string; prices: PriceRecord[] }[]; notify: AlertItem[] } {
  const changes: { id: string; prices: PriceRecord[] }[] = [];
  const notify: AlertItem[] = [];
  for (const wish of wishes) {
    const quotes = [
      ...(wish.eshopNsuid && prices.eshop?.[wish.eshopNsuid] ? [{ store: ESHOP, quote: prices.eshop[wish.eshopNsuid] }] : []),
      ...(wish.steamAppId && prices.steam?.[String(wish.steamAppId)] ? [{ store: STEAM, quote: prices.steam[String(wish.steamAppId)] }] : []),
    ];
    const records = newPriceRecords(wish, quotes, today, id);
    if (!records.length) continue;
    changes.push({ id: wish.id, prices: [...wish.prices, ...records] });
    const target = wish.targetPrice;
    if (target == null) continue;
    const worth = records.filter((r) => {
      const before = lastOf(wish.prices, r.store);
      return r.amount <= target && (!before || r.amount < before.amount);
    });
    const best = worth.sort((a, b) => a.amount - b.amount)[0];
    if (best) notify.push({ wish, record: best });
  }
  return { changes, notify };
}

/** «Hades II», «Hades II y Celeste», «Hades II, Celeste y Hollow Knight». */
const joinTitles = (titles: string[]) => (titles.length < 2 ? titles.join("") : `${titles.slice(0, -1).join(", ")} y ${titles.at(-1)}`);

/** El texto de la notificación: de un deseo, con su precio, tienda, descuento y fin; de varios, una sola. */
export function notificationFor(items: AlertItem[], now: Date): PushPayload | null {
  if (!items.length) return null;
  if (items.length > 1) return { title: `${items.length} deseos han bajado de tu objetivo`, body: joinTitles(items.map((i) => i.wish.title)), url: URL };
  const { wish, record } = items[0];
  const target = wish.targetPrice ?? record.amount;
  let body = `${record.amount < target ? "Por debajo de tu objetivo" : "En tu objetivo"} (${formatMoney(target)})`;
  if (record.regular != null && record.regular > record.amount) {
    body += ` · −${Math.round((1 - record.amount / record.regular) * 100)} %`;
    if (record.until) body += `, ${untilLabel(record.until, now)}`;
  }
  return { title: `${wish.title}: ${formatMoney(record.amount)} ${storeIn(record.store)}`, body, url: URL };
}

/** Si el servicio de notificaciones dice que la suscripción ya no existe (se desinstaló la app, se quitó el permiso). */
export const isGoneStatus = (status: number) => status === 404 || status === 410;
