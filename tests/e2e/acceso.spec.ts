import { type Page, expect, test } from "@playwright/test";
import { safeNextPath } from "../../src/lib/redirect";

/*
 * Con Supabase configurado y sin sesión válida, ninguna pantalla ni API da
 * acceso. La instancia de prueba apunta a un Supabase inexistente, así que la
 * sesión nunca se valida: equivale a una visita sin iniciar sesión.
 */

test("sin sesión, las pantallas redirigen a «Entrar»", async ({ page }) => {
  for (const path of ["/", "/biblioteca", "/ajustes", "/juego/cualquiera"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/entrar\?next=/);
  }
  await expect(page.getByRole("heading", { name: "Entrar en tu biblioteca" })).toBeVisible();
  await expect(page.getByLabel("Correo")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
});

test("sin sesión, la API del catálogo responde 401", async ({ request }) => {
  const search = await request.get("/api/catalogo?q=hades");
  expect(search.status()).toBe(401);
  expect(await search.json()).toMatchObject({ ok: false, reason: "no-autorizado" });
  const estado = await request.get("/api/catalogo/estado");
  expect(estado.status()).toBe(401);
});

test("sin sesión, nadie puede mandar avisos de errores", async ({ request }) => {
  const res = await request.post("/api/errores", { data: { kind: "navegador", name: "Error", message: "Intruso", path: "/" } });
  expect(res.status()).toBe(401);
});

test("tras entrar solo se vuelve a páginas de la propia app", () => {
  const origin = "https://ludoteca.example";
  // Rutas internas: se conservan tal cual.
  expect(safeNextPath("/biblioteca?vista=lista", origin)).toBe("/biblioteca?vista=lista");
  expect(safeNextPath("/juego/1#notas", origin)).toBe("/juego/1#notas");
  expect(safeNextPath("/.//otro-sitio.example", origin)).toBe("/otro-sitio.example");
  // Sin destino o con destino ajeno: al inicio.
  for (const next of [
    null,
    "",
    "biblioteca",
    "https://otro-sitio.example/",
    "//otro-sitio.example",
    "/\\otro-sitio.example",
    "/\t/otro-sitio.example",
    "/\n/otro-sitio.example",
    "javascript:alert(1)",
  ]) {
    expect(safeNextPath(next, origin), JSON.stringify(next)).toBe("/");
  }
});

test("ninguna otra web puede mostrar la app dentro de un marco", async ({ request }) => {
  const res = await request.get("/entrar");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

/** Simula las respuestas de Supabase Auth, que en estas pruebas no existe. */
async function mockSignIn(page: Page, status: number, body: object) {
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 200 : status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
      body: JSON.stringify(body),
    }),
  );
}

test("las obras de la pantalla de «Entrar» cargan sin sesión", async ({ request }) => {
  const res = await request.get("/demo-art/ghost-of-tsushima-fondo.webp", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/webp");
});

test("«Entrar» avisa si faltan datos o la contraseña no coincide", async ({ page }) => {
  await mockSignIn(page, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
  await page.goto("/entrar");
  const entrar = page.getByRole("button", { name: "Entrar" });

  await entrar.click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Escribe tu correo y tu contraseña para entrar.");
  await expect(page.getByLabel("Correo")).toBeFocused();

  await page.getByLabel("Correo").fill("propietaria@example.com");
  await entrar.click();
  await expect(page.getByLabel("Contraseña")).toBeFocused();

  await page.getByLabel("Contraseña").fill("no-es-esta");
  await entrar.click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("El correo o la contraseña no coinciden.");
  await expect(page.locator("main")).toHaveAttribute("data-fase", "sala");
  await expect(entrar).toBeEnabled();
});

test("al entrar bien, la pantalla se lleva toda la sala", async ({ page }) => {
  await mockSignIn(page, 200, {
    access_token: "a.b.c",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "r",
    user: { id: "1", aud: "authenticated", email: "propietaria@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  });
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("propietaria@example.com");
  await page.getByLabel("Contraseña").fill("la-buena");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-fase", "entrando");
});

test("la proyección avanza sola y se puede pausar", async ({ page }) => {
  await page.clock.install();
  await page.goto("/entrar");
  await expect(page.getByText("Fuji rojo")).toBeVisible();
  await page.clock.fastForward(7100);
  await expect(page.getByText("Nebulosa de Orión")).toBeVisible();
  await page.getByRole("button", { name: "Pausar la proyección" }).click();
  await expect(page.getByRole("button", { name: "Reanudar la proyección" })).toBeVisible();
  await page.clock.fastForward(30_000);
  await expect(page.getByText("Nebulosa de Orión")).toBeVisible();
});
