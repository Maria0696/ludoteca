# Diseño · Sala de proyección

Sistema visual de Ludoteca. Sustituye a la primera dirección («Cubeta de videoclub»), que se descartó por plana y sobria. Las referencias elegidas son Apple TV y Netflix, y Steam y PlayStation. La estructura combina dos bocetos: el cartel cinematográfico de «Sala de proyección» y el selector de carátulas de «Consola». Los tokens viven en `src/app/globals.css`.

## Idea

Entrar en tu colección es entrar en una sala a oscuras: el arte de cada juego llena la pantalla, las carátulas son pósters que responden al tocarlas y todo tiene movimiento. El color lo ponen los juegos, no la interfaz.

## Color

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0b0b0d` | Fondo de todas las pantallas |
| `--surface` | `#141417` | Paneles, diálogos, campos |
| `--raised` | `#1c1c21` | Tarjetas dentro de paneles, menús |
| `--line` | `#26262c` | Bordes de paneles |
| `--control` | `#34343c` | Borde de campos |
| `--text` | `#f4f4f5` | Texto |
| `--muted` | `#a1a1aa` | Texto secundario |
| `--primary` | `#ffffff` | Acción principal (texto `#0b0b0d`) y selección |
| Estados | pendiente `#a1a1aa` · jugando `#4ade80` · pausado `#fbbf24` · completado `#60a5fa` · abandonado `#71717a` | Punto de color junto al nombre del estado |

Los botones secundarios, chips y pestañas son píldoras translúcidas (`#ffffff0f`–`#ffffff24`). Lo seleccionado se vuelve blanco con texto oscuro.

## Tipografía

- **Bricolage Grotesque** (800, interletraje −0,03 a −0,045 em) para títulos de pantalla, de juego y cifras grandes.
- **Albert Sans** (400–700) para la interfaz y el texto.
- Escala: cartel 44–92 px; título de pantalla 56 px (40 en móvil); secciones 22–28 px; interfaz 14–15 px; metadatos 12–13 px con cifras tabulares.

## Componentes

- **Cartel de Inicio** (`Hero`): el arte del juego destacado a pantalla completa, con un lento movimiento de cámara y fundido entre juegos. El selector de carátulas cambia el destacado al pasar por ellas; avanza solo cada 8 s, con barra de progreso, hasta que lo tocas. Sin arte apaisado, usa la carátula difuminada como luz ambiente y la muestra flotando.
- **Póster** (`GameCard`): carátula 3:4 con radio de 12 px que se eleva y se amplía al pasar el ratón; debajo, título, estado con punto de color y plataformas en etiqueta.
- **Filas** (`.shelf`): pósters en fila con desplazamiento horizontal y ajuste por elemento.
- **Ficha de aventura**: la historia de cada juego en píxeles. Arriba, una isla con 7 niveles (llegó a tu ludoteca, tu copia, primera partida, en marcha, tu nota, terminado y 100 %) y la guardiana en el último conseguido, que comenta cómo va el juego. Debajo, carátula en alta calidad, nombre en una sola línea, estados e «Inserta moneda» (He jugado hoy); misiones a la izquierda; récords y «Para elegir a qué jugar» a la derecha; copias y más datos al final. Los datos se editan al pulsarlos. Al 100 %, celebración y trofeo permanente, con ventanas doradas.
- **Propuesta de «¿A qué juego?»**: panel con el arte del juego difuminado hacia la derecha.
- **Diálogo**: `<dialog>` nativo con fondo desenfocado; en móvil, hoja inferior.
- **Puerta de «Entrar»**: la única pantalla en píxeles de la app. Lienzo de baja resolución con estanterías de cajas de juegos, una puerta con el rótulo «Ludoteca» y la guardiana, un personaje propio. El acceso es una conversación en un cuadro de diálogo con letra de terminal (VT323) y de arcade (Press Start 2P). El campo se puede usar desde el primer momento, sin esperar al texto.

## Movimiento

- Al cambiar de pantalla, el contenido entra con un fundido y un ligero ascenso (380 ms).
- Los pósters entran escalonados (35 ms entre uno y otro, con un tope de 14).
- Cartel: fundido entre juegos de 1,1 s, movimiento de cámara de 24 s y entrada del texto con desenfoque.
- Pulsación: `scale(0.96)` en 140 ms. Elevación de pósters: 420 ms con curva de salida fuerte.
- Barras de estadísticas que crecen al entrar.
- «Entrar»: el texto aparece letra a letra (24 ms por letra), la guardiana respira y niega si te equivocas, las antorchas parpadean y, al entrar, la puerta se abre (0,9 s) y la cámara entra en la luz hasta fundir a negro (0,85 s).
- Ficha: cada objetivo cumplido avisa con «¡Nivel superado!» y la guardiana salta y camina al nuevo nivel (0,9 s); al conseguir el 100 %, trofeo y confeti durante 3,8 s.
- Con movimiento reducido: sin desplazamientos ni avance automático; solo opacidad.

## Imágenes de demostración

Obras de dominio público (Hokusai, Hiroshige, Bierstadt, Doré, Whistler, la NASA…) preparadas con `scripts/prepare-demo-art.mjs`. Sus créditos están en `src/lib/demo-art.ts` y en Ajustes. Con datos reales se usan las carátulas y las ilustraciones de IGDB.
