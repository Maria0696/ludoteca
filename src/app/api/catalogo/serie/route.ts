import { NextResponse } from "next/server";
import { z } from "zod";
import type { SeriesGamesResponse } from "@/lib/catalog";
import { gamesOfSeries, igdbConfigured } from "@/lib/igdb";
import { authorizeRequest } from "@/lib/supabase/server";

/* Los juegos de una serie de IGDB, para «Buscar los que faltan» en una saga. */

const bodySchema = z.object({ name: z.string().trim().min(1).max(200) });

const reply = (body: SeriesGamesResponse, status = 200) => NextResponse.json<SeriesGamesResponse>(body, { status });

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return reply({ ok: false, reason: "no-autorizado", message: auth.message }, auth.status);
  if (!igdbConfigured) return reply({ ok: false, reason: "no-configurado", message: "El catálogo de IGDB no está configurado." });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return reply({ ok: false, reason: "error", message: "Petición no válida." }, 400);

  try {
    return reply({ ok: true, games: await gamesOfSeries(body.data.name) });
  } catch {
    return reply({ ok: false, reason: "error", message: "No se pudo consultar el catálogo." }, 502);
  }
}
