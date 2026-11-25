# Rejugar un juego ya superado

Fecha: 23/11/2026 · Estado: pendiente de aprobación

## Por qué

La propietaria a veces vuelve a jugar un juego que ya terminó. Hoy la app no lo contempla:

- Para apuntarlo hay que sacar el juego de «Completado», y deja de contar como superado.
- Al terminarlo otra vez no se guarda la fecha nueva (se conserva la primera), así que esa vuelta no cuenta en «Superados» del año ni del mes.
- No se sabe cuántas veces se ha terminado.

Rejugar es una decisión consciente: no necesita que la app se lo recomiende.

## Objetivos

1. En la ficha de un juego superado, un botón **«Rejugar»** empieza una vuelta nueva: el juego pasa a «Jugando» y se ve como **«Vuelta 2»** (3, 4…).
2. Lo superado **no se pierde nunca**: cada vuelta terminada queda con su inicio y su fin.
3. Cada vuelta terminada cuenta en «Superados» del año y del mes en que acaba.
4. En la ficha se ven las vueltas: número, inicio, fin y días.

## Fuera del alcance

- Que ¿A qué juego? proponga juegos ya superados, o una marca «Quiero rejugarlo» (descartado por ella: rejugar es consciente).
- Diario o notas por vuelta: nada que escribir.
- Horas por vuelta: las horas siguen siendo del juego entero.
- Estado propio de cada vuelta (abandonada, en pausa): la vuelta en curso usa el estado del juego.

## Lo que no debe pasar

- Que rejugar o cambiar de estado borre una vuelta ya terminada.
- Que marcar «Completado» dos veces el mismo día por error cuente como dos vueltas.
- Que cambie algo en Supabase sin su permiso explícito (hace falta una columna nueva).

## Enfoques considerados

1. **Lista de fechas de fin en el juego.** Mínimo: cuenta vueltas y años, pero no sabe cuándo empezó cada una.
2. **Tabla aparte de vueltas** (inicio, fin, estado). La más completa, pero es una tabla nueva con permisos, modo local, copia de seguridad e importación con coincidencias propias, y todo lo que hoy lee las fechas del juego tendría que leerlas de ahí. Dos o tres veces más trabajo.
3. **Solo un contador.** No sabe en qué año acabó cada vuelta: Estadísticas no podría contarlas.

**Elegido: un punto intermedio entre 1 y 2**, a propuesta del agente y con el visto bueno de ella: la lista de vueltas, con inicio y fin, guardada **en el propio juego**. Da la tabla de vueltas de la ficha con una sola columna nueva y sin tocar la importación. Lo único que se pierde de la 2 es el estado de cada vuelta.

## Cómo

**Datos.** El juego guarda las vueltas **anteriores ya cerradas** en `pastRuns: { start: fecha | null, end: fecha }[]` (en Supabase, `past_runs jsonb not null default '[]'`, migración 0010). La vuelta en curso sigue siendo `startedAt` / `finishedAt` del juego, como hoy: así el mapa, ¿A qué juego?, Inicio y la ficha siguen funcionando igual.

- Número de la vuelta en curso: `pastRuns.length + 1`. Solo se enseña «Vuelta N» si N ≥ 2.
- Veces superado: `pastRuns.length + (finishedAt ? 1 : 0)`.
- Fechas de fin de todas las vueltas: las `end` de `pastRuns` más `finishedAt`.

**«Rejugar».** Sale en la ficha si el juego tiene `finishedAt` y no es sin final. Al pulsarlo: `{ start: startedAt, end: finishedAt }` se añade a `pastRuns`; `startedAt` = hoy, `finishedAt` = vacío, estado «Jugando», `lastPlayedAt` = hoy. Aviso con «Deshacer», como los demás cambios de estado.

**Cambiar el estado a mano.** De «Completado» a «Jugando» o «Pendiente» con `finishedAt` puesto = lo mismo que «Rejugar» (se archiva la vuelta). Si se vuelve a «Completado» el mismo día en que se archivó una vuelta que terminaba hoy, se recupera esa vuelta en vez de crear otra (el error del mismo día no suma).

**Estadísticas.** «Superados en 2026», «Superados mes a mes» y «El último» cuentan todas las fechas de fin (vueltas anteriores incluidas). La estantería y la leyenda siguen el estado actual (mientras se rejuega, verde «Jugando»).

**Ficha.** Junto al estado, «Vuelta N» cuando N ≥ 2. En «Tus récords» (o bajo «Misión principal»), la lista de vueltas: `1 · 12 mar 2019 → 2 may 2019 · 51 días`, la en curso con «en curso». El mapa mantiene «Terminado» alcanzado si hay alguna vuelta terminada. Texto en VT323 o con «Vuelta 2», nunca «2.ª» (en Press Start 2P la «ª» se confunde).

**Copia de seguridad e importación.** `pastRuns` entra en el esquema del juego con valor por defecto `[]`: las copias antiguas siguen sirviendo, sin cambiar la versión.

## Lo que queda a quien lo construya

- El sitio exacto del botón «Rejugar» y de la lista de vueltas en la ficha, dentro de su estilo.
- Los datos de demostración: un juego con una vuelta anterior, para las pruebas.
