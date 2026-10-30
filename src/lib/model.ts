import { z } from "zod";

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

export const DEFAULT_PLATFORMS = [
  "PS5",
  "PS4",
  "Switch 2",
  "Switch",
  "Xbox Series",
  "Xbox One",
  "PC",
  "Steam Deck",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha con formato AAAA-MM-DD");
const optionalText = z.string().trim().max(2000).nullish();

export const gameSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  coverUrl: z.string().max(2_000_000).nullish(),
  /** Arte apaisado para los fondos; si falta, se usa la carátula difuminada. */
  backdropUrl: z.string().max(2_000_000).nullish(),
  igdbId: z.number().int().nullish(),
  genres: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  status: z.enum(GAME_STATUSES).default("pendiente"),
  completed100: z.boolean().default(false),
  favorite: z.boolean().default(false),
  rating: z.number().min(0).max(10).nullish(),
  hoursPlayed: z.number().min(0).max(100000).nullish(),
  notes: optionalText,
  startedAt: isoDate.nullish(),
  finishedAt: isoDate.nullish(),
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
  store: optionalText,
  // Estantería: campos opcionales, válidos también para copias digitales con caja decorativa.
  hasCase: z.boolean().nullish(),
  hasFullArtwork: z.boolean().nullish(),
  artworkPrintPending: z.boolean().nullish(),
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

export const listSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "Ponle un nombre a la lista").max(80),
  gameIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  demo: z.boolean().optional(),
});

export type Game = z.infer<typeof gameSchema>;
export type Copy = z.infer<typeof copySchema>;
export type PriceRecord = z.infer<typeof priceRecordSchema>;
export type WishItem = z.infer<typeof wishSchema>;
export type GameList = z.infer<typeof listSchema>;

export interface Library {
  games: Game[];
  copies: Copy[];
  wishlist: WishItem[];
  lists: GameList[];
}

export const emptyLibrary = (): Library => ({ games: [], copies: [], wishlist: [], lists: [] });

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
