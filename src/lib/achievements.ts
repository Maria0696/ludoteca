import type { Achievement, Game, GameAchievements } from "./model";

/*
 * Logros de Steam: la parte sin red. Cómo se juntan las tres respuestas de Steam (lo tuyo, el esquema del juego y la
 * rareza), en qué orden se enseñan y las cifras del Anuario y de Estadísticas. Las consultas están en
 * steam-achievements.ts (servidor) y la sincronización en achievement-sync.ts (navegador).
 */

/** Un logro tal como lo da GetPlayerAchievements (con `l=spanish`, trae nombre y descripción). */
export type SteamPlayerAchievement = { apiname: string; achieved: number; unlocktime: number; name?: string; description?: string };
/** Un logro del esquema del juego (GetSchemaForGame): su nombre visible, si es oculto y su icono. */
export type SteamSchemaAchievement = { name: string; displayName?: string; hidden?: number; description?: string; icon?: string };

const text = (s: string | undefined | null) => (s && s.trim() ? s.trim() : null);

/**
 * Los logros de un juego, juntando lo que dice Steam de ti, del juego y de todos los jugadores. Manda el esquema (todos
 * los logros del juego, en su orden): un logro que no está entre los tuyos cuenta como no conseguido.
 */
export function mergeAchievements(
  player: SteamPlayerAchievement[],
  schema: SteamSchemaAchievement[],
  percents: Record<string, number>,
): { total: number; unlocked: number; items: Achievement[] } {
  const mine = new Map(player.map((p) => [p.apiname, p]));
  const apis = schema.length ? schema.map((s) => s.name) : player.map((p) => p.apiname);
  const bySchema = new Map(schema.map((s) => [s.name, s]));
  const items = apis.map((api): Achievement => {
    const s = bySchema.get(api);
    const p = mine.get(api);
    return {
      api,
      name: text(s?.displayName) ?? text(p?.name) ?? api,
      description: text(s?.description) ?? text(p?.description),
      hidden: s?.hidden === 1,
      percent: Number.isFinite(percents[api]) ? percents[api] : null,
      unlockedAt: p?.achieved === 1 && p.unlocktime > 0 ? new Date(p.unlocktime * 1000).toISOString() : null,
      icon: text(s?.icon),
    };
  });
  return { total: items.length, unlocked: items.filter((i) => i.unlockedAt).length, items };
}

/** El % completado, hacia abajo: 99,9 % aún no es el 100 %. */
export const completion = (g: { total: number; unlocked: number }) => (g.total ? Math.floor((g.unlocked / g.total) * 100) : 0);

/** Los que te faltan, del más raro al más común; los que no tienen rareza conocida, al final. */
export function missingSorted(items: Achievement[]): Achievement[] {
  return items.filter((i) => !i.unlockedAt).sort((a, b) => (a.percent ?? Infinity) - (b.percent ?? Infinity));
}

/** Los conseguidos, del más reciente al más antiguo. */
export function unlockedSorted(items: Achievement[]): Achievement[] {
  return items.filter((i) => i.unlockedAt).sort((a, b) => b.unlockedAt!.localeCompare(a.unlockedAt!));
}

/**
 * La vista de todos, para elegir qué completar: primero los empezados, del más cerca del 100 % al más lejos (a igualdad,
 * el que tiene menos por conseguir); luego los que tienen logros pero ninguno conseguido; los completos, al final. Los
 * juegos sin logros no salen.
 */
export function nearlyDone(list: GameAchievements[]): GameAchievements[] {
  const group = (g: GameAchievements) => (g.unlocked === g.total ? 2 : g.unlocked === 0 ? 1 : 0);
  return list
    .filter((g) => g.total > 0)
    .sort((a, b) => group(a) - group(b) || b.unlocked / b.total - a.unlocked / a.total || a.total - a.unlocked - (b.total - b.unlocked));
}

const MADRID_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });
/** El año de una fecha y hora, en Madrid. */
const yearOf = (iso: string) => Number(MADRID_DAY.format(new Date(iso)).slice(0, 4));

/**
 * Los logros de un año, para el Anuario: cuántos conseguiste, los juegos que llegaron al 100 % ese año (el día del
 * último logro) y el logro más raro de los del año.
 */
export function achievementsOfYear(
  list: GameAchievements[],
  games: Game[],
  year: number,
): { count: number; completed: { gameId: string; title: string; date: string }[]; rarest: { title: string; name: string; percent: number } | null } {
  const titles = new Map(games.map((g) => [g.id, g.title]));
  let count = 0;
  let rarest: { title: string; name: string; percent: number } | null = null;
  const completed: { gameId: string; title: string; date: string }[] = [];
  for (const g of list) {
    const title = titles.get(g.gameId);
    if (!title || g.total === 0) continue;
    for (const i of g.items) {
      if (!i.unlockedAt || yearOf(i.unlockedAt) !== year) continue;
      count++;
      if (i.percent != null && (!rarest || i.percent < rarest.percent)) rarest = { title, name: i.name, percent: i.percent };
    }
    if (g.unlocked === g.total) {
      const last = g.items.reduce<string | null>((max, i) => (i.unlockedAt && (!max || i.unlockedAt > max) ? i.unlockedAt : max), null);
      if (last && yearOf(last) === year) completed.push({ gameId: g.gameId, title, date: last });
    }
  }
  completed.sort((a, b) => a.date.localeCompare(b.date));
  return { count, completed, rarest };
}

/** Para Estadísticas: logros conseguidos, juegos al 100 %, la media de completado de los empezados y tus 5 más raros. */
export function achievementTotals(list: GameAchievements[]): {
  unlocked: number;
  complete: number;
  average: number;
  rarest: { gameId: string; item: Achievement }[];
} {
  const withAny = list.filter((g) => g.total > 0 && g.unlocked > 0);
  const unlocked = withAny.reduce((n, g) => n + g.unlocked, 0);
  const complete = withAny.filter((g) => g.unlocked === g.total).length;
  const average = withAny.length ? Math.round(withAny.reduce((n, g) => n + (g.unlocked / g.total) * 100, 0) / withAny.length) : 0;
  const rarest = withAny
    .flatMap((g) => g.items.filter((i) => i.unlockedAt && i.percent != null).map((item) => ({ gameId: g.gameId, item })))
    .sort((a, b) => a.item.percent! - b.item.percent!)
    .slice(0, 5);
  return { unlocked, complete, average, rarest };
}
