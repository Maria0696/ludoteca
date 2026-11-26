import type { NextConfig } from "next";

// El modo local (datos solo en el navegador) se permite en desarrollo y en
// despliegues de vista previa. En producción de Vercel se desactiva salvo que
// ALLOW_LOCAL_MODE=true lo pida expresamente.
const localModeAllowed = process.env.ALLOW_LOCAL_MODE === "true" || process.env.VERCEL_ENV !== "production";

const nextConfig: NextConfig = {
  // Las pruebas de acceso compilan en su propia carpeta para convivir con `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: {
    NEXT_PUBLIC_LOCAL_MODE_ALLOWED: String(localModeAllowed),
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Ninguna otra web puede mostrar la app dentro de un marco (clickjacking).
          // La primera cabecera es la de siempre; la segunda, la moderna.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // La app no usa cámara, micrófono ni ubicación: se bloquean.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
      {
        // El service worker, siempre recién pedido: así una versión nueva se recoge en la siguiente visita.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
