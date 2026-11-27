# Logros de Steam

## Para qué

Que la propietaria pueda **ir a por los logros** de sus juegos de Steam desde la Ludoteca: ver cuáles le faltan y cuáles son más raros, y elegir qué juego completar. Además, que su año de logros quede en el Anuario y sus totales en Estadísticas.

Es el primer paso de «trofeos»: si funciona bien, después vendrá PlayStation (por la vía no oficial) y, quizá, apuntar a mano los de Nintendo.

## Decidido con la propietaria

- **Qué juegos:** solo los de su Ludoteca que estén en Steam (opción A). Los juegos de su cuenta de Steam que no estén en la biblioteca no cuentan.
  - Los importados de Steam ya traen su número (`Game.steamAppId`).
  - Los de PC añadidos a mano se enlazan **como los deseos** (PR #124):
    - solos, por título, si hay un único juego de Steam con ese título;
    - si no, con «Elegir en Steam» en la ficha, que permite buscar con otras palabras.
- **Dónde se ven:**
  1. **En la ficha de cada juego**, una sección «Logros»:
     - progreso, por ejemplo «23 de 41 · 56 %», con su barra;
     - **los que faltan**, del más raro al más común (con el % de jugadores que lo tienen);
     - **los conseguidos** debajo, con su fecha.
  2. **Una vista de todos** los juegos con logros, ordenada por lo cerca que está cada uno del 100 % («te faltan 3»). Cada juego lleva a su ficha.
  3. **En el Anuario**, una pantalla con los logros del año: cuántos, los juegos que llegaron al 100 % ese año y el logro más raro del año.
  4. **En Estadísticas**, los totales (logros conseguidos, juegos al 100 %, media de completado) y los logros más raros.
- **Logros ocultos:** los que faltan salen tapados («Logro oculto · 3,2 % · Ver») y se destapan con un toque (opción A). Los conseguidos se ven enteros.
- **Aceptado de la propuesta del agente:**
  - el perfil de Steam se guarda una vez en Ajustes;
  - los logros se actualizan solos una vez al día al abrir la app, con «Mirar ahora»;
  - si los «Detalles de juego» del perfil no son públicos, la app lo dice y explica cómo cambiarlo.

## Formas consideradas

- **Elegida: guardar los logros en la biblioteca** (en local, en Supabase y en las copias) y pedirlos a Steam desde la app, una vez al día al abrirse, como los precios.
  - Todo funciona al momento y sin red: la ficha, la vista de todos, el Anuario y Estadísticas.
  - Lo que cuesta: una migración, un tipo nuevo en la biblioteca y que la biblioteca pese más (ver «Tamaño»).
- **Pedirlos solo al abrir cada ficha, sin guardarlos.** No permite la vista de todos ni el Anuario, que necesitan los logros de todos los juegos a la vez.
- **Una tarea nocturna de GitHub, como las copias.** Añade otra clave, funciones con huella y otro workflow para algo que la app puede hacer al abrirse. Steam no avisa de los logros nuevos, así que tampoco gana inmediatez.

## Cómo

### Datos de Steam (API oficial, con `STEAM_API_KEY`, que ya está en Vercel)

| Qué | Llamada | Notas |
|---|---|---|
| Logros de la propietaria en un juego | `ISteamUserStats/GetPlayerAchievements/v1?appid&steamid&l=spanish` | `apiname`, `achieved`, `unlocktime` (segundos Unix), `name`, `description`. **Perfil privado** → 403 con `"Profile is not public"`. **Juego sin logros** → error «Requested app has no stats». |
| Nombre, icono y si es oculto | `ISteamUserStats/GetSchemaForGame/v2?appid&l=spanish` | `name` (= `apiname`), `displayName`, `hidden` (0/1), `description` (en los ocultos puede faltar), `icon`, `icongray`. |
| Rareza | `ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2?gameid` | Sin clave. `percent` viene **como texto** («81.8»). Comprobado con Hades (1145360). |
| Qué ha jugado últimamente | `IPlayerService/GetRecentlyPlayedGames/v1?steamid` | Últimas 2 semanas: decide qué juegos se miran cada día. |

**No verificado** (en local no hay clave): si en los ocultos sin conseguir Steam da `description`. La sección enseña lo que haya: nombre siempre y descripción si viene.

### Modelo (formato de datos 3)

- **`Library.achievements: GameAchievements[]`**, uno por juego con logros:
  - `{ id, gameId, steamAppId, total, unlocked, items, checkedAt, createdAt, updatedAt }`;
  - cada elemento de `items`: `{ api, name, description: string | null, hidden: boolean, percent: number | null, unlockedAt: string | null (ISO), icon: string | null }`;
  - `unlocked` y `total` se guardan además de `items`, para la vista de todos y Estadísticas;
  - `icon` es la URL del icono en color; los que faltan se ven en gris con CSS.
- **`Library.settings: { steamId: string | null }`**: el perfil, ya convertido a las 17 cifras con lo que ya hace `parseSteamProfile` y `ResolveVanityURL`.
- **Formato 3:** el almacén del navegador y las copias de seguridad aceptan el formato 2, sin logros ni ajustes, y lo leen como listas vacías.
- **Supabase: migración `0021_logros.sql`** (la aplica ella):
  - `achievements`: una fila por juego, con `game_id` único que referencia `games` con `on delete cascade`, y `steam_app_id`, `total`, `unlocked`, `items jsonb`, `checked_at`, `created_at`, `updated_at`. RLS «solo la propietaria», como las demás.
  - `user_settings`: una fila por propietaria, con `owner_id` como clave y `steam_id` con `check (steam_id ~ '^\d{17}$')`. RLS igual.
  - Actualizar `copia_de_seguridad(clave)` para que la copia automática traiga también `achievements` y `user_settings`.
- **Repositorios:** `local.ts` y `supabase.ts` guardan y cargan las dos cosas igual que `wraps` (en `Changes`, `achievements` y `settings`). En Supabase, con `upsert` por `game_id` y por `owner_id`.
  - Al borrar un juego se borran sus logros: en Supabase por la cascada; en local, a mano en `deleteGame` y `deleteAllGames`.
  - La demostración no tiene logros.

### Tamaño

Un logro guardado ocupa unos 250 bytes; 100 juegos con 50 logros, ~1,25 MB. Se carga con la biblioteca, y una vez cargada, la ficha y las vistas son instantáneas.

Si al probar con la colección real la carga se nota, lo siguiente sería cargar los logros aparte, después de la biblioteca. Queda fuera de este alcance salvo que haga falta.

### Rutas (servidor; la clave nunca sale)

- **`POST /api/logros`** `{ steamId, appIds: number[] }` (como mucho 10 por llamada) → `{ ok, games: { [appId]: { total, items } }, sinLogros: number[], failed: number[] }`.
  - Para cada juego hace las tres llamadas (jugador, esquema y rareza) y las junta.
  - Si el perfil es privado: `{ ok: false, reason: "privado", message }`.
  - Sin clave: `"no-configurado"`. Sin sesión: 401, como las demás.
- **`GET /api/logros/recientes?steamId`** → los `appId` jugados en las últimas 2 semanas.
- El perfil se resuelve con la misma lógica que la importación (`/api/steam` ya resuelve el nombre personalizado). Si hace falta, se saca a una función compartida.
- **Partes puras** (en `src/lib/achievements.ts`, sin red):
  - `mergeAchievements(player, schema, percents)` → `{ total, unlocked, items }`;
  - `completion(g)` → porcentaje;
  - `missingSorted(g)` → los que faltan, de más raro a más común; los que no tienen % van al final;
  - `nearlyDone(list)` → la vista de todos, ordenada por lo que falta (porcentaje alto primero y, a igualdad, menos logros que faltan);
  - `achievementsOfYear(list, year)` → `{ count, completed: juegos al 100 % ese año (fecha del último logro), rarest }`.

### Sincronización (cliente, `src/lib/achievement-sync.ts`, como `price-sync.ts`)

- **Al abrir la app**, como mucho una vez al día (`localStorage` `ludoteca:logros-mirados`), si hay `steamId`:
  1. **Enlazar** los juegos de la biblioteca con copia de PC sin `steamAppId`: por título con `/api/precios/steam/buscar` y `pickSteam` (una vez al día por juego, como los deseos). Los dudosos quedan «por elegir».
  2. **Elegir cuáles mirar:**
     - los enlazados que nunca se han mirado;
     - los jugados en las últimas 2 semanas;
     - los que llevan más de 30 días sin mirarse (para que la rareza no se quede vieja).
  3. **Pedirlos** en tandas de 10 a `/api/logros` y guardar los que cambian. Los juegos sin logros se apuntan como `total: 0`, para no volver a preguntar cada día.
- **«Mirar ahora»** (en la vista de todos y en la ficha) mira todos los enlazados, o ese juego.
- Las pruebas traen `ludoteca:logros-mirados` puesto, como el de precios, para no salir a Steam.

### Pantallas

- **Ajustes → Traer juegos → Steam:** el perfil se guarda al importar. También hay un campo «Tu perfil de Steam (para los logros)», con «Guardar» y «Quitar», y con el aviso de los «Detalles de juego» públicos y cómo cambiarlo.
- **Ficha (`GameDetail`):** un panel plegable «Logros», como los demás paneles, solo si el juego tiene logros o se puede enlazar con Steam:
  - cabecera con «23 de 41 · 56 %» y la barra;
  - «Te faltan (18)» con icono gris, nombre, descripción y % de rareza; los ocultos tapados con «Ver», que destapa ese logro mientras la ficha esté abierta;
  - «Conseguidos (23)» con icono en color, nombre, fecha y %;
  - pie con «Mirado hace 3 h · Mirar ahora».
  - Si es de PC y no está enlazado: «Elegir en Steam» (se reutiliza `StoreChooser`, generalizado de deseo a título).
  - Si no hay perfil: «Guarda tu perfil de Steam en Ajustes para ver tus logros».
- **Vista de todos, `/logros`:**
  - título «Logros», con totales en la cabecera;
  - una fila por juego: carátula, título, barra, «92 % · te faltan 3»; los completos al final, con «100 %»;
  - el juego que tiene logros pero ninguno conseguido va después de los empezados;
  - enlaces a ella desde Estadísticas («Ver todos») y desde la ficha.
  - **Decisión del agente:** no va en el menú principal, que ya tiene seis entradas.
- **Anuario:**
  - `YearWrapData` gana un campo opcional `achievements: { count, completed: WrapGame[], rarest: { title, name, percent } | null }`. Los años ya congelados no lo tienen y no enseñan la pantalla.
  - La pantalla «Tus logros» va después de la de terminados, solo si `count > 0`.
- **Estadísticas:** un apartado «Logros» con logros conseguidos, juegos al 100 %, media de completado (de los juegos con algún logro conseguido) y los 5 logros más raros que tienes, con «Ver todos».

## Lo que hace la propietaria

1. Aplicar la migración 0021.
2. En Steam → Perfil → Editar perfil → Privacidad: «Detalles de juego» en **Público**.
3. Fusionar, guardar su perfil en Ajustes y pulsar «Mirar ahora» en Logros.

## Pruebas

- **Puras:**
  - `mergeAchievements`: junta las tres fuentes; % en texto → número; sin rareza → `null`; ocultos;
  - `missingSorted`, `nearlyDone`, `completion`;
  - `achievementsOfYear`: fecha de completado = último logro; el más raro del año;
  - formato 3: el formato 2 se lee con listas vacías y la copia conserva logros y perfil.
- **Rutas:** `/api/logros` valida (perfil de 17 cifras, como mucho 10 juegos) y, sin clave (como en las pruebas), responde `no-configurado`; sin sesión, 401 en `acceso`.
- **e2e (con las rutas simuladas, como `ofertas.spec`):**
  - con perfil guardado, al abrir se enlaza un juego de PC por título, se miran sus logros y la ficha enseña progreso, faltan ordenados por rareza y conseguidos con fecha;
  - un oculto sale tapado y «Ver» lo destapa;
  - la vista `/logros` ordena por lo que falta;
  - Estadísticas y el Anuario enseñan sus cifras;
  - perfil privado → aviso con cómo arreglarlo;
  - sin perfil → la ficha lo pide.
- **Sin prueba automática:** la respuesta real de Steam con su perfil. Se comprueba tras fusionar, con su cuenta.

## Lo que queda al constructor

- La forma visual de cada pantalla, con el estilo de cada sitio: ventana de la ficha, carcasa de Estadísticas y pantallas del Anuario.
- El reparto exacto en archivos, siguiendo los patrones existentes (`price-sync.ts`, `StoreChooser.tsx`, los paneles de `GameDetail`).

## Fuera de alcance

- PlayStation, Xbox y Nintendo.
- Juegos de Steam que no están en la biblioteca.
- Marcar solo el juego como «completado al 100 %» al llegar al 100 % de logros (la app ya tiene ese estado: puede ser lo siguiente).
- Avisos en Inicio de juegos a punto de completarse.
- Cargar los logros aparte de la biblioteca (solo si el tamaño lo pide).
