import { type Copy, type Format, type Game, type GameStatus, type Library, normalizeTitle } from "./model";

export const SORTS = ["anadido", "titulo", "valoracion", "jugado"] as const;
export type SortKey = (typeof SORTS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  anadido: "Añadidos recientemente",
  titulo: "Título (A–Z)",
  valoracion: "Mejor valorados",
  jugado: "Jugados recientemente",
};

export interface LibraryFilters {
  q: string;
  platforms: string[];
  formats: Format[];
  genres: string[];
  statuses: GameStatus[];
  favorites: boolean;
}

export const EMPTY_FILTERS: LibraryFilters = {
  q: "",
  platforms: [],
  formats: [],
  genres: [],
  statuses: [],
  favorites: false,
};

export interface LibraryEntry {
  game: Game;
  copies: Copy[];
}

export function activeFilterCount(f: LibraryFilters): number {
  return f.platforms.length + f.formats.length + f.genres.length + f.statuses.length + (f.favorites ? 1 : 0);
}

export function buildEntries(library: Library): LibraryEntry[] {
  const byGame = new Map<string, Copy[]>();
  for (const c of library.copies) {
    const list = byGame.get(c.gameId);
    if (list) list.push(c);
    else byGame.set(c.gameId, [c]);
  }
  return library.games.map((game) => ({ game, copies: byGame.get(game.id) ?? [] }));
}

export function filterEntries(entries: LibraryEntry[], f: LibraryFilters): LibraryEntry[] {
  const q = normalizeTitle(f.q);
  return entries.filter(({ game, copies }) => {
    if (q && !normalizeTitle(game.title).includes(q)) return false;
    if (f.statuses.length && !f.statuses.includes(game.status)) return false;
    if (f.favorites && !game.favorite) return false;
    if (f.platforms.length && !copies.some((c) => f.platforms.includes(c.platform))) return false;
    if (f.formats.length && !copies.some((c) => f.formats.includes(c.format))) return false;
    if (f.genres.length && !game.genres.some((g) => f.genres.includes(g))) return false;
    return true;
  });
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export function sortEntries(entries: LibraryEntry[], sort: SortKey): LibraryEntry[] {
  const list = [...entries];
  const byTitle = (a: LibraryEntry, b: LibraryEntry) => collator.compare(a.game.title, b.game.title);
  switch (sort) {
    case "titulo":
      return list.sort(byTitle);
    case "anadido":
      return list.sort((a, b) => b.game.createdAt.localeCompare(a.game.createdAt) || byTitle(a, b));
    case "valoracion":
      return list.sort((a, b) => nullsLast(a.game.rating, b.game.rating) || byTitle(a, b));
    case "jugado":
      return list.sort(
        (a, b) => nullsLastStr(a.game.lastPlayedAt, b.game.lastPlayedAt) || byTitle(a, b),
      );
  }
}

function nullsLast(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function nullsLastStr(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

/** Valores presentes en la colección, para ofrecer solo filtros que devuelven algo. */
export function facetValues(entries: LibraryEntry[]) {
  const platforms = new Map<string, number>();
  const genres = new Map<string, number>();
  for (const { game, copies } of entries) {
    for (const p of new Set(copies.map((c) => c.platform))) platforms.set(p, (platforms.get(p) ?? 0) + 1);
    for (const g of game.genres) genres.set(g, (genres.get(g) ?? 0) + 1);
  }
  const sorted = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).map(([value, count]) => ({ value, count }));
  return { platforms: sorted(platforms), genres: sorted(genres) };
}

/** Busca un juego existente con el mismo título normalizado. */
export function findSameTitle(library: Library, title: string, exceptId?: string): Game | undefined {
  const n = normalizeTitle(title);
  if (!n) return undefined;
  return library.games.find((g) => g.id !== exceptId && normalizeTitle(g.title) === n);
}
