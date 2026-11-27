import { NextResponse } from "next/server";
import { fetchRecentAppIds } from "@/lib/steam-achievements";
import { authorizeRequest } from "@/lib/supabase/server";

/** Los juegos de Steam jugados en las últimas dos semanas: los que se miran cada día. */
export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  const steamId = new URL(request.url).searchParams.get("steamId") ?? "";
  if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ ok: false, reason: "mal-pedido", message: "Hace falta un perfil de Steam (17 cifras)." }, { status: 400 });
  const key = process.env.STEAM_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "no-configurado", message: "Falta la clave de Steam (STEAM_API_KEY) en el servidor." });
  try {
    return NextResponse.json({ ok: true, appIds: await fetchRecentAppIds(key, steamId) });
  } catch {
    return NextResponse.json({ ok: false, reason: "sin-respuesta", message: "Steam no responde ahora." }, { status: 502 });
  }
}
