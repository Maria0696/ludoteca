import { type Game, type Library, type SagaExtra, type YearWrap, emptyLibrary, upgradeExtraV1, upgradeGameV1 } from "../model";
import type { Changes, Repository } from "./types";

/*
 * Modo local: toda la biblioteca vive en IndexedDB, en este navegador.
 * No se sincroniza con otros dispositivos. Se guarda como un único
 * documento y las escrituras se encadenan para no pisarse.
 */

const DB_NAME = "ludoteca";
const STORE = "library";
const KEY = "data";
/** Formato de lo guardado. Sin él, es el 1: «saga» era la franquicia y «series» la saga (ver `upgradeGameV1`). */
export const FORMAT = 2;
type Stored = Partial<Library> & { format?: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      // Si otra pestaña necesita actualizar o borrar el almacén, no la bloqueamos.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

function read(db: IDBDatabase): Promise<Stored | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as Stored | undefined);
    req.onerror = () => reject(req.error);
  });
}

function write(db: IDBDatabase, value: Library): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...value, format: FORMAT } satisfies Stored, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar en este navegador."));
  });
}

/** Un año del Anuario por año: el que llega sustituye al que había. */
function upsertYears(list: YearWrap[], items: YearWrap[] | undefined): YearWrap[] {
  if (!items?.length) return list;
  const byYear = new Map(list.map((w) => [w.year, w]));
  for (const w of items) byYear.set(w.year, w);
  return [...byYear.values()];
}

function upsert<T extends { id: string }>(list: T[], items: T[] | undefined): T[] {
  if (!items?.length) return list;
  const byId = new Map(list.map((i) => [i.id, i]));
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}

export class LocalRepository implements Repository {
  readonly mode = "local" as const;
  private db: Promise<IDBDatabase> | null = null;
  private data: Library = emptyLibrary();
  private queue: Promise<void> = Promise.resolve();

  private getDb() {
    this.db ??= openDb();
    return this.db;
  }

  async load(): Promise<Library> {
    const stored = await read(await this.getDb());
    // Lo guardado en el formato 1 se lee en el 2; se queda en el 2 al guardar lo siguiente.
    const old = stored != null && stored.format !== FORMAT;
    // Solo lo que la app usa: lo que quede de versiones anteriores (como las listas) se deja atrás.
    // Los juegos guardados antes de las vueltas no las traen: sin vueltas anteriores.
    const games = (stored?.games ?? [])
      .map((g) => (old ? upgradeGameV1(g) : g) as Game)
      .map((g) => ({ ...g, pastRuns: g.pastRuns ?? [], saga: g.saga ?? null, sagaOrder: g.sagaOrder ?? null }));
    const extras = (stored?.extras ?? []).map((x) => (old ? upgradeExtraV1(x) : x) as SagaExtra);
    this.data = { games, copies: stored?.copies ?? [], wishlist: stored?.wishlist ?? [], extras, wraps: stored?.wraps ?? [] };
    return structuredClone(this.data);
  }

  private commit(mutate: (d: Library) => Library): Promise<void> {
    const run = async () => {
      this.data = mutate(this.data);
      await write(await this.getDb(), this.data);
    };
    this.queue = this.queue.then(run, run);
    return this.queue;
  }

  save(changes: Changes) {
    return this.commit((d) => ({
      games: upsert(d.games, changes.games),
      copies: upsert(d.copies, changes.copies),
      wishlist: upsert(d.wishlist, changes.wishlist),
      extras: upsert(d.extras, changes.extras),
      wraps: upsertYears(d.wraps, changes.wraps),
    }));
  }

  deleteGame(id: string) {
    return this.commit((d) => ({
      ...d,
      games: d.games.filter((g) => g.id !== id),
      copies: d.copies.filter((c) => c.gameId !== id),
    }));
  }

  deleteCopy(id: string) {
    return this.commit((d) => ({ ...d, copies: d.copies.filter((c) => c.id !== id) }));
  }

  deleteWish(id: string) {
    return this.commit((d) => ({ ...d, wishlist: d.wishlist.filter((w) => w.id !== id) }));
  }

  deleteExtra(id: string) {
    return this.commit((d) => ({ ...d, extras: d.extras.filter((x) => x.id !== id) }));
  }

  deleteAllGames() {
    return this.commit((d) => ({ ...d, games: [], copies: [], extras: [] }));
  }

  deleteDemo() {
    return this.commit((d) => {
      const demoGames = new Set(d.games.filter((g) => g.demo).map((g) => g.id));
      return {
        games: d.games.filter((g) => !g.demo),
        copies: d.copies.filter((c) => !c.demo && !demoGames.has(c.gameId)),
        wishlist: d.wishlist.filter((w) => !w.demo),
        extras: d.extras.filter((x) => !x.demo),
        wraps: d.wraps,
      };
    });
  }
}
