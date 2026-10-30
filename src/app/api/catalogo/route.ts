import { NextResponse } from "next/server";
import type { CatalogGame, CatalogResponse } from "@/lib/catalog";
import type { Mood, PlayMode } from "@/lib/model";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Búsqueda en el catálogo de IGDB (gratuito para uso no comercial con una
 * aplicación de Twitch). Las claves viven solo en el servidor; el navegador
 * nunca las ve. Sin claves, la ruta responde «no-configurado» y la app sigue
 * funcionando con datos introducidos a mano.
 */

const clientId = process.env.IGDB_CLIENT_ID;
const clientSecret = process.env.IGDB_CLIENT_SECRET;

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("client_secret", clientSecret!);
  url.searchParams.set("grant_type", "client_credentials");
  const res = await fetch(url, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`Twitch rechazó las credenciales (${res.status}).`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function igdb<T>(endpoint: string, body: string): Promise<T> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": clientId!, Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (res.status === 401) token = null;
  if (!res.ok) throw new Error(`IGDB respondió ${res.status}.`);
  return (await res.json()) as T;
}

interface IgdbGame {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  genres?: { name: string }[];
  themes?: { name: string }[];
  platforms?: { abbreviation?: string; name: string }[];
  game_modes?: { name: string }[];
}

const GENRES_ES: Record<string, string> = {
  "Role-playing (RPG)": "Rol",
  Adventure: "Aventura",
  Platform: "Plataformas",
  Puzzle: "Puzles",
  Shooter: "Disparos",
  Strategy: "Estrategia",
  Simulator: "Simulación",
  Racing: "Carreras",
  Sport: "Deportes",
  Fighting: "Lucha",
  "Hack and slash/Beat 'em up": "Acción",
  Indie: "Independiente",
  Arcade: "Arcade",
  "Turn-based strategy (TBS)": "Estrategia por turnos",
  "Real Time Strategy (RTS)": "Estrategia en tiempo real",
  Tactical: "Táctico",
  "Visual Novel": "Novela visual",
  "Card & Board Game": "Cartas y tablero",
  Music: "Música",
  "Point-and-click": "Aventura gráfica",
  MOBA: "MOBA",
  Pinball: "Pinball",
  Quiz: "Preguntas",
};

const PLATFORM_NAMES: Record<string, string> = {
  PS5: "PS5",
  PS4: "PS4",
  Switch: "Switch",
  "Switch 2": "Switch 2",
  NSW: "Switch",
  NSW2: "Switch 2",
  "Series X|S": "Xbox Series",
  XONE: "Xbox One",
  PC: "PC",
  "Steam Deck": "Steam Deck",
};

function mapModes(modes: { name: string }[] = []): PlayMode[] {
  const out = new Set<PlayMode>();
  for (const { name } of modes) {
    if (name === "Single player") out.add("solo");
    if (name === "Co-operative") out.add("coop_online");
    if (name === "Split screen") out.add("coop_local");
    if (name === "Multiplayer" || name === "Battle Royale") out.add("competitivo");
  }
  return [...out];
}

function guessMoods(g: IgdbGame): Mood[] {
  const names = new Set([...(g.genres ?? []), ...(g.themes ?? [])].map((x) => x.name));
  const out = new Set<Mood>();
  if (names.has("Action") || names.has("Shooter") || names.has("Fighting") || names.has("Hack and slash/Beat 'em up")) out.add("accion");
  if (names.has("Drama") || names.has("Mystery") || names.has("Visual Novel") || names.has("Role-playing (RPG)")) out.add("historia");
  if (names.has("Simulator") || names.has("Sandbox") || names.has("Puzzle")) out.add("tranquila");
  if (names.has("Arcade") || names.has("Party") || names.has("Racing")) out.add("rapida");
  return [...out];
}

export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) {
    return NextResponse.json<CatalogResponse>({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  }
  if (!clientId || !clientSecret) {
    return NextResponse.json<CatalogResponse>({
      ok: false,
      reason: "no-configurado",
      message: "La búsqueda de carátulas aún no está configurada. Puedes escribir los datos a mano.",
    });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json<CatalogResponse>({ ok: true, results: [] });

  try {
    const safe = q.replace(/["\\]/g, " ").slice(0, 80);
    const games = await igdb<IgdbGame[]>(
      "games",
      `search "${safe}"; fields name,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,themes.name,platforms.abbreviation,platforms.name,game_modes.name; where version_parent = null; limit 8;`,
    );
    const ids = games.map((g) => g.id);
    const times = ids.length
      ? await igdb<{ game_id: number; normally?: number; hastily?: number }[]>(
          "game_time_to_beats",
          `fields game_id,normally,hastily; where game_id = (${ids.join(",")}); limit 8;`,
        ).catch(() => [])
      : [];
    const timeById = new Map(times.map((t) => [t.game_id, t.normally ?? t.hastily ?? null]));

    const results: CatalogGame[] = games.map((g) => {
      const seconds = timeById.get(g.id);
      const art = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id;
      return {
        igdbId: g.id,
        title: g.name,
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
        coverUrl: g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${g.cover.image_id}.jpg` : null,
        backdropUrl: art ? `https://images.igdb.com/igdb/image/upload/t_1080p/${art}.jpg` : null,
        genres: [...new Set((g.genres ?? []).map((x) => GENRES_ES[x.name] ?? x.name))],
        platforms: [...new Set((g.platforms ?? []).map((p) => PLATFORM_NAMES[p.abbreviation ?? ""] ?? p.abbreviation ?? p.name))],
        modes: mapModes(g.game_modes),
        moods: guessMoods(g),
        lengthHours: seconds ? Math.round((seconds / 3600) * 2) / 2 : null,
      };
    });
    return NextResponse.json<CatalogResponse>({ ok: true, results });
  } catch (e) {
    return NextResponse.json<CatalogResponse>(
      { ok: false, reason: "error", message: e instanceof Error ? e.message : "No se pudo consultar el catálogo." },
      { status: 502 },
    );
  }
}
