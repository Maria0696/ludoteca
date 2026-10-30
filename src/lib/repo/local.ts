import { type Library, emptyLibrary } from "../model";
import type { Changes, Repository } from "./types";

/*
 * Modo local: toda la biblioteca vive en IndexedDB, en este navegador.
 * No se sincroniza con otros dispositivos. Se guarda como un único
 * documento y las escrituras se encadenan para no pisarse.
 */

const DB_NAME = "ludoteca";
const STORE = "library";
const KEY = "data";

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

function read(db: IDBDatabase): Promise<Library | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as Library | undefined);
    req.onerror = () => reject(req.error);
  });
}

function write(db: IDBDatabase, value: Library): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("No se pudo guardar en este navegador."));
  });
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
    this.data = { ...emptyLibrary(), ...stored };
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
      lists: upsert(d.lists, changes.lists),
    }));
  }

  deleteGame(id: string) {
    return this.commit((d) => ({
      ...d,
      games: d.games.filter((g) => g.id !== id),
      copies: d.copies.filter((c) => c.gameId !== id),
      lists: d.lists.map((l) => (l.gameIds.includes(id) ? { ...l, gameIds: l.gameIds.filter((g) => g !== id) } : l)),
    }));
  }

  deleteCopy(id: string) {
    return this.commit((d) => ({ ...d, copies: d.copies.filter((c) => c.id !== id) }));
  }

  deleteWish(id: string) {
    return this.commit((d) => ({ ...d, wishlist: d.wishlist.filter((w) => w.id !== id) }));
  }

  deleteList(id: string) {
    return this.commit((d) => ({ ...d, lists: d.lists.filter((l) => l.id !== id) }));
  }

  deleteDemo() {
    return this.commit((d) => {
      const demoGames = new Set(d.games.filter((g) => g.demo).map((g) => g.id));
      return {
        games: d.games.filter((g) => !g.demo),
        copies: d.copies.filter((c) => !c.demo && !demoGames.has(c.gameId)),
        wishlist: d.wishlist.filter((w) => !w.demo),
        lists: d.lists
          .filter((l) => !l.demo)
          .map((l) => ({ ...l, gameIds: l.gameIds.filter((id) => !demoGames.has(id)) })),
      };
    });
  }
}
