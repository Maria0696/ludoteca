/**
 * Un fetch para Supabase que deja terminar los guardados aunque se cierre la página (también en iPhone, donde no se
 * puede avisar al cerrar). Solo las escrituras (lo que no es GET ni HEAD) y solo si caben: el navegador limita
 * `keepalive` a 64 KB en vuelo, así que lo grande (importar una copia) va como siempre. Si el navegador lo rechaza por
 * ese límite (varias a la vez), se repite sin `keepalive`.
 */
const LIMIT = 60_000;

export function keepaliveFetch(base: typeof fetch): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body;
    const small = body == null || (typeof body === "string" && body.length <= LIMIT);
    if (method === "GET" || method === "HEAD" || !small || init?.signal?.aborted) return base(input, init);
    try {
      return await base(input, { ...init, keepalive: true });
    } catch (e) {
      // Pasado el límite de lo que puede ir en vuelo con keepalive, el navegador lanza TypeError: se repite normal.
      if (e instanceof TypeError) return base(input, init);
      throw e;
    }
  };
}
