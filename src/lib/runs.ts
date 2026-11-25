import type { Game } from "./model";

/**
 * Rejugar un juego ya superado. La vuelta en curso es `startedAt` / `finishedAt` del juego, como siempre;
 * las anteriores, ya terminadas, se guardan en `pastRuns`. Lo superado no se pierde nunca.
 */
export type Run = Game["pastRuns"][number];

/** El número de la vuelta en curso: 1 si nunca se ha rejugado. */
export const runNumber = (game: Game): number => game.pastRuns.length + 1;

/** Cuántas veces se ha terminado, contando la vuelta en curso si ya acabó. */
export const timesFinished = (game: Game): number => game.pastRuns.length + (game.finishedAt ? 1 : 0);

/** El fin de cada vuelta terminada, de la primera a la última. */
export const finishDates = (game: Game): string[] => [...game.pastRuns.map((r) => r.end), ...(game.finishedAt ? [game.finishedAt] : [])];

/** Guarda la vuelta terminada entre las anteriores y deja la nueva sin fechas. Sin vuelta terminada, nada. */
export function archiveRun(game: Game): Game {
  if (!game.finishedAt) return game;
  return { ...game, pastRuns: [...game.pastRuns, { start: game.startedAt ?? null, end: game.finishedAt }], startedAt: null, finishedAt: null };
}

/**
 * Volver a «Completado» el mismo día en que se guardó una vuelta que acababa hoy es deshacer un error,
 * no otra vuelta: la recupera como vuelta en curso. Si no es el caso, `null`.
 */
export function reopenSameDayRun(game: Game, today: string): Game | null {
  const last = game.pastRuns.at(-1);
  if (!last || last.end !== today || game.finishedAt || (game.startedAt && game.startedAt !== today)) return null;
  return { ...game, pastRuns: game.pastRuns.slice(0, -1), startedAt: last.start, finishedAt: last.end };
}
