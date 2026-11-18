# Una sola máquina · Paso 3: Estadísticas, ¿A qué juego? y Ajustes — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Estadísticas, ¿A qué juego? y Ajustes, y sus diálogos, adopten la carcasa completa: título de pantalla en píxeles, una ventana por sección, todo el texto en VT323 a 18 px o más y nada redondeado.

**Architecture:**
- Se reutilizan las piezas de los pasos 1 y 2: `.screen-title`, `.window` con `.window > h2`, `.window .empty`, `.back-link`, las piezas globales y la utilidad `expectCarcasaText`.
- Una regla global nueva pone en VT323 el cuerpo de todos los diálogos (`.sheet-body`), que hoy hereda la letra antigua del `body`.
- Cada pantalla cambia su marcado (títulos y secciones como ventana) y su módulo CSS (quita tarjetas redondeadas, bordes de 1 px y tamaños de 12–15 px).

**Tech Stack:** Next.js 16, CSS Modules, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-una-sola-maquina-design.md`

## Global Constraints

- Título de pantalla: `.screen-title` (Press Start 2P dorado 28 px; 20 px en el móvil). Sin mayúsculas forzadas.
- Título de ventana: `.window > h2` (Press Start 2P 13 px dorado), o el mismo estilo si el `h2` no es hijo directo.
- Texto que se lee: VT323 21–23 px, nunca por debajo de 18 px. Cifras grandes: VT323 32–56 px.
- Una ventana por sección; filas y celdas dentro, separadas por líneas de 2 px `var(--line)`, nunca con su propio marco. Nada redondeado.
- El dorado solo para la acción principal y lo elegido. Los colores de estado son `var(--st-*)`.
- En ¿A qué juego?, las propuestas **conservan el arte difuminado detrás** (spec, tabla «Lo que conserva cada pantalla»).
- Fuera de este paso: el reordenado para el móvil (propuestas antes que filtros, etc.) y los textos técnicos de Ajustes («README», «IGDB_CLIENT_ID»). Son los pasos 4 a 6 del plan de la revisión.

## Review Focus

1. **Cifras grandes en el móvil:** un gasto de cuatro cifras («1.234,56 €») o más de 999 horas en VT323 grande no puede desbordar su celda ni la página a 390 px (test en la tarea 2).
2. **Títulos largos en las propuestas:** se parten en líneas sobre el arte de fondo y el texto sigue legible (comprobación visual en la tarea 5).
3. **Choques al importar una copia en Ajustes:** la lista de conflictos y sus botones siguen legibles en VT323 (test en la tarea 4 con el flujo de importación).
4. **Barras con valor 0 en Estadísticas:** la pista vacía se ve como pista, sin redondeos ni restos del estilo anterior (comprobación visual en la tarea 5).
5. **Diálogo de eliminar todo en tres avisos:** cada aviso, legible y en la carcasa (test en la tarea 4).

---

### Task 1: Cuerpo de los diálogos en la carcasa y autoprueba fija de la utilidad

**Files:**
- Modify: `src/app/globals.css`, sección «Diálogo»: `.sheet-body` con `font-family: var(--font-term)`, `font-size: 21px` y `line-height: 1.2`.
- Modify: `tests/e2e/carcasa.spec.ts`. La autoprueba «la utilidad de la carcasa detecta letra antigua y texto pequeño» deja de usar `/estadisticas` (que se migra ahora) y pasa a un contenido fijo con `page.setContent`.
- Test: `tests/e2e/carcasa.spec.ts`.

**Interfaces:**
- Consumes: `expectCarcasaText(root: Locator)` de `tests/e2e/helpers.ts`.
- Produces: todo texto suelto dentro de `.sheet-body` sale en VT323 21 px. Las tareas 2–4 cuentan con ello.

- [ ] **Step 1: Write the failing tests**

```ts
test("la utilidad de la carcasa detecta letra antigua y texto pequeño", async ({ page }) => {
  await page.setContent(`<main><p style="font-family: 'Albert Sans'">antigua</p><p style="font-family: VT323; font-size: 14px">pequeña</p></main>`);
  await expect(expectCarcasaText(page.locator("main"))).rejects.toThrow(/Albert[\s\S]*VT323 14px/);
});

test("el texto suelto de los diálogos está en la carcasa", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Retirar datos de demostración" }).click();
  await expectCarcasaText(page.getByRole("dialog"));
});
```

- [ ] **Step 2: Run them and check that they fail.** `npx playwright test tests/e2e/carcasa.spec.ts -g "utilidad|texto suelto" --project=escritorio --reporter=line`. Expected: the first one PASSES (it is a fixed fixture: the utility already detects both). The second FAILS: the dialog's paragraphs are in Albert Sans.
- [ ] **Step 3: Implement** `.sheet-body` as above.
- [ ] **Step 4: Run them and check that they pass.** Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "Carcasa: el texto de los diálogos en letra de terminal"`

---

### Task 2: Estadísticas

**Files:**
- Modify: `src/app/estadisticas/StatsView.tsx`:
  - `h1` con `screen-title`, tanto en la pantalla normal como en la vacía;
  - el `dl` de cifras dentro de una `section className="window"` con `aria-labelledby` hacia un `h2` «En cifras»;
  - las cuatro `section` de paneles pasan de `styles.panel` a `window ${styles.panel}`.
- Modify: `src/app/estadisticas/stats.module.css`. Quita `.title` y los redondeos, bordes de 1 px y fondos propios de `.kpis > div` y `.panel`.
  - **Cifras:** sin marco; celdas separadas por `border-left: 2px solid var(--line)`, salvo la primera de cada fila.
    - `dt` en VT323 20 px;
    - `dd` en VT323 56 px (40 px en el móvil), con `overflow-wrap: anywhere`;
    - `p` en VT323 18 px en `--muted`.
  - **Barras:**
    - `.barLabel` en VT323 21 px;
    - `.track` sin redondeo, con fondo `var(--raised)` y 12 px de alto;
    - `.fill` sin redondeo; la barra de plataformas en `var(--paper)` en lugar de `#fff`.
  - **Formato:**
    - `.stack` sin redondeo;
    - `.stackA` en papel y `.stackB` en `var(--st-completado)`;
    - la leyenda en VT323, con `dt` a 20 px y `dd` a 40 px.
  - **Notas:** `.footnote` y `.legend small` en VT323 18 px; `.pair dd` en VT323 48 px; `.extra` y el párrafo de introducción en VT323 21 px.
- Test: `tests/e2e/carcasa.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Consumes: `.screen-title`, `.window`, `.window > h2` y `expectCarcasaText`.

- [ ] **Step 1: Write the failing tests**

```ts
test("Estadísticas en la carcasa: título en píxeles, una ventana por sección y todo legible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/estadisticas");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Estadísticas" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["En cifras", "Copias por plataforma", "Títulos por estado", "Formato de las copias", "Horas y gasto registrados"]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await expectCarcasaText(page.locator("main"));
});
```

En `tests/e2e/movil.spec.ts`, el test nuevo «Estadísticas, ¿A qué juego? y Ajustes caben en el móvil» (lo amplían las tareas 3 y 4). En «/estadisticas», con datos de demostración, comprueba:
- que la página no desborda (`scrollWidth - innerWidth <= 0`);
- que ningún `dd` de «En cifras» tiene `scrollWidth > clientWidth`;
- `expectCarcasaText(page.locator("main"))`.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; el título es Bricolage y no existe la región «En cifras».
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/biblioteca.spec.ts --reporter=line` (biblioteca lee las cifras de Estadísticas). Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "Estadísticas en la carcasa: ventanas por sección y cifras en letra de terminal"`

---

### Task 3: ¿A qué juego?

**Files:**
- Modify: `src/app/que-juego/PickerView.tsx`:
  - `h1` con `screen-title`;
  - el formulario lleva también la clase `window` y un `h2` visible «Tu sesión», al que apunta con `aria-labelledby` (en lugar de `aria-label`);
  - la sección de resultados lleva también la clase `window`.
- Modify: `src/app/que-juego/picker.module.css`:
  - quita los redondeos, bordes de 1 px, fondos propios y la elevación al pasar el ratón de `.form` y `.pick`;
  - las propuestas se separan con `border-bottom: 2px solid var(--line)`, salvo la última, y **conservan** `.pickBg`, el arte difuminado;
  - `.resultsHead h2`, al no ser hijo directo de la ventana, toma el mismo estilo de título de ventana (Press Start 2P 13 px dorado), con su `span` en VT323 20 px y `--muted`;
  - el título de la propuesta (`.pickBody h3`) en VT323 32 px blanco, con `overflow-wrap: anywhere` (26 px en el móvil);
  - `.pickMeta` en VT323 19 px y `.reasons li` en VT323 21 px;
  - `.head p` en VT323 21 px.
- Test: `tests/e2e/carcasa.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Consumes: `.screen-title`, `.window`, `expectCarcasaText` y `StatusMark` (paso 1).

- [ ] **Step 1: Write the failing tests**

```ts
test("¿A qué juego? en la carcasa: sesión y propuestas en ventanas, con el arte detrás", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "¿A qué juego?" }));
  expect(family).toMatch(/Press.Start.2P/i);
  // Un form con nombre accesible tiene el rol «form»; la sección de resultados, «region».
  for (const box of [page.getByRole("form", { name: "Tu sesión" }), page.getByRole("region", { name: /^Mis propuestas/ })]) {
    expect(await box.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  const picks = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^Ficha de / }) });
  for (const shadow of await picks.evaluateAll((els) => els.map((e) => getComputedStyle(e).boxShadow))) expect(shadow).toBe("none");
  await expect(picks.first().locator("img[aria-hidden]")).toHaveCount(1); // el arte difuminado se conserva
  await expectCarcasaText(page.locator("main"));
});
```

En el test del móvil de la tarea 2, añade «/que-juego»: la página no desborda y `expectCarcasaText(page.locator("main"))` pasa.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; el título es Bricolage.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/flujos.spec.ts --reporter=line` (flujos cubre las recomendaciones con filtros). Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "¿A qué juego? en la carcasa: sesión y propuestas en ventanas, con el arte detrás"`

---

### Task 4: Ajustes

**Files:**
- Modify: `src/app/ajustes/SettingsView.tsx` y `src/app/ajustes/DeleteAllGames.tsx`:
  - `h1` con `screen-title`;
  - cada `section` de fila pasa de `styles.row` a `window ${styles.row}`;
  - el `p` con `style={{ fontSize: 12 }}` (créditos de IGDB) pasa a una clase de nota en VT323 18 px.
- Modify: `src/app/ajustes/settings.module.css`:
  - quita `.title`;
  - `.row`: ventana con dos columnas (300 px y el resto) y un hueco de 28 px entre ventanas (`margin-bottom`), sin `border-top`;
  - `.label h2` con el estilo de título de ventana (Press Start 2P 13 px dorado) y `.label p` en VT323 20 px en `--muted`;
  - `.panel` sin marco, fondo ni redondeo (es el contenido de la ventana), en VT323 21 px;
  - `.modeLine` y `.lastBackup` en VT323 21 px; `.errors` en VT323 20 px; `.conflictsHead h3` en VT323 22 px;
  - `.summary` en VT323 21 px; `.credits` en VT323 18 px;
  - en el móvil, una columna.
- Test: `tests/e2e/carcasa.spec.ts`, `tests/e2e/movil.spec.ts` y `tests/e2e/flujos.spec.ts`.

**Interfaces:**
- Consumes: `.screen-title`, `.window`, `.sheet-body` (tarea 1) y `expectCarcasaText`.

- [ ] **Step 1: Write the failing tests**

```ts
test("Ajustes en la carcasa: una ventana por ajuste y diálogos legibles", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Ajustes" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["Dónde se guardan tus datos", "Copia de seguridad", "Eliminar todos los juegos"]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await page.getByText(/Ver las \d+ obras/).click(); // créditos desplegados
  await expectCarcasaText(page.locator("main"));
  // Los tres avisos de eliminar todo, en la carcasa.
  await page.getByRole("button", { name: "Eliminar todos los juegos" }).click();
  const dialog = page.getByRole("dialog");
  await expectCarcasaText(dialog);
  await dialog.getByRole("button", { name: "Sí, continuar" }).click();
  await expectCarcasaText(dialog);
});
```

En `tests/e2e/flujos.spec.ts`, en «exportar e importar una copia de seguridad, resolviendo duplicados», cuando aparece la lista de conflictos, añade `await expectCarcasaText(page.locator("main"))`.

En el test del móvil de la tarea 2, añade «/ajustes»: la página no desborda y `expectCarcasaText(page.locator("main"))` pasa.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; el título es Bricolage.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/flujos.spec.ts tests/e2e/eliminar-todo.spec.ts tests/e2e/copias.spec.ts --reporter=line`. Expected: PASS. «Copia de seguridad» puede fallar de forma intermitente y debe pasar con `--last-failed`.
- [ ] **Step 5: Commit**: `git commit -m "Ajustes en la carcasa: una ventana por ajuste y diálogos legibles"`

---

### Task 5: Revisión visual y PR

- [ ] **Step 1: Capturas a 1440×900 y 390×844** con datos de demostración de:
  - Estadísticas, también con la biblioteca vacía;
  - ¿A qué juego?, también sin propuestas (filtros que no dejan candidatos);
  - Ajustes con los créditos desplegados;
  - los diálogos de retirar la demostración y de eliminar todo (sus tres avisos).
- [ ] **Step 2: Comprobar:**
  - una ventana por sección;
  - nada redondeado;
  - dorado solo en acciones y en lo elegido;
  - el arte de las propuestas detrás del texto;
  - barras a 0 que se ven como pista vacía;
  - nada por debajo de 18 px.
- [ ] **Step 3: Pasar el detector** `impeccable detect --json src/app/estadisticas src/app/que-juego src/app/ajustes`, y explicar o corregir lo que salga.
- [ ] **Step 4: Comprobaciones finales:** `npm run typecheck`, `npx eslint src tests` y la batería completa.
- [ ] **Step 5: PR** en español.
