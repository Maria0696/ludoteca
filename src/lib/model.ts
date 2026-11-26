import { z } from "zod";
import type { YearWrapData } from "./anuario";

/*
 * Modelo de la colección.
 *
 * Un `Game` es la obra (el título que juegas, valoras y terminas).
 * Una `Copy` es un ejemplar que posees de esa obra: plataforma, edición,
 * formato y procedencia. Un mismo juego puede tener varias copias.
 * El estado de juego, la valoración y las horas pertenecen al juego;
 * el precio, la tienda y la estantería pertenecen a cada copia.
 */

export const GAME_STATUSES = ["pendiente", "jugando", "pausado", "completado", "abandonado"] as const;
export const FORMATS = ["fisico", "digital"] as const;
export const AVAILABILITIES = ["comprado", "prestado", "suscripcion"] as const;
export const PLAY_MODES = ["solo", "coop_local", "coop_online", "competitivo"] as const;
export const MOODS = ["tranquila", "historia", "accion", "reto", "rapida"] as const;
export const PRIORITIES = ["alta", "media", "baja"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];
export type Format = (typeof FORMATS)[number];
export type Availability = (typeof AVAILABILITIES)[number];
export type PlayMode = (typeof PLAY_MODES)[number];
export type Mood = (typeof MOODS)[number];
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<GameStatus, string> = {
  pendiente: "Pendiente",
  jugando: "Jugando",
  pausado: "Pausado",
  completado: "Completado",
  abandonado: "Abandonado",
};

export const FORMAT_LABEL: Record<Format, string> = { fisico: "Físico", digital: "Digital" };

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  comprado: "Comprado",
  prestado: "Prestado por alguien",
  suscripcion: "Suscripción",
};

/** Por qué una copia no tiene importe. Sin motivo, es que se pagó (o falta anotar cuánto). */
export const PRICE_KINDS = ["regalo", "gratis", "pack", "desconocido"] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];
export const PRICE_KIND_LABEL: Record<PriceKind, string> = { regalo: "Regalo", gratis: "Gratis", pack: "En un pack", desconocido: "No lo sé" };

export const MODE_LABEL: Record<PlayMode, string> = {
  solo: "Un jugador",
  coop_local: "Cooperativo local",
  coop_online: "Cooperativo en línea",
  competitivo: "Competitivo",
};

export const MOOD_LABEL: Record<Mood, string> = {
  tranquila: "Tranquila",
  historia: "Historia",
  accion: "Acción",
  reto: "Reto",
  rapida: "Partida rápida",
};

export const PRIORITY_LABEL: Record<Priority, string> = { alta: "Alta", media: "Media", baja: "Baja" };

/** Consolas conocidas por familia y por año de salida, de la más nueva a la más antigua; los visores, al final de su familia. */
export const PLATFORM_FAMILIES: readonly { name: string; platforms: readonly string[] }[] = [
  { name: "PlayStation", platforms: ["PS5", "PS4", "PS Vita", "PS3", "PSP", "PS2", "PS1", "PS VR2", "PS VR"] },
  { name: "Xbox", platforms: ["Xbox Series", "Xbox 360", "Xbox"] },
  { name: "Nintendo", platforms: ["Switch 2", "Switch", "Wii U", "3DS", "Wii", "DS", "GameCube", "GBA", "N64", "SNES", "Game Boy", "NES"] },
  { name: "Otras", platforms: ["PC", "Meta Quest", "Oculus Rift", "Dreamcast", "Mega Drive"] },
];

export const DEFAULT_PLATFORMS = PLATFORM_FAMILIES.flatMap((family) => family.platforms);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato AAAA-MM-DD");
const optionalText = z.string().trim().max(2000).nullish();

/** Qué es el juego, con los tipos de IGDB (y «edición» para las versiones de otro juego: Definitive, GOTY…). */
export const GAME_TYPES = [
  "main",
  "dlc",
  "expansion",
  "standalone_expansion",
  "bundle",
  "remake",
  "remaster",
  "expanded",
  "port",
  "edition",
  "episode",
  "season",
  "pack",
  "update",
  "mod",
  "fork",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

/** La marca de una parada en el mapa de su saga: principal (número), opcional (estrella) o DLC (pieza de puzle). */
export const SAGA_ROLES = ["main", "optional", "dlc"] as const;
export type SagaRole = (typeof SAGA_ROLES)[number];
/** De qué juego es versión (su número de IGDB); 0 = parada propia, decidido. Sin él, aún no se sabe. */
const versionOf = z.number().int().min(0).max(2_147_483_647).nullish();

export const gameSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  coverUrl: z.string().max(2_000_000).nullish(),
  /** Arte apaisado para los fondos; si falta, se usa la carátula difuminada. */
  backdropUrl: z.string().max(2_000_000).nullish(),
  igdbId: z.number().int().nullish(),
  /** Número del juego en Steam, si llegó desde allí. */
  steamAppId: z.number().int().positive().nullish(),
  genres: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  status: z.enum(GAME_STATUSES).default("pendiente"),
  completed100: z.boolean().default(false),
  /** Sin final (Mario Kart, Stardew…): no se completa, se juega. */
  endless: z.boolean().default(false),
  favorite: z.boolean().default(false),
  rating: z.number().min(0).max(10).nullish(),
  /** Nota de Metacritic, apuntada a mano. */
  metacritic: z.number().int().min(0).max(100).nullish(),
  /** Media de la crítica según IGDB; la trae el catálogo. */
  criticRating: z.number().int().min(0).max(100).nullish(),
  // Ficha técnica: la trae el catálogo y se puede corregir a mano.
  summary: optionalText,
  developer: optionalText,
  /** La franquicia: Star Wars. */
  franchise: optionalText,
  /** La saga dentro de la franquicia (la serie de IGDB o puesta a mano): Star Wars Jedi dentro de Star Wars. */
  saga: optionalText,
  /** Su puesto en la cronología de la saga, puesto a mano; sin él, cuenta el de lanzamiento. */
  sagaOrder: z.number().int().min(1).max(10000).nullish(),
  /** Quitado del apartado Sagas (él o su saga entera): la ficha conserva su saga; Traer lo vuelve a proponer. */
  sagaHidden: z.boolean().optional(),
  /** Qué es: juego base, DLC, remake, remaster… */
  gameType: z.enum(GAME_TYPES).nullish(),
  /** De qué juego es, si es DLC, expansión, edición…: «God of War Ragnarök». */
  baseGame: optionalText,
  /** Su marca en el mapa de la saga; sin ella, según su tipo (los DLC, con la pieza de puzle). */
  sagaRole: z.enum(SAGA_ROLES).nullish(),
  versionOf,
  releaseDate: isoDate.nullish(),
  ageRating: optionalText,
  hoursPlayed: z.number().min(0).max(100000).nullish(),
  notes: optionalText,
  // La vuelta en curso: su inicio y su fin.
  startedAt: isoDate.nullish(),
  finishedAt: isoDate.nullish(),
  /** Las vueltas anteriores, ya terminadas, al rejugar un juego superado. Las copias antiguas no las traen. */
  pastRuns: z.array(z.object({ start: isoDate.nullable(), end: isoDate })).default([]),
  lastPlayedAt: isoDate.nullish(),
  modes: z.array(z.enum(PLAY_MODES)).default([]),
  moods: z.array(z.enum(MOODS)).default([]),
  sessionMinutes: z.number().int().min(1).max(1440).nullish(),
  lengthHours: z.number().min(0).max(100000).nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  demo: z.boolean().optional(),
});

export const copySchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  platform: z.string().trim().min(1, "Elige una plataforma").max(40),
  edition: optionalText,
  format: z.enum(FORMATS),
  availability: z.enum(AVAILABILITIES).default("comprado"),
  subscriptionService: optionalText,
  acquiredAt: isoDate.nullish(),
  pricePaid: z.number().min(0).max(100000).nullish(),
  priceKind: z.enum(PRICE_KINDS).nullish(),
  /** Con qué juego venía, si llegó en un pack. */
  bundleWith: optionalText,
  store: optionalText,
  // Estantería: campos opcionales, válidos también para copias digitales con caja decorativa.
  hasCase: z.boolean().nullish(),
  hasFullArtwork: z.boolean().nullish(),
  artworkUrl: optionalText,
  shelfLocation: optionalText,
  lentTo: optionalText,
  lentAt: isoDate.nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  demo: z.boolean().optional(),
});

export const priceRecordSchema = z.object({
  id: z.string().min(1),
  amount: z.number().min(0).max(100000),
  store: optionalText,
  date: isoDate,
});

export const wishSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  coverUrl: z.string().max(2_000_000).nullish(),
  igdbId: z.number().int().nullish(),
  platform: optionalText,
  priority: z.enum(PRIORITIES).default("media"),
  targetPrice: z.number().min(0).max(100000).nullish(),
  notes: optionalText,
  genres: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  prices: z.array(priceRecordSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  demo: z.boolean().optional(),
});

/** Un juego de una saga que no tienes: lo metes a mano (buscándolo en IGDB) para verlo en su sitio del mapa. */
export const sagaExtraSchema = z.object({
  id: z.string().min(1),
  saga: z.string().trim().min(1).max(200),
  igdbId: z.number().int().nullish(),
  title: z.string().trim().min(1).max(200),
  coverUrl: z.string().max(2_000_000).nullish(),
  releaseDate: isoDate.nullish(),
  sagaOrder: z.number().int().min(1).max(10000).nullish(),
  /** Su saga se quitó del apartado Sagas: se guarda para cuando vuelva. */
  hidden: z.boolean().optional(),
  gameType: z.enum(GAME_TYPES).nullish(),
  sagaRole: z.enum(SAGA_ROLES).nullish(),
  versionOf,
  createdAt: z.string(),
  updatedAt: z.string(),
  demo: z.boolean().optional(),
});

/**
 * Un año del Anuario congelado: el resumen tal como era al cerrarlo (ver `computeYear` en anuario.ts). Uno por año.
 */
export const yearWrapSchema = z.object({
  id: z.string().min(1),
  year: z.number().int().min(1970).max(2200),
  data: z.custom<YearWrapData>((v) => typeof v === "object" && v !== null && (v as { version?: unknown }).version === 1),
  frozenAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Game = z.infer<typeof gameSchema>;
export type Copy = z.infer<typeof copySchema>;
export type PriceRecord = z.infer<typeof priceRecordSchema>;
export type WishItem = z.infer<typeof wishSchema>;
export type SagaExtra = z.infer<typeof sagaExtraSchema>;
export type YearWrap = z.infer<typeof yearWrapSchema>;
export type NewExtraInput = Omit<SagaExtra, "id" | "createdAt" | "updatedAt">;

export interface Library {
  games: Game[];
  copies: Copy[];
  wishlist: WishItem[];
  /** Juegos de saga que no tienes. */
  extras: SagaExtra[];
  /** Los años del Anuario ya congelados. */
  wraps: YearWrap[];
}

export const emptyLibrary = (): Library => ({ games: [], copies: [], wishlist: [], extras: [], wraps: [] });

/*
 * Formato 1 de los datos guardados (hasta noviembre de 2026): «saga» era la franquicia, «series» la saga y
 * «seriesOrder» su puesto; lo descartado se llamaba «Sin historia» y «Sin saga» como franquicia era no tenerla.
 * Las copias de seguridad y el almacén del navegador de entonces se pasan al formato 2 al leerlos.
 */
type Raw = Record<string, unknown>;
const isRaw = (x: unknown): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x);
const lower = (x: unknown) => (typeof x === "string" ? x.trim().toLowerCase() : null);

/** Un juego del formato 1, en el formato 2. */
export function upgradeGameV1(game: unknown): unknown {
  if (!isRaw(game)) return game;
  const { saga, series, seriesOrder, ...rest } = game;
  return {
    ...rest,
    franchise: lower(saga) === "sin saga" ? null : (saga ?? null),
    saga: lower(series) === "sin historia" ? "Sin saga" : (series ?? null),
    sagaOrder: seriesOrder ?? null,
  };
}

/** Un juego de saga que no tienes del formato 1, en el formato 2. */
export function upgradeExtraV1(extra: unknown): unknown {
  if (!isRaw(extra)) return extra;
  const { series, seriesOrder, ...rest } = extra;
  return { ...rest, saga: series, sagaOrder: seriesOrder ?? null };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type NewGameInput = Partial<Omit<Game, "id" | "createdAt" | "updatedAt">> & { title: string };
export type NewCopyInput = Partial<Omit<Copy, "id" | "gameId" | "createdAt" | "updatedAt">> & Pick<Copy, "platform" | "format">;

export function createGame(input: NewGameInput): Game {
  const stamp = nowIso();
  return {
    coverUrl: null,
    backdropUrl: null,
    igdbId: null,
    genres: [],
    tags: [],
    status: "pendiente",
    completed100: false,
    endless: false,
    favorite: false,
    rating: null,
    hoursPlayed: null,
    notes: null,
    startedAt: null,
    finishedAt: null,
    pastRuns: [],
    saga: null,
    sagaOrder: null,
    lastPlayedAt: null,
    modes: [],
    moods: [],
    sessionMinutes: null,
    lengthHours: null,
    ...input,
    title: input.title.trim(),
    id: newId(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createCopy(gameId: string, input: NewCopyInput): Copy {
  const stamp = nowIso();
  return {
    edition: null,
    availability: "comprado",
    subscriptionService: null,
    acquiredAt: null,
    pricePaid: null,
    priceKind: null,
    bundleWith: null,
    store: null,
    hasCase: null,
    hasFullArtwork: null,
    artworkUrl: null,
    shelfLocation: null,
    lentTo: null,
    lentAt: null,
    ...input,
    id: newId(),
    gameId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Título normalizado para detectar duplicados: sin acentos, mayúsculas, puntuación ni artículos iniciales. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/^(the|el|la|los|las) /, "")
    .trim();
}

/** Una copia está disponible si no está prestada a otra persona. */
export function isCopyAvailable(copy: Copy): boolean {
  return !copy.lentTo;
}
