import { expect, test } from "@playwright/test";
import type { PriceRecord, WishItem } from "../../src/lib/model";
import { isGoneStatus, notificationFor, planAlerts } from "../../src/lib/offer-push";
import { ESHOP, STEAM } from "../../src/lib/price-watch";

/* Notificaciones de ofertas: la tarea de GitHub mira los precios dos veces al día y avisa al móvil. */

const stamp = "2026-11-27T10:00:00.000Z";
const now = new Date(stamp);
const today = "2026-11-27";
const NSUID = "70010000063715";
const APP = 1145350;
let n = 0;
const id = () => `p${++n}`;

const wish = (patch: Partial<WishItem> = {}): WishItem => ({
  id: crypto.randomUUID(),
  title: "Hades II",
  coverUrl: null,
  igdbId: null,
  platform: "Switch",
  priority: "media",
  targetPrice: 22,
  notes: null,
  genres: [],
  prices: [],
  eshopNsuid: NSUID,
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});
const seen = (amount: number, patch: Partial<PriceRecord> = {}): PriceRecord => ({
  id: id(),
  amount,
  regular: 24.99,
  until: "2026-11-29T22:59:59Z",
  store: ESHOP,
  date: "2026-11-26",
  ...patch,
});
const eshop = (amount: number, until: string | null = "2026-11-29T22:59:59Z", regular = 24.99) => ({ eshop: { [NSUID]: { amount, regular, until } } });

test("planAlerts: avisa solo de los precios nuevos por debajo del objetivo o en él", () => {
  const w = wish();
  const below = planAlerts([w], eshop(19.99), today, id);
  expect(below.changes).toHaveLength(1);
  expect(below.changes[0].id).toBe(w.id);
  expect(below.changes[0].prices).toHaveLength(1);
  expect(below.notify).toHaveLength(1);
  expect(below.notify[0].record).toMatchObject({ amount: 19.99, store: ESHOP });

  expect(planAlerts([w], eshop(22), today, id).notify).toHaveLength(1);

  const above = planAlerts([w], eshop(22.5), today, id);
  expect(above.changes).toHaveLength(1);
  expect(above.notify).toHaveLength(0);

  const noTarget = planAlerts([wish({ targetPrice: null })], eshop(9.99), today, id);
  expect(noTarget.changes).toHaveLength(1);
  expect(noTarget.notify).toHaveLength(0);
});

test("planAlerts: alargar la oferta no repite el aviso; abaratarla más, sí", () => {
  const w = wish({ prices: [seen(19.99)] });
  const longer = planAlerts([w], eshop(19.99, "2026-12-06T22:59:59Z"), today, id);
  expect(longer.changes).toHaveLength(1);
  expect(longer.notify).toHaveLength(0);

  expect(planAlerts([w], eshop(14.99), today, id).notify).toHaveLength(1);
  // Se acabó la oferta (vuelve a 29,99) y otra vez rebajado: aviso nuevo.
  const back = wish({ prices: [seen(19.99, { date: "2026-11-20" }), seen(29.99, { regular: 29.99, until: null, date: "2026-11-24" })] });
  expect(planAlerts([back], eshop(19.99), today, id).notify).toHaveLength(1);
  // Sin cambios: ni precio nuevo ni aviso.
  const same = planAlerts([w], eshop(19.99), today, id);
  expect(same.changes).toHaveLength(0);
  expect(same.notify).toHaveLength(0);
});

test("planAlerts: si una tienda no responde, no se toca lo suyo", () => {
  const w = wish({ steamAppId: APP, prices: [seen(29.99, { regular: 29.99, until: null })] });
  const res = planAlerts([w], { steam: { [String(APP)]: { amount: 9.99, regular: 19.99, until: null } } }, today, id);
  expect(res.changes).toHaveLength(1);
  const added = res.changes[0].prices.slice(w.prices.length);
  expect(added).toHaveLength(1);
  expect(added[0].store).toBe(STEAM);
  expect(res.changes[0].prices.slice(0, w.prices.length)).toEqual(w.prices);
  expect(res.notify).toHaveLength(1);
  expect(res.notify[0].record.store).toBe(STEAM);
});

test("planAlerts: un deseo con las dos tiendas por debajo se avisa una vez, con la más barata", () => {
  const w = wish({ steamAppId: APP });
  const res = planAlerts([w], { ...eshop(19.99), steam: { [String(APP)]: { amount: 14.99, regular: 29.99, until: null } } }, today, id);
  expect(res.changes[0].prices).toHaveLength(2);
  expect(res.notify).toHaveLength(1);
  expect(res.notify[0].record).toMatchObject({ store: STEAM, amount: 14.99 });
});

test("notificationFor: uno, con su tienda, su descuento y hasta cuándo", () => {
  const w = wish();
  const one = notificationFor([{ wish: w, record: seen(19.99) }], now)!;
  expect(one.title).toMatch(/^Hades II: 19,99\s€ en el eShop$/);
  expect(one.body).toMatch(/^Por debajo de tu objetivo \(22,00\s€\) · −20 %, hasta el domingo 29$/);
  expect(one.url).toBe("/deseos");

  expect(notificationFor([{ wish: w, record: seen(22) }], now)!.body).toMatch(/^En tu objetivo \(22,00\s€\)/);

  const steam = notificationFor([{ wish: w, record: seen(9.99, { store: STEAM, regular: 19.99, until: null }) }], now)!;
  expect(steam.title).toMatch(/en Steam$/);
  expect(steam.body).toMatch(/^Por debajo de tu objetivo \(22,00\s€\) · −50 %$/);

  const full = notificationFor([{ wish: w, record: seen(19.99, { regular: 19.99, until: null }) }], now)!;
  expect(full.body).toMatch(/^Por debajo de tu objetivo \(22,00\s€\)$/);
});

test("notificationFor: varios, en una sola", () => {
  const item = (title: string) => ({ wish: wish({ title }), record: seen(9.99) });
  const three = notificationFor([item("Hades II"), item("Celeste"), item("Hollow Knight")], now)!;
  expect(three.title).toBe("3 deseos han bajado de tu objetivo");
  expect(three.body).toBe("Hades II, Celeste y Hollow Knight");
  expect(three.url).toBe("/deseos");
  expect(notificationFor([item("Hades II"), item("Celeste")], now)!.body).toBe("Hades II y Celeste");
  expect(notificationFor([], now)).toBeNull();
});

test("una suscripción caducada se quita; con otros errores, no", () => {
  expect(isGoneStatus(404)).toBe(true);
  expect(isGoneStatus(410)).toBe(true);
  for (const s of [500, 429, 0]) expect(isGoneStatus(s)).toBe(false);
});
