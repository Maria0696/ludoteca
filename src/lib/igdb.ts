import "server-only";
import type { CatalogGame } from "./catalog";
import {
  GENRES_ES,
  type IgdbCollection,
  OWN_SERIES_FIELDS,
  PLATFORM_NAMES,
  SERIES_FIELDS,
  SIMPLE_SERIES_FIELDS,
  guessMoods,
  mapModes,
  seriesForIgdbGame,
  singleGameSeries,
} from "./igdb-maps";

/*
 * Consultas al catálogo de IGDB (gratuito para uso no comercial con una
 * aplicación de Twitch). Las claves viven solo en el servidor; el navegador
 * nunca las ve.
 */

const clientId = process.env.IGDB_CLIENT_ID;
const clientSecret = process.env.IGDB_CLIENT_SECRET;

export const igdbConfigured = Boolean(clientId && clientSecret);

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

async function igdb<T>(endpoint: string, body: string, retried = false): Promise<T> {
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: { "Client-ID": clientId!, Authorization: `Bearer ${await getToken()}`, Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (res.status === 401) token = null;
  // IGDB admite 4 peticiones por segundo: al pasarse, se espera y se repite una vez.
  if (res.status === 429 && !retried) {
    await new Promise((resolve) => setTimeout(resolve, 1100));
    return igdb(endpoint, body, true);
  }
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
  aggregated_rating?: number;
  summary?: string;
  franchise?: { name: string };
  franchises?: { name: string }[];
  collections?: IgdbCollection[];
  version_parent?: Pick<IgdbGame, "franchise" | "franchises" | "collections">;
  parent_game?: Pick<IgdbGame, "franchise" | "franchises" | "collections">;
  involved_companies?: { developer?: boolean; company?: { name: string } }[];
  age_ratings?: { organization?: { name: string }; rating_category?: { rating: string } }[];
}

const BASE_FIELDS =
  "name,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,themes.name,platforms.abbreviation,platforms.name,game_modes.name,aggregated_rating";
const DETAIL_FIELDS = `summary,${SERIES_FIELDS},involved_companies.developer,involved_companies.company.name,age_ratings.organization.name,age_ratings.rating_category.rating`;

const PEGI_AGES: Record<string, string> = { Three: "3", Seven: "7", Twelve: "12", Sixteen: "16", Eighteen: "18" };

function pegiRating(ratings: IgdbGame["age_ratings"] = []): string | null {
  const rating = ratings.find((r) => /pegi/i.test(r.organization?.name ?? ""))?.rating_category?.rating;
  if (!rating) return null;
  const age = rating.match(/\d+/)?.[0] ?? PEGI_AGES[rating];
  return age ? `PEGI ${age}` : null;
}

/**
 * Pide juegos al catálogo. `query` recibe los campos y devuelve la consulta completa.
 * Con `requireTimes`, un fallo al pedir la duración es un error y no «no la tiene».
 */
export async function fetchCatalogGames(query: (fields: string) => string, options: { requireTimes?: boolean } = {}): Promise<CatalogGame[]> {
  // Si IGDB rechaza los detalles, la búsqueda sigue funcionando con lo básico.
  const games = await igdb<IgdbGame[]>("games", query(`${BASE_FIELDS},${DETAIL_FIELDS}`)).catch(() => igdb<IgdbGame[]>("games", query(BASE_FIELDS)));
  const ids = games.map((g) => g.id);
  const times = ids.length
    ? await igdb<{ game_id: number; normally?: number; hastily?: number; completely?: number }[]>(
        "game_time_to_beats",
        `fields game_id,normally,hastily,completely; where game_id = (${ids.join(",")}); limit ${ids.length};`,
      ).catch((e: unknown) => {
        if (options.requireTimes) throw e;
        return [];
      })
    : [];
  const timeById = new Map(times.map((t) => [t.game_id, t.normally ?? t.hastily ?? t.completely ?? null]));

  return games.map((g) => {
    const seconds = timeById.get(g.id);
    const art = g.artworks?.[0]?.image_id ?? g.screenshots?.[0]?.image_id;
    const critics = g.aggregated_rating;
    return {
      igdbId: g.id,
      title: g.name,
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      coverUrl: g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${g.cover.image_id}.jpg` : null,
      backdropUrl: art ? `https://images.igdb.com/igdb/image/upload/t_1080p/${art}.jpg` : null,
      genres: [...new Set((g.genres ?? []).map((x) => GENRES_ES[x.name] ?? x.name))],
      platforms: [...new Set((g.platforms ?? []).map((p) => PLATFORM_NAMES[p.abbreviation ?? ""] ?? PLATFORM_NAMES[p.name] ?? p.abbreviation ?? p.name))],
      modes: mapModes((g.game_modes ?? []).map((x) => x.name)),
      moods: guessMoods([...(g.genres ?? []), ...(g.themes ?? [])].map((x) => x.name)),
      lengthHours: seconds ? Math.round((seconds / 3600) * 2) / 2 : null,
      // Un valor fuera de escala impediría guardar el juego: mejor sin nota.
      criticRating: critics != null && critics >= 0 && critics <= 100 ? Math.round(critics) : null,
      summary: g.summary?.trim().slice(0, 2000) || null,
      developer: (g.involved_companies ?? []).flatMap((c) => (c.developer && c.company ? [c.company.name] : [])).join(", ").slice(0, 2000) || null,
      franchise: franchiseOf(g),
      saga: seriesForIgdbGame(g),
      releaseDate: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
      ageRating: pegiRating(g.age_ratings),
    };
  });
}

const franchiseOf = (g: IgdbGame) => g.franchise?.name ?? g.franchises?.[0]?.name ?? g.collections?.[0]?.name ?? null;

/**
 * La saga de cada juego de IGDB, por su número, y las series suyas que son un solo juego (para limpiar las que ya se
 * pusieron): solo lo necesario para elegirla.
 */
export async function seriesByIgdbIds(ids: number[]): Promise<{ sagas: Record<string, string | null>; single?: Record<string, string[]> }> {
  const query = (fields: string) => `fields ${fields}; where id = (${ids.join(",")}); limit ${ids.length};`;
  const full = await igdb<IgdbGame[]>("games", query(SERIES_FIELDS)).catch(() => null);
  const sagas = (games: IgdbGame[]) => Object.fromEntries(games.map((g) => [String(g.id), seriesForIgdbGame(g)]));
  if (full) return { sagas: sagas(full), single: Object.fromEntries(full.map((g) => [String(g.id), singleGameSeries(g)])) };
  // Si IGDB no acepta tanto detalle, con menos (sin el juego original, si hace falta) y sin saber qué series son un solo juego.
  const games = await igdb<IgdbGame[]>("games", query(SIMPLE_SERIES_FIELDS)).catch(() => igdb<IgdbGame[]>("games", query(OWN_SERIES_FIELDS)));
  return { sagas: sagas(games) };
}

/**
 * Los juegos de una serie de IGDB, por su nombre: los principales, rehechos y remasterizados (sin ediciones ni
 * contenidos descargables), por fecha. Si IGDB no acepta el filtro de tipo, se piden todos.
 */
export async function gamesOfSeries(name: string): Promise<CatalogGame[]> {
  const quoted = name.replace(/\\/g, "").replace(/"/g, '\\"');
  const found = await igdb<{ name: string; games?: number[] }[]>("collections", `fields name,games; where name ~ "${quoted}"; limit 10;`);
  const series = found.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? found[0];
  const ids = (series?.games ?? []).slice(0, 100);
  if (!ids.length) return [];
  const where = `where id = (${ids.join(",")}) & version_parent = null`;
  const games = await fetchCatalogGames((fields) => `fields ${fields}; ${where} & game_type = (0,8,9); limit ${ids.length};`).catch(() =>
    fetchCatalogGames((fields) => `fields ${fields}; ${where}; limit ${ids.length};`),
  );
  return games.sort((a, b) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999"));
}

interface SteamLink {
  game: number;
  uid: string;
}

/** Busca en IGDB los juegos con estos números de Steam. Los que no estén, no vuelven. */
export async function catalogBySteamIds(appIds: number[]): Promise<Record<number, CatalogGame>> {
  const uids = appIds.map((id) => `"${id}"`).join(",");
  const links = (field: string) => igdb<SteamLink[]>("external_games", `fields game,uid; where ${field} = 1 & uid = (${uids}); limit 500;`);
  // `category` está en desuso, pero sigue siendo la referencia documentada de Steam (1).
  let found = await links("external_game_source").catch((): SteamLink[] => []);
  if (!found.length) found = await links("category");
  if (!found.length) return {};

  const ids = [...new Set(found.map((l) => l.game))];
  const games = await fetchCatalogGames((fields) => `fields ${fields}; where id = (${ids.join(",")}); limit ${ids.length};`);
  const byId = new Map(games.map((g) => [g.igdbId, g]));
  const out: Record<number, CatalogGame> = {};
  for (const { uid, game } of found) {
    const match = byId.get(game);
    if (match) out[Number(uid)] = match;
  }
  return out;
}
