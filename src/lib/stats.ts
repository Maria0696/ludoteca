import { type Format, type GameStatus, type Library, GAME_STATUSES } from "./model";

/*
 * Estadísticas calculadas solo a partir de los datos guardados.
 * «Títulos» cuenta juegos (obras); «copias» cuenta ejemplares.
 * Cada suma parcial indica cuántos registros no tenían el dato.
 */

export interface CollectionStats {
  titles: number;
  copies: number;
  byStatus: Record<GameStatus, number>;
  /** Copias por plataforma, de mayor a menor. */
  copiesByPlatform: { platform: string; copies: number; titles: number }[];
  copiesByFormat: Record<Format, number>;
  /** Juegos con fecha de fin en el año en curso. */
  finishedThisYear: number;
  /** Juegos completados sin fecha de fin: no entran en el recuento del año. */
  completedWithoutDate: number;
  completed100: number;
  hours: { total: number; withData: number; missing: number };
  spend: { total: number; withData: number; missing: number };
  wishlist: number;
  lentOut: number;
}

export function computeStats(library: Library, today = new Date()): CollectionStats {
  const year = String(today.getFullYear());
  const byStatus = Object.fromEntries(GAME_STATUSES.map((s) => [s, 0])) as Record<GameStatus, number>;
  let finishedThisYear = 0;
  let completedWithoutDate = 0;
  let completed100 = 0;
  const hours = { total: 0, withData: 0, missing: 0 };

  for (const g of library.games) {
    byStatus[g.status]++;
    if (g.finishedAt?.startsWith(year)) finishedThisYear++;
    if (g.status === "completado" && !g.finishedAt) completedWithoutDate++;
    if (g.completed100) completed100++;
    if (g.hoursPlayed != null) {
      hours.total += g.hoursPlayed;
      hours.withData++;
    } else {
      hours.missing++;
    }
  }

  const platformMap = new Map<string, { copies: number; games: Set<string> }>();
  const copiesByFormat: Record<Format, number> = { fisico: 0, digital: 0 };
  const spend = { total: 0, withData: 0, missing: 0 };
  let lentOut = 0;

  for (const c of library.copies) {
    const entry = platformMap.get(c.platform) ?? { copies: 0, games: new Set<string>() };
    entry.copies++;
    entry.games.add(c.gameId);
    platformMap.set(c.platform, entry);
    copiesByFormat[c.format]++;
    if (c.lentTo) lentOut++;
    if (c.availability === "comprado") {
      if (c.pricePaid != null) {
        spend.total += c.pricePaid;
        spend.withData++;
      } else {
        spend.missing++;
      }
    }
  }

  const copiesByPlatform = [...platformMap.entries()]
    .map(([platform, v]) => ({ platform, copies: v.copies, titles: v.games.size }))
    .sort((a, b) => b.copies - a.copies || a.platform.localeCompare(b.platform, "es"));

  spend.total = Math.round(spend.total * 100) / 100;
  hours.total = Math.round(hours.total * 10) / 10;

  return {
    titles: library.games.length,
    copies: library.copies.length,
    byStatus,
    copiesByPlatform,
    copiesByFormat,
    finishedThisYear,
    completedWithoutDate,
    completed100,
    hours,
    spend,
    wishlist: library.wishlist.length,
    lentOut,
  };
}
