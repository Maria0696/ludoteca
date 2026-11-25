# Sagas a mano Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter juegos a mano en las sagas buscando en IGDB, también los que no tiene (guardados en `saga_extras`), verlos «en el camino» con «Añadir a deseos», buscar los que faltan, «Nueva saga» y la pantalla vacía «El mapa en blanco».

**Architecture:** Una colección nueva en la biblioteca, `extras` (juegos de saga que no tiene), con su tabla en Supabase y su sitio en el modo local y la copia de seguridad. `sagas.ts` pasa a ordenar «paradas» (juegos suyos y que faltan) en una sola lista; el puesto y «Siguiente» siguen contando solo los suyos.

**Tech Stack:** Next.js 16, TypeScript, zod, Supabase, IndexedDB, IGDB, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-sagas-design.md` (sección «Tercera vuelta»)

## Global Constraints

- Español de España; mundo de la carcasa; oro solo para la acción principal y lo elegido.
- Los que no tiene no cuentan para el puesto ni para «Siguiente»; se ordenan en la cronología como los demás.
- Nada aparece en el mapa sin que ella lo diga (añadir a mano o elegir en «Buscar los que faltan»).
- Supabase: tabla `public.saga_extras` con `owner_id`, la política «solo la propietaria», índice por `owner_id`, permisos a `authenticated` y ninguno a `anon` (migración `0012_juegos_de_saga.sql`). **No se aplica sin permiso explícito.** Sin la tabla, la app carga igual (sin juegos de saga que no tiene).
- Copia de seguridad: `data.extras` con valor por defecto `[]`; misma versión.
- TDD; en local solo los specs afectados; sin prettier en archivos enteros.

## Review Focus

1. Ocultar «Los que me faltan» y arrastrar un juego suyo: los que faltan conservan su sitio. → prueba en Task 2.
2. Un juego que faltaba llega a la biblioteca (deseo convertido) con el mismo número de IGDB: toma su historia y su puesto, y la parada hueca desaparece. → prueba en Task 1.
3. Supabase sin la tabla nueva: la biblioteca carga igual. → revisión de código en Task 1 (el repositorio trata el error de tabla inexistente como lista vacía).
4. Una copia de seguridad antigua (sin `extras`) se importa; una nueva conserva los juegos de saga que no tiene. → prueba en Task 1.
5. Añadir con el buscador un juego que ya tiene: entra como suyo, no como parada hueca. → prueba en Task 4.

---

### Task 1: Datos de los juegos de saga que no tiene

**Files:** `src/lib/model.ts` (`sagaExtraSchema`, `SagaExtra`, `Library.extras`, `emptyLibrary`), `src/lib/repo/types.ts` (`Changes.extras`, `deleteExtra`), `src/lib/repo/local.ts`, `src/lib/repo/supabase.ts`, `src/lib/backup.ts`, `src/lib/store.tsx` (acciones y absorber al llegar a la biblioteca), `supabase/migrations/0012_juegos_de_saga.sql`; Test: `tests/e2e/sagas.spec.ts`.

**Interfaces (produce):**
- `SagaExtra = { id; series: string; igdbId?: number | null; title: string; coverUrl?: string | null; releaseDate?: string | null; seriesOrder?: number | null; createdAt; updatedAt; demo?: boolean }`
- acciones: `addExtras(items: NewExtraInput[]): SagaExtra[]`, `updateExtras(patches: { id: string; patch: Partial<SagaExtra> }[]): void`, `deleteExtra(id: string): void` (con «Deshacer»)
- al dar de alta un juego o convertir un deseo con `igdbId` igual al de un juego de saga que no tiene: el juego toma `series` y `seriesOrder` y ese juego de saga se borra.

- [ ] Pruebas (rojo): copia antigua sin `extras` → `[]`; copia con `extras` los conserva al exportar e importar; convertir un deseo con el `igdbId` de un juego de saga que no tiene → la parada hueca desaparece y el juego queda en la saga.
- [ ] Implementar; migración escrita (no aplicada).
- [ ] Verde, `tsc` limpio; commit «Sagas: los juegos de saga que no tiene».

### Task 2: Reglas con paradas (suyas y que faltan)

**Files:** `src/lib/sagas.ts`; Test: `tests/e2e/sagas.spec.ts`.

**Interfaces:** `Story` gana `extras: SagaExtra[]`; `buildStories(games, extras = [])` (≥ 2 paradas en total); `type Stop = { kind: "juego"; id; game } | { kind: "falta"; id; extra }`; `storyStops(story, order, withExtras): Stop[]`; `placeInStory(story, id, toIndex, withExtras = true): { kind: "juego" | "falta"; id; seriesOrder }[]` (sin los que faltan, los suyos se reordenan en sus huecos y los que faltan no se mueven); `orderStory` sigue devolviendo solo los suyos, en el orden de las paradas; `storyPosition(game, games, extras = [])`; `missingFrom(story, catalog: { igdbId; title; coverUrl; releaseDate }[], games)`.

- [ ] Pruebas (rojo): orden con paradas mezcladas; colocar con los que faltan ocultos no los mueve; historia con un suyo y uno que falta cuenta; `missingFrom` descarta los que ya tiene o ya están.
- [ ] Implementar; adaptar las pruebas de `placeInStory`.
- [ ] Verde; commit «Sagas: paradas suyas y que faltan».

### Task 3: Los juegos de una serie en IGDB

**Files:** `src/lib/igdb.ts` (`gamesOfSeries(name)`), `src/app/api/catalogo/serie/route.ts`, `src/lib/catalog.ts` (`SeriesGamesResponse`).

- [ ] `POST /api/catalogo/serie` con `{ name }` → `{ ok: true; games: CatalogGame[] }` (juegos principales, rehechos y remasterizados de la serie con ese nombre); mismo patrón que `/api/catalogo/series`.
- [ ] `tsc` limpio; commit.

### Task 4: La pantalla

**Files:** `src/app/sagas/SagasView.tsx`, `src/app/sagas/sagas.module.css`; Test: `tests/e2e/sagas.spec.ts`.

- [ ] Pruebas (rojo): pantalla vacía con «Tu primer mapa está por dibujar»; «Añadir juego» con el buscador (catálogo simulado): uno que no tiene entra como parada hueca, uno que tiene entra como suyo; interruptor «Los que me faltan»; «Añadir a deseos» → «En deseos»; «Quitar de la saga» (suyo y que falta, con «Deshacer»); «Buscar los que faltan» propone y se elige; «Nueva saga».
- [ ] Implementar; capturas a 1440 y 390 px.
- [ ] Verde (`sagas`, `movil`, `carcasa`, `ficha`, `flujos`); commit.

### Task 5: Revisión, Supabase y PR

- [ ] Revisión independiente de la rama; arreglar lo importante con pruebas.
- [ ] Pedir permiso para aplicar `0012`; aplicarla y comprobarla.
- [ ] PR en español, CI e informe.
