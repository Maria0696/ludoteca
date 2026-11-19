import { parseCsv } from "./csv";
import { GENRES_ES, PLATFORM_NAMES, guessMoods, mapModes } from "./igdb-maps";
import {
  type Copy,
  type Format,
  type Game,
  type Library,
  type Mood,
  type PlayMode,
  type WishItem,
  createCopy,
  createGame,
  newId,
  normalizeTitle,
  nowIso,
} from "./model";

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

export interface PlannedCopy {
  platform: string;
  format: Format;
  store: string | null;
}

/**
 * Copias que salen de un juego del archivo. Game Tracker no dice qué formato
 * va con qué plataforma: cuando no hay forma de saberlo, el juego queda para
 * revisar con todas las combinaciones, y la propietaria quita lo que sobra.
 */
export function planCopies(entry: GtEntry): { copies: PlannedCopy[]; doubtful: boolean } {
  const hasPc = entry.platforms.includes("PC");
  const consoles = entry.platforms.filter((p) => p !== "PC");
  const both = entry.formats.length === 2;
  const single = entry.formats.length === 1 ? entry.formats[0] : null;
  const copies: PlannedCopy[] = [];
  let doubtful = entry.platforms.length === 0;

  if (hasPc) {
    const format: Format = entry.formats.length === 0 || entry.formats.includes("digital") ? "digital" : "fisico";
    if (entry.stores.length) for (const store of entry.stores) copies.push({ platform: "PC", format, store });
    else copies.push({ platform: "PC", format, store: null });
  }
  for (const platform of consoles) {
    if (single) copies.push({ platform, format: single, store: null });
    else if (both && hasPc) copies.push({ platform, format: "fisico", store: null });
    else if (both && consoles.length === 1) copies.push({ platform, format: "fisico", store: null }, { platform, format: "digital", store: null });
    else if (both) {
      copies.push({ platform, format: "fisico", store: null }, { platform, format: "digital", store: null });
      doubtful = true;
    } else {
      copies.push({ platform, format: "fisico", store: null });
      doubtful = true;
    }
  }
  return { copies, doubtful };
}

/** nuevo: entra · dudoso: entra, pero conviene revisar sus copias · ya: está en la Ludoteca o repetido en el archivo. */
export type GtState = "nuevo" | "dudoso" | "ya";

export interface GtItem {
  /** Estable dentro de una lectura: la pantalla guarda selección y copias por él. */
  id: string;
  entry: GtEntry;
  state: GtState;
  copies: PlannedCopy[];
}

export interface GtCounts {
  juegos: number;
  copias: number;
  deseos: number;
  saltados: number;
}

/** Lo que ya tiene la Ludoteca (sin la demostración), por número de catálogo y por título. */
class Known {
  private readonly games = new Set<string>();
  private readonly wishes = new Set<string>();

  constructor(library: Library) {
    for (const g of library.games) if (!g.demo) this.add(this.games, g.title, g.igdbId);
    for (const w of library.wishlist) if (!w.demo) this.add(this.wishes, w.title, w.igdbId);
  }

  private keys(title: string, igdbId: number | null | undefined) {
    return igdbId ? [`t:${normalizeTitle(title)}`, `i:${igdbId}`] : [`t:${normalizeTitle(title)}`];
  }

  private add(set: Set<string>, title: string, igdbId: number | null | undefined) {
    for (const k of this.keys(title, igdbId)) set.add(k);
  }

  /** Un juego se salta si ya lo tienes; un deseo, también si ya está en la lista. */
  has(entry: GtEntry): boolean {
    const keys = this.keys(entry.title, entry.igdbId);
    return keys.some((k) => this.games.has(k) || (entry.wish && this.wishes.has(k)));
  }

  remember(entry: GtEntry) {
    this.add(entry.wish ? this.wishes : this.games, entry.title, entry.igdbId);
  }
}

export function classifyGameTracker(library: Library, entries: GtEntry[]): GtItem[] {
  const known = new Known(library);
  return entries.map((entry, i) => {
    const { copies, doubtful } = entry.wish ? { copies: [], doubtful: false } : planCopies(entry);
    const state: GtState = known.has(entry) ? "ya" : doubtful ? "dudoso" : "nuevo";
    known.remember(entry);
    return { id: `gt-${i}`, entry, state, copies };
  });
}

/**
 * Lo que se guarda de los elegidos. Vuelve a mirar la biblioteca actual, así
 * que repetir una tanda (o el archivo entero) no duplica nada.
 */
export function planGameTrackerImport(library: Library, items: GtItem[]): { games: Game[]; copies: Copy[]; wishlist: WishItem[]; counts: GtCounts } {
  const known = new Known(library);
  const games: Game[] = [];
  const copies: Copy[] = [];
  const wishlist: WishItem[] = [];
  const counts: GtCounts = { juegos: 0, copias: 0, deseos: 0, saltados: 0 };
  const stamp = nowIso();

  for (const { entry, copies: planned } of items) {
    if (known.has(entry)) {
      counts.saltados++;
      continue;
    }
    known.remember(entry);
    if (entry.wish) {
      wishlist.push({
        id: newId(),
        title: entry.title,
        coverUrl: entry.coverUrl,
        igdbId: entry.igdbId,
        platform: entry.platforms[0] ?? null,
        priority: "media",
        targetPrice: null,
        notes: null,
        genres: entry.genres,
        prices: [],
        createdAt: entry.createdAt,
        updatedAt: stamp,
      });
      counts.deseos++;
      continue;
    }
    const game = {
      ...createGame({
        title: entry.title,
        igdbId: entry.igdbId,
        coverUrl: entry.coverUrl,
        backdropUrl: entry.backdropUrl,
        genres: entry.genres,
        modes: entry.modes,
        moods: entry.moods,
        summary: entry.summary,
        developer: entry.developer,
        releaseDate: entry.releaseDate,
        criticRating: entry.criticRating,
      }),
      createdAt: entry.createdAt,
    };
    games.push(game);
    for (const c of planned) copies.push(createCopy(game.id, { platform: c.platform, format: c.format, store: c.store }));
    counts.juegos++;
    counts.copias += planned.length;
  }
  return { games, copies, wishlist, counts };
}
