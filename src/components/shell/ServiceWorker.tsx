"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js), que solo sirve para enseñar «Sin conexión» cuando no hay red. Solo en la
 * versión publicada: en desarrollo guardaría pantallas a medias.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Si no se puede registrar (navegación privada, navegador antiguo), la app funciona igual, sin pantalla propia.
    });
  }, []);
  return null;
}
