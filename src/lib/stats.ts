import { type Format, type GameStatus, type Library, GAME_STATUSES, PLATFORM_FAMILIES } from "./model";
import { finishDates } from "./runs";

/*
 * Estadísticas calculadas solo a partir de los datos guardados.
 * «Títulos» cuenta juegos (obras); «copias» cuenta ejemplares.
 * Cada suma parcial indica cuántos registros no tenían el dato.
 */

export interface CollectionStats {
  titles: number;
  copies: number;
  byStatus: Record<GameStatus, number>;
  /**
   * Copias por familia de plataformas, en el orden de la biblioteca: PC, PlayStation, Xbox, Nintendo y Otras.
   * Dentro de cada una, sus plataformas de más a menos copias; el PC, además, por tienda.
   */
  families: { name: string; copies: number; platforms: { platform: string; copies: number }[] }[];
  pcStores: { store: string; copies: number }[];
  /** Superados (con fecha de fin) en cada mes del año en curso, de enero a diciembre. */
  finishedByMonth: number[];
  /** El último juego con fecha de fin, sea del año que sea. */
  lastFinished: { id: string; title: string; finishedAt: string } | null;
  /** Los pendientes con mejor nota de Metacritic. */
  gems: { id: string; title: string; metacritic: number; platform: string | null }[];
  /** Géneros con más títulos. */
  genres: { genre: string; titles: number }[];
  /** Títulos por tramo de nota de Metacritic: menos de 50, de 50 a 59… y 90 o más. */
  metacritic: { buckets: { label: string; titles: number }[]; average: number | null; withData: number };
  /** Títulos por década de salida, de la más antigua a la más nueva. */
  decades: { decade: number; titles: number }[];
  oldest: { title: string; year: number } | null;
  /** Juegos sin final: no se completan y no cuentan en la pila de «por jugar». */
  endless: { total: number; pending: number; byStatus: Record<GameStatus, number> };
  /** Pendientes con sesiones de 30 minutos o menos, y pendientes que se pueden jugar acompañada. */
  pendingQuick: number;
  pendingCoop: number;
  copiesByFormat: Record<Format, number>;
  /** Juegos con fecha de fin en el año en curso. */
  finishedThisYear: number;
  /** Juegos completados sin fecha de fin: no entran en el recuento del año. */
  completedWithoutDate: number;
  completed100: number;
  hours: { total: number; withData: number; missing: number };
  /**
   * Gasto de las copias compradas: la suma de los importes y cuántas no tienen importe porque fueron
   * regalo, gratis, de un pack o no se sabe; «missing» son las que aún no dicen nada.
   */
  spend: { total: number; withData: number; missing: number; regalo: number; gratis: number; pack: number; desconocido: number };
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
    // Cada vuelta terminada cuenta en el año en que acaba, también las de un juego rejugado.
    finishedThisYear += finishDates(g).filter((d) => d.startsWith(year)).length;
    if (g.status === "completado" && !g.finishedAt) completedWithoutDate++;
    if (g.completed100) completed100++;
    if (g.hoursPlayed != null) {
      hours.total += g.hoursPlayed;
      hours.withData++;
    } else {
      hours.missing++;
    }
  }

  const finishedByMonth = Array.from({ length: 12 }, () => 0);
  let lastFinished: CollectionStats["lastFinished"] = null;
  const genreMap = new Map<string, number>();
  const buckets = ["<50", "50", "60", "70", "80", "90+"].map((label) => ({ label, titles: 0 }));
  let mcSum = 0;
  let mcWith = 0;
  const decadeMap = new Map<number, number>();
  let oldest: { title: string; date: string } | null = null;
  let pendingQuick = 0;
  let pendingCoop = 0;
  const endless = { total: 0, pending: 0, byStatus: Object.fromEntries(GAME_STATUSES.map((s) => [s, 0])) as Record<GameStatus, number> };
  for (const g of library.games) {
    if (g.endless) {
      endless.total++;
      endless.byStatus[g.status]++;
      if (g.status === "pendiente") endless.pending++;
    }
    for (const end of finishDates(g)) {
      if (end.startsWith(year)) finishedByMonth[Number(end.slice(5, 7)) - 1]++;
      if (!lastFinished || end > lastFinished.finishedAt) lastFinished = { id: g.id, title: g.title, finishedAt: end };
    }
    for (const genre of g.genres) genreMap.set(genre, (genreMap.get(genre) ?? 0) + 1);
    if (g.metacritic != null) {
      buckets[g.metacritic < 50 ? 0 : Math.min(5, Math.floor(g.metacritic / 10) - 4)].titles++;
      mcSum += g.metacritic;
      mcWith++;
    }
    if (g.releaseDate) {
      const decade = Math.floor(Number(g.releaseDate.slice(0, 4)) / 10) * 10;
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1);
      if (!oldest || g.releaseDate < oldest.date) oldest = { title: g.title, date: g.releaseDate };
    }
    if (g.status === "pendiente") {
      if (g.sessionMinutes != null && g.sessionMinutes <= 30) pendingQuick++;
      if (g.modes.some((m) => m === "coop_local" || m === "coop_online")) pendingCoop++;
    }
  }

  const platformMap = new Map<string, { copies: number; games: Set<string> }>();
  const storeMap = new Map<string, number>();
  const copiesByFormat: Record<Format, number> = { fisico: 0, digital: 0 };
  const spend = { total: 0, withData: 0, missing: 0, regalo: 0, gratis: 0, pack: 0, desconocido: 0 };
  let lentOut = 0;

  for (const c of library.copies) {
    const entry = platformMap.get(c.platform) ?? { copies: 0, games: new Set<string>() };
    entry.copies++;
    entry.games.add(c.gameId);
    platformMap.set(c.platform, entry);
    copiesByFormat[c.format]++;
    if (c.platform === "PC" && c.store) storeMap.set(c.store, (storeMap.get(c.store) ?? 0) + 1);
    if (c.lentTo) lentOut++;
    if (c.availability === "comprado") {
      if (c.priceKind) {
        spend[c.priceKind]++;
      } else if (c.pricePaid != null) {
        spend.total += c.pricePaid;
        spend.withData++;
      } else {
        spend.missing++;
      }
    }
  }

  const byCount = <T>(entries: [T, number][]) => entries.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "es"));
  // Las familias de la biblioteca, con el PC aparte; lo que no está en ninguna va a «Otras».
  const order = [{ name: "PC", platforms: ["PC"] }, ...PLATFORM_FAMILIES.map((f) => ({ name: f.name, platforms: f.platforms.filter((p) => p !== "PC") }))];
  const familyOf = (platform: string) => order.find((f) => f.platforms.includes(platform))?.name ?? "Otras";
  const families = order
    .map((f) => {
      const counts = [...platformMap.entries()].filter(([p]) => familyOf(p) === f.name).map(([p, v]): [string, number] => [p, v.copies]);
      const platforms = byCount(counts).map(([platform, copies]) => ({ platform, copies }));
      return { name: f.name, copies: platforms.reduce((sum, p) => sum + p.copies, 0), platforms };
    })
    .filter((f) => f.copies > 0);

  const firstPlatform = new Map<string, string>();
  for (const c of library.copies) if (!firstPlatform.has(c.gameId)) firstPlatform.set(c.gameId, c.platform);
  const gems = library.games
    .flatMap((g) => (g.status === "pendiente" && !g.endless && g.metacritic != null ? [{ id: g.id, title: g.title, metacritic: g.metacritic, platform: firstPlatform.get(g.id) ?? null }] : []))
    .sort((a, b) => b.metacritic - a.metacritic || a.title.localeCompare(b.title, "es"))
    .slice(0, 6);

  spend.total = Math.round(spend.total * 100) / 100;
  hours.total = Math.round(hours.total * 10) / 10;

  return {
    titles: library.games.length,
    copies: library.copies.length,
    byStatus,
    families,
    pcStores: byCount([...storeMap.entries()]).map(([store, copies]) => ({ store, copies })),
    finishedByMonth,
    lastFinished,
    gems,
    genres: byCount([...genreMap.entries()])
      .slice(0, 8)
      .map(([genre, titles]) => ({ genre, titles })),
    metacritic: { buckets, average: mcWith ? Math.round((mcSum / mcWith) * 10) / 10 : null, withData: mcWith },
    decades: [...decadeMap.entries()].sort((a, b) => a[0] - b[0]).map(([decade, titles]) => ({ decade, titles })),
    oldest: oldest ? { title: oldest.title, year: Number(oldest.date.slice(0, 4)) } : null,
    endless,
    pendingQuick,
    pendingCoop,
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
