import type { Mood, PlayMode } from "./model";

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
  saga: string | null;
  /** La historia dentro de la saga: la serie más concreta de IGDB (Star Wars Jedi dentro de Star Wars). */
  series: string | null;
  /** Primer lanzamiento, en formato AAAA-MM-DD. */
  releaseDate: string | null;
  /** Por ejemplo, «PEGI 16». */
  ageRating: string | null;
}

export type CatalogResponse =
  | { ok: true; results: CatalogGame[] }
  | { ok: false; reason: "no-configurado" | "no-autorizado" | "error"; message: string };

/** Respuesta de /api/catalogo/series: la historia de cada juego, por su número de IGDB. */
export type SeriesResponse =
  | { ok: true; series: Record<string, string | null> }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };

/** Respuesta de /api/catalogo/serie: los juegos de una serie de IGDB. */
export type SeriesGamesResponse =
  | { ok: true; games: CatalogGame[] }
  | { ok: false; reason: "no-autorizado" | "no-configurado" | "error"; message: string };
