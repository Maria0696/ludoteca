# Importar de Game Tracker · plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer a la Ludoteca, desde el CSV de Game Tracker, los juegos y deseos que aún no tiene, con una revisión antes de copiar, y dividir por tienda los juegos de PC en la biblioteca.

**Architecture:** Todo en el navegador. Un módulo puro (`gametracker-import.ts`) lee el CSV, traduce plataformas y formatos a copias, reconoce lo que ya está y prepara lo que se guarda. La pantalla de importar gana un origen «Game Tracker» y la acción de la tienda guarda por tandas, como la copia de Steam. La biblioteca añade el filtro «Tienda» y parte la balda de PC por tienda.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, CSS Modules, zod, Playwright (las funciones puras se prueban importándolas desde `src`, como en `tests/e2e/ficha.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-11-19-importar-game-tracker-design.md`

## Global Constraints

- Leer la guía de `node_modules/next/dist/docs/` antes de tocar páginas o rutas (AGENTS.md).
- Todo el texto de la interfaz en español de España.
- Carcasa «Una sola máquina» (DESIGN.md): ventanas `window`, Press Start 2P en títulos, VT323 a 18 px o más, dorado solo para la acción principal y lo elegido, sin esquinas redondeadas, objetivos táctiles de 44 px en el móvil.
- Nada se escribe en la cuenta hasta pulsar «Copiar a la ludoteca».
- Un juego que ya está (por número de IGDB o por título normalizado, sin contar los de demostración) se salta entero.
- PS VR y PS VR2 no crean copia; las tiendas no son plataformas.
- Sin dependencias nuevas.
- Rama `importar-game-tracker` desde `main`; un commit por tarea, en español, terminando en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- El archivo real es grande (unos 700 registros, sinopsis con saltos de línea, comillas dobles escapadas): el parser no debe partir un registro en dos. → prueba en la Tarea 1 con comillas, `;` y salto de línea dentro de un campo.
- Volver a importar el mismo archivo tras copiar: todo debe salir como «Ya lo tienes» y no crear nada. → prueba en la Tarea 3.
- Un corte a mitad de la copia: lo ya guardado se queda y al repetir no se duplica (cada tanda vuelve a comprobar contra la biblioteca actual). → prueba pura en la Tarea 2 (planificar dos veces seguidas).
- Sinopsis de más de 2000 caracteres: el modelo las rechaza; se recortan. → prueba en la Tarea 1.
- Copias de PC sin tienda junto a copias con tienda: la balda «PC · sin tienda» solo aparece si hay alguna con tienda; si ninguna tiene, la balda sigue llamándose «PC». → prueba en la Tarea 4.

---

### Task 1: Leer el CSV de Game Tracker

**Files:**
- Create: `src/lib/csv.ts`
- Create: `src/lib/igdb-maps.ts` (sale de `src/lib/igdb.ts`, que lo importa)
- Create: `src/lib/gametracker-import.ts` (primera parte)
- Modify: `src/lib/igdb.ts` (quita `GENRES_ES`, `PLATFORM_NAMES`, `mapModes`, `guessMoods` y los importa)
- Test: `tests/e2e/gametracker.spec.ts`

**Interfaces:**
- Produces:
  - `parseCsv(text: string, separator?: string): string[][]` (por defecto `;`; quita el BOM; admite `""` dentro de comillas y saltos `\r\n`/`\n`).
  - En `igdb-maps.ts`, sin `"server-only"`: `GENRES_ES: Record<string,string>`, `PLATFORM_NAMES: Record<string,string>`, `mapModes(names: string[]): PlayMode[]`, `guessMoods(names: string[]): Mood[]`. `igdb.ts` llama a `mapModes(g.game_modes?.map(x=>x.name) ?? [])` y `guessMoods([...genres, ...themes].map(x=>x.name))`.
  - En `gametracker-import.ts`:
    ```ts
    export interface GtEntry {
      title: string; igdbId: number | null; wish: boolean;
      platforms: string[];   // ya traducidas, sin PS VR, sin repetir
      stores: string[]; formats: Format[];
      coverUrl: string | null; backdropUrl: string | null; summary: string | null;
      genres: string[]; modes: PlayMode[]; moods: Mood[]; developer: string | null;
      releaseDate: string | null; criticRating: number | null; createdAt: string;
    }
    export type GtParse = { ok: true; entries: GtEntry[] } | { ok: false; message: string };
    export function parseGameTracker(text: string): GtParse;
    export function gtPlatform(name: string): string | null; // null para PS VR / PS VR2
    ```

- [ ] **Step 1: Pruebas que fallan** en `tests/e2e/gametracker.spec.ts` (bloque `test.describe("leer el archivo")`):
  - `parseCsv('a;"b;c";"d ""e""\nf"\r\n1;2;3')` → `[["a","b;c",'d "e"\nf'],["1","2","3"]]`.
  - `parseGameTracker("hola;adios\n1;2")` → `{ ok: false, message: "Este archivo no parece una exportación de Game Tracker." }`.
  - Con una cabecera real (las 29 columnas de la spec, en ese orden) y una fila de *Ark* (`source=igdb`, `externalId=10239`, `cover=https://images.igdb.com/igdb/image/upload/t_cover_big/co493k.png`, `artworks=".../t_screenshot_big/ar5kw.png;.../ar67gg.png"`, `externalRating=67.66`, `genres="Role-playing (RPG);Shooter"`, `gameModes="Single player;Multiplayer;Co-operative;Split screen"`, `developers="Studio Wildcard"`, `firstReleaseDate=2017-08-27`, `spaces=Propiedad`, `userPlatforms="PC (Microsoft Windows)"`, `tags="Epic Games;Steam"`, `formats=DIGITAL`, `createdAt=2026-02-22`), la entrada vale: `igdbId 10239`, `wish false`, `platforms ["PC"]`, `stores ["Epic Games","Steam"]`, `formats ["digital"]`, `coverUrl ".../t_cover_big_2x/co493k.png"`, `backdropUrl ".../t_1080p/ar5kw.png"`, `criticRating 68`, `genres ["Rol","Disparos"]`, `modes` contiene `solo`, `coop_online`, `coop_local`, `competitivo`, `moods` contiene `accion` e `historia`, `developer "Studio Wildcard"`, `createdAt "2026-02-22T12:00:00.000Z"`.
  - `gtPlatform("PlayStation VR")` y `gtPlatform("PlayStation VR2")` → `null`; `gtPlatform("Oculus Rift")` → `"PC"`; `gtPlatform("Meta Quest 3")` → `"Meta Quest"`; `gtPlatform("PlayStation Portable")` → `"PSP"`; `gtPlatform("Atari 2600")` → `"Atari 2600"`.
  - Una fila con `source=user` y `externalId` vacío → `igdbId null`; `externalRating=0.0` → `criticRating null`; `spaces=Deseos` → `wish true`, `formats []`; una sinopsis de 2500 caracteres → `summary.length === 2000`.
  - Una fila con título vacío no produce entrada.

- [ ] **Step 2: Ejecutar y ver que fallan**
  Run: `npx playwright test tests/e2e/gametracker.spec.ts --project=escritorio -g "leer el archivo" --reporter=line`
  Expected: FAIL (no existen los módulos).

- [ ] **Step 3: Implementar** `csv.ts`, `igdb-maps.ts` (mover sin cambiar valores; añadir a la tabla de plataformas `"Oculus Rift": "PC"`) y la parte de lectura de `gametracker-import.ts`. La cabecera es válida si contiene `title`, `source`, `externalId`, `spaces`, `userPlatforms`, `formats` y `tags`; las columnas se buscan por nombre, no por posición. `PHYSICAL`→`fisico`, `DIGITAL`→`digital`. La fecha de alta es `AAAA-MM-DDT12:00:00.000Z` si `createdAt` es `AAAA-MM-DD`; si no, ahora.

- [ ] **Step 4: Ejecutar y ver que pasan**, además de `npx tsc --noEmit` y `npx playwright test tests/e2e/ficha.spec.ts --project=escritorio --reporter=line` (el catálogo sigue igual).

- [ ] **Step 5: Commit** «Importar de Game Tracker: leer el archivo» (incluye la spec y este plan).

---

### Task 2: Copias, lo que ya está y lo que se guarda

**Files:**
- Modify: `src/lib/gametracker-import.ts`
- Test: `tests/e2e/gametracker.spec.ts` (bloque `test.describe("planificar")`)

**Interfaces:**
- Consumes: `GtEntry` (Tarea 1); `createGame`, `createCopy`, `normalizeTitle`, `newId`, `nowIso`, `Library`, `Copy`, `Game`, `WishItem` de `model.ts`.
- Produces:
  ```ts
  export interface PlannedCopy { platform: string; format: Format; store: string | null }
  export function planCopies(entry: GtEntry): { copies: PlannedCopy[]; doubtful: boolean };
  export type GtState = "nuevo" | "dudoso" | "ya";
  export interface GtItem { id: string; entry: GtEntry; state: GtState; copies: PlannedCopy[] }
  export function classifyGameTracker(library: Library, entries: GtEntry[]): GtItem[];
  export interface GtCounts { juegos: number; copias: number; deseos: number; saltados: number }
  export function planGameTrackerImport(library: Library, items: GtItem[]):
    { games: Game[]; copies: Copy[]; wishlist: WishItem[]; counts: GtCounts };
  ```
  `GtItem.id` es estable dentro de una lectura (índice de fila); la pantalla guarda la selección y las copias editadas por `id`.

- [ ] **Step 1: Pruebas que fallan**, con entradas construidas a mano (una función de ayuda `entry(partial)` en el spec):
  - `planCopies` PC con `stores ["Epic Games","Steam"]`, `formats ["digital"]` → `[{PC,digital,"Epic Games"},{PC,digital,"Steam"}]`, `doubtful false`.
  - PC sin tiendas → `[{PC,digital,null}]`.
  - `platforms ["PS4"]`, `formats ["fisico","digital"]` → `[{PS4,fisico,null},{PS4,digital,null}]`, no dudoso.
  - `platforms ["PS3","PC","PS4"]`, ambos formatos, `stores ["Steam"]` → `{PC,digital,"Steam"}`, `{PS3,fisico,null}`, `{PS4,fisico,null}`.
  - `platforms ["PS5","PS4"]`, `formats ["fisico"]` → PS5 y PS4 en físico.
  - `platforms ["Switch","Switch 2"]`, ambos formatos → 4 copias (físico y digital en cada una), `doubtful true`.
  - `platforms []` → `copies []`, `doubtful true`.
  - Consolas sin formato → físico en cada una, `doubtful true`.
  - PC con `formats ["fisico"]` y sin más plataformas → `{PC,fisico,null}`.
  - `classifyGameTracker`: con un juego propio «Hades» (igdbId nulo) y un juego de demostración «Celeste», las entradas «Hades» → `ya`, «Celeste» → `nuevo`; una entrada con `igdbId` igual al de un juego propio pero otro título → `ya`; la segunda aparición del mismo título en el archivo → `ya`; un deseo cuyo título ya está en la lista de deseos o entre los juegos → `ya`; una entrada dudosa nueva → `dudoso`.
  - `planGameTrackerImport` con 2 juegos nuevos (uno con 2 copias) y 1 deseo → `counts { juegos: 2, copias: 3, deseos: 1, saltados: 0 }`; cada copia lleva `gameId` de su juego, `availability "comprado"`, `store` del plan; el juego conserva `createdAt` del archivo, `status "pendiente"`; el deseo lleva `priority "media"`, `platform` = primera plataforma, `igdbId`, `coverUrl`, `genres`.
  - Idempotencia: aplicar el resultado a la biblioteca y volver a llamar a `planGameTrackerImport` con los mismos `items` → nada nuevo y `saltados` igual al número de items.

- [ ] **Step 2: Ejecutar y ver que fallan**
  Run: `npx playwright test tests/e2e/gametracker.spec.ts --project=escritorio -g "planificar" --reporter=line`

- [ ] **Step 3: Implementar.** El índice de lo propio (por `igdbId` y título normalizado, sin `demo`) se rehace en cada llamada a `planGameTrackerImport` y crece con lo que va planificando, para que una tanda repetida o un título repetido no dupliquen. `planGameTrackerImport` respeta `item.copies` (pueden venir editadas) y no mira `state`, solo lo que hay en la biblioteca.

- [ ] **Step 4: Ejecutar y ver que pasan** + `npx tsc --noEmit`.

- [ ] **Step 5: Commit** «Importar de Game Tracker: copias y lo que ya está».

---

### Task 3: La pantalla de importar

**Files:**
- Create: `src/app/importar/ImportView.tsx` (elige origen con `?origen=`)
- Create: `src/app/importar/GameTrackerImport.tsx`
- Modify: `src/app/importar/page.tsx` (título «Importar», `ImportView` dentro de `<Suspense>`, como Ajustes)
- Modify: `src/app/importar/importar.module.css`
- Modify: `src/lib/store.tsx` (acción `importGameTracker`)
- Modify: `src/app/biblioteca/LibraryView.tsx:231,591` (texto «Importar…»)
- Modify: `src/lib/pistas.ts` sin cambios de texto (la pista `steam` sigue en el origen Steam)
- Test: `tests/e2e/gametracker.spec.ts` (bloque `test.describe("pantalla")`), `tests/e2e/fixtures/gametracker-muestra.csv`, `tests/e2e/movil.spec.ts:267-270`

**Interfaces:**
- Consumes: `parseGameTracker`, `classifyGameTracker`, `GtItem`, `PlannedCopy`, `GtCounts` (Tareas 1 y 2).
- Produces: en `Actions` de `store.tsx`, `importGameTracker(items: GtItem[]): Promise<GtCounts>` — planifica contra `libRef.current`, guarda con `repo.save({ games, copies, wishlist })` y hace `commit` igual que `importSteam`.

- [ ] **Step 1: Muestra** `tests/e2e/fixtures/gametracker-muestra.csv`, con la cabecera real de 29 columnas y estas filas (columnas no citadas, vacías):

  | title | source / externalId | spaces | userPlatforms | formats | tags | nota |
  |---|---|---|---|---|---|---|
  | Hades | igdb / 113112 | Propiedad | Nintendo Switch | DIGITAL | | ya existe (se añade en la prueba) |
  | Ark: Survival Evolved | igdb / 10239 | Propiedad | PC (Microsoft Windows) | DIGITAL | Epic Games;Steam | `summary` entre comillas con `;` y un salto de línea |
  | Horizon Zero Dawn | igdb / 11156 | Propiedad | PlayStation 4 | PHYSICAL;DIGITAL | | |
  | Final Fantasy X/X-2 HD Remaster | igdb / 14144 | Propiedad | PlayStation 3;PC (Microsoft Windows);PlayStation 4 | DIGITAL;PHYSICAL | Steam | |
  | Resident Evil 7: Biohazard | igdb / 19562 | Propiedad | PlayStation 5;PlayStation VR;PlayStation 4 | PHYSICAL | | |
  | Kirby and the Forgotten Land | igdb / 172427 | Propiedad | Nintendo Switch;Nintendo Switch 2 | PHYSICAL;DIGITAL | | dudoso |
  | Genshin Impact | user / — | Propiedad | PC (Microsoft Windows) | DIGITAL | Epic Games | |
  | Asgard's Wrath | igdb / 115031 | Propiedad | Oculus Rift | DIGITAL | | |
  | Fable | igdb / 92550 | Deseos | PlayStation 5 | | | deseo |
  | Ark: Survival Evolved | igdb / 10239 | Propiedad | PC (Microsoft Windows) | DIGITAL | Steam | repetido |

- [ ] **Step 2: Prueba que falla** «la pantalla importa de Game Tracker lo que falta y lo repetido no entra»:
  - `openApp(page, "/biblioteca")`, `addGame(page, { title: "Hades", platform: "Switch" })`.
  - Botón de la biblioteca «Importar…» → `/importar`; enlace «Game Tracker» (navegación «Origen de la importación», `aria-current="page"` en el elegido) → URL con `origen=gametracker`; título de nivel 1 «Copiar desde Game Tracker».
  - `getByLabel("Archivo de Game Tracker").setInputFiles(muestra)`.
  - Se lee el resumen `7 juegos nuevos · 1 deseo nuevo · 2 ya los tienes · 1 para revisar` (Kirby cuenta como nuevo y como para revisar).
  - En la región «Para revisar», Kirby muestra 4 copias; pulsar «Quitar Switch 2 · Físico» y «Quitar Switch · Digital» deja 2.
  - Desmarcar la casilla «Copiar «Genshin Impact»».
  - Se ve el aviso con enlace «Haz antes una copia de seguridad» a `/ajustes?apartado=copia`.
  - «Copiar a la ludoteca» → mensaje final «Copiados 6 juegos, 12 copias y 1 deseo.» (Ark 2 + Horizon 2 + FFX 3 + RE7 2 + Kirby 2 + Asgard's Wrath 1) y enlace «Ver la biblioteca».
  - En `/biblioteca?q=Kirby` hay una tarjeta con «Switch» y «Switch 2»; en `/deseos` está «Fable»; `/biblioteca?q=Genshin` no encuentra nada.
  - Volver a cargar el mismo archivo → resumen `1 juego nuevo · 0 deseos nuevos · 9 ya los tienes · 0 para revisar` (solo Genshin, que no se copió).
  - Un archivo cualquiera («hola;adios») muestra «Este archivo no parece una exportación de Game Tracker.» y no hay botón de copiar.
  - `expectCarcasaText(page.locator("main"))`.

  Y en `movil.spec.ts:267-270` el nombre del enlace pasa a «Importar…» en la cabecera; el de Ajustes («Importar de Steam», sección Steam) no cambia y apunta a `/importar?origen=steam`.

- [ ] **Step 3: Ejecutar y ver que falla**
  Run: `npx playwright test tests/e2e/gametracker.spec.ts tests/e2e/movil.spec.ts -g "pantalla|Importar" --reporter=line`

- [ ] **Step 4: Implementar.**
  - `ImportView`: navegación con dos enlaces, «Steam» y «Game Tracker»; sin `origen`, Steam (no cambia nada de lo que hay). `metadata.title` = «Importar».
  - `GameTrackerImport`, fases `inicio | revision | copiando | hecho`:
    - `inicio`: ventana con `<input type="file" accept=".csv,text/csv">` etiquetado «Archivo de Game Tracker», texto corto de qué hace, y en el ordenador también se puede soltar el archivo encima.
    - `revision`: resumen en una línea (`role="status"`); región «Para revisar» primero (cada copia como chip con botón «Quitar {plataforma} · {Físico|Digital}» y una fila para añadir: selector de plataforma con `DEFAULT_PLATFORMS`, selector de formato y botón «Añadir copia»); región «Juegos nuevos» y región «Deseos nuevos», con buscador «Buscar en el archivo», casilla por fila «Copiar «{título}»» (todo marcado al empezar) y la lista de copias en texto (`PC · Steam`, `PS4 · Físico`); «Ya los tienes» dentro de `<details>` cerrado; aviso con enlace «Haz antes una copia de seguridad»; botón dorado «Copiar a la ludoteca» (deshabilitado si no hay nada marcado).
    - `copiando`: tandas de 50 llamando a `actions.importGameTracker`, barra `role="progressbar"` con `aria-label="Progreso de la copia"`; si una tanda falla, mensaje «Se ha parado tras guardar N juegos (motivo). Vuelve a copiar: lo ya guardado no se duplica.» y vuelve a `revision`.
    - `hecho`: «Copiados {juegos} juegos, {copias} copias y {deseos} deseo(s).» (singular y plural bien) y enlace «Ver la biblioteca».
  - Biblioteca: los dos enlaces dicen «Importar…» y van a `/importar`.

- [ ] **Step 5: Ejecutar y ver que pasa**, más las pruebas de Steam y la carcasa: `npx playwright test tests/e2e/steam.spec.ts tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts --reporter=line`. Capturas a 1440 y 390 px de las fases `inicio` y `revision` con la muestra; revisarlas.

- [ ] **Step 6: Commit** «Importar de Game Tracker: la pantalla».

---

### Task 4: Tienda en la biblioteca

**Files:**
- Modify: `src/lib/filters.ts`
- Modify: `src/app/biblioteca/LibraryView.tsx` (lectura de `tienda`, control del filtro, `groupEntries`, `resetFilters`, chips activos)
- Modify: `src/app/biblioteca/library.module.css` si hace falta
- Test: `tests/e2e/gametracker.spec.ts` (bloque `test.describe("tienda")`), `tests/e2e/biblioteca.spec.ts` si alguna prueba de filtros compara el objeto entero

**Interfaces:**
- Produces: `LibraryFilters.stores: string[]` (en `EMPTY_FILTERS` vacío, cuenta en `activeFilterCount`); `filterEntries` deja los juegos con alguna copia cuya `store` (recortada) esté en `stores`; `facetValues(...)` devuelve además `stores: { value: string; count: number }[]` (juegos por tienda, solo copias con tienda).

- [ ] **Step 1: Pruebas que fallan**
  - Puras: con tres juegos (PC·Steam, PC·Epic Games + PC·Steam, PS4 sin tienda), `filterEntries(..., { ...EMPTY_FILTERS, stores: ["Steam"] })` devuelve los dos primeros; `facetValues` da `[{Steam,2},{Epic Games,1}]`.
  - Pantalla «la balda de PC se divide por tienda y se filtra por tienda»: importar la muestra (como en la Tarea 3, sin tocar nada) y en `/biblioteca` (agrupada por plataforma) ver las cabeceras de balda «PC · Steam», «PC · Epic Games» y «PC · sin tienda» (Asgard's Wrath) y no una balda «PC» sin más; Ark aparece en «PC · Steam» y en «PC · Epic Games».
  - En el filtro «Tienda» (grupo con ese nombre; en el móvil dentro de la hoja «Filtrar y ordenar»), pulsar «Steam» → la URL lleva `tienda=Steam`, se ven Ark y Final Fantasy X/X-2 y no Horizon; «Restablecer» lo quita.
  - Sin ninguna copia con tienda (solo `addGame` de un juego de PC), la balda se llama «PC» y el filtro «Tienda» no aparece.

- [ ] **Step 2: Ejecutar y ver que fallan**
  Run: `npx playwright test tests/e2e/gametracker.spec.ts -g "tienda" --reporter=line`

- [ ] **Step 3: Implementar.** En `groupEntries` (por plataforma), si alguna copia de PC de las entradas visibles tiene tienda, la clave de cada copia de PC es `PC · {tienda}` o `PC · sin tienda`; el color es el de PC y el título largo, el mismo texto. Las subbaldas se ordenan con las demás baldas, por número de juegos. El filtro se pinta con los chips del filtro de formato, va dentro de `filterControls` (barra y hoja) y solo si `facets.stores.length > 0`.

- [ ] **Step 4: Ejecutar y ver que pasan**, y después la batería completa: `npx tsc --noEmit`, `npx eslint src tests`, `npx playwright test --reporter=line` (repetir con `--last-failed` lo intermitente). Capturas de la biblioteca a 1440 y 390 px con la muestra importada.

- [ ] **Step 5: Commit** «Biblioteca: la balda de PC por tienda y el filtro «Tienda»».

---

### Task 5: Ensayo con el archivo real

- [ ] **Step 1:** `npx next build` con `NEXT_DIST_DIR=.next-ensayo` y las variables de Supabase vacías, y `npx next start -p 3300` en segundo plano (como el servidor de pruebas, ver `playwright.config.ts`).
- [ ] **Step 2:** Dar a la propietaria la dirección `http://localhost:3300/importar?origen=gametracker`, recordarle que es modo local (nada llega a su cuenta) y esperar su visto bueno.
- [ ] **Step 3:** Con su visto bueno, parar el servidor, push de la rama y PR en español; esperar la integración y avisar.
