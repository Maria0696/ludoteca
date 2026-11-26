# Ludoteca instalable (PWA)

## Para qué

Que la propietaria pueda instalar la Ludoteca en el móvil (y en el ordenador si quiere) como una app más: con su icono en la pantalla de inicio, a pantalla completa sin la barra del navegador y arrancando rápido. Es lo que más mejora el uso diario desde el móvil.

## Objetivos

- Se puede instalar en Android, en iPhone (con «Añadir a pantalla de inicio») y en el ordenador (Chrome o Edge).
- Una vez instalada, abre en Inicio, a pantalla completa, con la barra del sistema en morado noche.
- El icono es la guardiana de la app, con el fondo morado noche y líneas de pantalla.
- Sin conexión sale una pantalla propia de la Ludoteca, «Sin conexión», con un botón para reintentar.

## Fuera de alcance

- Consultar la biblioteca sin conexión, o guardar cambios para enviarlos después. Se habló como opción B y se descartó por ahora.
- Notificaciones y un botón propio de «Instalar» dentro de la app: se instala desde el menú del navegador.

## Lo que no puede pasar

- Que el service worker guarde páginas o datos viejos y la app enseñe cosas desactualizadas. Solo guarda la pantalla «Sin conexión».
- Que el control de acceso mande a «Entrar» las peticiones del manifiesto, los iconos, el service worker o la pantalla sin conexión. Si pasa, el móvil no podría leerlos o guardaría la pantalla de «Entrar».

## Formas consideradas

- **Elegida: lo que trae Next.js más un service worker mínimo escrito a mano.** Usa `app/manifest.ts`, iconos PNG, las etiquetas de Apple en `metadata` y un `public/sw.js` pequeño. Sin dependencias nuevas.
- Una librería de PWA (Serwist o next-pwa): añade una dependencia y una configuración pensadas para guardar copia sin conexión, que no se quiere.
- Solo el manifiesto, sin service worker: sin conexión se vería la pantalla de error del navegador.

## Decidido

- **Manifiesto** (`src/app/manifest.ts`, servido en `/manifest.webmanifest`):
  - nombre y nombre corto: «Ludoteca»;
  - descripción: «Tu biblioteca personal de videojuegos.»;
  - `lang` es-ES;
  - `start_url` y `scope`: `/`;
  - `display: standalone`;
  - fondo y tema `#1a1526`;
  - iconos de 192 y 512 px (`any`) y de 512 px adaptable (`maskable`).
- **Icono** (decidido por la propietaria): la cara de la guardiana (`KEEPER` de `src/components/pixel/sprites.ts`) sobre morado noche con líneas de pantalla finas.
  - El dibujo queda dentro de la zona segura, para que el recorte redondo de Android no lo corte.
  - El favicon (`src/app/icon.svg`, que es de una versión antigua) pasa a ser también la guardiana.
- **iPhone:** `apple-icon` de 180 px, y `metadata.appleWebApp` con título «Ludoteca», pantalla completa y barra `black`. La cabecera no reserva el hueco de la muesca, así que la barra translúcida taparía contenido.
- **Sin conexión:**
  - `public/offline.html` es autónoma: estilos en línea y la guardiana en SVG en línea, porque sin red no hay CSS ni fuentes. Muestra «Sin conexión», una frase y el botón «Reintentar», que recarga.
  - `public/sw.js` guarda solo esa página al instalarse. Las navegaciones van a la red y, si falla, sirven esa página. Todo lo demás no lo toca.
- **Registro del service worker:** desde el cliente, solo en producción, para no estorbar en desarrollo.
- **Control de acceso** (`src/proxy.ts`): el `matcher` deja fuera `manifest.webmanifest`, `sw.js`, `offline.html`, los iconos y `apple-icon`.
- **Cabeceras:** `sw.js` con `Cache-Control: no-cache` y su tipo JavaScript, para que una versión nueva se recoja enseguida.

## Lo que queda a quien lo construya

- Cómo generar los PNG del icono a partir del dibujo: rutas de Next con imagen generada o archivos en `public/` creados con un script y `sharp`, que ya está instalado. Lo importante es que salgan nítidos y en píxel.
- El texto exacto de la pantalla sin conexión, en el tono de la app.
- Pruebas e2e:
  - el manifiesto y sus campos;
  - que los iconos responden como PNG;
  - las etiquetas de Apple;
  - que sin conexión, con el service worker activo, sale «Sin conexión»;
  - que el `matcher` deja pasar estas rutas.
