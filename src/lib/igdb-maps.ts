import type { GameType, Mood, PlayMode } from "./model";

/*
 * Tablas del catálogo de IGDB compartidas por el servidor y el navegador:
 * géneros, plataformas, modos y ganas de jugar.
 */

export const GENRES_ES: Record<string, string> = {
  "Role-playing (RPG)": "Rol",
  Adventure: "Aventura",
  Platform: "Plataformas",
  Puzzle: "Puzles",
  Shooter: "Disparos",
  Strategy: "Estrategia",
  Simulator: "Simulación",
  Racing: "Carreras",
  Sport: "Deportes",
  Fighting: "Lucha",
  "Hack and slash/Beat 'em up": "Acción",
  Indie: "Independiente",
  Arcade: "Arcade",
  "Turn-based strategy (TBS)": "Estrategia por turnos",
  "Real Time Strategy (RTS)": "Estrategia en tiempo real",
  Tactical: "Táctico",
  "Visual Novel": "Novela visual",
  "Card & Board Game": "Cartas y tablero",
  Music: "Música",
  "Point-and-click": "Aventura gráfica",
  MOBA: "MOBA",
  Pinball: "Pinball",
  Quiz: "Preguntas",
};

/** Abreviaturas y nombres del catálogo, traducidos a las consolas de la Ludoteca. */
export const PLATFORM_NAMES: Record<string, string> = {
  PS5: "PS5",
  PS4: "PS4",
  PS3: "PS3",
  PS2: "PS2",
  PS1: "PS1",
  PlayStation: "PS1",
  "PlayStation 2": "PS2",
  "PlayStation 3": "PS3",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  Vita: "PS Vita",
  "PlayStation Vita": "PS Vita",
  PSP: "PSP",
  "PlayStation Portable": "PSP",
  PSVR: "PS VR",
  "PlayStation VR": "PS VR",
  PSVR2: "PS VR2",
  "PlayStation VR2": "PS VR2",
  "Series X|S": "Xbox Series",
  "Xbox Series X|S": "Xbox Series",
  XONE: "Xbox Series",
  "Xbox One": "Xbox Series",
  X360: "Xbox 360",
  "Xbox 360": "Xbox 360",
  XBOX: "Xbox",
  Xbox: "Xbox",
  Switch: "Switch",
  "Switch 2": "Switch 2",
  NSW: "Switch",
  NSW2: "Switch 2",
  "Nintendo Switch": "Switch",
  "Nintendo Switch 2": "Switch 2",
  WiiU: "Wii U",
  "Wii U": "Wii U",
  Wii: "Wii",
  NGC: "GameCube",
  "Nintendo GameCube": "GameCube",
  N64: "N64",
  "Nintendo 64": "N64",
  SNES: "SNES",
  "Super Nintendo Entertainment System": "SNES",
  NES: "NES",
  "Nintendo Entertainment System": "NES",
  "3DS": "3DS",
  "Nintendo 3DS": "3DS",
  NDS: "DS",
  "Nintendo DS": "DS",
  GBA: "GBA",
  "Game Boy Advance": "GBA",
  GB: "Game Boy",
  "Game Boy": "Game Boy",
  PC: "PC",
  "PC (Microsoft Windows)": "PC",
  "Steam Deck": "PC",
  "Oculus Rift": "Oculus Rift",
  "Oculus Quest": "Meta Quest",
  "Meta Quest 2": "Meta Quest",
  "Meta Quest 3": "Meta Quest",
  DC: "Dreamcast",
  Dreamcast: "Dreamcast",
  "Sega Mega Drive/Genesis": "Mega Drive",
};

/** Modos de juego del catálogo (en inglés) a los de la Ludoteca. */
export function mapModes(names: string[]): PlayMode[] {
  const out = new Set<PlayMode>();
  for (const name of names) {
    if (name === "Single player") out.add("solo");
    if (name === "Co-operative") out.add("coop_online");
    if (name === "Split screen") out.add("coop_local");
    if (name === "Multiplayer" || name === "Battle Royale") out.add("competitivo");
  }
  return [...out];
}

/** Ganas de jugar que sugieren los géneros y temas del catálogo (en inglés). */
export function guessMoods(list: string[]): Mood[] {
  const names = new Set(list);
  const out = new Set<Mood>();
  if (names.has("Action") || names.has("Shooter") || names.has("Fighting") || names.has("Hack and slash/Beat 'em up")) out.add("accion");
  if (names.has("Drama") || names.has("Mystery") || names.has("Visual Novel") || names.has("Role-playing (RPG)")) out.add("historia");
  if (names.has("Simulator") || names.has("Sandbox") || names.has("Puzzle")) out.add("tranquila");
  if (names.has("Arcade") || names.has("Party") || names.has("Racing")) out.add("rapida");
  return [...out];
}

/**
 * Un juego de una serie de IGDB: su número o, si IGDB lo despliega, también los juegos que son él mismo
 * (remakes, remasters, ports, versiones y contenido descargable).
 */
export type IgdbSeriesGame =
  | number
  | { id: number; remakes?: number[]; remasters?: number[]; ports?: number[]; version_parent?: number; parent_game?: number };
export type IgdbCollection = { name: string; games?: IgdbSeriesGame[] };

/**
 * Si la serie es un solo juego: el original con sus remakes, remasters, ports, versiones y contenido (Ocarina of Time
 * y su remake). Una secuela no lo es, aunque la serie se llame como el primero (Hades y Hades II).
 */
export function isSingleGame(c: IgdbCollection): boolean {
  const games = c.games ?? [];
  if (games.length < 2 || games.some((g) => typeof g === "number")) return false;
  const root = new Map<number, number>();
  for (const g of games) if (typeof g !== "number") root.set(g.id, g.id);
  const find = (id: number): number => (root.get(id) === id ? id : find(root.get(id)!));
  for (const g of games) {
    if (typeof g === "number") continue;
    const same = [...(g.remakes ?? []), ...(g.remasters ?? []), ...(g.ports ?? []), g.version_parent, g.parent_game];
    for (const other of same) if (other != null && root.has(other)) root.set(find(other), find(g.id));
  }
  return new Set([...root.keys()].map(find)).size === 1;
}

/**
 * La saga de un juego entre sus series de IGDB: la que no se llama como su franquicia y, de esas, la de menos juegos
 * (Star Wars Jedi mejor que Star Wars). Las que son un solo juego no cuentan. Si todas se llaman como la franquicia,
 * esa; si solo hay de un solo juego, la franquicia; sin series, ninguna.
 */
export function pickSeries(collections: IgdbCollection[] | undefined, brand: string | null): string | null {
  if (!collections?.length) return null;
  const real = collections.filter((c) => !isSingleGame(c));
  const same = (name: string) => brand != null && name.trim().toLowerCase() === brand.trim().toLowerCase();
  const own = real.filter((c) => !same(c.name)).sort((a, b) => (a.games?.length ?? Infinity) - (b.games?.length ?? Infinity));
  return (own[0] ?? real[0])?.name ?? brand;
}

/**
 * La saga de un juego de IGDB. La franquicia que se descarta es solo la «franchise»: si IGDB no la tiene,
 * la serie amplia no se toma por franquicia (si no, «Star Wars» saldría como saga y «Star Wars Jedi» como franquicia).
 */
type IgdbSeriesInfo = { franchise?: { name: string }; franchises?: { name: string }[]; collections?: IgdbCollection[] };
type IgdbSeriesGameInfo = IgdbSeriesInfo & { version_parent?: IgdbSeriesInfo; parent_game?: IgdbSeriesInfo };
export function seriesForIgdbGame(g: IgdbSeriesGameInfo): string | null {
  const own = (x: IgdbSeriesInfo | undefined) => (x ? pickSeries(x.collections, x.franchise?.name ?? x.franchises?.[0]?.name ?? null) : null);
  // Las ediciones y versiones no suelen tener serie en IGDB: la tiene su juego original.
  return own(g) ?? own(g.version_parent) ?? own(g.parent_game);
}

/** Las series del juego (y de su original) que son un solo juego: si alguna se puso como saga, sobra. */
export function singleGameSeries(g: IgdbSeriesGameInfo): string[] {
  const all = [g, g.version_parent, g.parent_game].flatMap((x) => x?.collections ?? []);
  return [...new Set(all.filter(isSingleGame).map((c) => c.name))];
}

const SAME_GAME = ["remakes", "remasters", "ports", "version_parent", "parent_game"].map((f) => `collections.games.${f}`);
const SERIES = ["franchise.name", "franchises.name", "collections.name", ...SAME_GAME];
const parents = (fields: string[]) => [...fields, ...fields.map((f) => `version_parent.${f}`), ...fields.map((f) => `parent_game.${f}`)];
/** Los campos de IGDB para elegir la saga: los del juego y, por si no tiene, los de su original. */
export const SERIES_FIELDS = parents(SERIES).join(",");
/** Por si IGDB no acepta tanto: sin saber qué juegos de la serie son el mismo. */
export const SIMPLE_SERIES_FIELDS = parents(["franchise.name", "franchises.name", "collections.name", "collections.games"]).join(",");
export const OWN_SERIES_FIELDS = "franchise.name,franchises.name,collections.name,collections.games";

/** Los tipos de juego de IGDB (`game_type`), por su número. */
const IGDB_GAME_TYPES: Record<number, GameType> = {
  0: "main",
  1: "dlc",
  2: "expansion",
  3: "bundle",
  4: "standalone_expansion",
  5: "mod",
  6: "episode",
  7: "season",
  8: "remake",
  9: "remaster",
  10: "expanded",
  11: "port",
  12: "fork",
  13: "pack",
  14: "update",
};
type IgdbTypeInfo = { game_type?: number; version_parent?: { name?: string } | null; parent_game?: { name?: string } | null };

/** Qué es un juego de IGDB. Una versión de otro (Definitive, GOTY…) es una «edición», diga lo que diga su tipo. */
export function gameTypeOf(g: IgdbTypeInfo): GameType | null {
  if (g.version_parent) return "edition";
  return g.game_type != null ? (IGDB_GAME_TYPES[g.game_type] ?? null) : null;
}

/** De qué juego es: el original de una edición, o el juego de un DLC o una expansión. */
export function baseGameOf(g: IgdbTypeInfo): string | null {
  return g.version_parent?.name ?? g.parent_game?.name ?? null;
}

/** Lo justo para saber qué es un juego de IGDB y de cuál. */
export const TYPE_FIELDS = "game_type,version_parent.name,parent_game.name";

