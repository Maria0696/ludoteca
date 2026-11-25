import type { CatalogGame } from "./catalog";
import { type Copy, type Game, type Library, createCopy, createGame, normalizeTitle, nowIso } from "./model";
import type { SteamGame } from "./steam";

/*
 * Qué hace la importación con cada juego de Steam. Un juego que ya está en la
 * biblioteca nunca se duplica ni pierde lo que tenía: solo se completa lo que
 * está vacío y las horas suben si Steam tiene más.
 */

export interface SteamImportItem {
  game: SteamGame;
  catalog?: CatalogGame;
}

/** nuevo: entra como juego · copia: ya estaba y gana la copia de Steam · horas: ya estaba con esa copia. */
export type SteamState = "nuevo" | "copia" | "horas";

export interface SteamImportCounts {
  nuevos: number;
  actualizados: number;
  sinCaratula: number;
}

export interface SteamImportPlan {
  games: Game[];
  copies: Copy[];
  counts: SteamImportCounts;
}

function catalogFields(c: CatalogGame) {
  return {
    coverUrl: c.coverUrl,
    backdropUrl: c.backdropUrl,
    igdbId: c.igdbId,
    genres: c.genres,
    modes: c.modes,
    moods: c.moods,
    lengthHours: c.lengthHours,
    criticRating: c.criticRating,
    summary: c.summary,
    developer: c.developer,
    franchise: c.franchise,
    saga: c.saga,
    gameType: c.gameType,
    baseGame: c.baseGame,
    releaseDate: c.releaseDate,
    ageRating: c.ageRating,
  } satisfies Partial<Game>;
}

function fillEmpty(game: Game, catalog: CatalogGame | undefined): Game {
  if (!catalog) return game;
  const out: Record<string, unknown> = { ...game };
  for (const [key, value] of Object.entries(catalogFields(catalog))) {
    const current = out[key];
    if (current == null || (Array.isArray(current) && current.length === 0)) out[key] = value;
  }
  return out as Game;
}

/** Las horas se quedan con una decimal; sin jugar, en blanco. */
function steamHours(minutes: number): number | null {
  return minutes > 0 ? Math.round(minutes / 6) / 10 : null;
}

/** Los juegos de demostración no cuentan: se retiran de una vez sin tocar la colección. */
class LibraryIndex {
  readonly games = new Map<string, Game>();
  readonly steamCopies: Set<string>;
  private readonly byApp = new Map<number, string>();
  private readonly byIgdb = new Map<number, string>();
  private readonly byTitle = new Map<string, string>();

  constructor(library: Library) {
    for (const game of library.games) if (!game.demo) this.add(game);
    this.steamCopies = new Set(library.copies.filter((c) => !c.demo && c.store?.trim().toLowerCase() === "steam").map((c) => c.gameId));
  }

  add(game: Game) {
    this.games.set(game.id, game);
    if (game.steamAppId) this.byApp.set(game.steamAppId, game.id);
    if (game.igdbId) this.byIgdb.set(game.igdbId, game.id);
    const title = normalizeTitle(game.title);
    if (!this.byTitle.has(title)) this.byTitle.set(title, game.id);
  }

  find(steam: SteamGame, catalog?: CatalogGame): Game | undefined {
    const id =
      this.byApp.get(steam.appId) ??
      (catalog ? this.byIgdb.get(catalog.igdbId) : undefined) ??
      this.byTitle.get(normalizeTitle(steam.name)) ??
      (catalog ? this.byTitle.get(normalizeTitle(catalog.title)) : undefined);
    return id ? this.games.get(id) : undefined;
  }
}

/** Para avisar en la lista, antes de copiar nada, de lo que pasará con cada juego. */
export function steamStates(library: Library, games: SteamGame[]): Map<number, SteamState> {
  const index = new LibraryIndex(library);
  return new Map(
    games.map((steam) => {
      const current = index.find(steam);
      return [steam.appId, !current ? "nuevo" : index.steamCopies.has(current.id) ? "horas" : "copia"];
    }),
  );
}

export function planSteamImport(library: Library, items: SteamImportItem[]): SteamImportPlan {
  const index = new LibraryIndex(library);
  const changed = new Map<string, Game>();
  const copies: Copy[] = [];
  const counts: SteamImportCounts = { nuevos: 0, actualizados: 0, sinCaratula: 0 };

  for (const { game: steam, catalog } of items) {
    const current = index.find(steam, catalog);
    const played = steamHours(steam.minutes);
    let saved: Game;
    if (current) {
      counts.actualizados++;
      saved = {
        ...fillEmpty(current, catalog),
        steamAppId: current.steamAppId ?? steam.appId,
        hoursPlayed: played != null && played > (current.hoursPlayed ?? 0) ? played : current.hoursPlayed,
        updatedAt: nowIso(),
      };
    } else {
      counts.nuevos++;
      saved = createGame({ ...(catalog ? catalogFields(catalog) : {}), title: catalog?.title ?? steam.name, steamAppId: steam.appId, hoursPlayed: played });
    }
    if (!saved.coverUrl) counts.sinCaratula++;
    index.add(saved);
    changed.set(saved.id, saved);
    if (!index.steamCopies.has(saved.id)) {
      copies.push(createCopy(saved.id, { platform: "PC", format: "digital", store: "Steam", availability: steam.family ? "prestado" : "comprado" }));
      index.steamCopies.add(saved.id);
    }
  }
  return { games: [...changed.values()], copies, counts };
}
