/*
 * Avisos de errores del navegador.
 *
 * Casi toda la app funciona en el navegador, y lo que falla ahí no queda
 * registrado en ningún sitio. Este módulo manda un aviso breve a
 * /api/errores, que lo escribe en el registro de Vercel para poder revisarlo
 * después. Nunca envía datos de la biblioteca: solo el tipo de error, su
 * mensaje, la pila de llamadas y la ruta de la pantalla (sin parámetros).
 */

export type ErrorKind = "pantalla" | "pantalla-general" | "navegador" | "promesa";

export interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
}

/** Como mucho, tantos avisos distintos por cada vez que se abre la app. */
const MAX_REPORTS = 5;
const sent = new Set<string>();

export function describeError(value: unknown): ErrorDetails {
  if (value instanceof Error) {
    const digest = (value as Error & { digest?: unknown }).digest;
    return {
      name: value.name || "Error",
      message: value.message,
      stack: value.stack,
      digest: typeof digest === "string" ? digest : undefined,
    };
  }
  if (typeof value === "string") return { name: "Error", message: value };
  let message: string;
  try {
    message = JSON.stringify(value) ?? String(value);
  } catch {
    message = String(value);
  }
  return { name: "Valor lanzado", message };
}

/** Lo que no viene de la app: extensiones del navegador y avisos inofensivos. */
export function isNoise(details: ErrorDetails): boolean {
  const text = `${details.message}\n${details.stack ?? ""}`;
  return (
    /(chrome|moz|safari(-web)?)-extension:\/\//.test(text) ||
    details.message.startsWith("ResizeObserver loop") ||
    details.message === "Script error."
  );
}

/** Recorta un texto para que, con los puntos suspensivos, no pase de `max`. */
export function cut(text: string | undefined, max: number): string | undefined {
  if (text === undefined || text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function sendErrorReport(kind: ErrorKind, value: unknown) {
  try {
    const details = describeError(value);
    if (isNoise(details)) return;
    // El mismo fallo puede llegar por varios caminos (pantalla de error y
    // aviso global): se envía una sola vez.
    const key = `${details.name}: ${details.message}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS) return;
    sent.add(key);
    void fetch("/api/errores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind,
        name: cut(details.name, 100),
        message: cut(details.message, 500),
        stack: cut(details.stack, 2000),
        digest: cut(details.digest, 100),
        path: cut(window.location.pathname, 200),
      }),
    }).catch(() => {});
  } catch {
    // Avisar de un error nunca debe provocar otro.
  }
}
