import { parseCsv } from "./csv";
import { GENRES_ES, PLATFORM_NAMES, guessMoods, mapModes } from "./igdb-maps";
import { type Format, type Mood, type PlayMode, nowIso } from "./model";

/*
 * Mudanza desde Game Tracker: su exportación en CSV (separada por «;») se lee
 * en el navegador y se traduce a la Ludoteca. El archivo ya trae carátula y
 * ficha del catálogo de IGDB, así que no hace falta preguntar al servidor.
 */

export interface GtEntry {
  title: string;
  igdbId: number | null;
  wish: boolean;
  /** Ya traducidas, sin visores de realidad virtual y sin repetir. */
  platforms: string[];
  /** Tiendas de PC (Steam, Epic Games…), tal como vienen. */
  stores: string[];
  formats: Format[];
  coverUrl: string | null;
  backdropUrl: string | null;
  summary: string | null;
  genres: string[];
  modes: PlayMode[];
  moods: Mood[];
  developer: string | null;
  releaseDate: string | null;
  criticRating: number | null;
  createdAt: string;
}

export type GtParse = { ok: true; entries: GtEntry[] } | { ok: false; message: string };

const REQUIRED = ["title", "source", "externalId", "spaces", "userPlatforms", "formats", "tags"] as const;
const NOT_GAME_TRACKER = "Este archivo no parece una exportación de Game Tracker.";
/** Los visores se enchufan a una consola: no son una plataforma con copia propia. */
const ACCESSORIES = new Set(["PlayStation VR", "PlayStation VR2"]);
const SUMMARY_MAX = 2000;

/** Plataforma de Game Tracker en la Ludoteca; `null` si es un accesorio. */
export function gtPlatform(name: string): string | null {
  const clean = name.trim();
  if (ACCESSORIES.has(clean)) return null;
  return PLATFORM_NAMES[clean] ?? clean;
}

const list = (value: string | undefined) =>
  (value ?? "")
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);

const text = (value: string | undefined) => value?.trim() || null;

function imageUrl(url: string | undefined, size: string): string | null {
  const clean = url?.trim();
  return clean ? clean.replace(/\/t_[a-z0-9_]+\//, `/${size}/`) : null;
}

function readEntry(get: (column: string) => string | undefined): GtEntry | null {
  const title = get("title")?.trim();
  if (!title) return null;
  const source = get("source")?.trim();
  const externalId = Number(get("externalId"));
  const genres = list(get("genres"));
  const rating = Number(get("externalRating"));
  const created = get("createdAt")?.trim() ?? "";
  const release = get("firstReleaseDate")?.trim() ?? "";
  const formats = list(get("formats"))
    .map((f) => (f === "PHYSICAL" ? "fisico" : f === "DIGITAL" ? "digital" : null))
    .filter((f): f is Format => f !== null);
  const platforms = list(get("userPlatforms"))
    .map(gtPlatform)
    .filter((p): p is string => p !== null);
  return {
    title,
    igdbId: (source === "igdb" || source === "igdbModified") && Number.isInteger(externalId) && externalId > 0 ? externalId : null,
    wish: get("spaces")?.trim() === "Deseos",
    platforms: [...new Set(platforms)],
    stores: [...new Set(list(get("tags")))],
    formats: [...new Set(formats)],
    coverUrl: imageUrl(get("cover"), "t_cover_big_2x"),
    backdropUrl: imageUrl(list(get("artworks"))[0], "t_1080p"),
    summary: text(get("summary"))?.slice(0, SUMMARY_MAX) ?? null,
    genres: [...new Set(genres.map((g) => GENRES_ES[g] ?? g))],
    modes: mapModes(list(get("gameModes"))),
    moods: guessMoods(genres),
    developer: list(get("developers"))[0] ?? null,
    releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(release) ? release : null,
    criticRating: Number.isFinite(rating) && rating > 0 ? Math.round(rating) : null,
    createdAt: /^\d{4}-\d{2}-\d{2}$/.test(created) ? `${created}T12:00:00.000Z` : nowIso(),
  };
}

/** Lee la exportación entera; las columnas se buscan por nombre. */
export function parseGameTracker(content: string): GtParse {
  const [header, ...rows] = parseCsv(content);
  const index = new Map((header ?? []).map((name, i) => [name.trim(), i]));
  if (!REQUIRED.every((c) => index.has(c))) return { ok: false, message: NOT_GAME_TRACKER };
  const entries: GtEntry[] = [];
  for (const cells of rows) {
    const entry = readEntry((column) => {
      const i = index.get(column);
      return i === undefined ? undefined : cells[i];
    });
    if (entry) entries.push(entry);
  }
  return { ok: true, entries };
}
