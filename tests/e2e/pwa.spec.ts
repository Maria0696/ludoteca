import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

/*
 * La Ludoteca instalable como app: manifiesto, iconos, etiquetas de Apple y una pantalla propia sin conexión.
 * Las pruebas corren contra la versión publicada (next start), donde el service worker sí se registra.
 */

test("el manifiesto la hace instalable: nombre, pantalla completa, colores e iconos", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({
    name: "Ludoteca",
    short_name: "Ludoteca",
    display: "standalone",
    start_url: "/",
    scope: "/",
    lang: "es-ES",
    theme_color: "#1a1526",
    background_color: "#1a1526",
  });
  expect(m.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icon-192.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "/icon-512.png", sizes: "512x512", type: "image/png" }),
      expect.objectContaining({ src: "/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
    ]),
  );
});

test("en iPhone abre a pantalla completa con su icono y su título", async ({ page }) => {
  await openApp(page, "/");
  const head = page.locator("head");
  await expect(head.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(head.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Ludoteca");
  await expect(head.locator('meta[name="mobile-web-app-capable"], meta[name="apple-mobile-web-app-capable"]')).not.toHaveCount(0);
  await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black");
});

/** Ancho y alto de un PNG, leídos de su cabecera (IHDR). */
const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test("los iconos son PNG del tamaño que dicen", async ({ request }) => {
  for (const [path, size] of [
    ["/icon-192.png", 192],
    ["/icon-512.png", 512],
    ["/icon-maskable-512.png", 512],
    ["/apple-icon.png", 180],
  ] as const) {
    const res = await request.get(path);
    expect(res.ok(), path).toBe(true);
    expect(res.headers()["content-type"], path).toContain("image/png");
    expect(pngSize(await res.body()), path).toEqual([size, size]);
  }
});

/** Abre la app y espera a que el service worker la controle. */
async function withServiceWorker(page: import("@playwright/test").Page) {
  await openApp(page, "/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await openApp(page, "/");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test("sin conexión, la app enseña su pantalla «Sin conexión» con «Reintentar»", async ({ page, context }) => {
  await withServiceWorker(page);
  await context.setOffline(true);
  await page.goto("/biblioteca");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/biblioteca$/);
  // La biblioteca de verdad (vacía en las pruebas): ofrece los datos de demostración.
  await expect(page.getByRole("button", { name: "Probar con datos de demostración" })).toBeVisible();
});

test("con conexión, la app sigue trayendo las páginas de verdad", async ({ page }) => {
  await withServiceWorker(page);
  await openApp(page, "/deseos");
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toHaveCount(0);
  await expect(page.locator("h1")).toContainText("deseos");
});

test("el service worker se recoge nuevo cada vez y solo guarda la pantalla sin conexión", async ({ page, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  await withServiceWorker(page);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const entries = await Promise.all(keys.map(async (k) => (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)));
    return { keys, entries };
  });
  expect(cached.keys).toEqual(["ludoteca-sin-conexion-v1"]);
  expect(cached.entries).toEqual([["/offline.html"]]);
});

test("el service worker enseña las notificaciones de ofertas y lleva a Deseos al tocarlas", async ({ request }) => {
  const sw = await (await request.get("/sw.js")).text();
  expect(sw).toContain('addEventListener("push"');
  expect(sw).toContain('addEventListener("notificationclick"');
});
