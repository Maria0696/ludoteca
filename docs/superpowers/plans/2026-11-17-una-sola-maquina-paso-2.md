# Una sola máquina · Paso 2: Deseos y Mis listas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Deseos y Mis listas adopten la carcasa completa: título de pantalla en píxeles, una ventana por sección, todo el texto en VT323 a 18 px o más y ninguna forma redondeada ni píldora.

**Architecture:**
- Tres piezas de pantalla nuevas y globales en `src/app/globals.css`, que reutilizará el paso 3:
  - `.screen-title`: título de pantalla;
  - `.window`: ventana de sección;
  - `.back-link`: enlace de vuelta.
- Cada pantalla deja de redefinir en su módulo CSS las piezas globales (buscadores y desplegables en píldora) y pasa sus textos a VT323.
- La tarjeta de juego (`GameCard`), que hoy solo usa Mis listas, se redibuja en la carcasa.
- Una utilidad de prueba común comprueba que ninguna pantalla migrada conserva letra antigua ni texto pequeño.

**Tech Stack:** Next.js 16, CSS Modules, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-una-sola-maquina-design.md` (el paso 1 ya está en `main`: tokens `--paper`, `--gold`, `--window`, `--frame-soft`, `--pixel-frame`, `--pixel-frame-soft`, `--font-pixel` y `--font-term`, y piezas globales).

## Global Constraints

- Título de pantalla: Press Start 2P, dorado, sombra dura `3px 3px 0 #000`, 26–30 px (20 px en el móvil). Sin `text-transform: uppercase`.
- Título de ventana: Press Start 2P, dorado, 12–14 px.
- Todo lo que se lee: VT323, 21–23 px, nunca por debajo de 18 px. Cifras grandes: VT323, 32–56 px.
- Ventana: `box-shadow: var(--pixel-frame)` sobre `var(--window)`. **Una por sección**; las filas dentro se separan con líneas finas (`1px` o `2px` `var(--line)`), nunca con su propio marco.
- El dorado solo para la acción principal y lo elegido.
- Sin redondeo (`border-radius: 0` o tokens `--radius-*`, que ya valen 0) y sin píldoras.
- Los botones que hoy son solo icono (editar y quitar en Deseos) llevan texto visible.
- Contraste AA, foco visible, objetivos táctiles de 44 px en el móvil y sin desbordamiento horizontal.

## Review Focus

1. **Títulos de deseo y nombres de lista largos en el móvil:** deben partirse en líneas sin desbordar la pantalla (test en las tareas 2 y 3, en el móvil).
2. **Deseo sin carátula:** el texto de repuesto en una miniatura de 64–76 px no puede quedar en VT323 diminuto. En miniaturas, el repuesto enseña solo el cartón (test en la tarea 2).
3. **Deseo sin precio ni objetivo:** los «—» se alinean con las cifras y no rompen la fila (comprobación visual en la tarea 4).
4. **Muchas listas en el móvil:** la fila de listas sigue desplazándose en horizontal sin desbordar la página (test en la tarea 3).
5. **Foco de teclado** en los botones de lista (la elegida es papel) y en las acciones de cada deseo: tiene que verse (test en la tarea 3).

---

### Task 1: Piezas de pantalla y utilidad de prueba

**Files:**
- Modify: `src/app/globals.css` (sección nueva «Pantallas de la carcasa», después de «Avisos y estados vacíos»).
- Modify: `tests/e2e/helpers.ts`.
- Test: `tests/e2e/carcasa.spec.ts`.

**Interfaces:**
- Produces (CSS global, para las tareas 2 y 3 y el paso 3):
  - `.screen-title`: Press Start 2P 28 px, dorado, sombra dura `3px 3px 0 #000`, `line-height: 1.3`, `text-wrap: balance`; 20 px por debajo de 899 px.
  - `.window`: `background: var(--window)`, `box-shadow: var(--pixel-frame)`, `padding: 20px`, `margin: 4px`. El título de ventana es `.window > h2`: Press Start 2P 13 px dorado, `line-height: 1.5`, `margin-bottom: 14px`.
  - `.back-link`: VT323 21 px, en línea con icono de 16 px, `min-height: 44px` y sin subrayado, salvo al pasar el ratón.
- Produces (prueba), en `tests/e2e/helpers.ts`:
  `export async function expectCarcasaText(root: Locator): Promise<void>`. Recorre los elementos visibles de `root` que tienen texto propio (nodos de texto no vacíos). Para cada uno exige que la letra no sea Albert Sans ni Bricolage Grotesque, y que, si es VT323, su `font-size` sea ≥ 18. Si falla, el mensaje dice el texto del elemento, su letra y su tamaño.

- [ ] **Step 1: Write the failing test**

```ts
test("la utilidad de la carcasa detecta letra antigua y texto pequeño", async ({ page }) => {
  await openApp(page, "/deseos");
  // Deseos aún no está migrada: su título usa Bricolage.
  await expect(expectCarcasaText(page.locator("main"))).rejects.toThrow(/Bricolage|Albert/);
});
```

- [ ] **Step 2: Run it and check that it fails.** `npx playwright test tests/e2e/carcasa.spec.ts -g "utilidad" --project=escritorio --reporter=line`. Expected: FAIL; `expectCarcasaText` no existe.
- [ ] **Step 3: Implement** `expectCarcasaText` and the three CSS pieces.
- [ ] **Step 4: Run it and check that it passes.** Expected: PASS. La utilidad rechaza la Deseos actual.
- [ ] **Step 5: Commit**: `git commit -m "Carcasa: título de pantalla, ventana y enlace de vuelta comunes"`

---

### Task 2: Deseos en la carcasa completa

**Files:**
- Modify: `src/app/deseos/WishlistView.tsx`:
  - `h1` con clase `screen-title`;
  - la lista `ul` envuelta en una `section className="window"` con `aria-label="Deseos"`;
  - botones de editar y quitar con texto visible «Editar» y «Quitar»; sus `aria-label` actuales se quedan («Editar …», «Quitar … de la lista»).
- Modify: `src/app/deseos/wishlist.module.css`:
  - quita `.head h1`, las píldoras de `.search input` y `.select :global(.select)` (el buscador pasa a la clase global `input`) y el redondeo de `.item` y `.cover`;
  - filas separadas por `border-bottom: 2px solid var(--line)` (salvo la última);
  - textos en VT323: `.info strong` 26 px blanco, `.info span` 19 px, `.notes` 20 px, `dt` 18 px, `dd` 28 px, `small` 18 px;
  - en `.cover` (miniatura), el repuesto oculta `strong` y `span`;
  - `.priceList li` (diálogo de precio) en VT323 20 px y `.convertHead` 20 px.
- Test: `tests/e2e/carcasa.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Consumes: `.screen-title`, `.window` y `expectCarcasaText` (tarea 1).

- [ ] **Step 1: Write the failing tests**

```ts
test("Deseos en la carcasa: título en píxeles, una ventana y todo legible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/deseos");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Lista de deseos" }));
  expect(family).toMatch(/Press.Start.2P/i);
  const win = page.getByRole("region", { name: "Deseos" });
  expect(await win.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  const rowFrames = await win.getByRole("listitem").evaluateAll((els) => els.map((e) => getComputedStyle(e).boxShadow));
  for (const shadow of rowFrames) expect(shadow).toBe("none");
  await expectCarcasaText(page.locator("main"));
  // Editar y quitar dicen lo que hacen.
  const edit = page.getByRole("button", { name: "Editar Hollow Knight: Silksong" });
  await expect(edit).toHaveText("Editar");
  await expect(page.getByRole("button", { name: "Quitar Hollow Knight: Silksong de la lista" })).toHaveText("Quitar");
});

test("Deseos: un deseo sin carátula no enseña texto diminuto en la miniatura", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: "Añadir el primer deseo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Un juego con un título larguísimo que no tiene carátula todavía");
  await dialog.getByRole("button", { name: "Añadir deseo" }).click();
  await expectCarcasaText(page.locator("main"));
});
```

En `tests/e2e/movil.spec.ts`, un test nuevo: «Deseos y Mis listas caben en el móvil». Con datos de demostración, en «/deseos» añade un deseo con el título largo de arriba y comprueba que `document.documentElement.scrollWidth - innerWidth <= 0` y `expectCarcasaText(page.locator("main"))`. La parte de Mis listas la completa la tarea 3.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; el título es Bricolage y la región «Deseos» no existe.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/flujos.spec.ts --reporter=line` (flujos cubre convertir un deseo y apuntar precios). Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "Deseos en la carcasa: título de píxeles, una ventana y botones con texto"`

---

### Task 3: Mis listas y la tarjeta de juego en la carcasa

**Files:**
- Modify: `src/app/listas/ListsView.tsx`:
  - el enlace de vuelta con clase `back-link`;
  - `h1` con `screen-title`;
  - el `aside` pasa a `section className="window"` con `aria-label="Tus listas"` y un `h2` «Tus listas»;
  - la sección principal también lleva `window`, y conserva su `aria-label` actual (`Lista …`).
- Modify: `src/app/listas/lists.module.css`:
  - quita `.title`, `.back` y la píldora de `.pickerSearch input` (pasa a la clase global `input` con su icono);
  - los botones de lista sin redondeo, en VT323 21 px, con `small` a 18 px; la elegida sigue en papel;
  - en el móvil, `.lists` sigue en fila con desplazamiento horizontal;
  - `.pickerCover` oculta el texto de repuesto.
- Modify: `src/components/game/game.module.css`, solo `.card*`, `.fav` y `.cardCopies`:
  - carátula sin redondeo con `box-shadow: var(--pixel-frame-soft)`;
  - `.cardTitle` en VT323 22 px;
  - `.cardMeta` y `.cardCopies` en VT323 18 px.
  - `GameCard.tsx` no cambia de marcado.
- Test: `tests/e2e/carcasa.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Consumes: `.screen-title`, `.window`, `.back-link` y `expectCarcasaText` (tarea 1). `StatusMark` del paso 1 dentro de `GameCard`.

- [ ] **Step 1: Write the failing tests**

```ts
test("Mis listas en la carcasa: dos ventanas, tarjetas legibles y foco visible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/listas");
  const [family] = await font(page.getByRole("heading", { level: 1, name: "Mis listas" }));
  expect(family).toMatch(/Press.Start.2P/i);
  for (const name of ["Tus listas", /^Lista /]) {
    expect(await page.getByRole("region", { name }).evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(243, 234, 210)");
  }
  await expectCarcasaText(page.locator("main"));
  // Con el teclado, el foco se ve también en la lista elegida (papel).
  const current = page.locator('button[aria-current="true"]').first();
  await current.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(current).toBeFocused();
  expect(await current.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
});
```

En el test del móvil de la tarea 2, añade la parte de Mis listas:
- crea tres listas con nombres largos («Para jugar con mi pareja los domingos por la tarde», etc.);
- comprueba que la página no desborda;
- comprueba que el contenedor de listas (`getByRole("list", { name: "Listas" })`) tiene `scrollWidth > clientWidth` (se desplaza en horizontal);
- llama a `expectCarcasaText(page.locator("main"))`.

- [ ] **Step 2: Run them and check that they fail.** Expected: FAIL; el título es Bricolage y la región «Tus listas» no existe.
- [ ] **Step 3: Implement** the changes above.
- [ ] **Step 4: Run** `npx playwright test tests/e2e/carcasa.spec.ts tests/e2e/movil.spec.ts tests/e2e/biblioteca.spec.ts --reporter=line` (biblioteca cubre «listas personales»). Expected: PASS, salvo «listas personales» si falla de forma intermitente; debe pasar al repetirlo.
- [ ] **Step 5: Commit**: `git commit -m "Mis listas en la carcasa: ventanas, título de píxeles y tarjetas legibles"`

---

### Task 4: Revisión visual y PR

- [ ] **Step 1: Capturas a 1440×900 y 390×844** con datos de demostración de: Deseos, sus tres diálogos (añadir, precio y «Ya lo tengo»), Mis listas y su diálogo «Añadir juegos». También Deseos con un deseo sin precio ni objetivo y uno sin carátula.
- [ ] **Step 2: Comprobar:**
  - una ventana por sección y ninguna fila enmarcada;
  - nada redondeado;
  - dorado solo en acciones y en lo elegido;
  - los «—» alineados con las cifras;
  - nada por debajo de 18 px.
- [ ] **Step 3: Pasar el detector** `impeccable detect --json src/app/deseos src/app/listas src/components/game`, y explicar o corregir lo que salga.
- [ ] **Step 4: Comprobaciones finales:** `npm run typecheck`, `npx eslint src tests` y la batería completa.
- [ ] **Step 5: PR** en español.

**Fuera de este paso:** las sugerencias del catálogo dentro del diálogo de añadir deseo (`CatalogSearch`, compartido con «Añadir juego») se pasan a la carcasa en el paso 4, junto con el cofre de añadir juego.
