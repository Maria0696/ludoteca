import { expect, test } from "@playwright/test";
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
