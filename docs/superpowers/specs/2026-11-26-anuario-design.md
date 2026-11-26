# Anuario: el resumen de cada año, guardado como recuerdo

Fecha: 26/11/2026 · Estado: pendiente de aprobación

## Por qué

La propietaria quiere un «Wrapped» de su año de juego para **verlo al acabar el año** y **guardarlo como recuerdo**, y así **comparar unos años con otros**. Compartirlo no es el objetivo.

El README ya lo dejaba pendiente («objetivos y resumen anual»).

## Lo que hay hoy (datos con fecha)

En su biblioteca real (consultado el 26/11/2026):

| Dato | Con fecha | 2025 | 2026 (hasta hoy) |
|---|---|---|---|
| Juegos terminados (fecha de fin, incluidas las vueltas de `pastRuns`) | sí | 10 | 16 |
| Juegos empezados (`startedAt`, incluidas las vueltas) | sí | 11 | 14 |
| Copias que entraron (`acquiredAt` de la copia) | sí, salvo 141 sin fecha | 123 | 75 |
| Nota propia (`rating`) | sin fecha | 28 juegos con nota en total | |

Años anteriores: 2021-2024 tienen 90-134 copias por año y muy pocos terminados (de 0 a 3).

**No se puede saber por año:** horas o días jugados (las horas son un total sin fecha y «He jugado hoy» solo guarda el último día), abandonos (sin fecha), «al 100 %» (sin fecha) y deseos cumplidos (pasar un deseo a la biblioteca no deja rastro).

## Objetivos

1. Un **resumen de cada año**, en **pantallas a pantalla completa que se pasan una a una**, con el estilo de la app.
2. Durante el año se calcula **en vivo** con los datos. Al **cerrarse** se **congela**: se guarda una copia que ya no cambia aunque luego se editen juegos.
3. Cerrar: **solo** al abrir la app a partir del 1 de enero (el año anterior), **a mano** con «Cerrar el año», y los **años pasados** se pueden congelar desde ya.
4. **Comparar años**: cada resumen compara con el año anterior, y hay una vista con todos los años.
5. Funciona igual en modo local y sincronizado, y los años congelados **van en las copias de seguridad**.

## Fuera del alcance

- Compartir o exportar como imagen.
- Horas o días jugados por año, abandonos del año, «al 100 %» del año y deseos cumplidos, porque no hay datos fechados. Si un día se quieren, se empieza a guardar el dato entonces; los años ya pasados no lo tendrán.
- Congelar desde el servidor, con una tarea programada.
- Objetivos del año («terminar 20 juegos»), que es otra función.

## Lo que no debe pasar

- **Que un número mienta:** contar cosas sin fecha como si fueran del año. Lo que no se puede fechar no sale.
- **Que un recuerdo cambie solo.** Un año congelado solo cambia si ella pide «Volver a calcular», con confirmación.
- **Que un año casi vacío quede triste o roto.** Si no hay datos para una pantalla, esa pantalla no sale.

## Enfoque

Considerados:

1. **Calcular en la app y congelar en una tabla nueva (elegido).** Una función pura calcula el resumen de un año a partir de la biblioteca. Al congelar, el resultado (JSON) se guarda en `year_wraps` (Supabase) o en el almacén del navegador (modo local), y entra en las copias de seguridad.
2. **Congelar desde el servidor cada 1 de enero:** solo sirve en modo sincronizado, necesita una tarea programada en Vercel y permisos de servicio. Con una sola usuaria, esperar a que abra la app basta.
3. **Guardarlo dentro de otra tabla o en el navegador sin más:** no hay tabla de ajustes, mezclarlo con los juegos ensucia el modelo, y el navegador solo no se sincroniza ni sobrevive a otro dispositivo.

## Diseño

### Nombre y rutas (mi decisión)

- **«Anuario»**: un libro de recuerdos por año.
- **`/anuario`**: los años, de más nuevo a más viejo, y la comparación.
- **`/anuario/2026`**: las pantallas de ese año.

### Qué se cuenta de un año Y

Todo sale de fechas dentro de Y (de 1 de enero a 31 de diciembre, fechas locales `AAAA-MM-DD`). Los juegos y copias de demostración no cuentan (mi decisión):

- **Terminados:** los juegos con alguna fecha de fin en Y (`finishedAt` y `pastRuns[].end`). Se cuenta cada juego una vez y, aparte, las **vueltas** («2 de ellos, rejugados»).
- **Empezados:** los juegos con algún inicio en Y (`startedAt` y `pastRuns[].start`).
- **Por mes:** terminados en cada mes de Y, y el mes con más.
- **Primero y último:** el primer y el último juego terminados en Y.
- **Favoritos:** de los terminados en Y, hasta 3 con mejor nota propia (`rating`). Si ninguno tiene nota, la pantalla no sale.
- **Perfil:** de los terminados en Y, los 3 géneros, la familia de plataforma (la de su primera copia; mi decisión) y el tipo de experiencia (`moods`) más repetidos. Además, una frase con el primer género, por ejemplo «Tu año fue de rol». Las frases salen de una tabla fija en el código, sin inventar nada que no esté en los datos.
- **Tu ludoteca creció:** las copias con `acquiredAt` en Y, cuántas eran juegos nuevos (primera copia de ese juego), el gasto (suma de importes pagados), regalos y gratis. Las copias sin fecha no cuentan, y la pantalla dice cuántas hay sin fecha en total, para que el número no engañe.
- **Comparación:** con el año anterior (congelado o, si no lo está, calculado) en terminados, empezados y copias: «+4 que en 2025».

### Lo que se guarda al congelar

Un objeto `YearWrap` con los números y, para lo que se enseña, lo justo de cada juego: id, título, carátula (solo si es una URL; las subidas a mano en `data:` se guardan como `null`, porque pesarían demasiado), nota y fecha. Así, si un juego se borra después, el recuerdo sigue entero.

Lleva `version: 1`, para poder leer los de antes si el formato cambia.

### Cuándo se congela

- **Solo:** al cargar la biblioteca, si hoy es 1 de enero o después y el año anterior no está congelado y tiene datos (algún terminado, empezado o copia).
- **A mano:**
  - En el año en curso, «Cerrar el año», con confirmación: «Lo que pase después no contará».
  - En un año pasado sin congelar, «Guardar este año».
- **«Volver a calcular»** en un año congelado: lo sustituye por el cálculo de ahora, con confirmación.
- **Etiquetas:** un año congelado dice «Guardado el 3 ene 2027». El año en curso, «En curso».

### Las pantallas de un año (`/anuario/2026`)

A pantalla completa, con una barra de progreso de puntos arriba. Se pasan con las flechas de pantalla, deslizando, con ←/→ del teclado y con el mando, que ya funciona con la navegación espacial de la app. Esc o «Cerrar» vuelve a `/anuario`.

Cada pantalla tiene una idea grande y una entrada discreta, con el mismo lenguaje que las transiciones de pantalla: fundido y subida corta.

1. **Portada:** «Tu 2026», con el abanico de carátulas de lo terminado.
2. **Terminados:** el número grande, las vueltas y la comparación con el año anterior.
3. **Tu mes:** barras de enero a diciembre, con el mes fuerte destacado.
4. **Favoritos:** hasta 3 carátulas con su nota (solo si hay nota).
5. **Primero y último:** dos carátulas con su fecha.
6. **Tu perfil:** la frase, los géneros, la plataforma y el tipo de experiencia.
7. **Tu ludoteca creció:** copias, juegos nuevos, gasto, regalos y gratis.
8. **Resumen:** todo en una tarjeta, más «Ver todos los años».

Las pantallas sin datos no salen. Un año sin terminados enseña portada, «Tu ludoteca creció» y resumen.

```
┌──────────────────────────────┐
│  ●●●○○○○○  (3 de 8)   Cerrar │
│                              │
│   En 2026 terminaste         │
│          16                  │
│        juegos                │
│   +6 que en 2025             │
│                              │
│   ‹ anterior     siguiente › │
└──────────────────────────────┘
```

### Todos los años (`/anuario`)

- **Cada año:** una tarjeta con su número, su estado («En curso», «Guardado el…» o «Sin guardar») y tres cifras: terminados, empezados y copias. Al pulsarla se abren sus pantallas.
- **Comparación:** debajo, una tabla con un año por columna y una fila por cifra.
- **Qué años salen:** los que tienen datos o están congelados.

### Dónde se llega

- **En Estadísticas,** un bloque «Tu 2026 en el Anuario →».
- **En Inicio,** del 15 de diciembre al 31 de enero, un aviso: «Ya puedes ver tu 2026».

### Datos

- **Supabase**, migración `0017_anuario.sql`:
  - Tabla `year_wraps`: `id uuid`, `owner_id`, `year integer`, `data jsonb`, `frozen_at timestamptz`, `created_at` y `updated_at`.
  - Restricción `unique (owner_id, year)`.
  - La misma seguridad por filas que las demás tablas.
- **Modelo:** `YearWrap` con `{ id, year, data, frozenAt, createdAt, updatedAt }`, que va en `Library.wraps`, y el repositorio gana guardar y borrar.
- **Modo local:** se guarda en el mismo documento del navegador.
- **Copias de seguridad:** `data.wraps` es opcional (por defecto `[]`) en la versión 2. Al importar, entran los años que no tienes; si ya tienes ese año, se queda el tuyo.

### Movimiento y accesibilidad

- **Movimiento:** fundido más 8 px hacia arriba, de 200 a 250 ms con `--ease-out`. Las cifras grandes no cuentan hacia arriba (sería «delight» repetido cada vez). Con «Reducir movimiento», solo fundido.
- **Lectores de pantalla:** cada pantalla es una región con su título, y la barra de puntos dice «Pantalla 3 de 8».

## Lo que queda para quien lo construya

- Las frases del perfil: una tabla de géneros a frase en español, en el tono de la app.
- El aspecto exacto de cada pantalla, dentro del estilo pixel de la app, con capturas a 1440 y 390.
- Cómo se ve el abanico de la portada (puede reutilizar el de Sagas).
