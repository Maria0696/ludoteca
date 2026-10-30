# Superficie: aplicación de la biblioteca (Inicio, Biblioteca, ficha, Deseos, ¿A qué juego?, Estadísticas)

Modo: Operate. Usuaria única, escritorio y móvil. Tarea principal: encontrar, añadir y actualizar juegos; elegir a qué jugar.

## Direction contract

THESIS: Entrar en la colección es entrar en una sala a oscuras donde el arte de cada juego llena la pantalla. Rechaza la interfaz plana de formulario y la pared de portadas sin vida.

OWN-WORLD: Fondo #0b0b0d neutro, superficies #141417 y #1c1c21, texto #f4f4f5; acción principal blanca; punto de color por estado (jugando verde, pausado ámbar, completado azul). Bricolage Grotesque 800 para títulos y cifras, Albert Sans para la interfaz. Pósters 3:4 con radio de 12 px; píldoras translúcidas.

STORY: Al entrar ve a pantalla completa lo que está jugando, lo recorre con la fila de carátulas, anota que ha jugado hoy o abre la ficha; baja por filas de pendientes y recientes; busca y filtra en la Biblioteca; elige a qué jugar con propuestas explicadas.

FIRST VIEWPORT: Barra superior transparente sobre el cartel: nombre, cinco destinos, búsqueda, ajustes y «Añadir juego» en blanco. El arte del juego destacado ocupa la pantalla con un lento movimiento de cámara; a la izquierda, estado, plataforma y horas, el título a 44–92 px, una frase y los botones «He jugado hoy» o «Retomar» y «Ver ficha»; abajo, la fila de carátulas que cambia el destacado con fundido.

FORM: Mezcla elegida por la usuaria de los bocetos «Sala de proyección» (cartel tipo Apple TV o Netflix) y «Consola» (selector tipo PlayStation 5); referencias Apple TV, Netflix, Steam y PlayStation. Sustituye a «Cubeta de videoclub» (seed:8f0a9902c1fcfaa0), descartada por plana.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: el selector de carátulas del cartel, que cambia arte, título y datos con fundido y avanza solo hasta que se toca.
Motion grammar: entrada de pantalla con fundido y ascenso (380 ms), pósters escalonados (35 ms), elevación al pasar el ratón (420 ms), fundido de cartel (1,1 s) y deriva lenta (24 s); con movimiento reducido solo opacidad.

## Unresolved
- Ninguna: el nombre es «Ludoteca».
