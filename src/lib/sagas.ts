import { type Game, type GameType, type SagaExtra, type SagaRole, normalizeTitle } from "./model";
import { timesFinished } from "./runs";

/*
 * Sagas: los juegos de cada saga (Star Wars Jedi, Half-Life…), agrupadas bajo su franquicia (Star Wars). En el código,
 * una saga es una «story» y su franquicia, su «brand»; en los datos, `saga` y `franchise`.
 * La cronología lo pone la propietaria; sin ponerlo, es el de lanzamiento. La app no inventa cronologías.
 */

export type StoryOrder = "lanzamiento" | "historia";

/** Lo que guarda la ficha al quitar una saga a mano: así traer de IGDB no la vuelve a poner. */
export const NO_STORY = "Sin saga";

/** Si la saga se quitó a propósito. */
export function isNoStory(saga: string | null | undefined): boolean {
  return saga?.trim().toLowerCase() === NO_STORY.toLowerCase();
}

/** La saga del juego; «Sin saga» y vacío no son saga. */
export function storyOf(game: Game): string | null {
  const name = game.saga?.trim();
  return name && !isNoStory(name) ? name : null;
}
/** Una saga: sus juegos (los tuyos) y los de la saga que no tienes. */
export type Story = { name: string; brand: string | null; games: Game[]; extras: SagaExtra[] };

/** Una parada del mapa: un juego tuyo o uno de la saga que no tienes. */
export type Stop = { kind: "juego"; id: string; game: Game } | { kind: "falta"; id: string; extra: SagaExtra };
export type Placement = { kind: Stop["kind"]; id: string; sagaOrder: number };

const byName = (a: string, b: string) => a.localeCompare(b, "es");

/** La franquicia del juego; vacío no es franquicia. */
export function brandOf(game: Game): string | null {
  return game.franchise?.trim() || null;
}

/** Las sagas con dos o más paradas (tuyas o que faltan), por nombre; su franquicia, la más repetida entre tus juegos. */
export function buildStories(games: Game[], extras: SagaExtra[] = []): Story[] {
  const map = new Map<string, Game[]>();
  const missing = new Map<string, SagaExtra[]>();
  // Lo quitado del apartado no cuenta (su ficha conserva la saga).
  for (const g of games) {
    const name = storyOf(g);
    if (name && !g.sagaHidden) map.set(name, [...(map.get(name) ?? []), g]);
  }
  for (const x of extras) {
    if (x.hidden) continue;
    const name = x.saga.trim();
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

/** Las sagas bajo su franquicia, por nombre; una saga sin franquicia va sola. */
export function groupByBrand(stories: Story[]): { brand: string | null; stories: Story[] }[] {
  const groups: { brand: string | null; stories: Story[] }[] = [];
  for (const story of stories) {
    const group = story.brand ? groups.find((g) => g.brand === story.brand) : undefined;
    if (group) group.stories.push(story);
    else groups.push({ brand: story.brand, stories: [story] });
  }
  return groups.sort((a, b) => byName(a.brand ?? a.stories[0].name, b.brand ?? b.stories[0].name));
}

type Ordered = { releaseDate?: string | null; sagaOrder?: number | null; title: string };
const byRelease = (a: Ordered, b: Ordered) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || byName(a.title, b.title);
const info = (s: Stop): Ordered => (s.kind === "juego" ? s.game : s.extra);

/**
 * Las paradas de la saga. «lanzamiento»: por fecha (sin fecha, al final). «historia» (la cronología): las que
 * tienen puesto, por él; las demás, después, por fecha. Sin `withExtras`, solo tus juegos.
 */
export function storyStops(story: Story, order: StoryOrder, withExtras = true): Stop[] {
  const all: Stop[] = [
    ...story.games.map((game): Stop => ({ kind: "juego", id: game.id, game })),
    ...(withExtras ? story.extras.map((extra): Stop => ({ kind: "falta", id: extra.id, extra })) : []),
  ];
  const release = all.sort((a, b) => byRelease(info(a), info(b)));
  if (order === "lanzamiento") return release;
  const placed = release.filter((s) => info(s).sagaOrder != null).sort((a, b) => info(a).sagaOrder! - info(b).sagaOrder!);
  return [...placed, ...release.filter((s) => info(s).sagaOrder == null)];
}

/** Las que llevan la pieza de puzle si ella no dice otra cosa. */
const DLC_TYPES = new Set<GameType>(["dlc", "expansion", "pack", "season", "update"]);

/** La marca de una parada: la que ella puso o, si no, según su tipo (los DLC y expansiones, pieza de puzle). */
export function roleOf(x: { sagaRole?: SagaRole | null; gameType?: GameType | null }): SagaRole {
  return x.sagaRole ?? (x.gameType && DLC_TYPES.has(x.gameType) ? "dlc" : "main");
}

/** Una parada del mapa: un juego y, dentro, sus versiones (remaster, remake, edición…), por fecha. */
export type StopGroup = { lead: Stop; versions: Stop[]; role: SagaRole };
const memberOf = (s: Stop) => (s.kind === "juego" ? s.game : s.extra);
const membersOf = (g: StopGroup) => [g.lead, ...g.versions];
const ownedIn = (g: StopGroup) => membersOf(g).flatMap((s) => (s.kind === "juego" ? [s.game] : []));

/** Las paradas en grupos: cada versión, dentro de la de su original (si está en la saga). */
function groupStops(stops: Stop[]): StopGroup[] {
  const byIgdb = new Map<number, Stop>();
  for (const s of stops) {
    const id = memberOf(s).igdbId;
    if (id != null && !byIgdb.has(id)) byIgdb.set(id, s);
  }
  // Su original, y el de este, hasta uno que no sea versión de nadie (un círculo no agrupa).
  const rootOf = (s: Stop): Stop => {
    const seen = new Set([s.id]);
    let at = s;
    for (;;) {
      const v = memberOf(at).versionOf;
      const up = v ? byIgdb.get(v) : undefined;
      if (!up) return at;
      if (seen.has(up.id)) return s;
      seen.add(up.id);
      at = up;
    }
  };
  const groups = new Map<string, StopGroup>();
  for (const s of stops) if (rootOf(s) === s) groups.set(s.id, { lead: s, versions: [], role: roleOf(memberOf(s)) });
  for (const s of stops) {
    const root = rootOf(s);
    if (root !== s) groups.get(root.id)!.versions.push(s);
  }
  for (const g of groups.values()) g.versions.sort((a, b) => byRelease(memberOf(a), memberOf(b)));
  return [...groups.values()];
}

/**
 * Las paradas del mapa, en grupos (ver `groupStops`), en el orden de la saga. Sin `withExtras`, solo las que tienen
 * algún juego tuyo, y solo con los tuyos (si el original no lo tienes, encabeza tu primera versión).
 */
export function storyGroups(story: Story, order: StoryOrder, withExtras = true): StopGroup[] {
  const all = groupStops(storyStops(story, order));
  if (withExtras) return all;
  return all.flatMap((g) => {
    const own = membersOf(g).filter((s) => s.kind === "juego");
    return own.length ? [{ lead: own[0], versions: own.slice(1), role: g.role }] : [];
  });
}

/** La marca de cada parada: las principales, numeradas por orden; las demás, «optional» o «dlc». */
export function groupMarks(groups: StopGroup[]): (number | "optional" | "dlc")[] {
  let n = 0;
  return groups.map((g) => (g.role === "main" ? ++n : g.role));
}

/** Si alguna de sus versiones está superada. */
export function groupDone(g: StopGroup): boolean {
  return ownedIn(g).some((game) => timesFinished(game) > 0 || game.status === "completado");
}

/** El siguiente que toca: de las principales (si hay), la primera sin superar con un juego tuyo sin abandonar. */
export function nextInGroups(groups: StopGroup[]): Game | null {
  const mains = groups.filter((g) => g.role === "main");
  for (const g of mains.length ? mains : groups) {
    if (groupDone(g)) continue;
    const game = ownedIn(g).find((x) => x.status !== "abandonado");
    if (game) return game;
  }
  return null;
}

/** Tus juegos en la cronología de la saga (el de todas sus paradas): para el puesto y «Siguiente». */
export function orderStory(story: Story, order: StoryOrder): Game[] {
  return storyStops(story, order).flatMap((s) => (s.kind === "juego" ? [s.game] : []));
}

/** Las paradas que se pueden mover: todas, o (sin los que faltan) las que tienen algún juego tuyo. */
function placeable(story: Story, withExtras: boolean) {
  const full = groupStops(storyStops(story, "historia"));
  return { full, visible: withExtras ? full : full.filter((g) => ownedIn(g).length > 0) };
}

/**
 * Coloca una parada (con sus versiones) en un puesto (desde 0) de la cronología y devuelve el puesto de todas (1…n);
 * las versiones, el de su parada. Con los que faltan ocultos, el puesto es entre las que tienen algún juego tuyo y
 * las demás no se mueven de su sitio. Si no está, nada.
 */
export function placeInStory(story: Story, id: string, toIndex: number, withExtras = true): Placement[] {
  const { full, visible } = placeable(story, withExtras);
  const from = visible.findIndex((g) => membersOf(g).some((s) => s.id === id));
  if (from < 0) return [];
  const moved = [...visible];
  const [group] = moved.splice(from, 1);
  moved.splice(Math.max(0, Math.min(toIndex, moved.length)), 0, group);
  let next = 0;
  const result = withExtras ? moved : full.map((g) => (visible.includes(g) ? moved[next++] : g));
  return result.flatMap((g, i) => membersOf(g).map((s) => ({ kind: s.kind, id: s.id, sagaOrder: i + 1 })));
}

/** Mueve una parada un puesto en la cronología (entre las que se ven); si no se puede, nada. */
export function moveInStory(story: Story, id: string, dir: -1 | 1, withExtras = true): Placement[] {
  const { visible } = placeable(story, withExtras);
  const from = visible.findIndex((g) => membersOf(g).some((s) => s.id === id));
  const to = from + dir;
  if (from < 0 || to < 0 || to >= visible.length) return [];
  return placeInStory(story, id, to, withExtras);
}

type CatalogEntry = { igdbId: number; title: string; coverUrl: string | null; releaseDate: string | null };

/** Lo que IGDB conoce de la serie y falta en la saga: ni lo tienes (en ninguna saga) ni está ya como «no lo tienes». */
export function missingFrom<T extends CatalogEntry>(story: Story, catalog: T[], games: Game[]): T[] {
  const owned = new Set(games.flatMap((g) => (g.igdbId != null ? [g.igdbId] : [])));
  const there = new Set(story.extras.flatMap((x) => (x.igdbId != null ? [x.igdbId] : [])));
  return catalog.filter((c) => !owned.has(c.igdbId) && !there.has(c.igdbId));
}

/** Una saga para añadir: la que propone IGDB o una que se quitó (con sus juegos que no tienes, guardados). */
export type Proposal = { name: string; games: Game[]; extras?: SagaExtra[] };

/**
 * Las sagas quitadas del apartado (todos sus juegos ocultos, con dos o más paradas): Traer las vuelve a proponer.
 * Un juego quitado de una saga que sigue a la vista no cuenta.
 */
export function hiddenStories(games: Game[], extras: SagaExtra[] = []): Proposal[] {
  const visible = new Set(buildStories(games, extras).map((s) => s.name));
  const map = new Map<string, { games: Game[]; extras: SagaExtra[] }>();
  const at = (name: string) => map.get(name) ?? map.set(name, { games: [], extras: [] }).get(name)!;
  for (const g of games) {
    const name = storyOf(g);
    if (name && g.sagaHidden && !visible.has(name)) at(name).games.push(g);
  }
  for (const x of extras) if (x.hidden && !visible.has(x.saga.trim())) at(x.saga.trim()).extras.push(x);
  return [...map.entries()]
    .filter(([, s]) => s.games.length + s.extras.length >= 2 && s.games.length > 0)
    .map(([name, s]) => ({ name, games: s.games, extras: s.extras }))
    .sort((a, b) => byName(a.name, b.name));
}

/**
 * Lo que propone IGDB: por saga, los juegos que no tienen ninguna (los que se quedaron en «Sin saga»
 * a propósito no cuentan). Ella elige cuáles añadir.
 */
export function proposeStories(games: Game[], found: Record<string, string | null>, { discarded = false } = {}): Proposal[] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const waiting = discarded ? isNoStory(g.saga) : !g.saga?.trim();
    const name = g.igdbId != null && waiting ? found[String(g.igdbId)]?.trim() : null;
    if (name) map.set(name, [...(map.get(name) ?? []), g]);
  }
  return [...map.entries()].map(([name, list]) => ({ name, games: list })).sort((a, b) => byName(a.name, b.name));
}

/** El siguiente que toca: el primero sin superar ni abandonar. */
export function nextInStory(ordered: Game[]): Game | null {
  return ordered.find((g) => timesFinished(g) === 0 && g.status !== "abandonado" && g.status !== "completado") ?? null;
}

/** El puesto del juego entre tus juegos de su saga (los que faltan no cuentan), si la saga se ve. */
export function storyPosition(game: Game, games: Game[], extras: SagaExtra[] = []): { name: string; position: number; total: number } | null {
  const story = game.sagaHidden ? undefined : buildStories(games, extras).find((s) => s.name === storyOf(game));
  if (!story) return null;
  const ordered = orderStory(story, "historia");
  return { name: story.name, position: ordered.findIndex((g) => g.id === game.id) + 1, total: ordered.length };
}

type Titled = { igdbId?: number | null; title: string };
/** Mismo juego: por número de IGDB; por título solo si a uno de los dos le falta el número (así un remake no pasa por el original). */
const sameGame = (a: Titled, b: Titled) =>
  a.igdbId != null && b.igdbId != null ? a.igdbId === b.igdbId : normalizeTitle(a.title) === normalizeTitle(b.title);

/** El juego tuyo que es este, si lo tienes. */
export function findOwned(games: Game[], c: Titled): Game | undefined {
  return games.find((g) => sameGame(g, c));
}

/** Si este juego ya está en tus deseos. */
export function isWished(wishlist: Titled[], x: Titled): boolean {
  return wishlist.some((w) => sameGame(w, x));
}

/** El deseo que es este juego, si está en deseos. */
export function findWish<T extends Titled>(wishlist: T[], x: Titled): T | undefined {
  return wishlist.find((w) => sameGame(w, x));
}

/**
 * Juegos que llegan a la biblioteca y estaban en una saga como «no lo tienes» (mismo número de IGDB): toman la
 * saga y el puesto de esa parada, aunque IGDB les dé otra. Devuelve también las paradas que sobran.
 */
export function absorbExtras(games: Game[], extras: SagaExtra[]): { games: Game[]; dropped: string[] } {
  const dropped = new Set<string>();
  const out = games.map((g) => {
    const matches = g.igdbId == null ? [] : extras.filter((x) => x.igdbId === g.igdbId);
    if (!matches.length) return g;
    for (const x of matches) dropped.add(x.id);
    const [x] = matches;
    // Si su saga estaba quitada del apartado, llega quitado también.
    return { ...g, saga: x.saga, sagaOrder: x.sagaOrder ?? null, sagaHidden: x.hidden ?? false, releaseDate: g.releaseDate ?? x.releaseDate ?? null };
  });
  return { games: out, dropped: [...dropped] };
}

/** Paradas huecas de juegos que ya tienes: sobran. */
export function ownedExtras(extras: SagaExtra[], games: Game[]): string[] {
  const owned = new Set(games.flatMap((g) => (g.igdbId != null ? [g.igdbId] : [])));
  return extras.filter((x) => x.igdbId != null && owned.has(x.igdbId)).map((x) => x.id);
}
