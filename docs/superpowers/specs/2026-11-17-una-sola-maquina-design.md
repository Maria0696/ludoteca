# Una sola máquina: carcasa común de ventanas de píxeles

Fecha: 17/11/2026 · Estado: pendiente de aprobación

## Por qué

La revisión de diseño de la app entera (`.impeccable/critique/2026-11-17T15-52-02Z__src-app.md`, 27/40) encontró seis estilos visuales que no se hablan entre sí:

- el inicio es un menú de consola (Anton, Chakra Petch, amarillo);
- la biblioteca, una recreativa de neón (VT323, Press Start 2P);
- la ficha y «Entrar», ventanas de píxeles (VT323, Press Start 2P);
- importar de Steam, una pantalla azul de consola (Oxanium, Share Tech Mono);
- añadir juego, un cofre (Anton y píxeles);
- Deseos, Mis listas, Estadísticas, ¿A qué juego?, Ajustes, la barra superior, los diálogos y los avisos siguen con el estilo sobrio de streaming (Bricolage Grotesque, Albert Sans).

Cada pantalla gusta por separado, pero al cambiar de una a otra parece otra app. Además, un mismo concepto tiene varios nombres: «Récords», «Hi-score» y «Tus récords»; «Pendiente» y «PRESS START».

La propietaria eligió, entre tres demos (Recreativa, Consola y Ventanas de píxeles), **la C: Ventanas de píxeles**, con dos ajustes:

1. una ventana por sección, no por fila;
2. el dorado solo para acciones y para lo elegido.

## Objetivos

- Una carcasa común para toda la app: barra superior, barra inferior del móvil, títulos de pantalla, ventanas, botones, chips, campos, diálogos, avisos y estados.
- Dos letras para todo, con papeles fijos:
  - **Press Start 2P** para títulos y rótulos decorativos;
  - **VT323** para todo lo que se lee: datos, etiquetas, botones y texto.
- Un acento común: el **dorado** para la acción principal y para lo elegido.
- Los mismos colores de estado en toda la app.
- Los mismos nombres en toda la app:
  - cada estado se dice con su etiqueta arcade y al lado su nombre normal (`PRESS START · Pendiente`);
  - «Estadísticas» para las cifras de la colección;
  - «Récords» solo para rankings y marcas.
- Que cada pantalla conserve su toque dentro de la carcasa.

## Fuera del alcance

Estos puntos son los pasos 4 a 6 del plan de la revisión e irán en sus propias PR:

- reordenar las pantallas para el móvil;
- reducir opciones;
- cambiar textos de Ajustes y otros detalles.

Aquí solo se cambia el aspecto y los nombres. La estructura, el orden de las secciones y lo que hace cada pantalla no cambian.

## Lo que haría que saliera mal aunque se viera bonito

- Que algo se lea peor que hoy: ningún texto que se lea por debajo de 16 px, ni texto de píxeles en párrafos o datos.
- Que cada fila lleve su propio marco de píxel. Eso fue lo pesado de la demo.
- Que se pierdan los toques que gustan: el neón y las cabinas de la biblioteca, el menú y la pantalla de título del inicio, el cofre, el mapa, la guardiana o el trofeo.
- Que el dorado se use para decorar: si todo es dorado, deja de señalar la acción.
- Que se rompa algo de lo que funciona hoy: teclado, foco visible, «Deshacer», hoja inferior del móvil o enlaces con filtros.

## Restricciones

- Next.js 16 con CSS Modules y tokens en `src/app/globals.css`. Sin librerías nuevas.
- Las letras se cargan con `next/font/google` (ya están en `src/app/entrar/fonts.ts`). Pasan a cargarse una vez en el layout raíz.
- Contraste AA, foco visible y respeto a «reducir movimiento», como hoy.
- Interfaz en español; los términos arcade solo como etiqueta junto al nombre normal.
- Todas las pruebas de Playwright deben seguir pasando. Las que dependan de textos que cambian se ajustan en la misma PR.

## Propuestas consideradas

| Propuesta | Qué era | Por qué no / por qué sí |
|---|---|---|
| A · Recreativa | El neón de la biblioteca en toda la app | Demasiados brillos: en la biblioteca ya hacía que nada destacara. Mejor como toque de la biblioteca. |
| B · Consola | El menú del inicio como sistema | Las mayúsculas condensadas cansan y los títulos largos se leen peor. Los botones inclinados recortan el texto. Usa letras que solo usa el inicio. |
| **C · Ventanas de píxeles (elegida)** | Las ventanas de la ficha como marco común | Es lo que más tiene la app (Entrar, ficha, guardiana, cofre, trofeo), se lee bien con VT323 y lleva menos efectos. |

## Diseño

### Colores (tokens nuevos en `globals.css`)

| Papel | Valor | Uso |
|---|---|---|
| Fondo | `#1a1526` | Fondo de todas las pantallas (el de la ficha) |
| Ventana | `#12101f` | Interior de las ventanas |
| Superficie | `#1f2140` | Botones secundarios, chips y campos |
| Marco | `#f3ead2` (papel) | Borde de píxel de las ventanas |
| Marco suave | `#4a4a7a` | Borde de botones, chips y campos |
| Texto | `#f3ead2` / `#fff` | Texto normal / destacado |
| Texto secundario | `#c9cdf0` | Metadatos y ayudas (contraste AA sobre la ventana) |
| Acento | `#ffd76a` (dorado), texto `#1b1400` | Acción principal y lo elegido; nada más |
| Peligro | `#ff6b6b` | Eliminar y errores |
| Estados | pendiente `#ffe94d` · jugando `#5dff8b` · pausado `#ffb13d` · completado `#3ff2ff` · abandonado `#ff4d6d` | Rombo de color, etiqueta arcade y nombre normal, iguales en toda la app (son los de la biblioteca) |

### Letras y papeles

| Papel | Letra | Tamaño |
|---|---|---|
| Título de pantalla | Press Start 2P, dorado, sombra dura negra | 26–30 px (20 px en el móvil) |
| Título de ventana | Press Start 2P, dorado | 12–14 px |
| Texto, datos, botones y etiquetas | VT323 | 21–23 px; nunca por debajo de 18 px |
| Cifras grandes | VT323 | 32–56 px |

Nunca se ponen en mayúsculas forzadas (`text-transform: uppercase`) los textos en Press Start 2P que puedan llevar tilde. Escritos tal cual, los títulos con tilde sí van en Press Start 2P («Añadir a la lista de deseos», «Último aviso»): las tildes de la letra se dibujan bien (decidido el 17/11/2026, tras la revisión del paso 1).

### Piezas

- **Ventana**: borde de píxel de 4 px color papel (dibujado con sombras sin desenfoque, como en la ficha) e interior `#12101f`. **Una por sección.** Las filas dentro de una ventana se separan con líneas finas, no con marcos.
- **Botón principal**: dorado con texto oscuro y borde de píxel. **Botón secundario**: superficie con borde suave. **Botón de peligro**: rojo. Todos con texto visible; los que hoy son solo icono (editar y borrar en Deseos) llevan texto.
- **Chip**: superficie con borde suave; elegido en papel con texto oscuro.
- **Campos y desplegables**: fondo oscuro, borde suave y foco dorado.
- **Estado**: rombo de color, etiqueta arcade en su color y nombre normal (`◆ PRESS START · Pendiente`). Sustituye al punto de color de `StatusMark`. Donde no cabe, la etiqueta arcade con el nombre normal accesible.
- **Barra superior**: fondo de ventana y línea inferior de papel. «Ludoteca» en Press Start 2P dorado y destinos en VT323; el destino actual, en dorado con texto oscuro. Buscador y «Añadir juego» como campo y botón principal.
- **Barra inferior (móvil)**: igual que la superior. Objetivos de al menos 44 px. Usa **nombres cortos**, como es habitual en las barras de pestañas del móvil: «Jugar» para «¿A qué juego?» y «Resumen» para «Estadísticas», que a 18 px no cabe (decidido el 17/11/2026).
- **Diálogos y hoja inferior**: ventana con borde de papel.
- **Avisos** (sonner): ventana pequeña con borde de papel; «Deshacer» como botón secundario.

### Lo que conserva cada pantalla

| Pantalla | Hoy | Después |
|---|---|---|
| Inicio | Menú de consola | **Conserva** el menú grande en Anton, el amarillo, el arte de fondo y la pantalla de título: es la portada. Solo cambian la barra superior y los avisos. |
| Biblioteca | Recreativa | **Conserva** cabinas, neón, botones de plataforma y rayas de pantalla. Adopta los estados comunes, la letra común en la tabla y los filtros, y «Récords» en lugar de «Hi-score». |
| Ficha | Ventanas de píxeles | Ya es el estilo de referencia: solo se alinea con los tokens comunes. |
| Añadir juego | Cofre | **Conserva** el cofre y su escena. El título y el formulario pasan a las letras comunes. |
| Entrar | Píxeles | Sin cambios. |
| Importar de Steam | Consola azul | **Conserva** las dos bahías y el azul como toque. Las letras pasan a VT323 y Press Start 2P. |
| Carga, error y «no encontrado» | Sobrias | Ventana común con el mensaje y sus botones (paso 1). |
| Deseos, Mis listas, Estadísticas, ¿A qué juego?, Ajustes | Sobrias | Adoptan la carcasa completa: título de pantalla, ventanas por sección, botones, chips y estados comunes. En ¿A qué juego? las propuestas conservan el arte difuminado detrás. |

### Nombres

- Menú del inicio: la opción «Récords» pasa a **«Estadísticas»**. Su panel, «Tu colección», ya muestra cifras de la colección.
- Biblioteca: «Hi-score · horas» pasa a **«Récords · horas»**.
- Ficha: «Tus récords» se queda.
- La barra superior sigue con **«Estadísticas»**.
- Estados: etiqueta arcade y nombre normal juntos en toda la app; los filtros siguen ofreciendo el nombre normal.

## Orden de trabajo (una PR por paso)

1. **Base común**:
   - tokens y letras en el layout raíz;
   - barra superior e inferior;
   - diálogos, hoja inferior y avisos;
   - pantallas de carga, error y «no encontrado»;
   - `StatusMark` con el estado común;
   - nombres («Estadísticas» en el inicio, «Récords» en la biblioteca).
   Las pantallas sobrias heredan ya el fondo y las letras.
2. **Deseos y Mis listas** en la carcasa completa.
3. **Estadísticas, ¿A qué juego? y Ajustes** en la carcasa completa.
4. **Toques**:
   - biblioteca con los estados y la letra común;
   - importar de Steam con las letras comunes;
   - el título y el formulario de añadir juego;
   - ficha alineada con los tokens.
5. **Cierre**: `DESIGN.md` reescrito con este sistema (sustituye a «Sala de proyección») y una nueva revisión de diseño para comparar con el 27/40.

Cada PR se revisa en capturas de ordenador y móvil y pasa `tsc`, `eslint` y Playwright.

## Lo que queda a quien lo construya

- Los valores exactos de espaciado y la escala de tamaños dentro de los rangos de arriba.
- Cómo dibujar el borde de píxel en piezas pequeñas (sombras o `border-image`), siempre que se vea igual que en la ficha.
- Los estilos de los avisos de sonner, mientras «Deshacer» siga visible y accesible.
- Si Bricolage Grotesque y Albert Sans dejan de usarse del todo, quitarlas del layout al final del paso 5.
