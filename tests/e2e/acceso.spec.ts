import { expect, test } from "@playwright/test";

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
