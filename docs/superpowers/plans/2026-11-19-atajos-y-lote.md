# Atajos de teclado y cambio de estado en grupo: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que quien ya domina la app vaya más rápido:
- **«/»** pone el cursor en el buscador;
- **«A»** abre el cofre de añadir;
- en la tabla de la biblioteca, se eligen varios juegos y se les cambia el estado de una vez, con «Deshacer».

**Architecture:**
- **Atajos:** un hook `useShortcuts` montado una vez en `AppShell`, que escucha el teclado.
- **Cambio en grupo:** la acción nueva `setStatusMany` del store, que guarda todos los juegos en una sola llamada `repo.save({ games })` con un único aviso y un único «Deshacer»; la tabla añade una casilla por fila y una barra de acción.

**Tech Stack:** Next.js 16, React, CSS Modules, Playwright.

**Spec:** este plan (crítica del 18/11/2026: «sin atajo de teclado para buscar o añadir; sin cambios de estado en lote»; la dueña eligió abarcar los cuatro temas).

## Diseño

### Atajos
| Tecla | Hace | Se anuncia |
|---|---|---|
| `/` | Ordenador: lleva el foco al buscador de la barra superior. Si no se ve, o en el móvil, abre `/biblioteca?buscar=1`. | Una tecla `/` dentro del buscador, a la derecha, y `aria-keyshortcuts="/"`. |
| `A` (o `a`) | Abre «Añadir juego». | `aria-keyshortcuts="A"` y el `title` «Añadir juego (A)» en el botón. |

No actúan:
- mientras se escribe (input, textarea, select o contenteditable);
- con Ctrl, Alt o Meta pulsadas;
- con un diálogo abierto;
- con la pantalla de título del inicio a la vista, porque ahí cualquier tecla es «Start».

En el manual, la página «Añadir un juego» y la de «Juegos y copias» lo mencionan en una línea.

### Cambio en grupo (tabla de la biblioteca)
- **Selección:** una columna nueva con una casilla por fila («Elegir «título»») y otra en la cabecera («Elegir todos los que se ven»).
- **Barra de acción:** con uno o más elegidos aparece encima de la tabla, como ventana pegada arriba, con:
  - «N elegidos»;
  - un desplegable «Cambiar estado a…» con los cinco estados;
  - el botón «Quitar la selección».
- **Al elegir un estado:** cambia todos los elegidos, quita la selección y muestra un aviso: «3 juegos pasan a Completado», con «Deshacer», que devuelve cada uno a su estado anterior.
- **Reglas al cambiar:** las mismas que `setStatus` (fecha de inicio y última partida al pasar a Jugando; fecha de fin al pasar a Completado).
- **Esc** quita la selección. La selección solo cuenta juegos visibles: si un filtro oculta un juego elegido, deja de estar elegido.
- **Móvil:** la casilla tiene 44 px de zona táctil y la barra queda pegada encima de la barra inferior.

## Global Constraints

- Carcasa (DESIGN.md): VT323 a 18 px o más, Press Start en títulos, sin esquinas redondeadas, el dorado solo en lo principal.
- Todo en español. «Deshacer» siempre visible en el aviso.
- Cada PR: `npx tsc --noEmit`, `npx eslint src tests` y la batería completa; capturas a 1440 y 390 px.

## Review Focus

1. **Escribir «a» o «/» dentro de un campo** (buscador, título del alta, nota en la ficha): no abre nada (tarea 1).
2. **Pantalla de título del inicio a la vista:** «A» la cierra como cualquier tecla y no abre el alta encima (tarea 1).
3. **Cambiar en grupo con juegos ya en ese estado:** solo cuentan los que cambian; si ninguno cambia, no sale aviso (tarea 2).
4. **«Deshacer» tras el cambio en grupo:** cada juego vuelve a su estado y a sus fechas anteriores (tarea 2).
5. **Filtrar después de elegir:** los ocultos salen de la selección y el recuento baja (tarea 2).

---

### Task 1: Atajos «/» y «A»

**Files:**
- Create: `src/components/shell/useShortcuts.ts`.
- Modify:
  - `src/components/shell/AppShell.tsx`: montar el hook;
  - `src/components/shell/QuickSearch.tsx`: la pista de la tecla y `aria-keyshortcuts`;
  - `src/components/shell/TopBar.tsx`: el botón de añadir;
  - `src/components/shell/shell.module.css`: el estilo de la pista;
  - `src/app/manual/ManualView.tsx`: las dos líneas del manual.
- Test: `tests/e2e/atajos.spec.ts`, nuevo y en el proyecto «escritorio».

**Interfaces:**
- Produces: `export function useShortcuts(): void`, montado dentro de `AddGameProvider`.

- [ ] **Step 1: Write the failing tests:**
  - `«/» lleva al buscador y «A» abre el alta`:
    - en `/deseos`, pulsar `/` deja el foco en el combobox «Buscar en tu biblioteca»;
    - Escape y luego `a` abre el diálogo «Añadir juego».
  - `los atajos no saltan mientras se escribe`:
    - con el alta abierta, escribir «a/» en «Título» deja ese valor y no abre nada más;
    - con el foco en el buscador, escribir «zelda/a» no lo saca de ahí.
  - `con la pantalla de título, «A» solo la cierra`: con `ludoteca:titulo-visto` borrado, en `/` pulsar `a` cierra el título y no abre el alta.
  - `los atajos se anuncian`: el buscador tiene `aria-keyshortcuts="/"` y el botón, `aria-keyshortcuts="A"`.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/atajos.spec.ts --project=escritorio`. Expected: FAIL.
- [ ] **Step 3: Implement** el hook y las pistas, como dice el diseño.
- [ ] **Step 4: Run** el paso 2 y `npx playwright test tests/e2e/inicio.spec.ts tests/e2e/anadir.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `Atajos de teclado: «/» para buscar y «A» para añadir`.

### Task 2: Cambiar el estado de varios juegos a la vez

**Files:**
- Modify:
  - `src/lib/store.tsx`: `setStatusMany`;
  - `src/app/biblioteca/LibraryView.tsx`: la selección, la columna de casillas y la barra de acción;
  - `src/app/biblioteca/library.module.css`: sus estilos.
- Test: `tests/e2e/biblioteca.spec.ts` y `tests/e2e/movil.spec.ts`.

**Interfaces:**
- Produces: `setStatusMany(ids: string[], status: GameStatus): void` en las acciones del store. Guarda los cambiados con un solo `repo.save({ games })`, muestra un único toast con «Deshacer» y no hace nada si ninguno cambia.

- [ ] **Step 1: Write the failing tests** en `biblioteca.spec.ts`:
  - `en la tabla se eligen varios juegos y se les cambia el estado de una vez`:
    - con la demostración y `?vista=lista`, elegir «Hades», «Celeste» y «Hollow Knight»: sale «3 elegidos»;
    - «Cambiar estado a…» → Abandonado: aviso «3 juegos pasan a Abandonado», los tres selects valen «abandonado» y la barra desaparece;
    - «Deshacer»: vuelven a Jugando, Completado y Pausado.
  - `elegir todos los que se ven respeta el filtro`:
    - filtrar Jugando y marcar la casilla de la cabecera: el recuento es igual al número de filas;
    - quitar el filtro: el recuento no cambia;
    - Escape quita la selección.
  - `solo cuentan los que cambian`: elegir dos juegos completados y cambiarlos a Completado no muestra ningún aviso.
- [ ] **Step 2: Write the failing test** en `movil.spec.ts`: `en el móvil, la barra del cambio en grupo queda encima de la barra inferior`. A 390 px, elegir un juego en la tabla: la barra está a la vista, por encima de la barra inferior, la casilla mide 44 px o más y nada desborda.
- [ ] **Step 3: Run** los dos. Expected: FAIL.
- [ ] **Step 4: Implement** como dice el diseño.
- [ ] **Step 5: Run** los tests de los pasos 1 y 2 y `npx playwright test tests/e2e/biblioteca.spec.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `Biblioteca: cambiar el estado de varios juegos a la vez`. Revisión visual, revisión final independiente y PR.
