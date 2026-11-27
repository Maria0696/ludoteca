# Precios de la lista de deseos: Nintendo eShop y Steam

## Para qué

Que la propietaria se entere de las ofertas de los juegos de su lista de deseos sin mirar las tiendas una a una.

Compra en Instant Gaming, G2A, Steam, PlayStation y Nintendo. Se empieza por lo que se puede vigilar gratis y sin claves: **el eShop de Nintendo España** y **la tienda de Steam**. Lo demás sigue a mano, como ahora: apuntar un precio por debajo del objetivo ya avisa.

## Decidido con la propietaria

- **Tiendas:** eShop de Nintendo y tienda de Steam. Tiendas de claves (vía GG.deals), PlayStation y Xbox, más adelante o a mano.
- **Quién mira los precios:** la propia app al abrirse, como mucho cada 6 horas, a través de sus rutas. El navegador no puede preguntar directamente a Nintendo ni a Steam. Sin claves ni tareas de GitHub; funciona también en modo local.
- **Avisos:** dentro de la app, en Deseos y en Inicio. Las notificaciones en el móvil, en un segundo paso (necesitarían una tarea nocturna).
- **Moneda y región:** siempre euros, eShop y Steam de España.

## Formas consideradas

- **Elegida:** la app mira los precios al abrirse. Es lo más sencillo, pero si no se abre en días, no se actualiza.
- **Tarea nocturna en GitHub:** compensa cuando haya notificaciones en el móvil.
- **Leer las webs de Instant Gaming o G2A:** frágil y contra sus condiciones. Descartado.

## Comprobado

- **eShop de España.** Dos consultas públicas, sin claves.
  - **Catálogo:** `searching.nintendo-europe.com/es/select`. Da título, consola y `nsuid_txt`, los códigos del producto; puede haber varios, como la Switch 2 Edition, cuyo segundo código es el paquete de mejora.
  - **Precio:** `api.ec.nintendo.com/v1/price?country=ES&lang=es&ids=…`, hasta 50 códigos por consulta. Da `regular_price` y, en oferta, `discount_price` con `start_datetime` y `end_datetime`.
  - No es oficial.
- **Steam:** `store.steampowered.com/api/appdetails?appids=…&cc=es&filters=price_overview`, varios juegos por consulta. Da `initial`, `final` y `discount_percent` en céntimos de euro, sin fecha de fin.
- **IGDB** relaciona juegos con Steam (`external_games`, fuente 1). La app ya lo usa al importar de Steam.

## Diseño

### Datos

- **`WishItem`:** `eshopNsuid` (texto de 14 cifras) y `steamAppId` (entero), opcionales.
- **`PriceRecord`:** `regular` (precio sin rebaja) y `until` (fin de la oferta, fecha y hora), opcionales.
- **Migración `0019`:** columnas `eshop_nsuid` y `steam_app_id` en `wishlist`. Los precios ya son `jsonb`.
- Van en las copias de seguridad, porque usan el mismo esquema.

### Enlazar cada deseo con su tienda

- **Steam:** deseos de **PC** con `igdbId` y sin `steamAppId`. Se pregunta a IGDB por su código de Steam, todos a la vez.
- **eShop:** deseos de **Switch** o **Switch 2** sin `eshopNsuid`. Se busca el título en el catálogo español, filtrado por esa consola.
  - Se enlaza solo si hay una única coincidencia de título (sin mayúsculas, acentos ni signos) con un único código.
  - Si no, queda **«por elegir»**: en Deseos, el botón «Elegir en el eShop» enseña las opciones con su precio y se elige.
- **«Buscar en las tiendas»**, en Deseos: lo hace con todos y mira los precios ya.
- **Al abrir la app**, cada 6 horas: lo hace con los nuevos (cada deseo se intenta una vez por día) y mira los precios.

### Mirar los precios

- **Ruta `POST /api/precios`** con `{ eshop: nsuid[], steam: appId[] }`. Devuelve, para cada uno, `{ amount, regular, until }`. Misma protección que el resto de rutas: solo la propietaria en la nube; en local, libre.
- **Cada precio se apunta en el historial del deseo** con su tienda («Nintendo eShop», «Steam»). Solo se apunta si cambia el importe, el precio normal o la fecha de fin respecto al último de esa tienda.
- **Las rutas de apoyo:**
  - `GET /api/precios/eshop?q=&plataforma=`: opciones del catálogo, con precio;
  - `POST /api/precios/steam`: `{ igdbIds }` → `{ igdbId: appId }`.

### Avisos

- **Oferta vigente de un deseo:** su último precio en una tienda, con `regular` mayor que `amount`. Se considera vigente si:
  - `until` es futuro, cuando lo hay (eShop);
  - si no hay `until` (Steam), el precio se vio hace menos de 2 días.
- **Deseos:** en cada juego en oferta, la etiqueta «−20 % hasta el dom. 29» (sin «hasta» en Steam), junto al precio.
- **Inicio:** un aviso con los deseos en oferta que estén por debajo de su precio objetivo, o en oferta a secas si no tienen objetivo. Ejemplo: «Hades II: 19,99 € en el eShop (−20 %), hasta el domingo 29». Enlaza a Deseos.

## Fuera de alcance

- Notificaciones en el móvil.
- GG.deals, PlayStation, Xbox y tiendas físicas.
- Precios de otros países.

## Tareas

1. Modelo y migración: campos nuevos, `wishCols`, copias.
2. Lógica pura (`price-watch.ts`): elegir la coincidencia del eShop, qué precios apuntar, la oferta vigente y los avisos de Inicio, con pruebas unitarias.
3. Servidor: consultas al eShop, a Steam y a IGDB, y las tres rutas. Pruebas con las respuestas de las tiendas simuladas.
4. Cliente: sincronizar al abrir (cada 6 h) y con «Buscar en las tiendas»; elegir en el eShop.
5. Pantallas: etiqueta en Deseos, «Elegir en el eShop» y aviso de Inicio. Capturas a 1440 y 390.
