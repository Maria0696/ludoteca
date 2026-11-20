"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createDemoLibrary } from "./demo";
import {
  type Copy,
  type Game,
  type GameList,
  type GameStatus,
  type Library,
  type NewCopyInput,
  type NewGameInput,
  type WishItem,
  STATUS_LABEL,
  createCopy,
  createGame,
  emptyLibrary,
  newId,
  nowIso,
  todayIso,
} from "./model";
import { isSupabaseConfigured, localModeAllowed } from "./config";
import { LocalRepository } from "./repo/local";
import type { Changes, Repository, StorageMode } from "./repo/types";
import { type GtCounts, type GtItem, planGameTrackerImport } from "./gametracker-import";
import { type SteamImportCounts, type SteamImportItem, planSteamImport } from "./steam-import";

/*
 * Estado de la biblioteca en el cliente. Cada acción actualiza la pantalla
 * al momento y guarda en segundo plano; si el guardado falla, se avisa y se
 * recarga lo que hay realmente guardado.
 */

export type LoadState = "loading" | "ready" | "error" | "setup";

interface Actions {
  reload(): Promise<void>;
  addGame(game: NewGameInput, copy?: NewCopyInput): Game;
  updateGame(id: string, patch: Partial<Game>): void;
  setStatus(id: string, status: GameStatus): void;
  /** Cambia el estado de varios juegos de una vez: un solo guardado, un solo aviso y un solo «Deshacer». */
  setStatusMany(ids: string[], status: GameStatus): void;
  /** Marca o quita el 100 %; marcarlo también lo pasa a Completado, en un solo guardado. */
  setCompleted100(id: string, done: boolean): void;
  /** Anota o borra la fecha de fin; anotarla también lo pasa a Completado, en un solo guardado. */
  setFinishedAt(id: string, date: string | null): void;
  markPlayedToday(id: string): void;
  deleteGame(id: string): void;
  /** Vacía la biblioteca; si no lo consigue del todo, avisa con un error. */
  deleteAllGames(): Promise<void>;
  addCopy(gameId: string, copy: NewCopyInput): Copy;
  updateCopy(id: string, patch: Partial<Copy>): void;
  deleteCopy(id: string): void;
  addWish(wish: Partial<WishItem> & { title: string }): WishItem;
  updateWish(id: string, patch: Partial<WishItem>): void;
  deleteWish(id: string): void;
  /** Pasa un deseo a la biblioteca: crea (o reutiliza) el juego y añade la copia. */
  convertWish(id: string, copy: NewCopyInput, existingGameId?: string): Game;
  addList(name: string): GameList;
  renameList(id: string, name: string): void;
  deleteList(id: string): void;
  toggleInList(listId: string, gameId: string): void;
  applyChanges(changes: Changes): Promise<void>;
  /** Guarda un grupo de juegos de Steam; si falla, avisa con un error y no cambia nada. */
  importSteam(items: SteamImportItem[]): Promise<SteamImportCounts>;
  /** Guarda un grupo de juegos y deseos de Game Tracker; lo que ya está se salta. Si falla, avisa con un error. */
  importGameTracker(items: GtItem[]): Promise<GtCounts>;
  loadDemo(): Promise<void>;
  removeDemo(): Promise<void>;
}

interface LibraryContextValue {
  state: LoadState;
  error: string | null;
  mode: StorageMode | null;
  library: Library;
  actions: Actions;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

type LoadResult =
  | { kind: "setup" }
  | { kind: "error"; message: string }
  | { kind: "ready"; mode: StorageMode; data: Library };

async function createRepository(): Promise<Repository | null> {
  if (isSupabaseConfigured) {
    const [{ SupabaseRepository }, { getBrowserSupabase }] = await Promise.all([
      import("./repo/supabase"),
      import("./supabase/client"),
    ]);
    return new SupabaseRepository(getBrowserSupabase());
  }
  return localModeAllowed ? new LocalRepository() : null;
}

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<StorageMode | null>(null);
  const repoRef = useRef<Repository | null>(null);
  const libRef = useRef<Library>(library);

  const commit = useCallback((next: Library) => {
    libRef.current = next;
    setLibrary(next);
  }, []);

  /** Lee del almacén sin tocar el estado de React. */
  const fetchLibrary = useCallback(async (): Promise<LoadResult> => {
    try {
      const repo = repoRef.current ?? (await createRepository());
      repoRef.current = repo;
      if (!repo) return { kind: "setup" };
      return { kind: "ready", mode: repo.mode, data: await repo.load() };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const applyLoad = useCallback(
    (result: LoadResult) => {
      if (result.kind === "setup") return setState("setup");
      if (result.kind === "error") {
        setError(result.message);
        return setState("error");
      }
      setMode(result.mode);
      commit(result.data);
      setError(null);
      setState("ready");
    },
    [commit],
  );

  const reload = useCallback(async () => {
    setState((s) => (s === "ready" ? s : "loading"));
    applyLoad(await fetchLibrary());
  }, [applyLoad, fetchLibrary]);

  useEffect(() => {
    let alive = true;
    void fetchLibrary().then((result) => {
      if (alive) applyLoad(result);
    });
    return () => {
      alive = false;
    };
  }, [applyLoad, fetchLibrary]);

  /** Guarda en segundo plano; si falla, avisa y vuelve a cargar lo guardado. */
  const persist = useCallback(
    (work: (repo: Repository) => Promise<void>) => {
      const repo = repoRef.current;
      if (!repo) return Promise.resolve();
      return work(repo).catch((e: unknown) => {
        toast.error("No se ha podido guardar el cambio", {
          description: e instanceof Error ? e.message : undefined,
          action: { label: "Reintentar carga", onClick: () => void reload() },
        });
        void reload();
      });
    },
    [reload],
  );

  const actions = useMemo<Actions>(() => {
    const saveGame = (game: Game) => {
      commit({ ...libRef.current, games: replaceById(libRef.current.games, game) });
      return persist((r) => r.save({ games: [game] }));
    };
    const saveGames = (games: Game[]) => {
      commit({ ...libRef.current, games: games.reduce((all, g) => replaceById(all, g), libRef.current.games) });
      return persist((r) => r.save({ games }));
    };
    /** Las mismas reglas al cambiar de estado, uno o varios: fechas de inicio, última partida y fin. */
    const withStatus = (previous: Game, status: GameStatus): Game => {
      const next: Game = { ...previous, status, updatedAt: nowIso() };
      const today = todayIso();
      if (status === "jugando") {
        next.startedAt ??= today;
        next.lastPlayedAt = today;
      }
      if (status === "completado") next.finishedAt ??= today;
      return next;
    };
    /**
     * Deshacer un cambio de estado devuelve solo el estado y sus fechas, sobre el juego tal como está ahora:
     * lo editado después se conserva, y un juego borrado entretanto no vuelve.
     */
    const undoStatus = (previous: Game[]) => {
      const restored = previous.flatMap((old) => {
        const now = findGame(old.id);
        if (!now) return [];
        const { status, startedAt, lastPlayedAt, finishedAt } = old;
        return [{ ...now, status, startedAt, lastPlayedAt, finishedAt, updatedAt: nowIso() }];
      });
      if (restored.length) void saveGames(restored);
    };
    const saveCopy = (copy: Copy) => {
      commit({ ...libRef.current, copies: replaceById(libRef.current.copies, copy) });
      return persist((r) => r.save({ copies: [copy] }));
    };
    const saveWish = (wish: WishItem) => {
      commit({ ...libRef.current, wishlist: replaceById(libRef.current.wishlist, wish) });
      return persist((r) => r.save({ wishlist: [wish] }));
    };
    const saveList = (list: GameList) => {
      commit({ ...libRef.current, lists: replaceById(libRef.current.lists, list) });
      return persist((r) => r.save({ lists: [list] }));
    };
    const findGame = (id: string) => libRef.current.games.find((g) => g.id === id);

    const a: Actions = {
      reload,

      addGame(input, copyInput) {
        const game = createGame(input);
        if (game.status === "jugando") {
          game.startedAt ??= todayIso();
          game.lastPlayedAt ??= todayIso();
        }
        if (game.status === "completado") game.finishedAt ??= todayIso();
        const copy = copyInput ? createCopy(game.id, copyInput) : null;
        commit({
          ...libRef.current,
          games: [...libRef.current.games, game],
          copies: copy ? [...libRef.current.copies, copy] : libRef.current.copies,
        });
        void persist((r) => r.save({ games: [game], copies: copy ? [copy] : [] }));
        return game;
      },

      updateGame(id, patch) {
        const game = findGame(id);
        if (!game) return;
        void saveGame({ ...game, ...patch, id, updatedAt: nowIso() });
      },

      setStatus(id, status) {
        const previous = findGame(id);
        if (!previous || previous.status === status) return;
        void saveGame(withStatus(previous, status));
        toast(`«${previous.title}» pasa a ${STATUS_LABEL[status]}`, {
          action: { label: "Deshacer", onClick: () => undoStatus([previous]) },
        });
      },

      setCompleted100(id, done) {
        const previous = findGame(id);
        if (!previous) return;
        // Al 100 % es que lo has terminado; quitarlo no lo devuelve a otro estado.
        const finishing = done && previous.status !== "completado";
        const next = finishing ? withStatus(previous, "completado") : { ...previous, updatedAt: nowIso() };
        void saveGame({ ...next, completed100: done });
        if (finishing) {
          toast(`«${previous.title}» pasa a ${STATUS_LABEL.completado}`, {
            action: { label: "Deshacer", onClick: () => undoStatus([previous]) },
          });
        }
      },

      setFinishedAt(id, date) {
        const previous = findGame(id);
        if (!previous) return;
        // Terminar la historia es completarlo. Borrar la fecha lo descompleta: vuelve a Jugando si lo
        // habías empezado y si no a Pendiente; al 100 % sigue completado, porque el trofeo dice que lo terminaste.
        const finishing = Boolean(date) && previous.status !== "completado";
        const unfinishing = !date && previous.status === "completado" && !previous.completed100;
        const backTo: GameStatus = previous.startedAt || previous.hoursPlayed || previous.lastPlayedAt ? "jugando" : "pendiente";
        const next = finishing
          ? withStatus(previous, "completado")
          : unfinishing
            ? { ...previous, status: backTo, updatedAt: nowIso() }
            : { ...previous, updatedAt: nowIso() };
        void saveGame({ ...next, finishedAt: date });
        if (finishing || unfinishing) {
          const message = finishing ? `«${previous.title}» pasa a ${STATUS_LABEL.completado}` : `«${previous.title}» vuelve a ${STATUS_LABEL[backTo]}`;
          toast(message, { action: { label: "Deshacer", onClick: () => undoStatus([previous]) } });
        }
      },

      setStatusMany(ids, status) {
        // Solo cuentan los que cambian: si ninguno cambia, no hay nada que avisar.
        const previous = ids.map(findGame).filter((g): g is Game => Boolean(g) && g!.status !== status);
        if (previous.length === 0) return;
        void saveGames(previous.map((g) => withStatus(g, status)));
        const what = previous.length === 1 ? `«${previous[0].title}» pasa` : `${previous.length} juegos pasan`;
        toast(`${what} a ${STATUS_LABEL[status]}`, {
          action: { label: "Deshacer", onClick: () => undoStatus(previous) },
        });
      },

      markPlayedToday(id) {
        const game = findGame(id);
        if (!game) return;
        const patch: Partial<Game> = { lastPlayedAt: todayIso() };
        if (game.status === "pendiente" || game.status === "pausado") {
          patch.status = "jugando";
          patch.startedAt = game.startedAt ?? todayIso();
        }
        void saveGame({ ...game, ...patch, updatedAt: nowIso() });
        toast(`Anotado: has jugado a «${game.title}» hoy`, {
          action: { label: "Deshacer", onClick: () => void saveGame({ ...game, updatedAt: nowIso() }) },
        });
      },

      deleteGame(id) {
        const before = libRef.current;
        const game = before.games.find((g) => g.id === id);
        if (!game) return;
        const copies = before.copies.filter((c) => c.gameId === id);
        const lists = before.lists.filter((l) => l.gameIds.includes(id));
        commit({
          ...before,
          games: before.games.filter((g) => g.id !== id),
          copies: before.copies.filter((c) => c.gameId !== id),
          lists: before.lists.map((l) => (l.gameIds.includes(id) ? { ...l, gameIds: l.gameIds.filter((g) => g !== id) } : l)),
        });
        void persist((r) => r.deleteGame(id));
        toast(`«${game.title}» eliminado de la biblioteca`, {
          description: copies.length > 1 ? `Con sus ${copies.length} copias.` : undefined,
          action: {
            label: "Deshacer",
            onClick: () => {
              const now = libRef.current;
              const restoredLists = now.lists.map((l) => lists.find((o) => o.id === l.id) ?? l);
              commit({ ...now, games: [...now.games, game], copies: [...now.copies, ...copies], lists: restoredLists });
              void persist((r) => r.save({ games: [game], copies, lists }));
            },
          },
        });
      },

      addCopy(gameId, input) {
        const copy = createCopy(gameId, input);
        void saveCopy(copy);
        return copy;
      },

      updateCopy(id, patch) {
        const copy = libRef.current.copies.find((c) => c.id === id);
        if (!copy) return;
        void saveCopy({ ...copy, ...patch, id, updatedAt: nowIso() });
      },

      deleteCopy(id) {
        const copy = libRef.current.copies.find((c) => c.id === id);
        if (!copy) return;
        commit({ ...libRef.current, copies: libRef.current.copies.filter((c) => c.id !== id) });
        void persist((r) => r.deleteCopy(id));
        toast(`Copia de ${copy.platform} eliminada`, {
          action: { label: "Deshacer", onClick: () => void saveCopy(copy) },
        });
      },

      addWish(input) {
        const stamp = nowIso();
        const wish: WishItem = {
          coverUrl: null,
          igdbId: null,
          platform: null,
          priority: "media",
          targetPrice: null,
          notes: null,
          genres: [],
          prices: [],
          ...input,
          title: input.title.trim(),
          id: newId(),
          createdAt: stamp,
          updatedAt: stamp,
        };
        void saveWish(wish);
        return wish;
      },

      updateWish(id, patch) {
        const wish = libRef.current.wishlist.find((w) => w.id === id);
        if (!wish) return;
        void saveWish({ ...wish, ...patch, id, updatedAt: nowIso() });
      },

      deleteWish(id) {
        const wish = libRef.current.wishlist.find((w) => w.id === id);
        if (!wish) return;
        commit({ ...libRef.current, wishlist: libRef.current.wishlist.filter((w) => w.id !== id) });
        void persist((r) => r.deleteWish(id));
        toast(`«${wish.title}» quitado de la lista de deseos`, {
          action: { label: "Deshacer", onClick: () => void saveWish(wish) },
        });
      },

      convertWish(id, copyInput, existingGameId) {
        const before = libRef.current;
        const wish = before.wishlist.find((w) => w.id === id);
        if (!wish) throw new Error("Ese deseo ya no existe.");
        const stamp = nowIso();
        let game = existingGameId ? before.games.find((g) => g.id === existingGameId) : undefined;
        const notes = [wish.notes, wish.targetPrice != null ? `Precio objetivo en la lista de deseos: ${wish.targetPrice} €` : null]
          .filter(Boolean)
          .join("\n");
        if (!game) {
          game = {
            id: newId(),
            title: wish.title,
            coverUrl: wish.coverUrl ?? null,
            backdropUrl: null,
            igdbId: wish.igdbId ?? null,
            genres: wish.genres,
            tags: [],
            status: "pendiente",
            completed100: false,
            favorite: false,
            rating: null,
            hoursPlayed: null,
            notes: notes || null,
            startedAt: null,
            finishedAt: null,
            lastPlayedAt: null,
            modes: [],
            moods: [],
            sessionMinutes: null,
            lengthHours: null,
            createdAt: stamp,
            updatedAt: stamp,
            demo: wish.demo,
          };
        }
        const latest = [...wish.prices].sort((x, y) => y.date.localeCompare(x.date))[0];
        const copy = createCopy(game.id, {
          pricePaid: latest?.amount ?? null,
          store: latest?.store ?? null,
          acquiredAt: todayIso(),
          ...copyInput,
          demo: wish.demo,
        });
        const isNewGame = !before.games.some((g) => g.id === game!.id);
        commit({
          ...before,
          games: isNewGame ? [...before.games, game] : before.games,
          copies: [...before.copies, copy],
          wishlist: before.wishlist.filter((w) => w.id !== id),
        });
        void persist(async (r) => {
          await r.save({ games: isNewGame ? [game!] : [], copies: [copy] });
          await r.deleteWish(id);
        });
        return game;
      },

      addList(name) {
        const stamp = nowIso();
        const list: GameList = { id: newId(), name: name.trim(), gameIds: [], createdAt: stamp, updatedAt: stamp };
        void saveList(list);
        return list;
      },

      renameList(id, name) {
        const list = libRef.current.lists.find((l) => l.id === id);
        if (list) void saveList({ ...list, name: name.trim(), updatedAt: nowIso() });
      },

      deleteList(id) {
        const list = libRef.current.lists.find((l) => l.id === id);
        if (!list) return;
        commit({ ...libRef.current, lists: libRef.current.lists.filter((l) => l.id !== id) });
        void persist((r) => r.deleteList(id));
        toast(`Lista «${list.name}» eliminada`, {
          description: "Los juegos siguen en tu biblioteca.",
          action: { label: "Deshacer", onClick: () => void saveList(list) },
        });
      },

      toggleInList(listId, gameId) {
        const list = libRef.current.lists.find((l) => l.id === listId);
        if (!list) return;
        const gameIds = list.gameIds.includes(gameId) ? list.gameIds.filter((g) => g !== gameId) : [...list.gameIds, gameId];
        void saveList({ ...list, gameIds, updatedAt: nowIso() });
      },

      async applyChanges(changes) {
        const repo = repoRef.current;
        if (!repo) return;
        await repo.save(changes);
        commit(await repo.load());
      },

      async importSteam(items) {
        const repo = repoRef.current;
        if (!repo) throw new Error("La biblioteca aún no está lista.");
        const plan = planSteamImport(libRef.current, items);
        await repo.save({ games: plan.games, copies: plan.copies });
        const before = libRef.current;
        const changed = new Map(plan.games.map((g) => [g.id, g]));
        const known = new Set(before.games.map((g) => g.id));
        commit({
          ...before,
          games: [...before.games.map((g) => changed.get(g.id) ?? g), ...plan.games.filter((g) => !known.has(g.id))],
          copies: [...before.copies, ...plan.copies],
        });
        return plan.counts;
      },

      async importGameTracker(items) {
        const repo = repoRef.current;
        if (!repo) throw new Error("La biblioteca aún no está lista.");
        const plan = planGameTrackerImport(libRef.current, items);
        if (plan.games.length || plan.copies.length || plan.wishlist.length) await repo.save({ games: plan.games, copies: plan.copies, wishlist: plan.wishlist });
        const before = libRef.current;
        // Por identificador: al repetir una tanda cortada, lo reescrito sustituye a lo que ya hubiera.
        const merge = <T extends { id: string }>(current: T[], added: T[]) => {
          const ids = new Set(added.map((x) => x.id));
          return [...current.filter((x) => !ids.has(x.id)), ...added];
        };
        commit({
          ...before,
          games: merge(before.games, plan.games),
          copies: merge(before.copies, plan.copies),
          wishlist: merge(before.wishlist, plan.wishlist),
        });
        return plan.counts;
      },

      async deleteAllGames() {
        const repo = repoRef.current;
        if (!repo) throw new Error("La biblioteca aún no está lista.");
        await repo.deleteAllGames();
        const data = await repo.load();
        commit(data);
        // Sin permiso, la base de datos no da error: simplemente no borra nada.
        if (data.games.length) throw new Error("Algunos juegos no se han podido eliminar.");
      },

      async loadDemo() {
        const repo = repoRef.current;
        if (!repo) return;
        await repo.save(createDemoLibrary());
        commit(await repo.load());
      },

      async removeDemo() {
        const repo = repoRef.current;
        if (!repo) return;
        await repo.deleteDemo();
        commit(await repo.load());
      },
    };
    return a;
  }, [commit, persist, reload]);

  const value = useMemo(() => ({ state, error, mode, library, actions }), [state, error, mode, library, actions]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary debe usarse dentro de LibraryProvider");
  return ctx;
}
