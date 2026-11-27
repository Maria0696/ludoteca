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
        // Los precios de los deseos, recién mirados: así ninguna prueba pregunta sola al eShop ni a Steam. Las de
        // ofertas.spec lo borran.
        { name: "ludoteca:precios-mirados", value: JSON.stringify(new Date().toISOString()) },
        // Los logros de Steam, recién mirados: ninguna prueba pregunta sola a Steam. Las de logros.spec lo borran.
        { name: "ludoteca:logros-mirados", value: JSON.stringify(new Date().toISOString()) },
      ],
    },
  ],
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  // Dos navegadores a la vez, también en local. En GitHub, Playwright usaría solo uno (con dos, cada parte tarda ~1 min
  // menos). En un portátil de 4 núcleos usaría cuatro, y cuatro Chrome sin tarjeta gráfica dibujando las animaciones
  // de Inicio (las ascuas sobre el fondo con filtros) se comen la CPU: el servidor de pruebas tarda más de 10 s en
  // responder y fallan las navegaciones. Con dos, las mismas pruebas pasan, y en la mitad de tiempo.
  workers: 2,
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
