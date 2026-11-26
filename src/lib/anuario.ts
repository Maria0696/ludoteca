import { type Copy, type Game, type Library, type Mood, PLATFORM_FAMILIES } from "./model";
import { finishDates } from "./runs";

/*
 * Anuario: el resumen de un año, calculado solo de lo que tiene fecha dentro de ese año (fechas «AAAA-MM-DD»
 * comparadas como texto). Lo que no tiene fecha (horas, abandonos, «al 100 %»…) no sale. Lo de demostración no cuenta.
 * Al congelar un año se guarda este objeto tal cual: por eso lleva lo justo de cada juego, por si luego se borra.
 */

export type WrapGame = { id: string; title: string; coverUrl: string | null; rating: number | null; date: string | null };
export type YearWrapData = {
  version: 1;
  year: number;
  /** Juegos terminados (cada uno una vez) y vueltas de más dentro del año. */
  finished: { games: number; replays: number };
  started: number;
  /** Terminados en cada mes, de enero a diciembre. */
  byMonth: number[];
  /** El mes (0–11) con más terminados; sin terminados, ninguno. */
  bestMonth: number | null;
  first: WrapGame | null;
  last: WrapGame | null;
  /** Hasta 3 terminados del año con nota propia, de mejor a peor. */
  favorites: WrapGame[];
  /** Hasta 8 terminados del año, por fecha: para el abanico de la portada. */
  finishedCovers: WrapGame[];
  profile: { genres: string[]; family: string | null; moods: Mood[]; line: string | null };
  library: { copies: number; newGames: number; spent: number; gifts: number; free: number; undatedCopies: number };
};

const inYear = (date: string | null | undefined, year: number) => date != null && date.slice(0, 4) === String(year);
const yearOf = (date: string | null | undefined) => (date ? Number(date.slice(0, 4)) : null);
const startDates = (g: Game) => [...g.pastRuns.map((r) => r.start), g.startedAt].filter((d): d is string => Boolean(d));

/** Lo justo de un juego para el recuerdo; una carátula subida a mano (data:) pesaría demasiado y no se guarda. */
function wrapGame(g: Game, date: string | null): WrapGame {
  return { id: g.id, title: g.title, coverUrl: g.coverUrl && !g.coverUrl.startsWith("data:") ? g.coverUrl : null, rating: g.rating ?? null, date };
}

/** Los más repetidos, por frecuencia y luego por nombre. */
function top<T extends string>(items: T[], n: number): T[] {
  const counts = new Map<T, number>();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, n).map(([x]) => x);
}

const familyOf = (platform: string) => PLATFORM_FAMILIES.find((f) => f.platforms.includes(platform))?.name ?? "Otras";

/** Una frase para el perfil del año, según el género que más se repitió. */
const LINES: Record<string, string> = {
  Rol: "Tu año fue de rol",
  Aventura: "Tu año fue de aventuras",
  Disparos: "Tu año fue a tiro limpio",
  Estrategia: "Tu año fue de estrategia",
  Plataformas: "Tu año fue de saltos y plataformas",
  Puzles: "Tu año fue de rompecabezas",
  Lucha: "Tu año fue de combates",
  Carreras: "Tu año fue a toda velocidad",
  Deportes: "Tu año fue deportivo",
  Simulación: "Tu año fue de vidas simuladas",
  Independiente: "Tu año fue indie",
};
export function profileLine(genre: string | undefined): string | null {
  if (!genre) return null;
  return LINES[genre] ?? `Tu año fue de ${genre.toLowerCase()}`;
}

export function computeYear(library: Library, year: number): YearWrapData {
  const games = library.games.filter((g) => !g.demo);
  const copies = library.copies.filter((c) => !c.demo);

  // Terminados: cada juego con su primera fecha de fin del año; las demás del año son vueltas.
  const finishes = games.flatMap((g) => finishDates(g).filter((d) => inYear(d, year)).map((date) => ({ game: g, date })));
  finishes.sort((a, b) => a.date.localeCompare(b.date));
  const firstFinish = new Map<string, { game: Game; date: string }>();
  for (const f of finishes) if (!firstFinish.has(f.game.id)) firstFinish.set(f.game.id, f);
  const finished = [...firstFinish.values()];

  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const f of finishes) byMonth[Number(f.date.slice(5, 7)) - 1]++;
  const max = Math.max(...byMonth);

  const favorites = finished
    .filter((f) => f.game.rating != null)
    .sort((a, b) => b.game.rating! - a.game.rating! || a.date.localeCompare(b.date))
    .slice(0, 3)
    .map((f) => wrapGame(f.game, f.date));

  const firstCopy = (g: Game) => copies.find((c) => c.gameId === g.id);
  const genres = top(finished.flatMap((f) => f.game.genres), 3);

  // Copias que entraron en el año; un juego es nuevo si su primera copia con fecha es de este año.
  const ofYear = copies.filter((c) => inYear(c.acquiredAt, year));
  const firstAcquired = new Map<string, string>();
  for (const c of copies) {
    if (!c.acquiredAt) continue;
    const before = firstAcquired.get(c.gameId);
    if (!before || c.acquiredAt < before) firstAcquired.set(c.gameId, c.acquiredAt);
  }
  const paid = (c: Copy) => c.priceKind == null && c.pricePaid != null;

  return {
    version: 1,
    year,
    finished: { games: finished.length, replays: finishes.length - finished.length },
    started: games.filter((g) => startDates(g).some((d) => inYear(d, year))).length,
    byMonth,
    bestMonth: max > 0 ? byMonth.indexOf(max) : null,
    first: finishes.length ? wrapGame(finishes[0].game, finishes[0].date) : null,
    last: finishes.length ? wrapGame(finishes[finishes.length - 1].game, finishes[finishes.length - 1].date) : null,
    favorites,
    finishedCovers: finished.slice(0, 8).map((f) => wrapGame(f.game, f.date)),
    profile: {
      genres,
      family: top(finished.flatMap((f) => (firstCopy(f.game) ? [familyOf(firstCopy(f.game)!.platform)] : [])), 1)[0] ?? null,
      moods: top(finished.flatMap((f) => f.game.moods), 2),
      line: profileLine(genres[0]),
    },
    library: {
      copies: ofYear.length,
      newGames: [...firstAcquired.values()].filter((d) => inYear(d, year)).length,
      spent: ofYear.filter(paid).reduce((sum, c) => sum + c.pricePaid!, 0),
      gifts: ofYear.filter((c) => c.priceKind === "regalo").length,
      free: ofYear.filter((c) => c.priceKind === "gratis").length,
      undatedCopies: copies.filter((c) => !c.acquiredAt).length,
    },
  };
}

/** Si el año tiene algo que contar: algún terminado, empezado o copia. */
export const hasActivity = (data: YearWrapData): boolean => data.finished.games > 0 || data.started > 0 || data.library.copies > 0;

/** Los años con algo que contar, de más nuevo a más viejo. */
export function activeYears(library: Library): number[] {
  const years = new Set<number>();
  for (const g of library.games) {
    if (g.demo) continue;
    for (const d of [...finishDates(g), ...startDates(g)]) years.add(yearOf(d)!);
  }
  for (const c of library.copies) if (!c.demo && c.acquiredAt) years.add(yearOf(c.acquiredAt)!);
  return [...years].sort((a, b) => b - a);
}

/** «+4 que en 2025», «−2 que en 2025» o «Igual que en 2025»; sin año anterior, nada. */
export function compareLine(now: number, before: number | undefined, yearBefore: number): string | null {
  if (before == null || (before === 0 && now === 0)) return null;
  if (now === before) return `Igual que en ${yearBefore}`;
  return `${now > before ? "+" : "−"}${Math.abs(now - before)} que en ${yearBefore}`;
}
