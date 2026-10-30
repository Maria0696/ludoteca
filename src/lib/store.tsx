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
  type WishItem,
  STATUS_LABEL,
  emptyLibrary,
  newId,
  nowIso,
  todayIso,
} from "./model";
import { isSupabaseConfigured, localModeAllowed } from "./config";
import { LocalRepository } from "./repo/local";
import type { Changes, Repository, StorageMode } from "./repo/types";

/*
 * Estado de la biblioteca en el cliente. Cada acción actualiza la pantalla
 * al momento y guarda en segundo plano; si el guardado falla, se avisa y se
 * recarga lo que hay realmente guardado.
 */

export type LoadState = "loading" | "ready" | "error" | "setup";

export type NewGameInput = Partial<Omit<Game, "id" | "createdAt" | "updatedAt">> & { title: string };
export type NewCopyInput = Partial<Omit<Copy, "id" | "gameId" | "createdAt" | "updatedAt">> & Pick<Copy, "platform" | "format">;

interface Actions {
  reload(): Promise<void>;
  addGame(game: NewGameInput, copy?: NewCopyInput): Game;
  updateGame(id: string, patch: Partial<Game>): void;
  setStatus(id: string, status: GameStatus): void;
  markPlayedToday(id: string): void;
  deleteGame(id: string): void;
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

    const buildCopy = (gameId: string, input: NewCopyInput): Copy => {
      const stamp = nowIso();
      return {
        edition: null,
        availability: "comprado",
        subscriptionService: null,
        acquiredAt: null,
        pricePaid: null,
        store: null,
        hasCase: null,
        hasFullArtwork: null,
        artworkPrintPending: null,
        artworkUrl: null,
        shelfLocation: null,
        lentTo: null,
        lentAt: null,
        ...input,
        id: newId(),
        gameId,
        createdAt: stamp,
        updatedAt: stamp,
      };
    };

    const a: Actions = {
      reload,

      addGame(input, copyInput) {
        const stamp = nowIso();
        const game: Game = {
          coverUrl: null,
          backdropUrl: null,
          igdbId: null,
          genres: [],
          tags: [],
          status: "pendiente",
          completed100: false,
          favorite: false,
          rating: null,
          hoursPlayed: null,
          notes: null,
          startedAt: null,
          finishedAt: null,
          lastPlayedAt: null,
          modes: [],
          moods: [],
          sessionMinutes: null,
          lengthHours: null,
          ...input,
          title: input.title.trim(),
          id: newId(),
          createdAt: stamp,
          updatedAt: stamp,
        };
        if (game.status === "jugando") {
          game.startedAt ??= todayIso();
          game.lastPlayedAt ??= todayIso();
        }
        if (game.status === "completado") game.finishedAt ??= todayIso();
        const copy = copyInput ? buildCopy(game.id, copyInput) : null;
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
        const next: Game = { ...previous, status, updatedAt: nowIso() };
        const today = todayIso();
        if (status === "jugando") {
          next.startedAt ??= today;
          next.lastPlayedAt = today;
        }
        if (status === "completado") next.finishedAt ??= today;
        void saveGame(next);
        toast(`«${previous.title}» pasa a ${STATUS_LABEL[status]}`, {
          action: { label: "Deshacer", onClick: () => void saveGame({ ...previous, updatedAt: nowIso() }) },
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
        const copy = buildCopy(gameId, input);
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
        const copy = buildCopy(game.id, {
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
