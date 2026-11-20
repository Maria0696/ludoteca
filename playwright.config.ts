import { defineConfig, devices } from "@playwright/test";

/*
 * Pruebas de extremo a extremo.
 *
 * - «escritorio» y «movil» usan una compilación de producción propia en modo
 *   local (en .next-pruebas, sin las claves de .env.local): cada prueba abre
 *   un navegador limpio, así que nunca tocan tu colección.
 * - «acceso» arranca otra instancia con una configuración de Supabase falsa
 *   para comprobar que sin sesión no se entra ni se llega a la API.
 *
 * Usa el Chrome instalado en el equipo.
 */

/** Variables vacías: Next no las rellena con las de .env.local. */
const sinServicios = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  OWNER_EMAIL: "",
  IGDB_CLIENT_ID: "",
  IGDB_CLIENT_SECRET: "",
  STEAM_API_KEY: "",
};

/** La pantalla de título ya vista hoy y las pistas ya leídas: cada prueba llega directa a lo suyo. */
const tituloVisto = {
  cookies: [],
  origins: [
    {
      origin: "http://localhost:3100",
      localStorage: [
        { name: "ludoteca:titulo-visto", value: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()) },
        // Las pistas de la guardiana, ya vistas: cada prueba que las quiera las borra.
        { name: "ludoteca:pistas-vistas", value: JSON.stringify(["mapa", "moneda", "datos", "quejuego", "steam"]) },
      ],
    },
  ],
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // En GitHub la máquina tiene 2 núcleos y Playwright usaría solo uno: con dos, las pruebas se solapan mientras esperan.
  workers: process.env.CI ? 2 : undefined,
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
      use: { baseURL: "http://localhost:3100", viewport: { width: 1440, height: 900 }, storageState: tituloVisto },
    },
    {
      name: "movil",
      testMatch: /movil\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chrome", baseURL: "http://localhost:3100", viewport: { width: 390, height: 844 }, storageState: tituloVisto },
    },
    {
      name: "acceso",
      testMatch: /acceso\.spec\.ts/,
      use: { baseURL: "http://localhost:3200" },
    },
  ],
  webServer: [
    {
      command: "npx next build && npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: 300_000,
      env: { ...sinServicios, NEXT_DIST_DIR: ".next-pruebas" },
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
