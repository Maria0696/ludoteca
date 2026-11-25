import type { Game, SagaExtra } from "./model";
import { timesFinished } from "./runs";

/*
 * Sagas: los juegos de cada historia (Star Wars Jedi, Half-Life…), agrupadas bajo su marca (Star Wars).
 * El orden de la historia lo pone la propietaria; sin ponerlo, es el de lanzamiento. La app no inventa cronologías.
 */

export type StoryOrder = "lanzamiento" | "historia";

/** Lo que guarda la ficha al quitar una historia a mano: así traer de IGDB no la vuelve a poner. */
export const NO_STORY = "Sin historia";

/** La historia del juego; «Sin historia» y vacío no son historia. */
export function storyOf(game: Game): string | null {
  const name = game.series?.trim();
  return name && name.toLowerCase() !== NO_STORY.toLowerCase() ? name : null;
}
/** Una historia: sus juegos (los tuyos) y los de la saga que no tienes. */
export type Story = { name: string; brand: string | null; games: Game[]; extras: SagaExtra[] };

/** Una parada del mapa: un juego tuyo o uno de la saga que no tienes. */
export type Stop = { kind: "juego"; id: string; game: Game } | { kind: "falta"; id: string; extra: SagaExtra };
export type Placement = { kind: Stop["kind"]; id: string; seriesOrder: number };

const byName = (a: string, b: string) => a.localeCompare(b, "es");

/** La marca del juego; «Sin saga» (herencia de una importación) y vacío no son marca. */
export function brandOf(game: Game): string | null {
  const saga = game.saga?.trim();
  return saga && saga.toLowerCase() !== "sin saga" ? saga : null;
}

/** Las historias con dos o más paradas (tuyas o que faltan), por nombre; su marca, la más repetida entre tus juegos. */
export function buildStories(games: Game[], extras: SagaExtra[] = []): Story[] {
  const map = new Map<string, Game[]>();
  const missing = new Map<string, SagaExtra[]>();
  for (const g of games) {
    const name = storyOf(g);
    if (name) map.set(name, [...(map.get(name) ?? []), g]);
  }
  for (const x of extras) {
    const name = x.series.trim();
    missing.set(name, [...(missing.get(name) ?? []), x]);
    if (!map.has(name)) map.set(name, []);
  }
  return [...map.entries()]
    .filter(([name, list]) => list.length + (missing.get(name)?.length ?? 0) >= 2)
    .map(([name, list]) => {
      const counts = new Map<string, number>();
      for (const g of list) {
        const brand = brandOf(g);
        if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
      }
      const brand = [...counts.entries()].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))[0]?.[0] ?? null;
      return { name, brand: brand && brand.toLowerCase() !== name.toLowerCase() ? brand : null, games: list, extras: missing.get(name) ?? [] };
    })
    .sort((a, b) => byName(a.name, b.name));
}

/** Las historias bajo su marca, por nombre; una historia sin marca va sola. */
export function groupByBrand(stories: Story[]): { brand: string | null; stories: Story[] }[] {
  const groups: { brand: string | null; stories: Story[] }[] = [];
  for (const story of stories) {
    const group = story.brand ? groups.find((g) => g.brand === story.brand) : undefined;
    if (group) group.stories.push(story);
    else groups.push({ brand: story.brand, stories: [story] });
  }
  return groups.sort((a, b) => byName(a.brand ?? a.stories[0].name, b.brand ?? b.stories[0].name));
}

type Ordered = { releaseDate?: string | null; seriesOrder?: number | null; title: string };
const byRelease = (a: Ordered, b: Ordered) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || byName(a.title, b.title);
const info = (s: Stop): Ordered => (s.kind === "juego" ? s.game : s.extra);

/**
 * Las paradas de la historia. «lanzamiento»: por fecha (sin fecha, al final). «historia» (la cronología): las que
 * tienen puesto, por él; las demás, después, por fecha. Sin `withExtras`, solo tus juegos.
 */
export function storyStops(story: Story, order: StoryOrder, withExtras = true): Stop[] {
  const all: Stop[] = [
    ...story.games.map((game): Stop => ({ kind: "juego", id: game.id, game })),
    ...(withExtras ? story.extras.map((extra): Stop => ({ kind: "falta", id: extra.id, extra })) : []),
  ];
  const release = all.sort((a, b) => byRelease(info(a), info(b)));
  if (order === "lanzamiento") return release;
  const placed = release.filter((s) => info(s).seriesOrder != null).sort((a, b) => info(a).seriesOrder! - info(b).seriesOrder!);
  return [...placed, ...release.filter((s) => info(s).seriesOrder == null)];
}

/** Tus juegos en el orden de la historia (el de todas sus paradas): para el puesto y «Siguiente». */
export function orderStory(story: Story, order: StoryOrder): Game[] {
  return storyStops(story, order).flatMap((s) => (s.kind === "juego" ? [s.game] : []));
}

/**
 * Coloca una parada en un puesto (desde 0) de la cronología y devuelve el puesto de todas (1…n). Con los que faltan
 * ocultos, el puesto es entre tus juegos y los que faltan no se mueven de su sitio. Si no está, nada.
 */
export function placeInStory(story: Story, id: string, toIndex: number, withExtras = true): Placement[] {
  const full = storyStops(story, "historia");
  const visible = withExtras ? full : full.filter((s) => s.kind === "juego");
  const from = visible.findIndex((s) => s.id === id);
  if (from < 0) return [];
  const moved = [...visible];
  const [stop] = moved.splice(from, 1);
  moved.splice(Math.max(0, Math.min(toIndex, moved.length)), 0, stop);
  let next = 0;
  const result = withExtras ? moved : full.map((s) => (s.kind === "juego" ? moved[next++] : s));
  return result.map((s, i) => ({ kind: s.kind, id: s.id, seriesOrder: i + 1 }));
}

/** Mueve una parada un puesto en la cronología (entre las que se ven); si no se puede, nada. */
export function moveInStory(story: Story, id: string, dir: -1 | 1, withExtras = true): Placement[] {
  const visible = storyStops(story, "historia", withExtras);
  const from = visible.findIndex((s) => s.id === id);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= visible.length) return [];
  return placeInStory(story, id, to, withExtras);
}

type CatalogEntry = { igdbId: number; title: string; coverUrl: string | null; releaseDate: string | null };

/** Lo que IGDB conoce de la serie y falta en la historia: ni lo tienes (en ninguna historia) ni está ya como «no lo tienes». */
export function missingFrom<T extends CatalogEntry>(story: Story, catalog: T[], games: Game[]): T[] {
  const owned = new Set(games.flatMap((g) => (g.igdbId != null ? [g.igdbId] : [])));
  const there = new Set(story.extras.flatMap((x) => (x.igdbId != null ? [x.igdbId] : [])));
  return catalog.filter((c) => !owned.has(c.igdbId) && !there.has(c.igdbId));
}

export type Proposal = { name: string; games: Game[] };

/**
 * Lo que propone IGDB: por historia, los juegos que no tienen ninguna (los que se quedaron en «Sin historia»
 * a propósito no cuentan). Ella elige cuáles añadir.
 */
export function proposeStories(games: Game[], found: Record<string, string | null>): Proposal[] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const name = g.igdbId != null && !g.series?.trim() ? found[String(g.igdbId)]?.trim() : null;
    if (name) map.set(name, [...(map.get(name) ?? []), g]);
  }
  return [...map.entries()].map(([name, list]) => ({ name, games: list })).sort((a, b) => byName(a.name, b.name));
}

/** El siguiente que toca: el primero sin superar ni abandonar. */
export function nextInStory(ordered: Game[]): Game | null {
  return ordered.find((g) => timesFinished(g) === 0 && g.status !== "abandonado" && g.status !== "completado") ?? null;
}

/** El puesto del juego entre tus juegos de su historia (los que faltan no cuentan), si la historia se ve. */
export function storyPosition(game: Game, games: Game[], extras: SagaExtra[] = []): { name: string; position: number; total: number } | null {
  const story = buildStories(games, extras).find((s) => s.name === storyOf(game));
  if (!story) return null;
  const ordered = orderStory(story, "historia");
  return { name: story.name, position: ordered.findIndex((g) => g.id === game.id) + 1, total: ordered.length };
}
