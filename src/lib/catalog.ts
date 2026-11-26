import type { GameType, Mood, PlayMode } from "./model";

/** Resultado del catálogo tal como lo usa la app (sin datos propios de IGDB). */
export interface CatalogGame {
  igdbId: number;
  title: string;
  year: number | null;
  coverUrl: string | null;
  /** Ilustración o captura apaisada para los fondos. */
  backdropUrl: string | null;
  genres: string[];
  platforms: string[];
  modes: PlayMode[];
  moods: Mood[];
  /** Horas para terminar la historia principal, si IGDB las tiene. */
  lengthHours: number | null;
  /** Media de la crítica en IGDB, de 0 a 100, si la tiene. */
  criticRating: number | null;
  /** Sinopsis tal como la da IGDB, normalmente en inglés. */
  summary: string | null;
  developer: string | null;
  /** La franquicia: Star Wars. */
  franchise: string | null;
  /** La saga dentro de la franquicia: la serie más concreta de IGDB (Star Wars Jedi dentro de Star Wars). */
  saga: string | null;
  /** Qué es: juego base, DLC, remake… */
  gameType: GameType | null;
  /** De qué juego es, si es DLC, expansión, edición… */
  baseGame: string | null;
  /** Primer lanzamiento, en formato AAAA-MM-DD. */
  releaseDate: string | null;
  /** Por ejemplo, «PEGI 16». */
  ageRating: string | null;
}

export type CatalogResponse =
  | { ok: true; results: CatalogGame[] }
  | { ok: false; reason: "no-configurado" | "no-autorizado" | "error"; message: string };

/**
 * Respuesta de /api/catalogo/series: la saga de cada juego, por su número de IGDB, y sus series que son un solo juego
 * (que no son saga).
 */
export type SeriesResponse =
  | { ok: true; sagas: Record<string, string | null>; single?: Record<string, string[]> }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };

/** Respuesta de /api/catalogo/tipos: qué es cada juego y de cuál, por su número de IGDB. */
export type TypesResponse =
  | { ok: true; types: Record<string, { gameType: GameType | null; baseGame: string | null }> }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };

/**
 * Respuesta de /api/catalogo/versiones: de qué juego es versión cada uno (su número de IGDB; 0, de ninguno) y qué es
 * (juego base, DLC…) y de cuál.
 */
export type VersionsResponse =
  | { ok: true; originals: Record<string, number>; types?: Record<string, { gameType: GameType | null; baseGame: string | null }> }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };

/** Respuesta de /api/catalogo/serie: los juegos de una serie de IGDB. */
export type SeriesGamesResponse =
  | { ok: true; games: CatalogGame[] }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };
