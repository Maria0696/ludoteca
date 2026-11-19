---
name: Ludoteca
description: Una sola máquina de juegos: ventanas de píxeles con marco de papel sobre un fondo morado oscuro.
colors:
  noche-morada: "#1a1526"
  ventana: "#12101f"
  superficie-alzada: "#1f2140"
  superficie-hover: "#2a2c55"
  marco-suave: "#4a4a7a"
  papel: "#f3ead2"
  lavanda: "#c9cdf0"
  lavanda-tenue: "#9a9cc4"
  blanco: "#ffffff"
  negro: "#000000"
  campo: "#0a0b1c"
  oro: "#ffd76a"
  tinta-de-oro: "#1b1400"
  peligro: "#ff6b6b"
  peligro-fondo: "#3a1a22"
  estado-pendiente: "#ffe94d"
  estado-jugando: "#5dff8b"
  estado-pausado: "#ffb13d"
  estado-completado: "#3ff2ff"
  estado-abandonado: "#ff4d6d"
typography:
  display:
    fontFamily: "Press Start 2P, Courier New, monospace"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.3
  title:
    fontFamily: "Press Start 2P, Courier New, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.2
  label:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.15
  meta:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.15
  note:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.15
  figure:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "56px"
    fontWeight: 400
    lineHeight: 1
rounded:
  none: "0px"
spacing:
  gutter-movil: "16px"
  gutter: "48px"
  ventana: "20px"
components:
  button-primary:
    backgroundColor: "{colors.oro}"
    textColor: "{colors.tinta-de-oro}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.superficie-alzada}"
    textColor: "{colors.papel}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.superficie-hover}"
  button-danger:
    backgroundColor: "{colors.peligro-fondo}"
    textColor: "{colors.peligro}"
    rounded: "{rounded.none}"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.ventana}"
    rounded: "{rounded.none}"
    height: "38px"
  input:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.papel}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    height: "44px"
  window:
    backgroundColor: "{colors.ventana}"
    textColor: "{colors.papel}"
    rounded: "{rounded.none}"
    padding: "{spacing.ventana}"
---

# Design System: Ludoteca

## Overview

**Creative North Star: "Una sola máquina"**

Ludoteca es una máquina de juegos con varias pantallas. Todas comparten la carcasa: un fondo morado oscuro, ventanas con un marco de píxel color papel y dos letras, una de píxeles para los títulos y otra de terminal para todo lo que se lee. Cada pantalla puede tener su toque (las cabinas de neón de la biblioteca, el mapa de la ficha, el cofre de añadir, las bahías azules de Steam, el menú de consola del inicio), pero el marco, las letras y los colores de estado son siempre los mismos.

Las carátulas y el arte de cada juego son lo que más llama la atención; la interfaz los rodea sin competir con ellos. El dorado es escaso a propósito: marca la acción principal y lo elegido. Todo lo demás está en papel, lavanda o el color de su estado.

La densidad es de pantalla de juego, no de panel de control: una ventana por sección, filas separadas por líneas finas dentro de cada ventana y texto grande (21 px de terminal) que se lee de un vistazo, también en el móvil.

**Key Characteristics:**
- Ventanas de píxel con marco de papel de 4 px, sin esquinas redondeadas.
- Press Start 2P para títulos y VT323 para leer, nunca por debajo de 18 px.
- El dorado solo en la acción principal y en lo elegido.
- Cinco colores de estado, los mismos en toda la app, siempre junto a su nombre.
- Cada pantalla conserva su toque dentro de la misma carcasa.

## Colors

Una noche morada con papel cálido encima, un oro escaso y cinco neones de estado.

### Primary
- **Oro de moneda** (`oro`): la acción principal de cada pantalla («Añadir juego», «Añadir el primer juego», «Inserta moneda»), el destino actual en la barra superior y los títulos de ventana. Con texto en tinta de oro.

### Neutral
- **Noche morada** (`noche-morada`): el fondo de todas las pantallas.
- **Ventana** (`ventana`): el interior de las ventanas, los diálogos y la hoja inferior.
- **Superficie alzada** (`superficie-alzada`): botones secundarios, chips y avisos dentro de una ventana; **superficie hover** al pasar el ratón.
- **Marco suave** (`marco-suave`): el borde interior de controles pequeños y las líneas que separan filas.
- **Papel** (`papel`): el texto, el marco de las ventanas y lo elegido en los grupos de opciones (fondo papel con texto de ventana).
- **Lavanda** (`lavanda`): texto secundario y explicaciones; **lavanda tenue** solo para texto de ejemplo en campos.
- **Peligro** (`peligro` sobre `peligro-fondo`): borrar y eliminar, nada más.
- **Blanco** (`blanco`, `--white`): texto destacado sobre el neón y el anillo de foco del teclado.
- **Negro** (`negro`, `--black`): las sombras de píxel sin desenfoque (títulos, cajas).
- **Campo** (`campo`, `--field`): el fondo de los campos de texto, más oscuro que la ventana.

### Estados
- **Pendiente** (`estado-pendiente`) · «NUEVA PARTIDA»
- **Jugando** (`estado-jugando`) · «EN PARTIDA»
- **Pausado** (`estado-pausado`) · «PAUSA»
- **Completado** (`estado-completado`) · «¡SUPERADO!»
- **Abandonado** (`estado-abandonado`) · «FIN DEL JUEGO»

### Named Rules
**The One Gold Rule.** El oro marca la acción principal y lo elegido. Si en una ventana hay dos cosas doradas que no son título, sobra una.

**The Status Lives Once Rule.** Los colores de estado solo existen en `--st-*` de `globals.css`. Cualquier componente los toma de ahí (`ARCADE_STATUS`); nunca un hex suelto.

**The Never Alone Rule.** Un color de estado nunca va solo: siempre lleva su etiqueta arcade o su nombre normal. Sobre fondo claro, el punto de color lleva un aro oscuro.

## Typography

**Display Font:** Press Start 2P (con Courier New)
**Body Font:** VT323 (con Courier New)

**Character:** Dos letras de máquina: la de píxeles grita los títulos como un rótulo de recreativa; la de terminal lo cuenta todo con calma y a buen tamaño.

### Hierarchy
- **Display** (400, 28 px; 20 px en el móvil; 1,3): el título de cada pantalla, en oro con sombra negra de 3 px. Equilibrado (`text-wrap: balance`).
- **Title** (400, 13–16 px; 1,5): el título de cada ventana y de cada diálogo, en oro.
- **Escala de lectura** (VT323, 400), cada tamaño con su token en `globals.css`:
  - **Lead** (22 px, `--size-lead`): destinos de la barra superior y encabezados dentro de una ventana.
  - **Body** (21 px, `--size-body`): todo lo que se lee: texto, botones, campos, filas.
  - **Label** (20 px, `--size-label`): etiquetas de campo y de cifra, estados.
  - **Meta** (19 px, `--size-meta`): datos secundarios y pistas.
  - **Note** (18 px, `--size-note`): notas y metadatos; el mínimo.
- **Figure** (400, 40–56 px; 1): cifras grandes de Estadísticas. Una cifra nunca se parte (`white-space: nowrap`).

### Named Rules
**The 18-Pixel Floor Rule.** Nada en VT323 por debajo de 18 px. Si no cabe, se reorganiza; no se encoge.

**The Token Rule.** Un tamaño de lectura o un color de la carcasa se escribe con su token (`var(--size-body)`, `var(--paper)`, `var(--white)`), nunca a mano. Los mundos propios (el menú del inicio, «Entrar», la escena del cofre, las bahías de Steam) pueden tener sus variables locales.

**The Accent Rule.** Press Start 2P con tilde nunca se pone en mayúsculas forzadas: se escribe tal cual («Añadir a la lista de deseos», «Último aviso»).

**The Legacy Fonts Rule.** Albert Sans y Bricolage Grotesque siguen cargadas por herencia (letra base del documento y algún título antiguo), y Anton y Chakra Petch solo viven en el menú del inicio y en la escena del cofre. No se usan en nada nuevo.

## Layout

Margen lateral de 48 px en el ordenador y 16 px en el móvil (por debajo de 900 px). La barra superior mide 72 px (60 px en el móvil); en el móvil hay además una barra inferior de 64 px con cinco destinos y nombres cortos («Jugar», «Resumen»).

Cada pantalla es un título y una o varias ventanas apiladas o en rejilla de dos columnas, que en el móvil pasan a una. Dentro de una ventana, 20 px de relleno y filas separadas por líneas de 2 px en marco suave. Lo frecuente queda al alcance del pulgar: en el móvil, la respuesta va antes que las preguntas (propuestas antes que la sesión) y las acciones de la partida se pegan encima de la barra inferior.

La barra superior se compacta por tramos en vez de desbordar: el chip de modo pasa a iconos y, entre 900 y 1100 px, «Añadir juego» pasa a ser «+».

## Elevation & Depth

Plano y enmarcado. La profundidad no viene de sombras difusas sino del marco de píxel: sombras sin desenfoque que dibujan un borde de 4 px color papel alrededor de cada ventana. Los controles pequeños llevan un borde interior de 2 px para no descolocar filas. Solo los diálogos añaden, además del marco, una sombra amplia y oscura que los separa del fondo desenfocado.

### Shadow Vocabulary
- **Marco de ventana** (`box-shadow: 0 -4px 0 #f3ead2, 0 4px 0 #f3ead2, -4px 0 0 #f3ead2, 4px 0 0 #f3ead2`): toda ventana de sección, diálogo y hoja inferior. En la ficha con trofeo, en oro.
- **Marco suave** (`box-shadow: inset 0 0 0 2px #4a4a7a`): botones secundarios, chips, campos de búsqueda y carátulas pequeñas.
- **Pulsación dorada** (`box-shadow: inset 0 -3px 0 #c99a2e`): el canto inferior del botón principal.
- **Diálogo** (marco de ventana + `0 40px 100px -20px #000`): solo diálogos.

### Named Rules
**The One Window Per Section Rule.** Una ventana por sección. Dentro, líneas; nunca ventanas dentro de ventanas.

## Shapes

Todo es rectangular: radio 0 en botones, campos, chips, ventanas, diálogos y carátulas. Los únicos círculos son los puntos de color de estado. Los botones de acción de las escenas de juego (el cofre, el menú del inicio) se inclinan 9 grados; los de la carcasa, no.

## Components

### Buttons
- **Shape:** rectángulo sin radio (0), 40 px de alto (34 px pequeño, 52 px grande); en el móvil, 44 px o más.
- **Primary:** oro con texto en tinta de oro y canto inferior más oscuro. Uno por pantalla o por diálogo.
- **Secondary:** superficie alzada con marco suave interior y texto papel; al pasar el ratón, superficie hover.
- **Quiet:** sin fondo ni marco, para iconos de la barra y acciones menores.
- **Danger:** fondo granate con texto rojo y marco interior; solo para borrar.
- **Pressed / Focus:** al pulsar, baja 2 px; con teclado, contorno blanco sólido, también sobre el oro.
- **Disabled:** atenuado al 45 % en la carcasa; en Steam, ranura azul con borde para que no parezca roto.

### Chips (grupos de opciones)
- **Style:** superficie alzada con marco suave, 38 px de alto, VT323.
- **State:** lo elegido pasa a fondo papel con texto de ventana, sin marco. Los grupos son `radiogroup` con nombre.

### Cards / Containers (ventanas)
- **Corner Style:** sin radio (0).
- **Background:** ventana.
- **Shadow Strategy:** marco de ventana (ver Elevation & Depth).
- **Internal Padding:** 20 px (22 px en diálogos).
- **Title:** Press Start 2P en oro, 13 px, sin margen extra si la ventana ya separa con hueco.

### Inputs / Fields
- **Style:** 44 px de alto, borde de 2 px en marco suave, fondo casi negro (#0a0b1c), VT323 a 21 px (nunca menos de 16 px en el móvil).
- **Focus:** contorno blanco y borde en oro.
- **Error:** texto en rojo claro bajo el campo, en VT323 a 19 px o más.

### Navigation
- **Barra superior:** fondo de ventana con línea inferior de papel; «Ludoteca» en Press Start 2P dorado; destinos en VT323 22 px; el actual, en oro con texto oscuro.
- **Barra inferior (móvil):** igual, cinco destinos con icono y nombre corto, 44 px o más.

### Estado (signature)
Rombo de color, etiqueta arcade en su color y nombre normal (`◆ NUEVA PARTIDA · Pendiente`). Los lectores de pantalla oyen solo el nombre normal. En las cabinas de la biblioteca, la etiqueta va en una placa de neón sobre la carátula.

### Toques de pantalla (signature)
- **Inicio:** menú de consola en Anton y amarillo con la pantalla de título «Pulsa Start». Es la portada y conserva su mundo.
- **Biblioteca:** cabinas de recreativa con neón rosa y cian, rótulo con el título y rayas de pantalla.
- **Ficha:** mapa de niveles en píxeles con la guardiana, misiones y récords en ventanas; con trofeo, marcos dorados.
- **Añadir juego:** cofre de píxeles que tiembla y se abre; el formulario va en las letras de la carcasa.
- **Importar de Steam:** dos bahías en azul de consola con las letras de la carcasa.

## Do's and Don'ts

### Do:
- **Do** pon cada sección en una ventana con marco de papel de 4 px y separa sus filas con líneas de 2 px.
- **Do** escribe todo lo que se lee en VT323 a 18 px o más, y los títulos en Press Start 2P.
- **Do** usa el oro solo para la acción principal y lo elegido.
- **Do** toma los colores de estado de `--st-*` y acompáñalos siempre de su etiqueta o su nombre.
- **Do** en el móvil, deja lo frecuente al alcance del pulgar y prueba a 390 y 360 px que nada se parta ni se salga.

### Don't:
- **Don't** redondees esquinas: ni botones, ni ventanas, ni carátulas.
- **Don't** uses Albert Sans, Bricolage Grotesque, Anton ni Chakra Petch fuera de donde ya están.
- **Don't** pongas mayúsculas forzadas en Press Start 2P cuando el texto lleva tildes.
- **Don't** metas ventanas dentro de ventanas.
- **Don't** escribas un color de estado en hex fuera de `globals.css`.
- **Don't** escribas rótulos en inglés: la app habla español, también en sus guiños de recreativa.
