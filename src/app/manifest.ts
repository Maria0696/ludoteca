import type { MetadataRoute } from "next";

/** La Ludoteca como app instalable: se abre en Inicio, a pantalla completa, con la guardiana de icono. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ludoteca",
    short_name: "Ludoteca",
    description: "Tu biblioteca personal de videojuegos.",
    lang: "es-ES",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a1526",
    theme_color: "#1a1526",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
