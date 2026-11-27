import { expect, test } from "@playwright/test";
import { createBackup, parseBackup } from "../../src/lib/backup";
import { type WishItem, emptyLibrary } from "../../src/lib/model";
import { ESHOP, STEAM, currentOffer, newPriceRecords, offerAlerts, pickEshop } from "../../src/lib/price-watch";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";
import { parseEshopPrices, parseEshopSearch, parseSteamPrices } from "../../src/lib/store-prices";

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

// Respuestas reales de las tiendas (recortadas), para leerlas sin depender de la red.
const ESHOP_PRICES = {
  prices: [
    { title_id: 70010000063715, sales_status: "onsale", regular_price: { amount: "69,99 €", currency: "EUR", raw_value: "69.99" } },
    {
      title_id: 70010000012345,
      sales_status: "onsale",
      regular_price: { amount: "7,99 €", currency: "EUR", raw_value: "7.99" },
      discount_price: { amount: "1,59 €", currency: "EUR", raw_value: "1.59", start_datetime: "2026-11-17T14:00:00Z", end_datetime: "2026-11-29T22:59:59Z" },
    },
    { title_id: 70010000099999, sales_status: "not_found" },
  ],
};
const STEAM_PRICES = {
  "413150": { success: true, data: { price_overview: { currency: "EUR", initial: 1399, final: 1399, discount_percent: 0 } } },
  "1145360": { success: true, data: { price_overview: { currency: "EUR", initial: 2450, final: 612, discount_percent: 75 } } },
  "570": { success: true, data: [] },
  "1": { success: false },
};
const ESHOP_SEARCH = {
  response: {
    docs: [
      { title: "The Legend of Zelda: Tears of the Kingdom", system_names_txt: ["Nintendo Switch"], nsuid_txt: ["70010000063715"] },
      { title: "The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition", system_names_txt: ["Nintendo Switch 2"], nsuid_txt: ["70050000056808", "70010000096822"] },
      { title: "Sin código", system_names_txt: ["Nintendo Switch"] },
    ],
  },
};

test("se leen bien los precios del eShop y de Steam, con la oferta y su fin", () => {
  expect(parseEshopPrices(ESHOP_PRICES)).toEqual({
    "70010000063715": { amount: 69.99, regular: 69.99, until: null },
    "70010000012345": { amount: 1.59, regular: 7.99, until: "2026-11-29T22:59:59Z" },
  });
  // Los gratuitos (sin precio) y los que no existen no vuelven.
  expect(parseSteamPrices(STEAM_PRICES)).toEqual({
    "413150": { amount: 13.99, regular: 13.99, until: null },
    "1145360": { amount: 6.12, regular: 24.5, until: null },
  });
});

test("del catálogo del eShop sale un candidato por producto y código, de la consola del deseo", () => {
  const switch1 = parseEshopSearch(ESHOP_SEARCH, "Switch");
  expect(switch1.map((c) => c.nsuid)).toEqual(["70010000063715"]);
  // Switch 2 también juega a lo de Switch: salen los dos, y la Switch 2 Edition con sus dos códigos.
  const switch2 = parseEshopSearch(ESHOP_SEARCH, "Switch 2");
  expect(switch2.map((c) => [c.nsuid, c.platform])).toEqual([
    ["70010000063715", "Switch"],
    ["70050000056808", "Switch 2"],
    ["70010000096822", "Switch 2"],
  ]);
});

test("las rutas de precios comprueban lo que se les pide y, sin nada que mirar, no salen a las tiendas", async ({ request }) => {
  expect((await request.post("/api/precios", { data: { eshop: ["no-es-un-codigo"] } })).status()).toBe(400);
  const empty = await request.post("/api/precios", { data: { eshop: [], steam: [] } });
  expect(await empty.json()).toEqual({ ok: true, eshop: {}, steam: {}, failed: [] });
  expect((await request.get("/api/precios/eshop?q=a&plataforma=Switch")).status()).toBe(400);
  expect((await request.get("/api/precios/eshop?q=zelda&plataforma=PS5")).status()).toBe(400);
  // Sin claves de IGDB (como en las pruebas), no se puede saber el número de Steam.
  expect(await (await request.post("/api/precios/steam", { data: { igdbIds: [1] } })).json()).toMatchObject({ ok: false, reason: "no-configurado" });
});
