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

test("sin sesión, el móvil puede leer lo que necesita para instalar la app", async ({ request }) => {
  for (const path of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icon-192.png", "/icon-512.png", "/icon-maskable-512.png", "/apple-icon.png"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
});

test("sin sesión, la API del catálogo responde 401", async ({ request }) => {
  const search = await request.get("/api/catalogo?q=hades");
  expect(search.status()).toBe(401);
  expect(await search.json()).toMatchObject({ ok: false, reason: "no-autorizado" });
  const estado = await request.get("/api/catalogo/estado");
  expect(estado.status()).toBe(401);
});

test("sin sesión, las rutas de Steam responden 401", async ({ request }) => {
  for (const [path, data] of [
    ["/api/steam", { perfil: "alguien" }],
    ["/api/steam/fichas", { appIds: [10] }],
  ] as const) {
    const res = await request.post(path, { data });
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, reason: "no-autorizado" });
  }
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

const session = {
  access_token: "a.b.c",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 4_000_000_000,
  refresh_token: "r",
  user: { id: "1", aud: "authenticated", email: "propietaria@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
};

const guardianSays = (page: Page, role: "alert" | "status", text: string) => page.getByRole(role).filter({ hasText: text });

test("al salir de la ludoteca, la guardiana se despide y pide el correo para volver", async ({ page }) => {
  await page.goto("/entrar?adios=1");
  await expect(guardianSays(page, "status", "¡Hasta pronto!")).toBeAttached();
  await expect(guardianSays(page, "status", "dime tu correo")).toBeAttached();
});

test("la guardiana pide el correo y la contraseña, y avisa de lo que falla", async ({ page }) => {
  await mockSignIn(page, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
  await page.goto("/entrar");
  await expect(guardianSays(page, "status", "Dime tu correo")).toBeAttached();
  const decir = page.getByRole("button", { name: "Decir" });

  await decir.click();
  await expect(guardianSays(page, "alert", "No te he oído")).toBeAttached();
  await expect(page.getByLabel("Correo")).toBeFocused();

  await page.getByLabel("Correo").fill("no-es-un-correo");
  await decir.click();
  await expect(guardianSays(page, "alert", "Eso no parece un correo")).toBeAttached();

  await page.getByLabel("Correo").fill("propietaria@example.com");
  await page.keyboard.press("Enter");
  await expect(guardianSays(page, "status", "contraseña secreta")).toBeAttached();
  await expect(page.getByLabel("Contraseña")).toBeFocused();

  await page.getByLabel("Contraseña").fill("no-es-esta");
  await page.keyboard.press("Enter");
  await expect(guardianSays(page, "alert", "El correo o la contraseña no coinciden")).toBeAttached();
  await expect(page.locator("main")).toHaveAttribute("data-fase", "sala");
  await expect(page.getByLabel("Contraseña")).toHaveValue("");
  await expect(decir).toBeEnabled();

  await page.getByRole("button", { name: "Volver" }).click();
  await expect(page.getByLabel("Correo")).toBeFocused();
});

test("si Supabase no responde, lo dice en español y deja reintentar", async ({ page }) => {
  await mockSignIn(page, 500, { code: 500, msg: "Internal server error" });
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("propietaria@example.com");
  await page.keyboard.press("Enter");
  await page.getByLabel("Contraseña").fill("x");
  await page.keyboard.press("Enter");
  await expect(guardianSays(page, "alert", "La puerta no responde")).toBeAttached();
  await expect(page.getByRole("button", { name: "Decir" })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("ludoteca:titulo-visto"))).toBeNull();
});

test("al entrar bien, la puerta se abre", async ({ page }) => {
  await mockSignIn(page, 200, session);
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("propietaria@example.com");
  await page.keyboard.press("Enter");
  await page.getByLabel("Contraseña").fill("la-buena");
  // Anota qué se lee en el cuadro justo cuando empieza a abrirse la puerta.
  const shownAtDoor = page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const main = document.querySelector("main")!;
        new MutationObserver(() => {
          if (main.dataset.fase === "entrando") resolve(main.querySelector("p span[aria-hidden]")!.textContent!);
        }).observe(main, { attributes: true });
      }),
  );
  await page.keyboard.press("Enter");
  await expect(guardianSays(page, "status", "Todo en orden")).toBeAttached();
  expect(await shownAtDoor).toBe("Todo en orden. Pasa, tu colección te espera.");
  await expect(page.locator("main")).toHaveAttribute("data-fase", "entrando");
  // Tras cruzar la puerta, hoy ya no sale la pantalla de título.
  const seen = await page.evaluate(() => [localStorage.getItem("ludoteca:titulo-visto"), new Intl.DateTimeFormat("sv-SE").format(new Date())]);
  expect(seen[0]).toBe(seen[1]);
});

test("con los dos campos rellenos por un gestor de contraseñas no pregunta dos veces", async ({ page }) => {
  await mockSignIn(page, 200, session);
  await page.goto("/entrar");
  await page.getByLabel("Correo").fill("propietaria@example.com");
  await page.getByLabel("Contraseña").fill("la-buena", { force: true });
  await page.getByRole("button", { name: "Decir" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-fase", "entrando");
});
