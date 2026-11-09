import { NextResponse } from "next/server";
import { z } from "zod";
import { catalogBySteamIds, igdbConfigured } from "@/lib/igdb";
import type { SteamSheetsResponse } from "@/lib/steam";
import { authorizeRequest } from "@/lib/supabase/server";

/* Carátula y ficha de IGDB para un grupo de juegos de Steam. */

const bodySchema = z.object({ appIds: z.array(z.number().int().positive().max(2_147_483_647)).min(1).max(50) });

const reply = (body: SteamSheetsResponse, status = 200) => NextResponse.json<SteamSheetsResponse>(body, { status });

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return reply({ ok: false, reason: "no-autorizado", message: auth.message }, auth.status);
  if (!igdbConfigured) return reply({ ok: false, reason: "no-configurado", message: "El catálogo de carátulas no está configurado." });

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return reply({ ok: false, reason: "error", message: "Petición no válida." }, 400);

  try {
    return reply({ ok: true, matches: await catalogBySteamIds(body.data.appIds) });
  } catch {
    return reply({ ok: false, reason: "error", message: "No se pudo consultar el catálogo." }, 502);
  }
}
