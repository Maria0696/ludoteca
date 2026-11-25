import type { Copy, Game } from "@/lib/model";

/*
 * La historia de un juego como camino de niveles. Solo lee los datos de la
 * ficha: conseguir un nivel es haber apuntado lo que corresponde.
 */

export const STAGES = ["Llegó a tu ludoteca", "Tu copia", "Primera partida", "En marcha", "Tu nota", "Terminado", "Al 100 %"];
/** Un juego sin final no se termina: su penúltimo nivel es la última partida. */
const ENDLESS_STAGES = STAGES.map((s) => (s === "Terminado" ? "Última partida" : s));

export const stagesFor = (game: Game) => (game.endless ? ENDLESS_STAGES : STAGES);

export const TROPHY_STAGE = 6;

export function reachedStages(game: Game, copies: Copy[]): boolean[] {
  return [
    true,
    copies.length > 0,
    Boolean(game.startedAt),
    (game.hoursPlayed ?? 0) > 0 || Boolean(game.lastPlayedAt),
    game.rating != null,
    // Superado una vez, superado siempre: mientras se rejuega, «Terminado» sigue alcanzado.
    game.endless ? Boolean(game.lastPlayedAt) : Boolean(game.finishedAt) || game.status === "completado" || game.pastRuns.length > 0,
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
  if (game.endless) return endlessLine(game, today);
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

/** Un juego sin final no tiene meta: la guardiana habla de partidas, no de terminarlo. */
function endlessLine(game: Game, today: Date): string {
  if (game.status === "abandonado") return "Lo dejaste aparcado. Si un día te apetece una partida, aquí sigue.";
  if (!game.lastPlayedAt) return "Este juego no tiene final: echa una partida cuando te apetezca y te la apunto.";
  const days = daysSince(game.lastPlayedAt, today);
  if (days === 0) return "¡Partida de hoy apuntada! Este no se acaba nunca.";
  return `Tu última partida fue hace ${days} ${days === 1 ? "día" : "días"}. ¿Otra?`;
}
