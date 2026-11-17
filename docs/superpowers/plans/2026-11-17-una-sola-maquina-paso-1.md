# Una sola máquina · Paso 1: base común — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda la app comparta la carcasa de ventanas de píxeles: colores, letras, piezas globales, barras de navegación, diálogos, avisos, pantallas de carga y error, el estado común y los nombres unificados.

**Architecture:** Casi todo vive en estilos globales.
- Los tokens de `src/app/globals.css` cambian de valor y conservan su nombre, así que las pantallas que ya los usan heredan el fondo y los colores sin tocarlas.
- Las piezas globales (`.btn`, `.chip`, `.tab`, `.segmented`, campos, `.tag`, `.state`, `dialog.sheet`, `.notice`, `.empty`, `.skeleton`) se redibujan en el estilo nuevo.
- Las barras se redibujan en `shell.module.css`.
- `StatusMark` pasa a mostrar la etiqueta arcade y el nombre normal. `ARCADE_STATUS` se mueve de la biblioteca a `StatusMark.tsx` para que lo use toda la app.

**Tech Stack:** Next.js 16 (App Router), CSS Modules, `next/font/google` (Press Start 2P, VT323), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-una-sola-maquina-design.md`

**Decisión de este plan (desviación del spec):** en este paso, las pantallas sobrias (Deseos, Mis listas, Estadísticas, ¿A qué juego?, Ajustes) heredan fondo, colores, piezas globales y estados, pero **no** cambian todavía la letra de su propio texto. Sus módulos CSS fijan tamaños de 12–15 px que en VT323 no se leen. Esas letras cambian en los pasos 2 y 3, pantalla a pantalla. `--font-display` y `--font-text` siguen existiendo hasta entonces.

## Global Constraints

- Colores (valores exactos del spec):
  - fondo `#1a1526`;
  - ventana `#12101f`;
  - superficie `#1f2140`;
  - marco `#f3ead2`;
  - marco suave `#4a4a7a`;
  - texto `#f3ead2` / `#fff`;
  - texto secundario `#c9cdf0`;
  - acento `#ffd76a` con texto `#1b1400`;
  - peligro `#ff6b6b`;
  - estados: pendiente `#ffe94d`, jugando `#5dff8b`, pausado `#ffb13d`, completado `#3ff2ff`, abandonado `#ff4d6d`.
- Press Start 2P solo para títulos y rótulos decorativos: título de ventana 12–14 px, título de pantalla 26–30 px (20 en el móvil). Nunca en mayúsculas forzadas un texto que pueda llevar tilde.
- VT323 para todo lo que se lee: 21–23 px, nunca por debajo de 18 px.
- Ventana = borde de píxel de 4 px color papel, dibujado con sombras sin desenfoque como `.window` de la ficha. Una por sección.
- El dorado solo para la acción principal y lo elegido.
- Sin librerías nuevas. Contraste AA. Foco visible. «Reducir movimiento» respetado.
- Textos en español. Los términos arcade, solo junto al nombre normal.

## Review Focus

1. **Foco sobre el dorado:** un contorno dorado sobre un botón dorado no se ve. El foco global tiene que seguir siendo visible sobre botones dorados, chips elegidos y fondos oscuros (test en la tarea 2).
2. **Barra inferior en móviles estrechos (360 px):** con VT323 a 18 px, «Biblioteca» y «Resumen» pueden no caber en su columna y desbordar la página (test en la tarea 3).
3. **«Deshacer» en los avisos:** si el estilo nuevo lo esconde o lo deja sin contraste, se pierde la única salida tras cambiar un estado (test en la tarea 3).
4. **Barra superior sobre el arte del inicio:** en el inicio flota sobre el arte y tiene que seguir leyéndose antes y después de hacer scroll (comprobación visual en la tarea 5).
5. **Campos en el móvil:** cualquier campo por debajo de 16 px hace que el iPhone haga zoom al tocarlo; los campos van en VT323 a 21 px (test en la tarea 2).

---

### Task 1: Tokens y letras globales

**Files:**
- Modify: `src/app/fonts.ts`: añade `arcade` (Press_Start_2P, `variable: "--font-arcade"`, weight `"400"`, `display: "swap"`) y `terminal` (VT323, `variable: "--font-terminal"`, weight `"400"`, `display: "swap"`), que hoy están en `src/app/entrar/fonts.ts`.
- Modify: `src/app/entrar/fonts.ts`: pasa a `export { arcade, terminal } from "../fonts";`. Así no hay que tocar a quienes ya lo importan (ficha, biblioteca, Entrar).
- Modify: `src/app/layout.tsx`: el `<html>` añade `arcade.variable` y `terminal.variable`, y `themeColor` pasa a `"#1a1526"`.
- Modify: `src/app/global-error.tsx`: el mismo `className` que el layout.
- Modify: `src/app/globals.css:8-46` (`:root`) y `:100-108` (`::selection`, `:focus-visible`).
- Test: `tests/e2e/carcasa.spec.ts` (nuevo).

**Interfaces:**
- Produces, como variables CSS que usan las tareas 2–4:
  - `--paper: #f3ead2`;
  - `--gold: #ffd76a`;
  - `--gold-ink: #1b1400`;
  - `--window: #12101f`;
  - `--frame-soft: #4a4a7a`;
  - `--font-pixel: var(--font-arcade), "Courier New", monospace`;
  - `--font-term: var(--font-terminal), "Courier New", monospace`;
  - `--pixel-frame: 0 -4px 0 var(--paper), 0 4px 0 var(--paper), -4px 0 0 var(--paper), 4px 0 0 var(--paper)`;
  - `--pixel-frame-soft`: igual con `3px` y `var(--frame-soft)`.
- Tokens existentes con valor nuevo, mismo nombre:
  - `--bg: #1a1526`;
  - `--surface: #12101f`;
  - `--raised: #1f2140`;
  - `--hover: #2a2c55`;
  - `--line: #4a4a7a`;
  - `--control: #4a4a7a`;
  - `--text: #f3ead2`;
  - `--muted: #c9cdf0`;
  - `--faint: #9a9cc4`;
  - `--primary: #ffd76a`;
  - `--primary-ink: #1b1400`;
  - `--danger: #ff6b6b`;
  - `--danger-bg: #3a1a22`;
  - `--ok: #5dff8b`;
  - `--st-pendiente: #ffe94d`;
  - `--st-jugando: #5dff8b`;
  - `--st-pausado: #ffb13d`;
  - `--st-completado: #3ff2ff`;
  - `--st-abandonado: #ff4d6d`;
  - todos los `--radius-*: 0`.

- [ ] **Step 1: Write the failing test** `tests/e2e/carcasa.spec.ts`

```ts
test("la carcasa común: fondo morado oscuro y las dos letras cargadas", async ({ page }) => {
  await openApp(page, "/estadisticas");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(26, 21, 38)");
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return [s.getPropertyValue("--font-pixel"), s.getPropertyValue("--font-term")];
  });
  expect(vars[0]).toMatch(/Press.Start.2P/i);
  expect(vars[1]).toMatch(/VT323/i);
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx playwright test tests/e2e/carcasa.spec.ts --project=escritorio --reporter=line`
Expected: FAIL. Recibe `rgb(11, 11, 13)`.

- [ ] **Step 3: Implement the tokens and fonts** described above.
  - `::selection`: fondo `#ffd76a55`, texto `#fff`.
  - `:focus-visible`: se queda en `2px solid #fff` con `outline-offset: 3px`, porque se ve sobre dorado y sobre oscuro.

- [ ] **Step 4: Run it and check that it passes.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/fonts.ts src/app/entrar/fonts.ts src/app/layout.tsx src/app/global-error.tsx src/app/globals.css tests/e2e/carcasa.spec.ts
git commit -m "Carcasa común: colores y letras de la ventana de píxeles para toda la app"
```

---

### Task 2: Piezas globales

**Files:**
- Modify: `src/app/globals.css`, secciones «Botones», «Chips y pestañas», «Campos», `.segmented`, `.check`, «Carátulas», `.tag`, «Diálogo», «Avisos y estados vacíos» y `.skeleton`.
- Test: `tests/e2e/carcasa.spec.ts`.

**Interfaces:**
- Consumes: los tokens de la tarea 1.
- Produces: las clases globales con su nombre de siempre (`.btn`, `.btn-ink`, `.btn-sticker`, `.btn-quiet`, `.btn-danger`, `.btn-icon`, `.btn-sm`, `.btn-lg`, `.chip`, `.tab`, `.segmented`, `.input`, `.select`, `.textarea`, `.check`, `.tag`, `dialog.sheet`, `.sheet-head`, `.sheet-foot`, `.notice`, `.empty`, `.skeleton`, `.link-btn`) con el estilo nuevo. No cambia ningún marcado.

Valores que fija el spec:
- **`.btn`**: VT323 21 px, sin redondeo y con `--pixel-frame-soft`.
  - `.btn-ink` y `.btn-sticker`: dorado con texto `#1b1400`.
  - `.btn-danger`: rojo `#ff6b6b` sobre `--danger-bg`.
- **`.chip`, `.tab` y botones de `.segmented`**: VT323 20 px y superficie `#1f2140` con marco suave. El estado elegido (`aria-pressed`, `aria-checked`, `aria-selected`, `.is-on`) va en papel `#f3ead2` con texto `#12101f`.
- **Campos**: VT323 21 px en todas las anchuras; fondo `#0a0b1c`, marco suave, y al enfocarlos un borde dorado (`box-shadow` dorado de 2 px) además del contorno de foco.
- **`.tag`**: VT323 18 px, sin redondeo.
- **`.cover-fallback strong`**: VT323 22 px.
- **`dialog.sheet`**:
  - sin borde ni redondeo;
  - `box-shadow: var(--pixel-frame)` más la sombra de profundidad actual;
  - fondo `--surface`;
  - `.sheet-head h2` en Press Start 2P 14 px dorado;
  - en el móvil sigue siendo hoja inferior, sin redondeo arriba.
- **`.notice`**: VT323 20 px, fondo `--raised`, sin redondeo.
- **`.empty`**:
  - ventana con `--pixel-frame` sobre `--surface`;
  - `h1`, `h2` y `h3` en Press Start 2P 16 px dorado, `line-height: 1.5`;
  - `p` en VT323 21 px.
  - Así se ven la carga, el error, «no encontrado» y los vacíos de todas las pantallas.

- [ ] **Step 1: Write the failing tests** en `tests/e2e/carcasa.spec.ts`

```ts
test("las piezas comunes: diálogo, botones y campos en la carcasa", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: /Añadir (el primer )?deseo/ }).first().click();
  const dialog = page.getByRole("dialog");
  const font = (l: Locator) => l.evaluate((el) => [getComputedStyle(el).fontFamily, parseFloat(getComputedStyle(el).fontSize)] as const);
  const [titleFont] = await font(dialog.getByRole("heading").first());
  expect(titleFont).toMatch(/Press.Start.2P/i);
  for (const control of [dialog.getByLabel("Título"), dialog.getByRole("button", { name: "Añadir deseo" })]) {
    const [family, size] = await font(control);
    expect(family).toMatch(/VT323/i);
    expect(size).toBeGreaterThanOrEqual(18);
  }
  // El foco se ve también sobre el botón dorado.
  await dialog.getByRole("button", { name: "Añadir deseo" }).focus();
  const outline = await dialog.getByRole("button", { name: "Añadir deseo" }).evaluate((el) => getComputedStyle(el).outlineColor);
  expect(outline).toBe("rgb(255, 255, 255)");
});

test("la página que no existe se ve como una ventana de la carcasa", async ({ page }) => {
  await openApp(page, "/no-existe");
  const heading = page.getByRole("heading", { name: "Esta página no está en tu ludoteca" });
  expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Press.Start.2P/i);
});
```

En el móvil (proyecto `movil`, en `tests/e2e/movil.spec.ts`), comprueba que el campo «Título» del diálogo de añadir juego mide al menos 16 px.

- [ ] **Step 2: Run them and check that they fail.** `npx playwright test tests/e2e/carcasa.spec.ts --reporter=line`. Expected: FAIL; la letra del título es Bricolage.

- [ ] **Step 3: Restyle the global pieces** with the values above.

- [ ] **Step 4: Run them and check that they pass,** then run `npx playwright test tests/e2e/movil.spec.ts tests/e2e/flujos.spec.ts --reporter=line` to check the dialogs and the mobile sheet. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "Carcasa común: botones, chips, campos, diálogos y vacíos de píxeles"`

---

### Task 3: Barra superior, barra inferior, búsqueda rápida y avisos

**Files:**
- Modify: `src/components/shell/shell.module.css` (todo el archivo salvo `.main`).
- Test: `tests/e2e/carcasa.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Consumes: los tokens de la tarea 1 y las piezas globales de la tarea 2. `TopBar.tsx`, `BottomNav.tsx`, `QuickSearch.tsx` y `AppShell.tsx` no cambian de marcado.

Valores:
- **`.top`**: fondo `--surface` y línea inferior papel de 4 px (`box-shadow: 0 4px 0 var(--paper)`). En el inicio (`.overlay`), degradado de `#12101fd9` a transparente, y `.scrolled` sólido con la línea.
- **`.brand`**: Press Start 2P 15 px dorado con sombra dura `3px 3px 0 #000`.
- **`.nav a`**: VT323 22 px en papel. El actual (`aria-current="page"`) va con fondo dorado y texto `#1b1400`, sin la raya animada.
- **`.modeChip`**: VT323 18 px, sin redondeo.
- **Búsqueda rápida (`.qs input`)**: VT323 21 px como campo.
- **Lista de la búsqueda (`.qsList`)**: ventana con `--pixel-frame`; `strong` en VT323 21 px; `small` en VT323 18 px.
- **`.bottom`** (móvil):
  - fondo `--surface` y línea superior papel de 4 px;
  - enlaces en VT323 18 px;
  - el actual en dorado (`.pill` dorada con icono oscuro);
  - objetivos de al menos 44 px de alto.
- **`.toast`**:
  - ventana `--surface` con marco papel de 3 px;
  - VT323 20 px y descripción en `--muted`;
  - `[data-button]` como botón secundario (superficie, marco suave, VT323 19 px, texto papel).

- [ ] **Step 1: Write the failing tests**

```ts
test("la barra superior: Ludoteca en píxeles y el destino actual en dorado", async ({ page }) => {
  await openApp(page, "/deseos");
  const nav = page.getByRole("navigation", { name: "Principal" }).first();
  const current = nav.getByRole("link", { name: "Deseos" });
  const style = await current.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.fontFamily, parseFloat(s.fontSize), s.backgroundColor];
  });
  expect(style[0]).toMatch(/VT323/i);
  expect(style[1]).toBeGreaterThanOrEqual(18);
  expect(style[2]).toBe("rgb(255, 215, 106)");
  expect(await page.getByRole("link", { name: "Ludoteca, inicio" }).evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Press.Start.2P/i);
});

test("los avisos: letra de la carcasa y «Deshacer» visible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  await page.getByRole("button", { name: /^(He jugado hoy|Retomar)$/ }).click();
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast.getByRole("button", { name: "Deshacer" })).toBeVisible();
  expect(await toast.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/VT323/i);
});
```

En `tests/e2e/movil.spec.ts`, añade al final de la prueba existente: con `page.setViewportSize({ width: 360, height: 780 })` en «/biblioteca», el desbordamiento horizontal `scrollWidth - innerWidth` es ≤ 0, y cada enlace de la barra inferior mide ≥ 44 px de alto (ya se comprueba) con letra ≥ 18 px.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; la letra es Albert Sans.

- [ ] **Step 3: Restyle `shell.module.css`** with the values above.

- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/inicio.spec.ts --reporter=line`. Expected: PASS.

- [ ] **Step 5: Commit**: `git commit -m "Carcasa común: barras de navegación, búsqueda rápida y avisos de píxeles"`

---

### Task 4: Estado común y nombres unificados

**Files:**
- Modify: `src/components/ui/StatusMark.tsx`: añade `ARCADE_STATUS` (se mueve desde `src/app/biblioteca/arcade.ts`, con los mismos valores) y cambia `StatusMark`.
- Modify: `src/app/biblioteca/arcade.ts`: quita `ARCADE_STATUS` y deja `platformColor`.
- Modify: imports de `ARCADE_STATUS` en `src/app/biblioteca/{LibraryView,Cabinet,Scoreboard}.tsx`.
- Modify: `src/app/globals.css`, sección «Estado».
- Modify: `src/components/home/MainMenu.tsx:29`: la etiqueta de la opción `records` pasa a `"Estadísticas"` (el `id` interno no cambia).
- Modify: `src/app/biblioteca/Scoreboard.tsx:55`: el texto `Hi-score · horas` pasa a `Récords · horas` (el `aria-label` «Récords de horas» se queda).
- Modify tests: `tests/e2e/inicio.spec.ts:60` y `tests/e2e/movil.spec.ts:39` pasan de «Récords» a «Estadísticas».

**Interfaces:**
- Produces:
  - `export const ARCADE_STATUS: Record<GameStatus, { label: string; color: string }>` desde `@/components/ui/StatusMark`.
  - `StatusMark({ status, stampKey })` con la misma firma. Renderiza `<span class="state" data-status>`, que contiene un rombo decorativo, la etiqueta arcade con `aria-hidden` y el nombre normal (`STATUS_LABEL`) visible.
  - El CSS `.state` dibuja el rombo (`::before`, cuadrado de 9 px girado 45°) con `--dot`, la etiqueta arcade en VT323 del color del estado y el nombre normal en `--muted`.

- [ ] **Step 1: Write the failing tests** en `tests/e2e/carcasa.spec.ts`

```ts
test("el estado se dice igual en toda la app: etiqueta arcade y nombre normal", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  // Cada propuesta es un <li> con el enlace «Ficha de …».
  const proposal = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Ficha de / }) }).first();
  await expect(proposal).toContainText("EN PARTIDA");
  await expect(proposal).toContainText("Jugando");
  await page.goto("/listas");
  await expect(page.getByText("PRESS START").first()).toBeVisible();
});

test("un solo nombre para cada cosa: Estadísticas en el inicio y Récords en la biblioteca", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  const menu = page.getByRole("group", { name: "Menú principal" });
  await expect(menu.getByRole("button", { name: "Estadísticas", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "Récords", exact: true })).toHaveCount(0);
  await page.goto("/biblioteca");
  await expect(page.getByRole("region", { name: "Récords de horas" }).getByRole("heading")).toHaveText("Récords · horas");
});
```

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; no está «EN PARTIDA» y el menú dice «Récords».

- [ ] **Step 3: Implement** the `StatusMark` change, the `ARCADE_STATUS` move, the `.state` CSS and the two text changes. Update the two existing tests from «Récords» to «Estadísticas».

- [ ] **Step 4: Run** `npx playwright test --reporter=line` (la batería completa). Expected: PASS, salvo los dos fallos intermitentes conocidos (copia de seguridad y «listas personales»), que deben pasar al repetirlos con `--last-failed`.

- [ ] **Step 5: Commit**: `git commit -m "Estado común en toda la app y un solo nombre para Estadísticas y Récords"`

---

### Task 5: Revisión visual y PR

**Files:** ninguno nuevo; correcciones puntuales en los archivos de las tareas 1–4 si la revisión encuentra algo.

- [ ] **Step 1: Capturas a 1440×900 y 390×844** con datos de demostración (servidor `NEXT_DIST_DIR=.next-pruebas npx next start -p 3100`) de: inicio (antes y después de hacer scroll), biblioteca, ficha, Deseos con su diálogo abierto, Mis listas, Estadísticas, ¿A qué juego?, Ajustes, «/no-existe» y un aviso con «Deshacer».
- [ ] **Step 2: Comprobar en las capturas:**
  - que ningún texto que se lea quede por debajo de 18 px en VT323 ni de 12 px en Press Start 2P;
  - que no haya mayúsculas forzadas con tilde en Press Start 2P;
  - que el dorado solo esté en acciones y en lo elegido;
  - que se conserven los toques del inicio, la biblioteca, la ficha y el cofre;
  - que en las pantallas sobrias no haya nada roto, aunque mezclen la letra antigua con las piezas nuevas (decisión de este plan).
- [ ] **Step 3: Pasar el detector** `impeccable detect --json src/components/shell src/app/globals.css src/components/ui` y explicar o corregir lo que salga.
- [ ] **Step 4: `npm run typecheck` y `npx eslint src tests`** limpios.
- [ ] **Step 5: PR** con la descripción en español: qué cambia, la decisión de dejar las letras de las pantallas sobrias para los pasos 2 y 3, y las comprobaciones hechas.
