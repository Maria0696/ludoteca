import { NextResponse } from "next/server";
import { z } from "zod";
import { igdbConfigured, steamIdsByIgdbIds } from "@/lib/igdb";
import { authorizeRequest } from "@/lib/supabase/server";

/** El número de Steam de cada deseo de PC que vino de IGDB, para mirar su precio: `{ igdbIds }` → `{ igdbId: número }`. */
const body = z.object({ igdbIds: z.array(z.number().int().positive()).min(1).max(500) });

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  if (!igdbConfigured) return NextResponse.json({ ok: false, reason: "no-configurado", message: "La búsqueda en IGDB aún no está configurada." });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "mal-pedido", message: "La lista de juegos no es válida." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, steam: await steamIdsByIgdbIds(parsed.data.igdbIds) });
  } catch {
    return NextResponse.json({ ok: false, reason: "sin-respuesta", message: "IGDB no responde ahora." }, { status: 502 });
  }
}
