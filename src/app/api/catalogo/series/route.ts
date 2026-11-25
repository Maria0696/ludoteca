import { NextResponse } from "next/server";
import { z } from "zod";
import type { SeriesResponse } from "@/lib/catalog";
import { igdbConfigured, seriesByIgdbIds } from "@/lib/igdb";
import { authorizeRequest } from "@/lib/supabase/server";

/* La saga (serie de IGDB) de un grupo de juegos, para rellenar y limpiar las sagas. */

const bodySchema = z.object({ igdbIds: z.array(z.number().int().positive().max(2_147_483_647)).min(1).max(50) });

const reply = (body: SeriesResponse, status = 200) => NextResponse.json<SeriesResponse>(body, { status });

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return reply({ ok: false, reason: "no-autorizado", message: auth.message }, auth.status);
  if (!igdbConfigured) return reply({ ok: false, reason: "no-configurado", message: "El catálogo de IGDB no está configurado." });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return reply({ ok: false, reason: "error", message: "Petición no válida." }, 400);

  try {
    return reply({ ok: true, ...(await seriesByIgdbIds(body.data.igdbIds)) });
  } catch {
    return reply({ ok: false, reason: "error", message: "No se pudo consultar el catálogo." }, 502);
  }
}
