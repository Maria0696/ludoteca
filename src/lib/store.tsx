"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { computeYear, hasActivity } from "./anuario";
import { createDemoLibrary } from "./demo";
import {
  type Copy,
  type Game,
  type GameStatus,
  type Library,
  type NewCopyInput,
  type NewGameInput,
  type NewExtraInput,
  type SagaExtra,
  type WishItem,
  type YearWrap,
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
import { archiveRun, reopenSameDayRun, runNumber } from "./runs";
import { absorbExtras, ownedExtras } from "./sagas";
import type { Changes, Repository, StorageMode } from "./repo/types";
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
  /** Varios cambios a la vez, guardados de una sola vez (p. ej. la cronología de una saga). */
  updateGames(patches: { id: string; patch: Partial<Game> }[]): void;
  setStatus(id: string, status: GameStatus): void;
  /** Empieza otra vuelta de un juego ya superado: lo terminado se guarda y no se pierde. */
  replay(id: string): void;
  /** Cambia el estado de varios juegos de una vez: un solo guardado, un solo aviso y un solo «Deshacer». */
  setStatusMany(ids: string[], status: GameStatus): void;
  /** Marca o quita el 100 %; marcarlo también lo pasa a Completado, en un solo guardado. */
  setCompleted100(id: string, done: boolean): void;
  /** Anota o borra la fecha de fin; anotarla también lo pasa a Completado, en un solo guardado. */
  setFinishedAt(id: string, date: string | null): void;
  /** Anota o borra la fecha de inicio; de Pendiente pasa a Jugando y, al borrarla, vuelve a Pendiente. */
  setStartedAt(id: string, date: string | null): void;
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
  /** Juegos de saga que no tienes: se meten a mano (con lo que trae IGDB), se ordenan y se quitan. */
  addExtras(items: NewExtraInput[]): SagaExtra[];
  updateExtras(patches: { id: string; patch: Partial<SagaExtra> }[]): void;
  deleteExtra(id: string): void;
  /** Quita varios a la vez, sin aviso (lo da quien llama), y los devuelve para poder deshacer. */
  removeExtras(ids: string[]): SagaExtra[];
  restoreExtras(extras: SagaExtra[]): void;
  /** Congela un año del Anuario: lo calcula ahora y lo guarda (si ya estaba, lo sustituye). */
  freezeYear(year: number): YearWrap;
  /** Pasa un deseo a la biblioteca: crea (o reutiliza) el juego y añade la copia. */
  convertWish(id: string, copy: NewCopyInput, existingGameId?: string): Game;
  applyChanges(changes: Changes): Promise<void>;
  /** Guarda un grupo de juegos de Steam; si falla, avisa con un error y no cambia nada. */
  importSteam(items: SteamImportItem[]): Promise<SteamImportCounts>;
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

  /**
   * Guarda en segundo plano; si falla, avisa y vuelve a cargar lo guardado. Mientras queda algo por guardar, la página
   * lleva `data-guardando`: recargar o cerrar en ese momento perdería el cambio (las pruebas esperan a que se quite).
   */
  const pending = useRef(0);
  const persist = useCallback(
    (work: (repo: Repository) => Promise<void>) => {
      const repo = repoRef.current;
      if (!repo) return Promise.resolve();
      if (pending.current++ === 0) document.documentElement.setAttribute("data-guardando", "");
      return work(repo)
        .catch((e: unknown) => {
          toast.error("No se ha podido guardar el cambio", {
            description: e instanceof Error ? e.message : undefined,
            action: { label: "Reintentar carga", onClick: () => void reload() },
          });
          void reload();
        })
        .finally(() => {
          if (--pending.current === 0) document.documentElement.removeAttribute("data-guardando");
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
    /**
     * Un cambio a mano. Cambiar de saga saca al juego de su puesto en la cronología de la anterior:
     * entra en la nueva al final, sin inventar un orden (salvo que el cambio diga ya su puesto). Y vuelve a verse
     * en el apartado Sagas, si estaba quitado.
     */
    const patched = (game: Game, patch: Partial<Game>): Game => {
      const changes = "saga" in patch && (patch.saga?.trim() ?? null) !== (game.saga?.trim() ?? null);
      const moved = changes ? { ...(!("sagaOrder" in patch) ? { sagaOrder: null } : {}), ...(!("sagaHidden" in patch) ? { sagaHidden: false } : {}) } : {};
      return { ...game, ...patch, ...moved, id: game.id, updatedAt: nowIso() };
    };
    /** Las mismas reglas al cambiar de estado, uno o varios: fechas de inicio, última partida y fin. */
    const withStatus = (previous: Game, status: GameStatus, reopen = true): Game => {
      const today = todayIso();
      // Volver a jugar (o a tener pendiente) un juego ya terminado es otra vuelta: la terminada se guarda,
      // venga de «Completado», «Pausado» o «Abandonado».
      // Volver a «Completado» el mismo día que se guardó es deshacer ese error, no otra vuelta.
      const leaving = Boolean(previous.finishedAt) && (status === "jugando" || status === "pendiente");
      const base = leaving ? archiveRun(previous) : status === "completado" && reopen ? (reopenSameDayRun(previous, today) ?? previous) : previous;
      const next: Game = { ...base, status, updatedAt: nowIso() };
      if (status === "jugando") {
        next.startedAt ??= today;
        next.lastPlayedAt = today;
      }
      if (status === "completado") {
        next.finishedAt ??= today;
        // Terminado implica empezado: sin fecha de inicio, empieza el día que termina.
        next.startedAt ??= next.finishedAt;
      }
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
        const { status, startedAt, lastPlayedAt, finishedAt, pastRuns } = old;
        return [{ ...now, status, startedAt, lastPlayedAt, finishedAt, pastRuns, updatedAt: nowIso() }];
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
    const findGame = (id: string) => libRef.current.games.find((g) => g.id === id);
    /** Un juego que llega toma la saga y el puesto de su parada hueca, que desaparece (ver `absorbExtras`). */
    const absorb = (game: Game): { game: Game; dropped: string[] } => {
      const { games, dropped } = absorbExtras([game], libRef.current.extras);
      return { game: games[0], dropped };
    };

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
        const { game: added, dropped } = absorb(game);
        commit({
          ...libRef.current,
          games: [...libRef.current.games, added],
          copies: copy ? [...libRef.current.copies, copy] : libRef.current.copies,
          extras: libRef.current.extras.filter((x) => !dropped.includes(x.id)),
        });
        void persist(async (r) => {
          await r.save({ games: [added], copies: copy ? [copy] : [] });
          for (const id of dropped) await r.deleteExtra(id);
        });
        return added;
      },

      updateGame(id, patch) {
        const game = findGame(id);
        if (!game) return;
        void saveGame(patched(game, patch));
      },

      updateGames(patches) {
        const games = patches.flatMap(({ id, patch }) => {
          const game = findGame(id);
          return game ? [patched(game, patch)] : [];
        });
        if (games.length) void saveGames(games);
      },

      setStatus(id, status) {
        const previous = findGame(id);
        if (!previous || previous.status === status) return;
        void saveGame(withStatus(previous, status));
        toast(`«${previous.title}» pasa a ${STATUS_LABEL[status]}`, {
          action: { label: "Deshacer", onClick: () => undoStatus([previous]) },
        });
      },

      replay(id) {
        const previous = findGame(id);
        if (!previous?.finishedAt || previous.endless) return;
        const today = todayIso();
        const next: Game = { ...archiveRun(previous), status: "jugando", startedAt: today, lastPlayedAt: today, updatedAt: nowIso() };
        void saveGame(next);
        toast(`«${previous.title}» empieza la vuelta ${runNumber(next)}`, {
          action: { label: "Deshacer", onClick: () => undoStatus([previous]) },
        });
      },

      setCompleted100(id, done) {
        const previous = findGame(id);
        if (!previous) return;
        // Al 100 % es que lo has terminado; quitarlo no lo devuelve a otro estado.
        // Un juego sin final no se termina: su 100 % son sus logros y no cambia el estado.
        const finishing = done && previous.status !== "completado" && !previous.endless;
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
        // Terminar la historia es completarlo, y también empezarlo: sin inicio, empieza el día que termina.
        // Borrar la fecha lo descompleta: vuelve a Jugando si «Empieza la aventura» está marcada y si no a
        // Pendiente; al 100 % sigue completado, porque el trofeo dice que lo terminaste.
        const finishing = Boolean(date) && previous.status !== "completado";
        const unfinishing = !date && previous.status === "completado" && !previous.completed100;
        const backTo: GameStatus = previous.startedAt ? "jugando" : "pendiente";
        // Terminar hoy una vuelta recién guardada hoy la recupera tal cual, con su inicio; con otra fecha, no.
        const next = finishing
          ? withStatus(previous, "completado", date === todayIso())
          : unfinishing
            ? { ...previous, status: backTo, updatedAt: nowIso() }
            : { ...previous, updatedAt: nowIso() };
        const reopened = next.pastRuns !== previous.pastRuns;
        void saveGame(reopened ? next : { ...next, finishedAt: date, startedAt: date ? (previous.startedAt ?? date) : next.startedAt });
        if (finishing || unfinishing) {
          const message = finishing ? `«${previous.title}» pasa a ${STATUS_LABEL.completado}` : `«${previous.title}» vuelve a ${STATUS_LABEL[backTo]}`;
          toast(message, { action: { label: "Deshacer", onClick: () => undoStatus([previous]) } });
        }
      },

      setStartedAt(id, date) {
        const previous = findGame(id);
        if (!previous) return;
        // Empezar la aventura es ponerse a jugar; borrar el inicio de un juego en marcha lo devuelve a Pendiente.
        // Abandonado o Completado no cambian: dicen más que la fecha.
        const to: GameStatus | null =
          date && previous.status === "pendiente" ? "jugando" : !date && (previous.status === "jugando" || previous.status === "pausado") ? "pendiente" : null;
        void saveGame({ ...previous, ...(to ? { status: to } : {}), startedAt: date, updatedAt: nowIso() });
        if (to) {
          toast(`«${previous.title}» ${to === "jugando" ? "pasa a" : "vuelve a"} ${STATUS_LABEL[to]}`, {
            action: { label: "Deshacer", onClick: () => undoStatus([previous]) },
          });
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
        // Ponerse a jugar uno pendiente o en pausa: las mismas reglas del estado (si ya estaba terminado, otra vuelta).
        const resumes = game.status === "pendiente" || game.status === "pausado";
        const next = resumes ? withStatus(game, "jugando") : { ...game, lastPlayedAt: todayIso(), updatedAt: nowIso() };
        void saveGame(next);
        toast(`Anotado: has jugado a «${game.title}» hoy`, {
          action: { label: "Deshacer", onClick: () => void saveGame({ ...game, updatedAt: nowIso() }) },
        });
      },

      deleteGame(id) {
        const before = libRef.current;
        const game = before.games.find((g) => g.id === id);
        if (!game) return;
        const copies = before.copies.filter((c) => c.gameId === id);
        commit({
          ...before,
          games: before.games.filter((g) => g.id !== id),
          copies: before.copies.filter((c) => c.gameId !== id),
        });
        void persist((r) => r.deleteGame(id));
        toast(`«${game.title}» eliminado de la biblioteca`, {
          description: copies.length > 1 ? `Con sus ${copies.length} copias.` : undefined,
          action: {
            label: "Deshacer",
            onClick: () => {
              const now = libRef.current;
              commit({ ...now, games: [...now.games, game], copies: [...now.copies, ...copies] });
              void persist((r) => r.save({ games: [game], copies }));
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

      freezeYear(year) {
        const stamp = nowIso();
        const before = libRef.current.wraps.find((w) => w.year === year);
        const wrap: YearWrap = { id: before?.id ?? newId(), year, data: computeYear(libRef.current, year), frozenAt: stamp, createdAt: before?.createdAt ?? stamp, updatedAt: stamp };
        commit({ ...libRef.current, wraps: [...libRef.current.wraps.filter((w) => w.year !== year), wrap] });
        void persist((r) => r.save({ wraps: [wrap] }));
        return wrap;
      },

      addExtras(items) {
        const stamp = nowIso();
        const extras = items.map((item) => ({ ...item, id: newId(), createdAt: stamp, updatedAt: stamp }));
        if (!extras.length) return [];
        commit({ ...libRef.current, extras: [...libRef.current.extras, ...extras] });
        void persist((r) => r.save({ extras }));
        return extras;
      },

      updateExtras(patches) {
        const stamp = nowIso();
        const extras = patches.flatMap(({ id, patch }) => {
          const extra = libRef.current.extras.find((x) => x.id === id);
          return extra ? [{ ...extra, ...patch, id, updatedAt: stamp }] : [];
        });
        if (!extras.length) return;
        commit({ ...libRef.current, extras: libRef.current.extras.map((x) => extras.find((e) => e.id === x.id) ?? x) });
        void persist((r) => r.save({ extras }));
      },

      removeExtras(ids) {
        const removed = libRef.current.extras.filter((x) => ids.includes(x.id));
        if (!removed.length) return [];
        commit({ ...libRef.current, extras: libRef.current.extras.filter((x) => !ids.includes(x.id)) });
        void persist(async (r) => {
          for (const x of removed) await r.deleteExtra(x.id);
        });
        return removed;
      },

      restoreExtras(extras) {
        if (!extras.length) return;
        commit({ ...libRef.current, extras: [...libRef.current.extras.filter((x) => !extras.some((e) => e.id === x.id)), ...extras] });
        void persist((r) => r.save({ extras }));
      },

      deleteExtra(id) {
        const extra = libRef.current.extras.find((x) => x.id === id);
        if (!extra) return;
        commit({ ...libRef.current, extras: libRef.current.extras.filter((x) => x.id !== id) });
        void persist((r) => r.deleteExtra(id));
        toast(`«${extra.title}» quitado de la saga`, {
          action: {
            label: "Deshacer",
            onClick: () => {
              commit({ ...libRef.current, extras: [...libRef.current.extras, extra] });
              void persist((r) => r.save({ extras: [extra] }));
            },
          },
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
            endless: false,
            favorite: false,
            rating: null,
            hoursPlayed: null,
            notes: notes || null,
            startedAt: null,
            finishedAt: null,
            pastRuns: [],
            saga: null,
            sagaOrder: null,
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
        const absorbed = isNewGame ? absorb(game) : { game, dropped: [] as string[] };
        game = absorbed.game;
        commit({
          ...before,
          games: isNewGame ? [...before.games, game] : before.games,
          copies: [...before.copies, copy],
          wishlist: before.wishlist.filter((w) => w.id !== id),
          extras: before.extras.filter((x) => !absorbed.dropped.includes(x.id)),
        });
        void persist(async (r) => {
          await r.save({ games: isNewGame ? [game!] : [], copies: [copy] });
          await r.deleteWish(id);
          for (const x of absorbed.dropped) await r.deleteExtra(x);
        });
        return game;
      },

      async applyChanges(changes) {
        const repo = repoRef.current;
        if (!repo) return;
        // Los juegos nuevos ocupan su parada hueca; y no entran paradas de juegos que ya tienes.
        const before = libRef.current;
        const known = new Set(before.games.map((g) => g.id));
        const pool = [...before.extras, ...(changes.extras ?? [])];
        const absorbed = absorbExtras((changes.games ?? []).filter((g) => !known.has(g.id)), pool);
        const byId = new Map(absorbed.games.map((g) => [g.id, g]));
        const games = changes.games?.map((g) => byId.get(g.id) ?? g);
        const gone = new Set([...absorbed.dropped, ...ownedExtras(pool, [...before.games, ...(games ?? [])])]);
        await repo.save({ ...changes, games, extras: changes.extras?.filter((x) => !gone.has(x.id)) });
        for (const x of before.extras) if (gone.has(x.id)) await repo.deleteExtra(x.id);
        commit(await repo.load());
      },

      async importSteam(items) {
        const repo = repoRef.current;
        if (!repo) throw new Error("La biblioteca aún no está lista.");
        const plan = planSteamImport(libRef.current, items);
        const before = libRef.current;
        const known = new Set(before.games.map((g) => g.id));
        // Los juegos nuevos ocupan su parada hueca; las paradas de juegos que ya tienes sobran.
        const absorbed = absorbExtras(plan.games.filter((g) => !known.has(g.id)), before.extras);
        const fresh = new Map(absorbed.games.map((g) => [g.id, g]));
        const games = plan.games.map((g) => fresh.get(g.id) ?? g);
        const changed = new Map(games.map((g) => [g.id, g]));
        const all = [...before.games.map((g) => changed.get(g.id) ?? g), ...games.filter((g) => !known.has(g.id))];
        const gone = new Set([...absorbed.dropped, ...ownedExtras(before.extras, all)]);
        await repo.save({ games, copies: plan.copies });
        for (const x of before.extras) if (gone.has(x.id)) await repo.deleteExtra(x.id);
        commit({
          ...before,
          games: all,
          copies: [...before.copies, ...plan.copies],
          extras: before.extras.filter((x) => !gone.has(x.id)),
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

  // El año que acaba de terminar se congela solo, una vez, si tiene algo que contar (ver el Anuario).
  const frozeLastYear = useRef(false);
  useEffect(() => {
    if (state !== "ready" || frozeLastYear.current) return;
    frozeLastYear.current = true;
    const last = new Date().getFullYear() - 1;
    if (!libRef.current.wraps.some((w) => w.year === last) && hasActivity(computeYear(libRef.current, last))) actions.freezeYear(last);
  }, [state, actions]);

  const value = useMemo(() => ({ state, error, mode, library, actions }), [state, error, mode, library, actions]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary debe usarse dentro de LibraryProvider");
  return ctx;
}
