import { NextResponse } from "next/server";
import { z } from "zod";
import { type SteamGame, type SteamLibraryResponse, parseSteamProfile } from "@/lib/steam";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Lista de juegos de una cuenta de Steam. La clave vive solo en el servidor y
 * nunca aparece en respuestas ni mensajes de error.
 */

class SteamRefused extends Error {
  constructor(readonly status: number) {
    super("Steam rechazó la petición.");
  }
}

async function steam<T>(key: string, path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.steampowered.com/${path}/`);
  url.search = new URLSearchParams({ key, format: "json", ...params }).toString();
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new SteamRefused(res.status);
  return (await res.json()) as T;
}

interface Vanity {
  response?: { success?: number; steamid?: string };
}

interface Owned {
  response?: {
    game_count?: number;
    games?: { appid: number; name?: string; playtime_forever?: number; img_icon_url?: string }[];
  };
}

function toGames(owned: NonNullable<NonNullable<Owned["response"]>["games"]>): SteamGame[] {
  const seen = new Set<number>();
  return owned.flatMap((g) => {
    const name = g.name?.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!name || seen.has(g.appid)) return [];
    seen.add(g.appid);
    const hasIcon = /^[0-9a-f]{40}$/i.test(g.img_icon_url ?? "");
    return [
      {
        appId: g.appid,
        name,
        minutes: g.playtime_forever ?? 0,
        icon: hasIcon ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : null,
      },
    ];
  });
}

const reply = (body: SteamLibraryResponse, status = 200) => NextResponse.json<SteamLibraryResponse>(body, { status });

const NOT_FOUND = "No encuentro ese perfil. Abre tu perfil de Steam, copia su enlace y pégalo aquí.";

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return reply({ ok: false, reason: "no-autorizado", message: auth.message }, auth.status);

  const key = process.env.STEAM_API_KEY;
  if (!key) {
    return reply({
      ok: false,
      reason: "no-configurado",
      message: "Falta la clave de Steam. Añade STEAM_API_KEY en las variables de Vercel y vuelve a desplegar.",
    });
  }

  const body = z.object({ perfil: z.string().max(300) }).safeParse(await request.json().catch(() => null));
  const profile = body.success ? parseSteamProfile(body.data.perfil) : null;
  if (!profile) return reply({ ok: false, reason: "perfil", message: NOT_FOUND });

  try {
    let steamId: string;
    if (profile.kind === "id") {
      steamId = profile.steamId;
    } else {
      const found = await steam<Vanity>(key, "ISteamUser/ResolveVanityURL/v1", { vanityurl: profile.vanity });
      if (found.response?.success !== 1 || !found.response.steamid) return reply({ ok: false, reason: "perfil", message: NOT_FOUND });
      steamId = found.response.steamid;
    }

    const owned = await steam<Owned>(key, "IPlayerService/GetOwnedGames/v1", {
      steamid: steamId,
      include_appinfo: "1",
      include_played_free_games: "1",
    });
    // Con los detalles de los juegos ocultos, Steam responde sin ningún dato.
    if (owned.response?.game_count === undefined) {
      return reply({
        ok: false,
        reason: "privado",
        message: "Steam no deja ver tus juegos. En la privacidad de tu perfil, pon «Detalles de los juegos» como público y vuelve a buscar.",
      });
    }
    const games = toGames(owned.response.games ?? []);
    if (!games.length) return reply({ ok: false, reason: "vacio", message: "Esa cuenta de Steam no tiene juegos." });
    return reply({ ok: true, games });
  } catch (e) {
    const status = e instanceof SteamRefused ? e.status : 0;
    const message =
      status === 401 || status === 403
        ? "Steam ha rechazado la clave. Revisa STEAM_API_KEY en las variables de Vercel."
        : status === 429
          ? "Steam ha recibido demasiadas peticiones. Espera unos minutos y vuelve a buscar."
          : "Steam no ha respondido. Vuelve a intentarlo dentro de un momento.";
    return reply({ ok: false, reason: "error", message }, 502);
  }
}
