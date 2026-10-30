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
}

export type CatalogResponse =
  | { ok: true; results: CatalogGame[] }
  | { ok: false; reason: "no-configurado" | "no-autorizado" | "error"; message: string };
