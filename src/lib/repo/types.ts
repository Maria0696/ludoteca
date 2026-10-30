import type { Copy, Game, GameList, Library, WishItem } from "../model";

export type StorageMode = "local" | "supabase";

export interface Changes {
  games?: Game[];
  copies?: Copy[];
  wishlist?: WishItem[];
  lists?: GameList[];
}

/**
 * Persistencia de la biblioteca. La interfaz trabaja con el estado completo
 * en memoria; cada implementación guarda los cambios en su almacén.
 */
export interface Repository {
  readonly mode: StorageMode;
  load(): Promise<Library>;
  save(changes: Changes): Promise<void>;
  deleteGame(id: string): Promise<void>;
  deleteCopy(id: string): Promise<void>;
  deleteWish(id: string): Promise<void>;
  deleteList(id: string): Promise<void>;
  /** Elimina todos los registros marcados como demostración. */
  deleteDemo(): Promise<void>;
}
