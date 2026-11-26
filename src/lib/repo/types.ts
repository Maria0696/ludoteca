import type { Copy, Game, Library, SagaExtra, WishItem, YearWrap } from "../model";

export type StorageMode = "local" | "supabase";

export interface Changes {
  games?: Game[];
  copies?: Copy[];
  wishlist?: WishItem[];
  extras?: SagaExtra[];
  /** Años del Anuario congelados: uno por año (si ya está, se sustituye). */
  wraps?: YearWrap[];
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
  deleteExtra(id: string): Promise<void>;
  /** Borra todos los juegos, sus copias y los juegos de saga que no tienes; los deseos no se tocan. */
  deleteAllGames(): Promise<void>;
  /** Elimina todos los registros marcados como demostración. */
  deleteDemo(): Promise<void>;
}
