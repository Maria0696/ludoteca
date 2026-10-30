import { defineConfig, devices } from "@playwright/test";

/*
 * Pruebas de extremo a extremo.
 *
 * - «escritorio» y «movil» usan la compilación de producción en modo local:
 *   cada prueba abre un navegador limpio, así que nunca tocan tu colección.
 * - «acceso» arranca otra instancia con una configuración de Supabase falsa
 *   para comprobar que sin sesión no se entra ni se llega a la API.
 *
 * Antes de ejecutar: `npm run build`. Usa el Chrome instalado en el equipo.
 */

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/informe" }]],
  use: {
    channel: "chrome",
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "escritorio",
      testIgnore: /(movil|acceso)\.spec\.ts/,
      use: { baseURL: "http://localhost:3100", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "movil",
      testMatch: /movil\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chrome", baseURL: "http://localhost:3100", viewport: { width: 390, height: 844 } },
    },
    {
      name: "acceso",
      testMatch: /acceso\.spec\.ts/,
      use: { baseURL: "http://localhost:3200" },
    },
  ],
  webServer: [
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Supabase apunta a un puerto cerrado: cualquier comprobación de sesión falla.
      command: "npx next dev -p 3200",
      url: "http://localhost:3200/entrar",
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_DIST_DIR: ".next-acceso",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clave-de-prueba",
        OWNER_EMAIL: "propietaria@example.com",
      },
    },
  ],
});
