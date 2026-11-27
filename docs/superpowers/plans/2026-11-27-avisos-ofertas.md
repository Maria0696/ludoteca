# Notificaciones de ofertas en el móvil — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una tarea de GitHub mire dos veces al día los precios de los deseos con objetivo y mande una notificación al móvil cuando alguno baje a ese objetivo o por debajo.

**Architecture:** Lógica pura en `src/lib/offer-push.ts` (qué precios apuntar, qué avisar, el texto), compartida por la ruta `POST /api/avisos-ofertas` (clave Bearer → RPC de Supabase con huella → tiendas → `web-push` → RPC para apuntar). El móvil se suscribe desde una línea en Deseos (`push-client.ts` + `OfferAlertsLine.tsx`) y guarda la suscripción en `push_subscriptions` con RLS; `public/sw.js` enseña la notificación.

**Tech Stack:** Next.js 16 (rutas de `app/api`), Supabase (RLS, funciones `security definer`), `web-push` 3.6.7 + `@types/web-push`, Playwright (también para las pruebas de funciones puras, como en `ofertas.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-11-27-avisos-ofertas-design.md`

## Global Constraints

- Interfaz y textos en español; los de la spec, tal cual.
- Solo deseos **con precio objetivo**, propios (`demo = false`) y enlazados al eShop o a Steam.
- Se avisa solo cuando **la ruta** descubre un precio nuevo con importe ≤ objetivo.
- Errores de la ruta: sin nube → 404; sin clave o mala → 401; sin claves VAPID → 503 «faltan las claves de los avisos».
- Variables: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (la URL de la app, sin correo); secreto de GitHub `AVISOS_CLAVE`.
- La migración 0020 la aplica la propietaria; aquí no se aplica nada.
- Ninguna clave se enseña en pantalla: van a un archivo del scratchpad o directas a `gh secret set`.
- Tarea a las 9:00 y 19:00 UTC, a mano también, y se reactiva sola.
- Pruebas locales: solo los specs tocados (`avisos.spec.ts`, `acceso.spec.ts`, `pwa.spec.ts`, `deseos.spec.ts`).

## Review Focus

1. La oferta se alarga (solo cambia `until`, mismo importe ≤ objetivo) → no se repite el aviso. *(Tarea 1)*
2. La oferta se abarata más (ya estaba ≤ objetivo y baja otra vez) → sí avisa; igual o más cara → no. *(Tarea 1)*
3. Una tienda falla y la otra responde → se apuntan y avisan solo los de la que respondió, sin borrar nada de la otra. *(Tarea 1)*
4. Importe exactamente igual al objetivo → avisa, con «En tu objetivo». *(Tarea 1)*
5. Una suscripción responde 404/410 → se quita; con otro error (500, red) se conserva. *(Tarea 1, `isGoneStatus`)*

---

### Task 1: La lógica pura de los avisos

**Files:**
- Create: `src/lib/offer-push.ts`
- Test: `tests/e2e/avisos.spec.ts`

**Interfaces:**
- Consumes: `newPriceRecords`, `ESHOP`, `STEAM`, `Quote`, `untilLabel`, `storeIn` de `price-watch.ts`; `formatMoney` de `format.ts`; `WishItem`, `PriceRecord` de `model.ts`.
- Produces:
  - `type StorePrices = { eshop?: Record<string, Quote>; steam?: Record<string, Quote> }` (una tienda ausente = no respondió).
  - `type AlertItem = { wish: WishItem; record: PriceRecord }`.
  - `planAlerts(wishes: WishItem[], prices: StorePrices, today: string, id: () => string): { changes: { id: string; prices: PriceRecord[] }[]; notify: AlertItem[] }`.
  - `type PushPayload = { title: string; body: string; url: string }`.
  - `notificationFor(items: AlertItem[], now: Date): PushPayload | null`.
  - `TEST_PAYLOAD: PushPayload`.
  - `isGoneStatus(status: number): boolean`.

- [ ] **Step 1: Escribir las pruebas** en `tests/e2e/avisos.spec.ts` (con un `wish()` como el de `ofertas.spec.ts`, `targetPrice: 22`, `eshopNsuid: "70010000063715"`):
  - `planAlerts: avisa solo de los precios nuevos por debajo del objetivo o en él` → con quote eShop `{amount: 19.99, regular: 24.99, until: "2026-11-29T22:59:59Z"}` y sin precios previos: `changes` tiene ese id con 1 precio; `notify` tiene 1. Con quote `22` → notifica. Con quote `22.5` → `changes` 1, `notify` 0. Deseo con `targetPrice: null` y precio bajo → `changes` 1, `notify` 0.
  - `planAlerts: alargar la oferta no repite el aviso; abaratarla más, sí` → previo `{19.99, regular 24.99, until A}`; quote con `until B` → `changes` 1, `notify` 0. Quote `14.99` → `notify` 1. Previo `29.99` (acabó la oferta) y quote `19.99` → `notify` 1.
  - `planAlerts: si una tienda no responde, no se toca lo suyo` → deseo con eShop y Steam (`steamAppId: 1145350`), `prices = { steam: {"1145350": {amount: 9.99, regular: 19.99, until: null}} }` (sin `eshop`) → solo 1 precio nuevo, de `STEAM`; `notify` 1 con `record.store === STEAM`.
  - `planAlerts: un deseo con las dos tiendas por debajo se avisa una vez, con la más barata`.
  - `notificationFor: uno, con su tienda, su descuento y hasta cuándo` → `{title: "Hades II: 19,99 € en el eShop", body: "Por debajo de tu objetivo (22,00 €) · −20 %, hasta el domingo 29", url: "/deseos"}` con `now = 2026-11-27T10:00:00Z` (comparar con `\s` en lugar del espacio duro de `formatMoney`). En el objetivo exacto: el cuerpo empieza por «En tu objetivo (22,00 €)». Steam sin `until`: «… · −50 %» sin «hasta». Sin rebaja (`regular == amount`): solo «Por debajo de tu objetivo (22,00 €)».
  - `notificationFor: varios, en una sola` → 3 → title «3 deseos han bajado de tu objetivo», body «Hades II, Celeste y Hollow Knight»; 2 → «Hades II y Celeste»; `[]` → `null`.
  - `una suscripción caducada se quita; con otros errores, no` → `isGoneStatus(404)`, `(410)` true; `(500)`, `(429)`, `(0)` false.

- [ ] **Step 2: Ejecutar y verlas fallar**

Run: `npx playwright test tests/e2e/avisos.spec.ts --project=escritorio`
Expected: FAIL al importar `../../src/lib/offer-push` (no existe).

- [ ] **Step 3: Implementar `src/lib/offer-push.ts`** sin importar nada de React ni del servidor (lo usan la ruta y las pruebas).
  - `planAlerts`: por deseo, las quotes de las tiendas presentes en `prices` según `eshopNsuid`/`steamAppId`; `newPriceRecords` da los nuevos; `changes` = `{id, prices: [...wish.prices, ...nuevos]}` si hay nuevos.
  - Un nuevo **avisa** si el deseo tiene objetivo, su importe ≤ objetivo y (no había precio previo de esa tienda o el último previo de esa tienda era más caro). Por deseo, como mucho un `AlertItem`: el más barato.
  - `notificationFor`: para uno, título `${title}: ${formatMoney(amount)} ${storeIn(store)}`; cuerpo `«Por debajo de tu objetivo (X)»` o `«En tu objetivo (X)»`, más `· −N %` si `regular > amount` y `, ${untilLabel(until, now)}` si hay `until`. Para varios, el título con el número y el cuerpo con los títulos unidos por «, » y « y ». `url` siempre `"/deseos"`.
  - `TEST_PAYLOAD = { title: "Avisos de ofertas activados", body: "Así te avisaré cuando un deseo baje de su precio objetivo.", url: "/deseos" }`.

- [ ] **Step 4: Ejecutar y verlas pasar.** Mismo comando. Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/lib/offer-push.ts tests/e2e/avisos.spec.ts && git commit -m "Avisos de ofertas: qué precios apuntar, qué avisar y con qué texto"`

### Task 2: Supabase, el envío y las rutas

**Files:**
- Create: `supabase/migrations/0020_avisos_ofertas.sql`, `src/lib/push.ts`, `src/app/api/avisos-ofertas/route.ts`, `src/app/api/avisos-ofertas/prueba/route.ts`
- Modify: `package.json` (deps), `tests/e2e/avisos.spec.ts`, `tests/e2e/acceso.spec.ts`

**Interfaces:**
- Consumes: `planAlerts`, `notificationFor`, `TEST_PAYLOAD`, `isGoneStatus`, `PushPayload` (Tarea 1); `fetchEshopPrices`, `fetchSteamPrices`; `libraryFromRows`; `authorizeRequest`, `getServerSupabase`; `isSupabaseConfigured`, `supabaseUrl`, `supabaseKey`.
- Produces:
  - Tabla `push_subscriptions(id uuid pk default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users on delete cascade, endpoint text unique not null check (endpoint ~ '^https://'), p256dh text not null, auth text not null, user_agent text, created_at timestamptz default now())`, con la política «solo la propietaria» de 0001.
  - Tabla `alerts_key` como `backup_key`; función `clave_de_avisos_valida(clave)`.
  - RPC `deseos_vigilados(clave) → jsonb {wishes: [filas de wishlist], subscriptions: [{endpoint, p256dh, auth}]}` (filas con `target_price is not null`, `demo = false`, `eshop_nsuid` o `steam_app_id` no nulos, de la propietaria).
  - RPC `apuntar_precios(clave, cambios jsonb)` → `update wishlist set prices = c.prices, updated_at = now()` por `[{id, prices}]`, solo de la propietaria.
  - RPC `quitar_suscripcion(clave, endpoint)`.
  - Las tres con `errcode 28000` si la clave no vale; `grant execute` a `anon, authenticated`.
  - `src/lib/push.ts` (`import "server-only"`): `vapidReady(): boolean`; `sendPush(sub: {endpoint: string; p256dh: string; auth: string}, payload: PushPayload): Promise<"ok" | "gone" | "error">`.
  - `POST /api/avisos-ofertas` → `{ok: true, watched, newPrices, notified, sent, removed, failed: string[]}`.
  - `POST /api/avisos-ofertas/prueba` con `{endpoint}` → `{ok: true}`; 410 si la suscripción ha caducado; 404 si no está guardada.

- [ ] **Step 1: Añadir las pruebas**
  - En `avisos.spec.ts`: `en modo local no hay avisos que mandar` → `POST /api/avisos-ofertas` y `/api/avisos-ofertas/prueba` responden 404 con `{ok: false}`.
  - En `acceso.spec.ts`: `los avisos de ofertas solo se mandan con la clave, y nunca mandan a «Entrar»` → con `{}`, `Bearer corta` y `Basic xxx…`: 401; con `Bearer ${"a".repeat(64)}`: 503 y `message` contiene «faltan las claves de los avisos» (en `acceso` no hay VAPID); `/prueba` sin sesión: 401. Todo con `maxRedirects: 0`.

- [ ] **Step 2: Verlas fallar**

Run: `npx playwright test tests/e2e/avisos.spec.ts tests/e2e/acceso.spec.ts`
Expected: FAIL con 404/405 de Next en lugar de los códigos pedidos (las rutas no existen).

- [ ] **Step 3: Escribir la migración 0020**, siguiendo el estilo de 0018: comentario de cabecera, `revoke` de las tablas sin políticas y `set search_path = ''`.

- [ ] **Step 4: Instalar las dependencias:** `npm install web-push@3.6.7` y `npm install -D @types/web-push@3.6.4`.

- [ ] **Step 5: Implementar `push.ts` y las rutas**
  - `push.ts`: `webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)` perezoso; `sendPush` captura el `WebPushError` y lo clasifica con `isGoneStatus(statusCode)`; TTL de 12 h (`TTL: 43200`).
  - Ruta principal, en este orden:
    1. `!isSupabaseConfigured` → 404.
    2. Bearer con el mismo regex que la copia; si no → 401.
    3. `!vapidReady()` → 503 `{reason: "sin-claves", message: "Faltan las claves de los avisos (VAPID) en el servidor."}`.
    4. RPC `deseos_vigilados`: 28000 → 401; otro error → 502.
    5. Precios: `Promise.allSettled` de las dos tiendas (solo si hay ids); las que fallan van a `failed` y no entran en `StorePrices`.
    6. `planAlerts` y `notificationFor`; enviar a cada suscripción; las `"gone"` → `quitar_suscripcion`.
    7. `apuntar_precios` con `changes` (si hay); un error aquí → 502.
    8. Responder con el resumen.

    Además, `export const maxDuration = 60`.
  - Ruta de prueba: `!isSupabaseConfigured` → 404; `authorizeRequest()`; zod `{endpoint: string url}`; leer la fila con `getServerSupabase()` (RLS); `!vapidReady()` → 503; `sendPush(…, TEST_PAYLOAD)`; `"gone"` → borrar la fila y 410 «Esta suscripción ha caducado: vuelve a activar los avisos.»; `"error"` → 502.

- [ ] **Step 6: Verlas pasar.** Mismo comando. Expected: PASS. Después, `npm run typecheck` y `npm run lint` sin errores.

- [ ] **Step 7: Commit** — migración, `push.ts`, rutas, `package*.json` y pruebas: «Avisos de ofertas: la ruta que mira los precios y manda las notificaciones».

### Task 3: Activarlos en el móvil y enseñarlos

**Files:**
- Create: `src/lib/push-client.ts`, `src/app/deseos/OfferAlertsLine.tsx`
- Modify: `public/sw.js`, `src/app/deseos/WishlistView.tsx` (debajo de `priceStatus`), `src/app/deseos/wishlist.module.css` (si hace falta), `tests/e2e/avisos.spec.ts`, `tests/e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: `getBrowserSupabase`; `useLibrary().mode`; ruta `/api/avisos-ofertas/prueba` (Tarea 2); tabla `push_subscriptions`.
- Produces:
  - `type PushStatus = "unsupported" | "ios-browser" | "denied" | "off" | "on"`.
  - `pushStatusFrom(env: {supported: boolean; ios: boolean; standalone: boolean; permission: NotificationPermission; subscribed: boolean}): PushStatus`.
  - `usePushStatus(): {status: PushStatus | null; refresh(): Promise<void>}`.
  - `enablePush(): Promise<void>`, `disablePush(): Promise<void>`, `testPush(): Promise<void>`. Las tres lanzan `Error` con un mensaje en español para el aviso.

- [ ] **Step 1: Pruebas**
  - `avisos.spec.ts`, `en el iPhone, fuera de la app instalada, se pide abrirla desde su icono` → `pushStatusFrom({supported: false, ios: true, standalone: false, …})` es `"ios-browser"`; `ios` y `standalone` con `supported` → `"off"`/`"on"` según `subscribed`; `permission: "denied"` → `"denied"` aunque esté suscrito; sin soporte y sin iOS → `"unsupported"`.
  - `avisos.spec.ts`, `en modo local, Deseos no ofrece avisos` → con un deseo sembrado (`seedDemo` o el alta del spec de deseos), en `/deseos` sale «Precios del eShop y Steam» y no sale el texto «Avisos de ofertas».
  - `pwa.spec.ts`, `el service worker enseña las notificaciones y lleva a Deseos al tocarlas` → `GET /sw.js` contiene `addEventListener("push"` y `addEventListener("notificationclick"`.

- [ ] **Step 2: Verlas fallar.**

Run: `npx playwright test tests/e2e/avisos.spec.ts tests/e2e/pwa.spec.ts --project=escritorio`
Expected: FAIL. Falta `push-client`, y `sw.js` no tiene los manejadores. La de modo local puede pasar ya; se deja como guarda.

- [ ] **Step 3: `sw.js`**
  - `push`: `event.data.json()` → `showNotification(title, {body, icon: "/icon-192.png", badge: "/icon-192.png", data: {url}})`. Sin datos, «Ludoteca».
  - `notificationclick`: cerrar; `clients.matchAll({type: "window", includeUncontrolled: true})`; si hay una ventana, `navigate(url)` y `focus()`; si no, `openWindow(url)`.

- [ ] **Step 4: `push-client.ts`**
  - Detección: iOS por `userAgent` (iPhone, iPad, iPod), o `MacIntel` con `maxTouchPoints > 1`. App instalada por `matchMedia("(display-mode: standalone)")` o `navigator.standalone`. Soporte si existen `serviceWorker`, `PushManager` y `Notification`.
  - `enablePush`:
    1. `Notification.requestPermission()`; si no es `"granted"`, error «Sin permiso, el móvil no puede enseñar los avisos.»
    2. `navigator.serviceWorker.ready` y `pushManager.subscribe({userVisibleOnly: true, applicationServerKey})`, con la clave base64url pasada a `Uint8Array`.
    3. `upsert` en `push_subscriptions` con `endpoint`, `p256dh`, `auth` (de `toJSON().keys`) y `user_agent`, con `onConflict: "endpoint"`.
    4. Si el `upsert` falla, `unsubscribe()` y error «No se ha podido guardar la suscripción. ¿Está aplicada la migración 0020?»
  - `disablePush`: borrar la fila y luego `unsubscribe()`.
  - `testPush`: POST a la ruta de prueba con el `endpoint`; error con el `message` de la ruta si no es `ok`.

- [ ] **Step 5: `OfferAlertsLine.tsx`**
  - Se pinta solo si `mode === "supabase"` y hay `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
  - Es un `<p className={styles.priceStatus} aria-live="polite">` con `link-btn`, como la línea de precios.
  - Textos:
    - `off`: «Avisos de ofertas en este móvil: desactivados · Activar»;
    - `on`: «Avisos de ofertas en este móvil: activados · Probar · Desactivar»;
    - mientras tanto: «Activando los avisos…», «Desactivando los avisos…» y «Enviando una de prueba…»;
    - `ios-browser`: «Para recibir avisos de ofertas, abre la app desde su icono en la pantalla de inicio.»;
    - `denied`: «Avisos de ofertas: bloqueados. Permite las notificaciones de la Ludoteca en los ajustes del móvil.»;
    - `unsupported`: «Este navegador no puede recibir avisos de ofertas.»
  - Éxito de «Probar»: `toast("Notificación de prueba enviada.")`. Errores: `toast.error(message)`, con `sonner` como en el resto de la app.
  - Montarla en `WishlistView` justo debajo de la línea de precios.

- [ ] **Step 6: Verlas pasar.** Mismo comando más `tests/e2e/deseos.spec.ts`. Expected: PASS. Después, typecheck y lint.

- [ ] **Step 7: Capturas** a 1440 y 390 de Deseos. La línea solo sale en nube, así que se comprueba renderizándola en el navegador real con el estado `off` y la spec en local no lo verá; si no se puede, basta con la captura de la línea de precios intacta. **Commit:** «Avisos de ofertas: activarlos en el móvil desde Deseos».

### Task 4: La tarea de GitHub, las claves y la PR

**Files:**
- Create: `.github/workflows/avisos-ofertas.yml`
- Scratchpad (no se sube): `claves-avisos.txt` con las tres variables de Vercel.

**Interfaces:**
- Consumes: la ruta de la Tarea 2; los secretos `APP_URL` y `AVISOS_CLAVE`.

- [ ] **Step 1: El workflow** — `on.schedule: ["0 9 * * *", "0 19 * * *"]` + `workflow_dispatch`; permisos `contents: read`, `actions: write`; un paso `curl --fail-with-body --silent --show-error -X POST "$APP_URL/api/avisos-ofertas" -H "Authorization: Bearer $AVISOS_CLAVE"` **sin reintentos**: un reintento tras enviar podría avisar dos veces. Después, imprimir el resumen. Por último, el paso de reactivación con `gh workflow enable avisos-ofertas.yml`. `timeout-minutes: 5`.
- [ ] **Step 2: Comprobar el YAML:** `node -e` con el analizador que haya (o `npx --yes yaml valid`). Expected: sin errores.
- [ ] **Step 3: Generar `AVISOS_CLAVE`** (`crypto.randomBytes(32).toString("base64url")`) y pasarla directa a `gh secret set AVISOS_CLAVE`; enseñar solo su SHA-256.
- [ ] **Step 4: Generar las claves VAPID** con `npx web-push generate-vapid-keys --json` y escribirlas, sin enseñarlas, en `claves-avisos.txt` del scratchpad, junto a `VAPID_SUBJECT=https://ludoteca-six.vercel.app`.
- [ ] **Step 5: Commit, push y PR** en español: qué hace, sus cuatro pasos (migración + `insert into public.alerts_key (key_hash) values ('<huella>');`, variables de Vercel y volver a desplegar, fusionar, activar y probar en el iPhone) y lo que no está probado automáticamente.
