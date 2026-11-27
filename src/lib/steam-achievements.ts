import { type SteamPlayerAchievement, type SteamSchemaAchievement, mergeAchievements } from "./achievements";
import type { Achievement } from "./model";

/*
 * Logros de Steam, desde el servidor (la clave nunca sale de aquí). Por cada juego, tres preguntas a la API oficial:
 * tus logros (GetPlayerAchievements), el esquema del juego (GetSchemaForGame: nombres, iconos y cuáles son ocultos) y
 * la rareza (GetGlobalAchievementPercentagesForApp, el % de jugadores que tienen cada uno). Los parseos son puros.
 */

const API = "https://api.steampowered.com";

type PlayerStats = { playerstats?: { success?: boolean; error?: string; achievements?: SteamPlayerAchievement[] } };

/** Tus logros de un juego, o por qué no hay: perfil privado, juego sin logros u otra respuesta. */
export function parsePlayer(json: unknown): { ok: true; items: SteamPlayerAchievement[] } | { ok: false; reason: "privado" | "sin-logros" | "error" } {
  const stats = (json as PlayerStats | null)?.playerstats;
  if (!stats) return { ok: false, reason: "error" };
  if (stats.success === false) {
    if (/not public/i.test(stats.error ?? "")) return { ok: false, reason: "privado" };
    if (/no stats/i.test(stats.error ?? "")) return { ok: false, reason: "sin-logros" };
    return { ok: false, reason: "error" };
  }
  // Un juego con estadísticas pero sin logros responde bien, sin la lista.
  if (!stats.achievements?.length) return { ok: false, reason: "sin-logros" };
  return { ok: true, items: stats.achievements };
}

type Schema = { game?: { availableGameStats?: { achievements?: (SteamSchemaAchievement & { icongray?: string })[] } } };

/** Del esquema del juego, lo que usa la app de cada logro. */
export function parseSchema(json: unknown): SteamSchemaAchievement[] {
  return ((json as Schema | null)?.game?.availableGameStats?.achievements ?? []).map(({ name, displayName, hidden, description, icon }) => ({
    name,
    ...(displayName !== undefined ? { displayName } : {}),
    ...(hidden !== undefined ? { hidden } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(icon !== undefined ? { icon } : {}),
  }));
}

type Percents = { achievementpercentages?: { achievements?: { name?: string; percent?: string | number }[] } };

/** El % de jugadores que tiene cada logro. Steam lo da como texto («81.8») y a veces como número. */
export function parsePercents(json: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of (json as Percents | null)?.achievementpercentages?.achievements ?? []) {
    const n = typeof a.percent === "number" ? a.percent : Number(a.percent);
    if (a.name && Number.isFinite(n)) out[a.name] = Math.min(100, Math.max(0, n));
  }
  return out;
}

/** Steam responde con error HTTP también al perfil privado (403) y al juego sin logros (400): se lee el cuerpo igual. */
async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 || res.status === 429 || res.status >= 500) throw new Error(`Steam respondió ${res.status}.`);
  return res.json().catch(() => null);
}

export type GameResult = { total: number; unlocked: number; items: Achievement[] } | "sin-logros" | "privado";

/** Los logros de un juego para un perfil, con nombre, rareza y fecha de cada uno. */
export async function fetchGameAchievements(key: string, steamId: string, appId: number): Promise<GameResult> {
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString();
  const [player, schema, percents] = await Promise.all([
    getJson(`${API}/ISteamUserStats/GetPlayerAchievements/v1/?${q({ key, steamid: steamId, appid: String(appId), l: "spanish" })}`),
    getJson(`${API}/ISteamUserStats/GetSchemaForGame/v2/?${q({ key, appid: String(appId), l: "spanish" })}`).catch(() => null),
    getJson(`${API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?${q({ gameid: String(appId) })}`).catch(() => null),
  ]);
  const mine = parsePlayer(player);
  if (!mine.ok) {
    if (mine.reason === "error") throw new Error("Steam no ha dado los logros.");
    return mine.reason;
  }
  return mergeAchievements(mine.items, parseSchema(schema), parsePercents(percents));
}

type Recent = { response?: { games?: { appid?: number }[] } };

/** Los juegos jugados en las últimas dos semanas. */
export async function fetchRecentAppIds(key: string, steamId: string): Promise<number[]> {
  const json = (await getJson(`${API}/IPlayerService/GetRecentlyPlayedGames/v1/?${new URLSearchParams({ key, steamid: steamId })}`)) as Recent | null;
  return (json?.response?.games ?? []).flatMap((g) => (Number.isInteger(g.appid) && g.appid! > 0 ? [g.appid!] : []));
}

/** Si Steam deja ver la lista de juegos del perfil: con los detalles de juego ocultos, responde sin ningún dato. */
export function gamesVisible(json: unknown): boolean {
  return (json as { response?: { game_count?: number } } | null)?.response?.game_count !== undefined;
}

/**
 * Si los detalles de juego del perfil son públicos. Hace falta porque, a un juego que no tienes en Steam (comprado en
 * otra tienda y enlazado por el título), GetPlayerAchievements le contesta lo mismo que a un perfil privado.
 */
export async function fetchGamesVisible(key: string, steamId: string): Promise<boolean> {
  return gamesVisible(await getJson(`${API}/IPlayerService/GetOwnedGames/v1/?${new URLSearchParams({ key, steamid: steamId, include_appinfo: "0" })}`));
}

type Summaries = { response?: { players?: { personaname?: string; avatarfull?: string; avatarmedium?: string }[] } };

/** Tu nombre y tu avatar de Steam (GetPlayerSummaries), para la tarjeta de Ajustes. */
export function parseSummary(json: unknown): { name: string; avatar: string | null } | null {
  const player = (json as Summaries | null)?.response?.players?.[0];
  if (!player?.personaname) return null;
  return { name: player.personaname, avatar: player.avatarfull ?? player.avatarmedium ?? null };
}

export async function fetchSummary(key: string, steamId: string): Promise<{ name: string; avatar: string | null } | null> {
  return parseSummary(await getJson(`${API}/ISteamUser/GetPlayerSummaries/v2/?${new URLSearchParams({ key, steamids: steamId })}`));
}
