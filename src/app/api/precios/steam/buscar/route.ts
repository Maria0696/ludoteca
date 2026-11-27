import { NextResponse } from "next/server";
import { searchSteam } from "@/lib/store-prices";
import { authorizeRequest } from "@/lib/supabase/server";

/** Juegos de la tienda de Steam que podrían ser un deseo de PC, con su precio: para enlazarlo o elegir. */
export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 200) {
    return NextResponse.json({ ok: false, reason: "mal-pedido", message: "Hace falta un título." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, candidates: await searchSteam(q) });
  } catch {
    return NextResponse.json({ ok: false, reason: "sin-respuesta", message: "Steam no responde ahora." }, { status: 502 });
  }
}
