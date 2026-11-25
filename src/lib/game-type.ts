import type { GameType } from "./model";

/** Cómo se dice cada tipo de juego en la app. */
export const GAME_TYPE_LABEL: Record<GameType, string> = {
  main: "Juego base",
  dlc: "DLC",
  expansion: "Expansión",
  standalone_expansion: "Expansión independiente",
  bundle: "Colección",
  remake: "Remake",
  remaster: "Remaster",
  expanded: "Versión ampliada",
  port: "Port",
  edition: "Edición",
  episode: "Episodio",
  season: "Temporada",
  pack: "Pack",
  update: "Actualización",
  mod: "Mod",
  fork: "Derivado",
};

/** La etiqueta del tipo, si se sabe. */
export const gameTypeLabel = (type: GameType | null | undefined): string | null => (type ? GAME_TYPE_LABEL[type] : null);
