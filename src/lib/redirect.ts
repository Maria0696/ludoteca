/**
 * Dirección a la que volver después de iniciar sesión.
 *
 * Solo acepta rutas de la propia app; cualquier otra cosa lleva al inicio.
 * Se compara la dirección ya interpretada, no el texto: trucos como
 * «/\otro-sitio» o un tabulador en «/<tab>/otro-sitio» pasan un filtro de
 * texto y el navegador los convierte en «//otro-sitio», que es otra web.
 */
export function safeNextPath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== new URL(origin).origin) return "/";
    // «/.//otro-sitio» se queda en la app, pero su ruta empieza por «//»
    // y al navegar a ella el navegador saltaría a otra web.
    const path = url.pathname.replace(/^\/{2,}/, "/");
    return `${path}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
