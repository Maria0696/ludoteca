# Logros de Steam — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los logros de Steam de los juegos de la biblioteca: en la ficha, en una vista de todos (`/logros`), en el Anuario y en Estadísticas, actualizados solos una vez al día.

**Architecture:**
- **Lógica pura** en `src/lib/achievements.ts`.
- **Consultas a Steam** en el servidor: `src/lib/steam-achievements.ts` y las rutas `/api/logros*`.
- **Sincronización** en el cliente, en `src/lib/achievement-sync.ts`, como `price-sync.ts`.
- **Guardado:** los logros y el perfil viven en la biblioteca (`Library.achievements`, `Library.settings`) y se guardan como los años del Anuario: IndexedDB, tablas de Supabase y copias de seguridad.

**Tech Stack:** Next.js 16, Supabase, zod, Playwright (también para lo puro).

**Spec:** `docs/superpowers/specs/2026-11-27-logros-steam-design.md`

## Global Constraints

- Textos en español; los de la spec, tal cual («Logro oculto · 3,2 % · Ver», «23 de 41 · 56 %», «te faltan 3», «Mirar ahora»).
- Solo juegos de la biblioteca (no demo) con `steamAppId`. Los de PC sin enlazar se enlazan por título con `pickSteam` y, si hay dudas, «Elegir en Steam».
- La clave de Steam nunca sale del servidor. Las rutas exigen sesión (`authorizeRequest`).
- Una vuelta al día al abrir (`ludoteca:logros-mirados`); «Mirar ahora» los mira todos o un juego. `playwright.config.ts` trae la clave puesta.
- Migración 0021: la aplica la propietaria.
- Pruebas locales: solo los specs tocados, con 2 navegadores.

## Review Focus

1. **Perfil privado, o sin perfil guardado.** Mensaje claro con cómo arreglarlo; nada se rompe y no se borra lo guardado. *(Tareas 3, 4 y 5)*
2. **Juego sin logros** (Steam: «no stats»). Se apunta `total: 0` y no sale en la vista ni en la ficha. *(Tareas 1 y 4)*
3. **Logro sin rareza** (`percent` ausente). Va al final de los que faltan, sin «NaN %». *(Tarea 1)*
4. **Borrar un juego.** Se van sus logros, en local y en la nube. *(Tarea 2)*
5. **Bibliotecas y copias de antes,** sin `achievements` ni `settings`. Se leen con listas vacías. *(Tarea 2)*

---

### Task 1: Modelo y lógica pura

**Files:**
- Modify: `src/lib/model.ts`
- Create: `src/lib/achievements.ts`, `tests/e2e/logros.spec.ts`

**Interfaces — Produces:**

En `model.ts`:
- `achievementSchema` = `{ api, name, description: string | null, hidden: boolean, percent: number | null, unlockedAt: string | null, icon: string | null }`.
- `gameAchievementsSchema` = `{ id, gameId, steamAppId, total, unlocked, items: Achievement[], checkedAt, createdAt, updatedAt }`.
- Tipos `Achievement` y `GameAchievements`; `Settings = { steamId: string | null }`.
- `Library` gana `achievements: GameAchievements[]` y `settings: Settings`; `emptyLibrary()` los trae vacíos (`{ steamId: null }`).

En `achievements.ts`:
- `SteamPlayerAchievement = { apiname: string; achieved: number; unlocktime: number; name?: string; description?: string }`.
- `SteamSchemaAchievement = { name: string; displayName?: string; hidden?: number; description?: string; icon?: string }`.
- `mergeAchievements(player, schema, percents: Record<string, number>): { total: number; unlocked: number; items: Achievement[] }`.
- `completion(g: { total: number; unlocked: number }): number`, en entero 0–100.
- `missingSorted(items: Achievement[]): Achievement[]`.
- `unlockedSorted(items: Achievement[]): Achievement[]`, del más reciente al más antiguo.
- `nearlyDone(list: GameAchievements[]): GameAchievements[]`.
- `achievementsOfYear(list: GameAchievements[], games: Game[], year: number): { count: number; completed: { gameId: string; title: string; date: string }[]; rarest: { title: string; name: string; percent: number } | null }`.
- `achievementTotals(list: GameAchievements[]): { unlocked: number; complete: number; average: number; rarest: { gameId: string; title?: string; item: Achievement }[] }`, con los 5 más raros conseguidos.

- [ ] **Step 1: Pruebas** en `logros.spec.ts`:
  - **`mergeAchievements`:**
    - usa el `displayName` del esquema y, si falta, el `name` del jugador;
    - `description` vacía → `null`;
    - `hidden: 1` → `true`;
    - `unlocktime 1767225600` con `achieved 1` → `"2026-01-01T00:00:00.000Z"`, y si `achieved 0` → `null`;
    - el `percent` llega en número (lo convierte la ruta) y, si falta, es `null`;
    - `icon` viene del esquema;
    - cuenta bien `total` y `unlocked`;
    - un logro del esquema que el jugador no trae cuenta como no conseguido.
  - **`missingSorted`:** `[12.4, null, 0.8, 3.2]` → `[0.8, 3.2, 12.4, null]`.
  - **`completion`:** `23/41` → 56; `0/0` → 0.
  - **`nearlyDone`:**
    - quita los de `total 0`;
    - los empezados van por porcentaje alto primero y, a igualdad, menos que faltan;
    - después, los de 0 conseguidos;
    - los del 100 % van al final.
  - **`achievementsOfYear`:**
    - cuenta los conseguidos en el año, en hora de Madrid (`unlockedAt` `2025-12-31T23:30:00Z` cuenta para 2026);
    - un juego completo cuyo último logro es de ese año está en `completed`, con esa fecha;
    - `rarest` es el de menor `percent` del año;
    - sin logros, `{ count: 0, completed: [], rarest: null }`.
  - **`achievementTotals`:** la media es la de los juegos con algún logro conseguido; `rarest` tiene como mucho 5.
- [ ] **Step 2:** `TZ=Europe/Madrid npx playwright test -c playwright.puras.config.ts tests/e2e/logros.spec.ts`. Expected: FAIL porque no existe `achievements`.
- [ ] **Step 3:** implementar. El año en Madrid: `new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(date).slice(0, 4)`.
- [ ] **Step 4:** el mismo comando, y otra vez con `TZ=UTC`. Expected: PASS. Además, `npx tsc --noEmit`: los usos de `Library` que no compilen se arreglan aquí con listas vacías (demo, `emptyLibrary`, repos).
- [ ] **Step 5:** commit «Logros: el modelo y la parte sin red».

### Task 2: Guardarlos (local, Supabase, copias) y acciones del almacén

**Files:**
- Create: `supabase/migrations/0021_logros.sql`
- Modify: `src/lib/repo/types.ts` (`Changes.achievements?`, `Changes.settings?`), `src/lib/repo/local.ts`, `src/lib/repo/supabase.ts`, `src/lib/backup.ts`, `src/lib/store.tsx`, `tests/e2e/logros.spec.ts`

**Interfaces — Produces:**
- **Tablas** `achievements` (`id`, `owner_id`, `game_id` único con cascada, `steam_app_id`, `total`, `unlocked`, `items jsonb`, `checked_at`, `created_at`, `updated_at`) y `user_settings` (`owner_id` pk con default `auth.uid()`, `steam_id`, `updated_at`).
- **`copia_de_seguridad`** devuelve además `achievements` y `user_settings`.
- **`LibraryRows`** gana `achievements?` y `user_settings?`.
- **`libraryFromRows` y `libraryToRows`** los convierten; `settings.steamId` sale de la primera fila de `user_settings`.
- **Copia:** `data.achievements` (default `[]`) y `data.settings` (default `{ steamId: null }`); `createBackup` los incluye. Al importar una copia, `planImport` y `resolveImport` copian los logros de los juegos importados y el perfil, si lo hay y el actual está vacío.
- **Acciones del almacén:**
  - `saveAchievements(items: GameAchievements[]): void` sustituye por `gameId`;
  - `setSteamId(steamId: string | null): void`;
  - `deleteGame`, `deleteAllGames` y `deleteDemo` también quitan los logros de esos juegos en memoria y en local.

- [ ] **Step 1: Pruebas**
  - una biblioteca con logros y perfil pasa por `createBackup`/`parseBackup` y por `libraryToRows`/`libraryFromRows` sin perder nada;
  - una copia sin esos campos se lee con `achievements: []` y `settings.steamId: null`;
  - e2e local: con un juego con logros sembrado en IndexedDB, al borrar el juego desde su ficha desaparecen sus logros del almacén.
- [ ] **Step 2:** verlas fallar.
- [ ] **Step 3:** la migración, al estilo de 0017/0018 (RLS «solo la propietaria», `revoke`/`grant`), con `create or replace function public.copia_de_seguridad` completa (las cinco claves de antes y las dos nuevas). En Supabase, `load()` tolera que las tablas no existan (`missingTable`), como `year_wraps`.
- [ ] **Step 4:** verlas pasar, con `tsc` y `eslint`.
- [ ] **Step 5:** commit «Logros: guardarlos en el navegador, en Supabase y en las copias».

### Task 3: Steam en el servidor

**Files:**
- Create: `src/lib/steam-achievements.ts`, `src/app/api/logros/route.ts`, `src/app/api/logros/recientes/route.ts`
- Modify: `src/app/api/steam/route.ts` y `src/lib/steam.ts` (la respuesta buena trae `steamId`), `tests/e2e/logros.spec.ts`, `tests/e2e/acceso.spec.ts`

**Interfaces — Produces:**
- Pura: `parsePercents(json): Record<string, number>`, que acepta `percent` en texto o en número.
- Pura: `parsePlayer(json): { ok: true; items: SteamPlayerAchievement[] } | { ok: false; reason: "privado" | "sin-logros" | "error" }`.
- Pura: `parseSchema(json): SteamSchemaAchievement[]`.
- `fetchGameAchievements(key, steamId, appId): Promise<{ total; unlocked; items } | "sin-logros" | "privado">`.
- `POST /api/logros` con `{ steamId: /^\d{17}$/, appIds: number[] ≤ 10 }` → `{ ok: true, games: Record<string, { total; unlocked; items }>, sinLogros: number[], failed: number[] }`, o bien `{ ok: false, reason: "privado" | "no-configurado" | "mal-pedido" }`.
- `GET /api/logros/recientes?steamId=` → `{ ok: true, appIds: number[] }`.

- [ ] **Step 1: Pruebas**
  - los tres parseos, con JSON como el de Steam: privado = `{ playerstats: { error: "Profile is not public", success: false } }`; sin logros = `{ playerstats: { error: "Requested app has no stats", success: false } }`;
  - rutas en local: `appIds` de 11 → 400, perfil inválido → 400, y uno bueno sin clave → `no-configurado`;
  - `acceso`: las dos rutas sin sesión → 401.
- [ ] **Step 2:** verlas fallar.
- [ ] **Step 3:** implementar. Las tres llamadas de cada juego, en paralelo. GetPlayerAchievements con 403 o 400 se lee igual con `parsePlayer`, por el cuerpo. Los juegos de una tanda van de 3 en 3.
- [ ] **Step 4:** verlas pasar.
- [ ] **Step 5:** commit «Logros: preguntar a Steam desde el servidor».

### Task 4: Sincronizar y guardar el perfil

**Files:**
- Create: `src/lib/achievement-sync.ts`
- Modify: `src/components/shell/AppShell.tsx` (montar `AchievementWatch`), `src/app/importar/SteamImport.tsx` (guarda `settings.steamId` al importar bien), `src/app/ajustes/SettingsView.tsx` (campo del perfil, en el apartado «Traer juegos»), `playwright.config.ts` (`ludoteca:logros-mirados`), `tests/e2e/logros.spec.ts`

**Interfaces — Produces:**
- `syncAchievements(library, actions, { force?: boolean; gameId?: string }): Promise<{ linked; updated; pending; privado: boolean; failed: boolean }>`.
- `useLastAchievementCheck(): string | null`.
- `usePendingSteamGames(): Set<string>`, con los juegos «por elegir».
- `chooseSteamForGame(game, appId, actions)`.
- `AchievementWatch`.

- [ ] **Step 1: e2e** con rutas simuladas (`page.route`), en una biblioteca sembrada con un juego de PC sin `steamAppId` y `settings.steamId`:
  - al abrir, se pide `/api/precios/steam/buscar`, se enlaza y se pide `/api/logros` con ese `appId`; el almacén guarda los logros;
  - sin perfil, no se pide nada;
  - con `privado`, en la ficha sale el aviso (lo comprueba la Tarea 5);
  - en Ajustes se guarda y se quita el perfil (por enlace, con la ruta `/api/steam` simulada que devuelve `steamId`).
- [ ] **Step 2:** verlas fallar.
- [ ] **Step 3:** implementar, según la sección «Sincronización» de la spec. Qué se mira cada día: los nunca mirados, los recientes y los de más de 30 días.
- [ ] **Step 4:** verlas pasar.
- [ ] **Step 5:** commit «Logros: se miran solos una vez al día; el perfil, en Ajustes».

### Task 5: Ficha y vista de todos

**Files:**
- Create: `src/app/juego/[id]/AchievementsPanel.tsx`, `src/app/logros/page.tsx`, `src/app/logros/AchievementsView.tsx`, `src/app/logros/logros.module.css`
- Modify: `src/app/juego/[id]/GameDetail.tsx`, `src/app/juego/[id]/detail.module.css`, `src/app/deseos/StoreChooser.tsx` (pasa a `src/components/ui/StoreChooser.tsx`, con `SteamChooser` para un `{ title }` y su `choose`), `tests/e2e/logros.spec.ts`

- [ ] **Step 1: e2e** con la biblioteca sembrada con logros:
  - **Ficha:**
    - región «Logros» con «2 de 4 · 50 %»;
    - «Te faltan (2)» en orden de rareza;
    - el oculto como «Logro oculto · 3,2 %» y, al pulsar «Ver», con su nombre;
    - conseguidos con fecha;
    - «Mirar ahora» pide `/api/logros` con ese juego.
  - **Sin perfil:** «Guarda tu perfil de Steam en Ajustes para ver tus logros».
  - **Privado:** el aviso de los «Detalles de juego».
  - **De PC sin enlazar:** «Elegir en Steam» abre el selector, y al elegir se enlaza.
  - **`/logros`:** filas en el orden de `nearlyDone`, con «te faltan N», y cada una enlaza a su ficha.
- [ ] **Step 2:** verlas fallar.
- [ ] **Step 3:** implementar con el estilo de cada sitio. Los iconos de los que faltan, con `filter: grayscale(1)`. En el móvil, una columna.
- [ ] **Step 4:** verlas pasar. Capturas a 1440 y 390.
- [ ] **Step 5:** commit «Logros: en la ficha de cada juego y en una vista de todos».

### Task 6: Anuario y Estadísticas

**Files:**
- Modify: `src/lib/anuario.ts` (`YearWrapData.achievements?`, rellenado en `computeYear` con `achievementsOfYear`), `src/app/anuario/YearStory.tsx`, `src/app/estadisticas/StatsView.tsx`, sus CSS, `tests/e2e/logros.spec.ts`

- [ ] **Step 1: e2e**
  - **Anuario de 2026** con logros sembrados: existe la pantalla «Tus logros», con el número, los juegos al 100 % y el más raro.
  - **Año sin logros:** esa pantalla no sale.
  - **Estadísticas:** el apartado «Logros» con los totales y «Ver todos» → `/logros`.
- [ ] **Step 2:** verlas fallar.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** verlas pasar, junto con `anuario.spec.ts` y `estadisticas.spec.ts`. Capturas.
- [ ] **Step 5:** commit «Logros: en el Anuario y en Estadísticas».

### Task 7: PR

- [ ] Revisión final propia, sin subagentes.
- [ ] Push y PR con sus pasos:
  - la migración 0021;
  - los «Detalles de juego» públicos en Steam;
  - guardar el perfil;
  - «Mirar ahora».
- [ ] Esperar la CI.
