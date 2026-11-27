import { expect, test } from "@playwright/test";
import { createBackup, parseBackup } from "../../src/lib/backup";
import { type WishItem, emptyLibrary } from "../../src/lib/model";
import { ESHOP, STEAM, currentOffer, newPriceRecords, offerAlerts, pickEshop } from "../../src/lib/price-watch";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";

/* Precios de la lista de deseos: el eShop de Nintendo España y la tienda de Steam, mirados por la app. */

const stamp = "2026-11-27T10:00:00.000Z";
const wish = (patch: Partial<WishItem> = {}): WishItem => ({
  id: crypto.randomUUID(),
  title: "Hades II",
  coverUrl: null,
  igdbId: null,
  platform: "Switch",
  priority: "media",
  targetPrice: null,
  notes: null,
  genres: [],
  prices: [],
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});

test("el enlace con cada tienda y el precio normal y fin de oferta se guardan, también en las copias y en la nube", () => {
  const w = wish({
    eshopNsuid: "70010000063715",
    steamAppId: 1145350,
    prices: [{ id: "p1", amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z", store: ESHOP, date: "2026-11-27" }],
  });
  const parsed = parseBackup(JSON.stringify(createBackup({ ...emptyLibrary(), wishlist: [w] })));
  if (!parsed.ok) throw new Error(parsed.errors.join(", "));
  expect(parsed.backup.data.wishlist[0]).toMatchObject({ eshopNsuid: "70010000063715", steamAppId: 1145350, prices: [{ regular: 24.99, until: "2026-11-29T22:59:59Z" }] });
  const back = libraryFromRows(libraryToRows({ ...emptyLibrary(), wishlist: [w] })).wishlist[0];
  expect(back).toMatchObject({ eshopNsuid: "70010000063715", steamAppId: 1145350 });
});

test("en el eShop se enlaza solo si hay una única coincidencia clara; si no, queda por elegir", () => {
  const one = { nsuid: "70010000000001", title: "HADES II", platform: "Switch", amount: 29.99 };
  expect(pickEshop("Hades II", [one, { nsuid: "70010000000002", title: "Hades", platform: "Switch", amount: 24.5 }])).toEqual({ nsuid: one.nsuid });
  // Sin tildes ni signos también cuenta como el mismo título.
  expect(pickEshop("Pokémon Leyendas: Z-A", [{ ...one, title: "Pokemon Leyendas Z-A" }])).toEqual({ nsuid: one.nsuid });
  // Dos productos con el mismo título (edición normal y otra con el mismo nombre): por elegir.
  expect(pickEshop("Hades II", [one, { ...one, nsuid: "70010000000003" }])).toBeNull();
  // Ninguno igual: por elegir.
  expect(pickEshop("Hades II", [{ ...one, title: "Hades II: Deluxe" }])).toBeNull();
  expect(pickEshop("Hades II", [])).toBeNull();
});

test("un precio se apunta solo si cambia respecto al último de esa tienda", () => {
  const ids = (() => {
    let n = 0;
    return () => `n${++n}`;
  })();
  const w = wish({ prices: [{ id: "a", amount: 24.99, regular: 24.99, until: null, store: ESHOP, date: "2026-11-20" }] });
  // Igual que el último del eShop: nada nuevo. Steam aún no tenía ninguno: se apunta.
  const same = newPriceRecords(w, [{ store: ESHOP, quote: { amount: 24.99, regular: 24.99, until: null } }, { store: STEAM, quote: { amount: 20, regular: 20, until: null } }], "2026-11-27", ids);
  expect(same).toEqual([{ id: "n1", amount: 20, regular: 20, until: null, store: STEAM, date: "2026-11-27" }]);
  // Empieza una oferta: se apunta con su precio normal y su fin.
  const sale = newPriceRecords(w, [{ store: ESHOP, quote: { amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z" } }], "2026-11-27", ids);
  expect(sale).toEqual([{ id: "n2", amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z", store: ESHOP, date: "2026-11-27" }]);
  // Un precio apuntado a mano en otra tienda no cuenta para comparar.
  const manual = wish({ prices: [{ id: "m", amount: 10, store: "Instant Gaming", date: "2026-11-26" }] });
  expect(newPriceRecords(manual, [{ store: STEAM, quote: { amount: 20, regular: 20, until: null } }], "2026-11-27", ids)).toHaveLength(1);
});

test("la oferta vigente: en el eShop hasta su fecha de fin; en Steam, si se vio hace menos de 2 días", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const eshop = wish({ prices: [{ id: "e", amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z", store: ESHOP, date: "2026-11-27" }] });
  expect(currentOffer(eshop, now)).toEqual({ store: ESHOP, amount: 19.99, regular: 24.99, percent: 20, until: "2026-11-29T22:59:59Z" });
  expect(currentOffer(eshop, new Date("2026-11-30T00:00:00Z"))).toBeNull();
  const steam = wish({ prices: [{ id: "s", amount: 6.12, regular: 24.5, until: null, store: STEAM, date: "2026-11-26" }] });
  expect(currentOffer(steam, now)).toMatchObject({ store: STEAM, amount: 6.12, percent: 75, until: null });
  expect(currentOffer(steam, new Date("2026-11-29T12:00:00Z"))).toBeNull();
  // Si después se vio sin rebaja, ya no hay oferta.
  const ended = wish({ prices: [...eshop.prices, { id: "e2", amount: 24.99, regular: 24.99, until: null, store: ESHOP, date: "2026-11-28" }] });
  expect(currentOffer(ended, new Date("2026-11-28T12:00:00Z"))).toBeNull();
  // Con dos tiendas en oferta, la más barata.
  const both = wish({ prices: [...eshop.prices, ...steam.prices] });
  expect(currentOffer(both, now)?.store).toBe(STEAM);
});

test("Inicio avisa de los deseos en oferta por debajo de su objetivo, o en oferta sin objetivo", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  const sale = [{ id: "e", amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z", store: ESHOP, date: "2026-11-27" }];
  const list = [
    wish({ title: "Sin objetivo", prices: sale }),
    wish({ title: "Por debajo", targetPrice: 20, prices: sale }),
    wish({ title: "Aún caro", targetPrice: 15, prices: sale }),
    wish({ title: "Sin oferta", prices: [{ id: "x", amount: 24.99, regular: 24.99, until: null, store: ESHOP, date: "2026-11-27" }] }),
    wish({ title: "De demostración", demo: true, prices: sale }),
  ];
  expect(offerAlerts(list, now).map((a) => a.wish.title)).toEqual(["Sin objetivo", "Por debajo"]);
});
