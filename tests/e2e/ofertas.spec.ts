import { type Page, expect, test } from "@playwright/test";
import { createBackup, parseBackup } from "../../src/lib/backup";
import { type WishItem, createGame, emptyLibrary } from "../../src/lib/model";
import { ESHOP, STEAM, currentOffer, newPriceRecords, offerAlerts, pickEshop, rankEshop } from "../../src/lib/price-watch";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";
import { parseEshopPrices, parseEshopSearch, parseSteamPrices } from "../../src/lib/store-prices";
import { openApp } from "./helpers";

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

test("al elegir en el eShop, primero las del mismo título, luego las que tienen todas sus palabras; las demás, al final", () => {
  const c = (title: string, nsuid: string) => ({ nsuid, title, platform: "Switch 2", amount: null });
  const ranked = rankEshop("Zelda Tears of the Kingdom Switch 2 Edition", [
    c("Crypt of the NecroDancer: Nintendo Switch Edition", "70010000000001"),
    c("The Legend of Zelda: Tears of the Kingdom", "70010000000002"),
    c("The Legend of Zelda: Tears of the Kingdom – Nintendo Switch 2 Edition", "70010000000003"),
    c("Zelda Tears of the Kingdom Switch 2 Edition", "70010000000004"),
  ]);
  expect(ranked.map((x) => x.nsuid)).toEqual(["70010000000004", "70010000000003", "70010000000002", "70010000000001"]);
  expect(rankEshop("Hades", Array.from({ length: 12 }, (_, i) => c(`Otro ${i}`, String(70010000000100 + i))))).toHaveLength(8);
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

/**
 * Una biblioteca con un juego y estos deseos, escrita directamente en el navegador (sin abrir la app). Con la biblioteca
 * vacía, Inicio enseña la bienvenida en vez de sus avisos. Borra «precios mirados» (las pruebas lo traen puesto para no
 * preguntar a las tiendas): así la app los mira al abrirse.
 */
async function withWishes(page: Page, wishes: WishItem[]) {
  await page.goto("/offline.html");
  await page.evaluate(() => localStorage.removeItem("ludoteca:precios-mirados"));
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
    { games: [createGame({ title: "Tunic" })], copies: [], wishlist: wishes, extras: [], wraps: [], format: 2 },
  );
}

const storedWishes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<WishItem[]>((resolve) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onsuccess = () => {
          const req = open.result.transaction("library", "readonly").objectStore("library").get("data");
          req.onsuccess = () => resolve(req.result.wishlist);
        };
      }),
  );

/** Las rutas de precios, simuladas: qué ofrece el catálogo del eShop y qué cuesta cada código. */
async function fakeStores(page: Page, candidates: unknown[], eshop: Record<string, unknown>, extra: { steamLinks?: Record<string, number>; steam?: Record<string, unknown> } = {}) {
  const asked = { eshop: [] as string[], steam: [] as number[] };
  await page.route("**/api/precios/eshop?*", (route) => route.fulfill({ json: { ok: true, candidates } }));
  await page.route("**/api/precios/steam", (route) => route.fulfill({ json: { ok: true, steam: extra.steamLinks ?? {} } }));
  await page.route("**/api/precios", (route) => {
    const body = route.request().postDataJSON() as { eshop: string[]; steam: number[] };
    asked.eshop.push(...body.eshop);
    asked.steam.push(...body.steam);
    return route.fulfill({ json: { ok: true, eshop, steam: extra.steam ?? {}, failed: [] } });
  });
  return asked;
}

const UNTIL = "2026-11-29T22:59:59Z";

test("al abrir la app, un deseo de Switch se enlaza solo con el eShop y su oferta sale en Inicio y en Deseos", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-27T10:00:00"));
  await withWishes(page, [wish({ title: "Hades II", platform: "Switch" })]);
  const asked = await fakeStores(page, [{ nsuid: "70010000060676", title: "Hades II", platform: "Switch", amount: 23.99 }], {
    "70010000060676": { amount: 23.99, regular: 29.99, until: UNTIL },
  });
  await openApp(page, "/");
  const notice = page.getByRole("region", { name: "Ofertas en tu lista de deseos" });
  await expect(notice).toContainText("Hades II: 23,99 € en el eShop (−20 %), hasta el domingo 29");
  expect(asked.eshop).toEqual(["70010000060676"]);
  await expect.poll(async () => (await storedWishes(page))[0].eshopNsuid).toBe("70010000060676");
  await notice.getByRole("link", { name: "Ver deseos" }).click();
  const item = page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: "Hades II" });
  await expect(item).toContainText("−20 % hasta el domingo 29");
  await expect(item).toContainText("23,99 €");
});

test("si el eShop tiene varias opciones, el deseo queda por elegir y se elige viendo el precio de cada una", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-27T10:00:00"));
  await withWishes(page, [wish({ title: "Zelda TOTK Switch 2 Edition", platform: "Switch 2" })]);
  const asked = await fakeStores(
    page,
    [
      { nsuid: "70050000056808", title: "Zelda TOTK Switch 2 Edition", platform: "Switch 2", amount: 9.99 },
      { nsuid: "70010000096822", title: "Zelda TOTK Switch 2 Edition", platform: "Switch 2", amount: 79.99 },
    ],
    { "70010000096822": { amount: 79.99, regular: 79.99, until: null } },
  );
  await openApp(page, "/deseos");
  const item = page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: "Zelda" });
  await item.getByRole("button", { name: "Elegir en el eShop" }).click();
  const dialog = page.getByRole("dialog", { name: /eShop/ });
  // El precio lleva un espacio que no se parte entre la cifra y el «€».
  await expect(dialog.getByRole("list").getByRole("button")).toContainText([/9,99\s€/, /79,99\s€/]);
  await dialog.getByRole("button", { name: /79,99\s€/ }).click();
  await expect.poll(async () => (await storedWishes(page))[0].eshopNsuid).toBe("70010000096822");
  await expect(item).toContainText("79,99 €");
  await expect(item.getByRole("button", { name: "Elegir en el eShop" })).toHaveCount(0);
  expect(asked.eshop).toContain("70010000096822");
});

test("«Buscar en las tiendas» enlaza también los de PC con Steam y mira sus precios", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-27T10:00:00"));
  await withWishes(page, [wish({ title: "Hades", platform: "PC", igdbId: 113112 })]);
  const asked = await fakeStores(page, [], {}, { steamLinks: { "113112": 1145360 }, steam: { "1145360": { amount: 6.12, regular: 24.5, until: null } } });
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: "Buscar en las tiendas" }).click();
  const item = page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: "Hades" });
  await expect(item).toContainText("6,12 €");
  await expect(item).toContainText("−75 %");
  expect(asked.steam).toContain(1145360);
  expect((await storedWishes(page))[0].steamAppId).toBe(1145360);
});
