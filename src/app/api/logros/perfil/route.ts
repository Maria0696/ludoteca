import { NextResponse } from "next/server";
import { fetchGamesVisible, fetchSummary } from "@/lib/steam-achievements";
import { authorizeRequest } from "@/lib/supabase/server";

/** Tu perfil de Steam para la tarjeta de Ajustes: nombre, avatar y si deja ver tus juegos (y con ellos, tus logros). */
export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  const steamId = new URL(request.url).searchParams.get("steamId") ?? "";
  if (!/^\d{17}$/.test(steamId)) return NextResponse.json({ ok: false, reason: "mal-pedido", message: "Hace falta un perfil de Steam (17 cifras)." }, { status: 400 });
  const key = process.env.STEAM_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "no-configurado", message: "Falta la clave de Steam (STEAM_API_KEY) en el servidor." });
  try {
    const [summary, gamesVisible] = await Promise.all([fetchSummary(key, steamId), fetchGamesVisible(key, steamId)]);
    if (!summary) return NextResponse.json({ ok: false, reason: "perfil", message: "Steam no encuentra ese perfil." });
    return NextResponse.json({ ok: true, ...summary, gamesVisible });
  } catch {
    return NextResponse.json({ ok: false, reason: "sin-respuesta", message: "Steam no responde ahora." }, { status: 502 });
  }
}
