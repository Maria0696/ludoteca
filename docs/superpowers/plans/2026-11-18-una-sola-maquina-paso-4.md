# Una sola máquina, paso 4 (toques): plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las últimas pantallas que no hablan con la carcasa:
- la ficha y el alta usan los colores de estado comunes;
- la ficha toma los tokens comunes;
- el formulario del cofre va en las letras comunes;
- Importar de Steam pasa a VT323 y Press Start 2P, conservando sus dos bahías azules.

**Architecture:** Solo CSS, más dos mapas de color que se sustituyen por `ARCADE_STATUS[s].color` de `StatusMark.tsx`. Cada pantalla conserva su escena (el mapa, el cofre, las bahías); cambian las letras, los colores de estado y los tamaños de lectura. Hay dos PR: A (tareas 1 y 2: ficha y alta) y B (tarea 3: Steam), cada una con su rama desde `main`.

**Tech Stack:** Next.js 16 (App Router), CSS Modules, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-una-sola-maquina-design.md` (tabla «Lo que conserva cada pantalla» y paso 4 del «Orden de trabajo»).

## Global Constraints

- Colores de estado: solo `var(--st-pendiente|jugando|pausado|completado|abandonado)` (globals.css). Ningún hex de estado fuera de globals.css.
- Letras: títulos en Press Start 2P (`--font-pixel`); texto de lectura y controles en VT323 (`--font-term`) a **18 px o más**. Sin Albert Sans ni Bricolage.
- Press Start con tilde: sin `text-transform: uppercase`.
- Sin esquinas redondeadas (salvo puntos de color, que son círculos).
- **El inicio no se toca:** conserva el menú en Anton, el amarillo y la pantalla de título.
- La escena del cofre (rayos, temblor, «¡Has conseguido…!») se conserva tal cual.
- En Steam se conservan las dos bahías y el azul.
- Contraste de texto de 4,5:1 o más, también en el botón desactivado.
- Cada PR: `npx tsc --noEmit`, `npx eslint src tests` y la batería completa de Playwright; capturas a 1440 y 390 px.

## Review Focus

1. Plataforma «Otra…» con un nombre largo en el alta, a 360 px: el campo y las casillas no desbordan (tarea 2).
2. Nombres largos de juegos de Steam en la lista, a 390 px, con letra más grande: la fila no desborda (tarea 3).
3. Ficha con trofeo (`data-trofeo`): las ventanas siguen en dorado tras cambiar los tokens (tarea 1, captura).
4. Botones de Steam desactivados mientras copia: se leen (contraste ≥ 4,5) y no parecen rotos (tarea 3).
5. Alta en «Añadir copia» (desde la ficha, sin título ni estado): el formulario corto también va en letras comunes (tarea 2).

---

### Task 1: Colores de estado comunes y tokens comunes en la ficha

**Files:**
- Modify: `src/app/juego/[id]/panels.tsx:24-30`: borrar `STATUS_COLOR`.
- Modify: `src/app/juego/[id]/GameDetail.tsx:20,133`: usar `ARCADE_STATUS[s].color`.
- Modify: `src/components/game/AddGameDialog.tsx:26-32,307`: borrar `STATUS_COLOR` y usar `ARCADE_STATUS[s].color`.
- Modify: `src/app/juego/[id]/adventure.module.css:2-10`: tokens locales a partir de los globales.
- Test: `tests/e2e/carcasa.spec.ts`.

**Interfaces:**
- Consumes: `ARCADE_STATUS: Record<GameStatus, { label: string; color: string }>` de `src/components/ui/StatusMark.tsx` (color = `var(--st-*)`).
- Produces: nada nuevo.

- [ ] **Step 1: Write the failing test.** Añadir a `carcasa.spec.ts`: `test("los estados tienen el mismo color en la biblioteca, la ficha y el alta")`.
  - Con `loadDemo` → `/biblioteca` → ficha de «Hades».
  - Leer el `background-color` del punto de cada opción de `getByRole("radiogroup", { name: "Estado" })`. Esperar:
    - «Completado» → `rgb(63, 242, 255)`;
    - «Abandonado» → `rgb(255, 77, 109)`;
    - «Pendiente» → `rgb(255, 233, 77)`.
  - Después, `getByRole("button", { name: "Añadir juego" }).first()` y, en el diálogo, los puntos del grupo de radios «Estado»: los mismos tres valores.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/carcasa.spec.ts -g "mismo color" --project=escritorio`. Expected: FAIL (`rgb(96, 165, 250)`).
- [ ] **Step 3: Implement.**
  - Sustituir los dos `STATUS_COLOR` por `ARCADE_STATUS[s].color`.
  - En `adventure.module.css` `.page`:
    - `--ink: var(--window)`, `--navy: var(--raised)`, `--soft: var(--muted)`, `--arcade: var(--font-pixel)`, `--term: var(--font-term)`;
    - borrar `--paper` y `--gold`, que ya vienen de `:root` con el mismo valor;
    - `background: var(--bg)`;
    - `--accent` se queda (marco de la carátula).
- [ ] **Step 4: Run** el test del paso 2 y `npx playwright test tests/e2e/ficha.spec.ts tests/e2e/inventario.spec.ts --project=escritorio`. Expected: PASS.
- [ ] **Step 5: Commit** `Ficha y alta: los colores de estado comunes y los tokens de la carcasa`.

### Task 2: El formulario del cofre en las letras comunes

**Files:**
- Modify: `src/components/game/loot.module.css`:
  - `.head h2` (título «¿Qué has encontrado?»);
  - `.label`, `.tile`, `.familyName`, `.titleField :global(.input)`, `.error`, `.customPlatform`, `.duplicate`, `.go`, `.goAlt`, `.hint`, `.close`;
  - y sus reglas en `@media`.
- Test: `tests/e2e/carcasa.spec.ts`, `tests/e2e/movil.spec.ts`.

**Interfaces:** ninguna.

- [ ] **Step 1: Write the failing test.** `carcasa.spec.ts`: `test("el formulario del cofre va en las letras de la carcasa")`.
  - Con `openApp(page, "/biblioteca")`, abrir «Añadir juego».
  - El heading «¿Qué has encontrado?» tiene familia `/Press.Start.2P/`.
  - Cada uno de estos va en `/VT323|Press.Start.2P/` y mide 18 px o más:
    - la etiqueta «Título»;
    - el radio «PS5»;
    - el radio «Físico»;
    - el radio «Pendiente»;
    - el botón «Añadir a la biblioteca»;
    - el texto «Precio, edición, horas…».
  - Usar el helper `font` del archivo.
  - Con la escena conservada: tras rellenar «Celeste», elegir «Switch» y añadir, el heading «¡Has conseguido Celeste!» sigue visible.
- [ ] **Step 2: Write the failing test.** `movil.spec.ts`: `test("el cofre cabe en el móvil con una plataforma de nombre largo")`.
  - A 360×740, abrir «Añadir juego», elegir el radio «Otra…» y escribir en su campo «Plataforma de recreativa de los noventa».
  - Esperar `document.documentElement.scrollWidth - innerWidth <= 0`.
  - Esperar `dialog.evaluate(el => el.scrollWidth - el.clientWidth) <= 0`.
- [ ] **Step 3: Run** los dos tests. Expected: FAIL. El de carcasa falla por la familia (Chakra Petch o Anton); el de móvil puede pasar ya, y entonces sirve de guarda.
- [ ] **Step 4: Implement.**
  - El título pasa a Press Start 2P: `var(--font-pixel)`, 24 px (18 px en el móvil), dorado, sin mayúsculas forzadas, `text-shadow: 3px 3px 0 #000`.
  - Etiquetas y textos a `var(--font-term)`:
    - etiquetas a 21 px;
    - casillas a 20 px;
    - campo a 24 px;
    - pista y errores a 19 px.
  - `.go` sigue dorado y conserva el sesgo. Pasa a `var(--font-pixel)` 15 px, sin `text-transform`, para «Añadir a la biblioteca».
  - `--hud` deja de usarse en el formulario. Se conservan `--heavy` en `.win h2` y la escena.
- [ ] **Step 5: Run** los tests de los pasos 1 y 2, `npx playwright test tests/e2e/anadir.spec.ts tests/e2e/copias.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `Alta: el formulario del cofre en las letras de la carcasa`. Revisión visual a 1440 y 390 px (paso «Añadir copia» incluido), revisión final independiente y **PR A**.

### Task 3: Importar de Steam en las letras comunes, conservando las bahías

**Files:**
- Modify: `src/app/importar/importar.module.css`: fuentes, tamaños menores de 18 px, `--dim`, botones desactivados.
- Modify: `src/app/importar/SteamImport.tsx:10,188`: quitar `screenData` y `screenTitle`.
- Delete: `src/app/importar/fonts.ts`.
- Modify: `tests/e2e/helpers.ts`: añadir `contrastRatio(fg: string, bg: string): number`, que lee cadenas `rgb()` y `rgba()` con fórmula WCAG.
- Test: `tests/e2e/steam.spec.ts`.

**Interfaces:**
- Produces: `contrastRatio(fg: string, bg: string): number` en helpers.ts.

- [ ] **Step 1: Write the failing test.** En `steam.spec.ts`, `test("la copia de datos va en las letras de la carcasa y se lee")`, con `mockSteam` → `openApp("/importar")`:
  - el h1 «Copiar desde Steam» va en `/Press.Start.2P/`;
  - `expectCarcasaText(page.locator("main"))` antes y después de `searchProfile`;
  - ningún elemento con texto usa `/Oxanium|Share Tech/`;
  - el color de «Tu perfil de Steam» contra `rgb(39, 80, 172)` (`#2750ac`, el tono más claro del degradado bajo la etiqueta) da `contrastRatio` ≥ 4,5;
  - con la cola vacía (desmarcar los 3 juegos), el botón «Copiar a la ludoteca» está `disabled`, con `opacity` "1" y `contrastRatio(color, backgroundColor)` ≥ 4,5.
- [ ] **Step 2: Write the failing test.** En `steam.spec.ts`, `test("un nombre largo de Steam no desborda la lista en el móvil")`:
  - viewport 390×844;
  - `mockSteam` con un juego llamado «The Elder Scrolls V: Skyrim Special Edition Anniversary Upgrade Pack»;
  - tras `searchProfile`, sin desbordamiento horizontal de la página y la fila del juego con `scrollWidth <= clientWidth`.
- [ ] **Step 3: Run** `npx playwright test tests/e2e/steam.spec.ts --project=escritorio`. Expected: FAIL en la prueba de letras (Oxanium).
- [ ] **Step 4: Implement.**
  - `--ttl: var(--font-pixel)`, `--mono: var(--font-term)`.
  - El h1 a 26 px (20 px en el móvil), sin `letter-spacing` negativo.
  - Títulos de bahía en Press Start a 14 px.
  - Todo texto en VT323 a 18 px o más: base 21 px, filas 20 px, notas 19 px.
  - `--dim: #dce6ff`.
  - Desactivado: `.go:disabled` y `.profile/.tools button:disabled` en `background: var(--row)`, `color: var(--text)`, borde discontinuo `var(--edge-dim)` y `opacity: 1`. Nada de dorado apagado.
  - Borrar `fonts.ts` y sus usos.
- [ ] **Step 5: Run** `npx playwright test tests/e2e/steam.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `Importar de Steam en las letras de la carcasa, con las bahías azules`. Revisión visual a 1440 y 390 px (vacío, lista, copiando, terminado), revisión final independiente y **PR B**.
