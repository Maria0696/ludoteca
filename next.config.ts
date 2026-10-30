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
        ],
      },
    ];
  },
};

export default nextConfig;
