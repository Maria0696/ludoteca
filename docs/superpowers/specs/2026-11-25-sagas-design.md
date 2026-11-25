# Sagas: en qué orden jugar cada historia

Fecha: 25/11/2026 · Estado: pendiente de aprobación

## Por qué

La propietaria se lía con el orden en que jugar los juegos de una saga: por fecha de lanzamiento o por cronología de la historia. Quiere un apartado propio para consultarlo.

Lo que ya hay:

- Cada juego tiene «Saga» (texto, en «Ficha técnica», traído de IGDB al añadirlo). Es casi siempre una **marca**, no una historia: sus 23 juegos de Star Wars mezclan Jedi, KOTOR, Battlefront, LEGO…
- 241 de sus 696 juegos tienen el texto literal «Sin saga» (heredado de una importación); debe contar como vacío.
- 695 de 696 tienen `igdbId`, y todos, fecha de lanzamiento.
- IGDB distingue la marca (`franchise`) de la **serie** (`collections`, p. ej. «Star Wars Jedi»). Ninguna fuente da el orden cronológico de la historia.

## Objetivos

1. Una pantalla **«Sagas»** que reúne los juegos por **historia** (Jedi, Resident Evil, Half-Life…), agrupadas bajo su marca.
2. En cada historia, sus juegos en dos órdenes que se alternan: **Lanzamiento** (automático) e **Historia** (lo pone ella).
3. El orden de la historia **parte del de lanzamiento**: ella solo mueve las excepciones (precuelas, spin-offs) con flechas.
4. Junto a cada juego, su estado, y destacado el **siguiente** que toca.
5. Las historias se rellenan solas desde IGDB y se pueden corregir a mano.
6. Desde la ficha de un juego se llega a su historia.

## Fuera del alcance

- Juegos de la saga que no tiene (aunque IGDB los conozca), ni «Añadir a deseos» desde aquí.
- Proponer el orden cronológico (ella lo busca y lo pone: «evitar errores»).
- Arrastrar y soltar: el orden se cambia con flechas.
- Que ¿A qué juego? tenga en cuenta las sagas.

## Lo que no debe pasar

- Que traer historias de IGDB **pise** una historia que ella haya puesto o corregido a mano.
- Que la app invente un orden cronológico.
- Que la barra de abajo del móvil pase de cinco destinos.
- Que cambie algo en Supabase sin su permiso explícito (hacen falta dos columnas).

## Enfoques considerados

Dónde vive:

1. **Dentro de la Biblioteca**: «Por saga» como agrupación, más una página por historia. Recomendado por el agente (no añade destino, reutiliza lo conocido).
2. **Pantalla propia «Sagas» en la barra.** **Elegido por ella.**
3. Solo en la ficha, un panel con la saga: sin vista de conjunto.

En el móvil (cinco destinos ya):

- A. Seis en la barra, con nombres más cortos o solo iconos.
- **B. Elegido por ella:** la barra de abajo no cambia; en el móvil se entra desde un botón «Sagas» en la cabecera de la Biblioteca. En el ordenador, «Sagas» es un destino de la barra de arriba, entre «Biblioteca» y «Deseos».

Orden de la historia:

- **A. Elegido por ella:** lo pone ella partiendo del de lanzamiento.
- B. Lo propone el agente para sagas conocidas, para revisar: descartado (riesgo de errores).

## Cómo

**Datos (por juego).** Dos campos nuevos:

- `series: texto | null`: la historia (en Supabase `series text`).
- `seriesOrder: entero | null`: su puesto en el orden de la historia (en Supabase `series_order integer`). `null` en todos los juegos de una historia = el orden de la historia es el de lanzamiento.

Migración `0011_sagas.sql`; las copias de seguridad antiguas siguen sirviendo (valores por defecto `null`, misma versión). Igual que con las vueltas, los repositorios completan los campos que falten al cargar.

`saga` se queda como la marca. «Sin saga» (y vacío) = sin marca, en todas partes donde se muestre o se agrupe.

**Traer historias de IGDB.** En la pantalla Sagas, un botón «Traer historias de IGDB» (también si aún no hay ninguna historia: es lo primero que se ve). Para los juegos con `igdbId` y `series` vacío, pide a un endpoint nuevo del servidor (con la clave de IGDB, como `/api/steam/fichas`, por lotes de hasta 50) las series de cada uno y rellena `series` **solo donde está vacío**. Si un juego tiene varias series, la más concreta: la que no se llama como su marca y, entre esas, la de menos juegos. Muestra cuántos ha rellenado. Los juegos nuevos (alta con catálogo, importación de Steam) traen ya su serie del catálogo.

**Corregir a mano.** En la ficha, junto a «Saga», un campo **«Historia»** editable (con sugerencias de las historias que ya existen), con su «Traer de IGDB». Cambiarlo mueve el juego de historia. En la página de una historia, «Cambiar nombre» renombra la historia en todos sus juegos (si el nombre ya existe, se unen).

**Pantalla «Sagas»** (`/sagas`):

- Las historias con **dos o más** juegos suyos, agrupadas bajo su marca («Star Wars»: Jedi, KOTOR…; si la historia no tiene marca o se llama igual, va sola). Buscador por título de historia o de juego.
- Cada historia, en una fila: nombre, cuántos juegos, cuántos superados («2 de 3») y «Siguiente: …».
- Al abrir una historia: el interruptor **Lanzamiento / Historia** y la lista de sus juegos, cada uno con carátula pequeña, año, estado y enlace a su ficha. En «Historia», cada juego tiene flechas ↑ ↓ para moverlo; mover el primero guarda el orden de todos (1…n) partiendo del que se ve.
- **Siguiente**: el primero, en el orden elegido, que no esté superado (`timesFinished = 0`) ni abandonado. Si todos lo están, «Saga completada».
- Mismo mundo que el resto (ventanas con marco de papel, Press Start 2P en títulos, VT323 para leer, estados con su color y su nombre).

**Navegación.** Ordenador: «Sagas» en la barra de arriba, entre «Biblioteca» y «Deseos», sin que la barra desborde (ya se compacta por tramos). Móvil: la barra de abajo no cambia; la cabecera de la Biblioteca tiene un botón «Sagas».

**Ficha.** Si el juego tiene historia con dos o más juegos: «Historia: Star Wars Jedi · 1 de 2» (puesto en el orden de la historia), con enlace a esa historia.

## Lo que queda a quien lo construya

- La forma exacta de la pantalla y de la página de una historia (una sola pantalla con la historia abierta al lado, o dos pantallas), dentro del estilo.
- La dirección de la página de una historia (p. ej. `/sagas?historia=…`).
- Recordar en el navegador qué orden se eligió la última vez (Lanzamiento / Historia).
