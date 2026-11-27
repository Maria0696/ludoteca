# Notificaciones de ofertas en el móvil

## Para qué

Que la propietaria se entere en el móvil, **sin abrir la app**, de cuándo un juego de su lista de deseos baja de su precio objetivo, para no perderse ofertas de pocos días.

Hoy la app solo mira los precios al abrirse (PR #116).

## Decidido con la propietaria

- **Qué avisa:** solo los deseos **con precio objetivo**, cuando su precio en una tienda vigilada (eShop de Nintendo España o Steam) **baja a ese objetivo o por debajo** (opción A). Sin objetivo, no hay notificación: el aviso de Inicio sigue como está.
- **Quién mira:** una **tarea de GitHub dos veces al día** que llama a una ruta de la app (opción A). La ruta lee los deseos con una clave propia, mira los precios, apunta los nuevos y envía las notificaciones.
  - Es el mismo esquema que las copias automáticas. Si falla, GitHub avisa por correo. El repositorio es público, así que no gasta minutos.

## Formas consideradas

- **Elegida:** tarea de GitHub → ruta de la app → Supabase (con clave) y tiendas → notificación.
- **Tarea programada de Vercel:** en el plan gratuito, una vez al día, sin hora exacta y sin aviso si falla.
- **Todo en Supabase** (pg_cron y una función propia): tecnología nueva, difícil de probar y con la lógica de precios duplicada.

## Cómo

### 1. Notificaciones web (Web Push con claves VAPID)

- **Las claves:**
  - **Pareja de claves VAPID:** la pública va en la app (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, variable de Vercel, que se fija al compilar); la privada, solo en el servidor (`VAPID_PRIVATE_KEY`, variable de Vercel).
  - **Remitente** (`VAPID_SUBJECT`): la dirección de la app, para no poner ningún correo.
  - Las genera el agente en un archivo local que no se enseña; la propietaria las pega en Vercel.
- **Librería:** `web-push`, la estándar para enviarlas desde Node.
- **En `public/sw.js`:**
  - `push` enseña la notificación (título, texto, icono de la guardiana y a dónde lleva);
  - `notificationclick` abre o enfoca la app en Deseos.

### 2. Activarlas en un dispositivo

- **En Deseos**, bajo la línea de los precios, una segunda línea discreta:
  - desactivadas: «Avisos de ofertas en este móvil: desactivados · **Activar**»;
  - activadas: «activados · **Probar** · **Desactivar**».
- **Al activar:** se pide permiso, se suscribe el service worker y se guarda la suscripción en Supabase.
- **Solo en modo nube.** En local no se enseña.
- **En iPhone solo funciona con la app instalada.** Si se abre en el navegador, la línea dice: «Para recibir avisos, abre la app desde su icono en la pantalla de inicio».
- **Si el permiso está denegado,** la línea dice cómo volver a darlo en los ajustes del móvil.
- **«Probar»** manda una notificación de prueba a ese dispositivo (`POST /api/avisos-ofertas/prueba`, con la sesión de la propietaria).

### 3. Supabase: migración `0020_avisos_ofertas.sql` (la aplica ella)

- **`push_subscriptions`:** `id`, `owner_id`, `endpoint` (único), `p256dh`, `auth`, `user_agent` y `created_at`. Con RLS, solo la propietaria.
- **`alerts_key`:** una fila con la huella SHA-256 de la clave de los avisos, como `backup_key`. Sin políticas.
- **Funciones** con la clave (`security definer`; error 28000 si la clave no vale):
  - `deseos_vigilados(clave)`: los deseos de la propietaria con objetivo y enlazados a alguna tienda, y sus suscripciones;
  - `apuntar_precios(clave, cambios)`: sustituye `prices` en esos deseos (`[{id, prices}]`);
  - `quitar_suscripcion(clave, endpoint)`: borra una suscripción caducada (las tiendas de notificaciones responden 404 o 410).

### 4. La ruta `POST /api/avisos-ofertas`

Con `Authorization: Bearer <AVISOS_CLAVE>`.

1. Pide los deseos vigilados y las suscripciones.
2. Mira los precios (`store-prices.ts`) y calcula los nuevos con `newPriceRecords`.
3. Decide qué avisar con la función pura `offersToNotify`. Se avisa solo cuando **la propia ruta** descubre un precio nuevo con importe ≤ objetivo. Así:
   - cada oferta se avisa una vez;
   - si la app ya la había visto al abrirse, no se repite (ya salió en Inicio).
4. Envía una notificación por deseo a cada suscripción. Con varios a la vez, una sola notificación: «3 deseos han bajado de tu objetivo». Si una suscripción ha caducado, la quita.
5. Apunta los precios nuevos.
6. Responde con un resumen: deseos mirados, precios nuevos, avisos y envíos.

**Texto de la notificación:**
- título: «Hades II: 19,99 € en el eShop»;
- cuerpo: «Por debajo de tu objetivo (22 €) · −20 %, hasta el domingo 29»;
- lleva a Deseos.

**Respuestas de error:**
- sin nube, 404;
- sin clave o con clave mala, 401;
- sin claves VAPID configuradas, 503 «faltan las claves de los avisos».

### 5. La tarea `.github/workflows/avisos-ofertas.yml`

- A las 9:00 y a las 19:00 UTC (10:00 y 20:00 en invierno en Madrid), y a mano.
- Llama a la ruta con `AVISOS_CLAVE` y `APP_URL`, y falla si no responde 200.
- Se reactiva sola, como las otras.

## Lo que hace la propietaria

1. Aplicar la migración 0020 y el `insert` con la huella de la clave.
2. En Vercel → Settings → Environment Variables: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`, sacadas del archivo que le dé el agente. Después, volver a desplegar.
3. Fusionar.
4. En el iPhone, abrir la app desde su icono, ir a Deseos → «Activar» y aceptar el permiso; después, «Probar».

## Pruebas

- **Unitarias:**
  - `offersToNotify`: solo con objetivo, solo precios nuevos ≤ objetivo, varios juntos en una;
  - el texto de la notificación.
- **e2e:**
  - la ruta: 404 en local; 401 sin clave en `acceso`; la de prueba exige sesión;
  - en modo local, la línea de avisos no sale.
- **Sin prueba automática:**
  - el permiso y la suscripción del navegador, y el envío real;
  - se comprueban en el iPhone con «Probar» y lanzando la tarea a mano tras poner un objetivo por encima del precio de un deseo.

## Fuera de alcance

- Avisos de deseos sin objetivo.
- Tiendas nuevas.
- Elegir la hora de los avisos.
- Avisos por correo.
