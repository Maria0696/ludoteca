import { NextResponse } from "next/server";
import type { CatalogResponse } from "@/lib/catalog";
import { catalogNameQuery, catalogSearchQuery, searchCatalog } from "@/lib/catalog-search";
import { fetchCatalogGames, igdbConfigured } from "@/lib/igdb";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Búsqueda en el catálogo de IGDB. Sin claves, la ruta responde «no-configurado»
 * y la app sigue funcionando con datos introducidos a mano.
 */

export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) {
    return NextResponse.json<CatalogResponse>({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  }
  if (!igdbConfigured) {
    return NextResponse.json<CatalogResponse>({
      ok: false,
      reason: "no-configurado",
      message: "La búsqueda de carátulas aún no está configurada. Puedes escribir los datos a mano.",
    });
  }
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  // Con `id` se pide un juego concreto, para completar uno que ya está en la biblioteca.
  const id = /^\d{1,9}$/.test(params.get("id") ?? "") ? params.get("id") : null;
  if (!id && q.length < 2) return NextResponse.json<CatalogResponse>({ ok: true, results: [] });

  try {
    const options = { requireTimes: params.has("duracion") };
    const results = id
      ? await fetchCatalogGames((fields) => `fields ${fields}; where id = ${id}; limit 1;`, options)
      : await searchCatalog(
          q,
          () => fetchCatalogGames((fields) => catalogSearchQuery(q, fields), options),
          () => fetchCatalogGames((fields) => catalogNameQuery(q, fields), options),
        );
    return NextResponse.json<CatalogResponse>({ ok: true, results });
  } catch (e) {
    return NextResponse.json<CatalogResponse>(
      { ok: false, reason: "error", message: e instanceof Error ? e.message : "No se pudo consultar el catálogo." },
      { status: 502 },
    );
  }
}
