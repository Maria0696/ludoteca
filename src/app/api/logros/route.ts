import { NextResponse } from "next/server";
import { z } from "zod";
import { type GameResult, fetchGameAchievements, fetchGamesVisible } from "@/lib/steam-achievements";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Logros de Steam de unos juegos (como mucho 10 por llamada) para un perfil: `{ steamId, appIds }` →
 * `{ games: { [appId]: { total, unlocked, items } }, sinLogros, noTuyos, failed }`. La app los pide en tandas. Si el
 * perfil no deja ver los detalles de los juegos, lo dice (`privado`) para que la app explique cómo cambiarlo. Steam
 * contesta igual a un juego que no tienes en Steam, así que antes de decir `privado` se comprueba si tu lista de
 * juegos se ve: si se ve, esos juegos van a `noTuyos`.
 */

export const maxDuration = 60;

const body = z.object({
  steamId: z.string().regex(/^\d{17}$/),
  appIds: z.array(z.number().int().positive()).min(1).max(10),
});

const fail = (status: number, reason: string, message: string) => NextResponse.json({ ok: false, reason, message }, { status });

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return fail(auth.status, "no-autorizado", auth.message);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "mal-pedido", "Hace falta un perfil de Steam (17 cifras) y de 1 a 10 juegos.");
  const key = process.env.STEAM_API_KEY;
  if (!key) return NextResponse.json({ ok: false, reason: "no-configurado", message: "Falta la clave de Steam (STEAM_API_KEY) en el servidor." });

  const { steamId, appIds } = parsed.data;
  const games: Record<string, Exclude<GameResult, string>> = {};
  const sinLogros: number[] = [];
  const failed: number[] = [];
  const privados: number[] = [];
  // De 3 en 3, para no pedirle a Steam demasiado a la vez.
  for (let i = 0; i < appIds.length; i += 3) {
    await Promise.all(
      appIds.slice(i, i + 3).map(async (appId) => {
        try {
          const result = await fetchGameAchievements(key, steamId, appId);
          if (result === "privado") privados.push(appId);
          else if (result === "sin-logros") sinLogros.push(appId);
          else games[String(appId)] = result;
        } catch {
          failed.push(appId);
        }
      }),
    );
  }
  let noTuyos: number[] = [];
  if (privados.length) {
    const visible = await fetchGamesVisible(key, steamId).catch(() => null);
    if (visible) noTuyos = privados;
    // Sin poder comprobarlo, si algún juego ha llegado el perfil no es privado: los demás quedan para otra vez.
    else if (visible === null && Object.keys(games).length) failed.push(...privados);
  }
  if (privados.length && !noTuyos.length && !Object.keys(games).length) {
    return NextResponse.json({
      ok: false,
      reason: "privado",
      message: "Steam no deja ver tus logros. En tu perfil de Steam → Editar perfil → Privacidad, pon «Detalles de juego» en Público.",
    });
  }
  return NextResponse.json({ ok: true, games, sinLogros, noTuyos, failed });
}
