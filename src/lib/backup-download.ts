import { backupFileName, createBackup } from "./backup";
import { markBackupExported } from "./backup-reminder";
import type { Library } from "./model";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const backupSummary = (c: { games: number; copies: number; wishlist: number }) =>
  `${count(c.games, "juego", "juegos")}, ${count(c.copies, "copia", "copias")} y ${count(c.wishlist, "deseo", "deseos")}`;

/**
 * Descarga la copia de seguridad como archivo JSON y apunta la fecha para el
 * recordatorio. Devuelve el resumen de lo exportado para mostrarlo.
 */
export function downloadBackup(library: Library, options: { includeDemo?: boolean } = {}): string {
  const backup = createBackup(library, options);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = backupFileName();
  a.click();
  URL.revokeObjectURL(url);
  markBackupExported();
  const d = backup.data;
  return backupSummary({ games: d.games.length, copies: d.copies.length, wishlist: d.wishlist.length });
}
