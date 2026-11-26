/*
 * Service worker de la Ludoteca. Hace una sola cosa: si una navegación falla por no haber conexión, enseña la
 * pantalla «Sin conexión» (offline.html), que guarda al instalarse. No guarda páginas ni datos, y no toca ninguna
 * otra petición (la API, Supabase, las carátulas…): todo lo demás va a la red como siempre.
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
