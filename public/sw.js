/*
 * Service worker de la Ludoteca. Hace una sola cosa: si una navegación falla por no haber conexión, enseña la
 * pantalla «Sin conexión» (offline.html), que guarda al instalarse. No guarda páginas ni datos, y no toca ninguna
 * otra petición (la API, Supabase, las carátulas…): todo lo demás va a la red como siempre.
 * Además enseña los avisos de ofertas (los manda /api/avisos-ofertas) y, al tocarlos, abre la app en Deseos.
 * Al cambiar offline.html, sube la versión de CACHE para que se guarde la nueva y se borre la vieja.
 */
const CACHE = "ludoteca-sin-conexion-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE, { cacheName: CACHE })));
});

// Un aviso de ofertas: { title, body, url }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Ludoteca", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      lang: "es-ES",
      data: { url: data.url || "/deseos" },
    }),
  );
});

// Al tocar el aviso: la app, si ya está abierta, pasa a Deseos; si no, se abre ahí.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/deseos", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (!open) return self.clients.openWindow(url);
      // Primero se trae la app delante; luego, a Deseos. Si la ventana no admite cambiar de página (no la controla
      // este service worker), al menos queda abierta donde estaba.
      return open
        .focus()
        .then((w) => (w || open).navigate(url))
        .catch(() => undefined);
    }),
  );
});
