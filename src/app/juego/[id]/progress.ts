import type { Copy, Game } from "@/lib/model";

/*
 * La historia de un juego como camino de niveles. Solo lee los datos de la
 * ficha: conseguir un nivel es haber apuntado lo que corresponde.
 */

export const STAGES = ["Llegó a tu ludoteca", "Tu copia", "Primera partida", "En marcha", "Tu nota", "Terminado", "Al 100 %"];

export const TROPHY_STAGE = 6;

export function reachedStages(game: Game, copies: Copy[]): boolean[] {
  return [
    true,
    copies.length > 0,
    Boolean(game.startedAt),
    (game.hoursPlayed ?? 0) > 0 || Boolean(game.lastPlayedAt),
    game.rating != null,
    Boolean(game.finishedAt) || game.status === "completado",
    game.completed100,
  ];
}

export const currentStage = (reached: boolean[]) => reached.lastIndexOf(true);

/** Porcentaje de horas jugadas sobre la duración, si se conocen las dos. */
export function progressPercent(game: Game): number | null {
  if (!game.hoursPlayed || !game.lengthHours) return null;
  return Math.min(100, Math.round((game.hoursPlayed / game.lengthHours) * 100));
}

function daysSince(iso: string, today: Date): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

/** Lo que dice la guardiana según cómo va el juego. */
export function keeperLine(game: Game, today = new Date()): string {
  if (game.completed100) return "¡Al 100 %! Este trofeo se queda para siempre en tu ludoteca.";
  if (game.status === "completado") return "Misión cumplida. Aún te queda el 100 %, si te atreves.";
  if (game.status === "abandonado") return "A veces una aventura se deja atrás. Esta seguirá aquí si vuelves.";
  if (game.status === "pendiente") return "Esta aventura aún no ha empezado. ¿Hoy es el día?";
  if (game.lastPlayedAt) {
    const days = daysSince(game.lastPlayedAt, today);
    if (days === 0) return "¡Hoy has jugado! Lo dejo anotado en el diario.";
    return `Llevas ${days} ${days === 1 ? "día" : "días"} sin volver. La aventura te espera.`;
  }
  return "Cuando juegues, cuéntamelo y lo apunto.";
}
