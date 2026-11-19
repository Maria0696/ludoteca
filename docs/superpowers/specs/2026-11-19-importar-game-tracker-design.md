# Importar de Game Tracker y la tienda de los juegos de PC

Fecha: 19/11/2026 · Estado: pendiente de aprobación

## Por qué

La propietaria deja Game Tracker, la app que usaba hasta ahora, y se muda a Ludoteca de una vez. Tiene su colección exportada en un CSV de Game Tracker, con unos 650 juegos propios y unos 50 deseos. Quiere traer **los juegos que todavía no tiene** en Ludoteca, sin duplicar nada y sin perder lo que ya tiene.

Casi todos sus juegos son de PC (unos 550), repartidos entre tiendas: Epic Games (unos 400, casi todos gratuitos), Steam, Ubisoft y EA. En Ludoteca la tienda es un dato de cada copia, pero la biblioteca no la enseña ni deja filtrar por ella. Sin cambios, la balda «PC» sería un montón de 550 juegos sin forma de separarlos.

Antes de importar en su cuenta lo quiere **probar** en una copia que no toque sus datos.

## Objetivos

1. Importar desde el CSV de Game Tracker, en el navegador, los juegos y deseos que no estén ya en Ludoteca.
2. Enseñar antes de copiar qué va a entrar, qué se queda fuera porque ya está y qué casos dudosos hay que revisar.
3. En la biblioteca, la balda de PC se divide por tienda y hay un filtro «Tienda».
4. Poder ensayarlo entero en el modo local (datos solo en el navegador) antes de hacerlo en la cuenta real.

## Fuera del alcance

- Sincronizar con Game Tracker o repetir la importación de vez en cuando: es una mudanza de una vez. Aun así, repetirla no debe duplicar nada (lo ya importado se reconoce como «ya lo tienes»).
- Completar con el catálogo IGDB lo que el archivo no trae: el CSV ya trae carátula, sinopsis, géneros y fecha, y la importación no necesita el servidor.
- Importar estado de juego, horas, nota o precio: el archivo no los tiene.
- Cambiar «Importar copia» de Ajustes.

## Lo que no debe pasar

- Que un juego que ya está en Ludoteca se duplique o pierda algo de lo que tenía.
- Que algo se escriba en la cuenta sin que la propietaria haya visto antes la lista y pulsado «Copiar».
- Que PS VR o PS VR2 aparezcan como si fueran consolas, o que las tiendas de PC cuenten como plataformas en Estadísticas.

## Lo que se decidió

### Caminos considerados

1. **Una opción «Game Tracker» en la pantalla de importar, que lee el archivo en el navegador (elegida).** Ves lo que va a entrar, revisas los dudosos y copias. Funciona igual en el modo local que en la cuenta. Reutiliza el reconocimiento de duplicados de la copia de Steam.
2. **Un programa que convierte el CSV en una copia de seguridad para «Importar copia».** Menos trabajo, pero esa importación compara solo por título y pregunta por cada choque uno a uno, y no deja revisar los dudosos.
3. **Escribir los datos directamente en Supabase.** Descartado: no se ve nada antes y no se puede ensayar.

Para la tienda de PC se consideraron tres formas y la propietaria eligió la primera:

1. **PC como plataforma y la tienda dentro de cada copia; la balda de PC se divide por tienda y hay filtro «Tienda» (elegida).** Encaja con lo que ya guarda la copia de Steam (PC + tienda «Steam») y en Estadísticas PC sigue siendo una máquina.
2. Cada tienda como plataforma propia: choca con lo ya importado de Steam y falsea «Copias por plataforma».
3. Solo guardar la tienda: deja la balda de 550 juegos.

### Dónde está

- El botón de la biblioteca que hoy dice «Importar de Steam» pasa a decir **«Importar…»** y lleva a la pantalla de importar.
- La pantalla de importar ofrece dos orígenes, **Steam** y **Game Tracker**, enlazables con `?origen=steam` y `?origen=gametracker`. Steam sigue igual que hoy.

### El archivo

CSV de Game Tracker separado por `;`, con comillas dobles y saltos de línea dentro de los campos (sinopsis largas). Columnas que se usan:

| Columna | Uso |
|---|---|
| `title` | título |
| `source`, `externalId` | si `source` es `igdb` o `igdbModified`, `externalId` es el número de IGDB; si es `user`, no hay |
| `spaces` | `Propiedad` → juego de la biblioteca; `Deseos` → lista de deseos |
| `userPlatforms` | plataformas propias, separadas por `;` |
| `formats` | `PHYSICAL`, `DIGITAL` o ambos; vacío en los deseos |
| `tags` | tiendas de PC: `Steam`, `Epic Games`, `Ubisoft`, `EA` |
| `cover` | carátula (`t_cover_big`, se pide en `t_cover_big_2x`) |
| `artworks` | la primera, en `t_1080p`, como fondo |
| `summary`, `genres`, `developers`, `firstReleaseDate` | ficha |
| `gameModes` | modos de juego, con la misma traducción que el catálogo |
| `externalRating` | media de la crítica (0 se toma como «sin dato») |
| `createdAt` | fecha en que se añadió en Game Tracker; se conserva como fecha de alta para que «Añadidos recientemente» respete el orden real |

Los géneros se traducen con la misma tabla que el catálogo. Una cabecera distinta o un archivo que no sea de Game Tracker se rechaza con un mensaje claro y sin copiar nada.

### De plataformas de Game Tracker a Ludoteca

| Game Tracker | Ludoteca |
|---|---|
| PC (Microsoft Windows), Oculus Rift | PC |
| PlayStation 5 / 4 / 3 / 2 | PS5 / PS4 / PS3 / PS2 |
| PlayStation Portable | PSP |
| Nintendo Switch 2 / Switch / 3DS / Wii | Switch 2 / Switch / 3DS / Wii |
| Meta Quest 3 | Meta Quest |
| PlayStation VR, PlayStation VR2 | ninguna: son accesorios, no crean copia |

Una plataforma que no esté en la tabla entra con su nombre tal cual, como plataforma propia.

### Cómo se forman las copias

- **PC:** una copia digital por cada tienda de `tags`; sin tiendas, una copia digital sin tienda. Si un mismo juego tiene `Epic Games;Steam`, entran dos copias de PC.
- **Consolas:** una copia por cada plataforma.
  - Si `formats` trae un solo formato, ese para todas.
  - Si trae los dos y hay PC, el PC se queda con el digital y las consolas con el físico.
  - Si trae los dos y hay una sola consola (sin PC), dos copias en esa consola: física y digital.
  - Si trae los dos y hay varias consolas (sin PC), el caso es **dudoso**: entra como una copia física y otra digital en cada consola, marcado para revisar.
- **Un juego sin plataformas** (solo PS VR, o vacío) entra sin copia y se marca para revisar.

### Deseos y detalles (decisiones del agente, a revisar)

- Un deseo entra con prioridad media, su carátula, géneros y número de IGDB, y como plataforma la primera de `userPlatforms` ya traducida.
- Las tiendas se guardan con el nombre del archivo (`Steam`, `Epic Games`, `Ubisoft`, `EA`), igual que hoy «Steam».
- Las copias entran como «Comprado», sin precio ni fecha de compra; los juegos gratuitos de Epic también.
- La fecha de `createdAt` (solo día) se guarda como ese día a mediodía.

### Qué se queda fuera

- Un juego ya está en Ludoteca si coincide por número de IGDB o por título normalizado (como en la copia de Steam; los juegos de demostración no cuentan). Ese juego se salta entero: no se toca ni se le añaden copias.
- Un deseo se salta si ya está en la lista de deseos o si ya tienes el juego (mismas reglas).
- Dentro del propio archivo no hay títulos repetidos; si los hubiera, el segundo se trata como ya importado.

### La pantalla

1. Eliges el archivo (botón y, en el ordenador, arrastrar). Se lee entero en el navegador.
2. Resumen arriba: «N juegos nuevos · M deseos nuevos · K ya los tienes · D para revisar».
3. Lista de lo que entra, en secciones («Juegos nuevos», «Deseos nuevos»), con carátula, título y sus copias (`PC · Steam`, `PS4 · Físico`). Buscador y casillas para quitar lo que no quieras; todo empieza marcado. Lo que ya tienes se puede desplegar para verlo, pero no se copia.
4. Los dudosos, aparte y primero: en cada uno puedes quitar o añadir copias (plataforma y formato) antes de copiar.
5. «Copiar a la ludoteca», en tandas y con barra de progreso, como la copia de Steam. Al acabar, el resumen de lo copiado y un enlace a la biblioteca.

Mismo aspecto que el resto de la app (ventanas de píxeles, VT323 y Press Start 2P, dorado solo para la acción principal), legible en el móvil y con teclado.

### En la biblioteca

- Agrupada **por plataforma**, la balda de PC se divide en subbaldas por tienda (`PC · Steam`, `PC · Epic Games`, `PC · Ubisoft`, `PC · EA`, `PC · sin tienda`). Un juego con copias en dos tiendas aparece en las dos, igual que hoy un juego con dos plataformas aparece en las dos baldas.
- Filtro **«Tienda»**, junto a los demás (en la barra en el ordenador y en la hoja «Filtrar y ordenar» en el móvil). Ofrece solo las tiendas que hay en la colección, con cuántos juegos tiene cada una, va en la dirección como `tienda=` y deja elegir varias. Solo aparece si alguna copia tiene tienda.

### Ensayo

- Para probar: la app arrancada en el ordenador de la propietaria sin las claves de Supabase (modo local), en un puerto aparte. Se importa el archivo real allí, se revisa y se descarta.
- Antes de importar en la cuenta: «Exportar copia» como red de seguridad. La pantalla lo recuerda.

## Lo que queda para quien lo construya

- Partir el CSV respetando comillas y saltos de línea, sin librerías nuevas si se puede hacer en pocas líneas.
- El tamaño de las tandas al guardar y cómo se ve la barra de progreso (siguiendo la copia de Steam).
- Dónde viven las tablas compartidas (géneros y modos del catálogo) para usarlas también en el navegador.
- El nombre exacto de las subbaldas y su orden (por número de juegos, como las plataformas).
- Las pruebas: un CSV de muestra pequeño con un caso de cada regla (varias tiendas, físico y digital, PS VR, deseo, ya existente por IGDB y por título, juego de `source=user`, dudoso).
