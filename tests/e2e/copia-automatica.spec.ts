import { expect, test } from "@playwright/test";
import { describeAutoBackup } from "../../src/lib/auto-backup";
import { createBackup, parseBackup } from "../../src/lib/backup";
import { backupStatus, shouldRemind } from "../../src/lib/backup-reminder";
import { createDemoLibrary } from "../../src/lib/demo";
import { libraryFromRows, libraryToRows } from "../../src/lib/repo/supabase";

/*
 * Copias automáticas: cada noche, GitHub pide a la app la copia (con una clave) y la guarda 90 días. Aquí, lo que se
 * puede probar sin Supabase: la copia sale de las filas igual que la manual, el aviso de Inicio y la ruta cerrada.
 */

test("la copia automática sale de las filas de Supabase con el mismo formato que la manual", () => {
  const library = createDemoLibrary();
  // Como las devuelve Supabase: con columnas de más (owner_id) que la app no usa.
  const rows = libraryToRows(library);
  for (const list of Object.values(rows)) for (const row of list) row.owner_id = "00000000-0000-0000-0000-000000000001";
  const restored = libraryFromRows(rows);
  expect(restored.games.map((g) => g.title)).toEqual(library.games.map((g) => g.title));
  expect(restored.copies).toHaveLength(library.copies.length);
  expect(restored.wishlist).toHaveLength(library.wishlist.length);
  const parsed = parseBackup(JSON.stringify(createBackup(restored, { includeDemo: true })));
  if (!parsed.ok) throw new Error(parsed.errors.join(", "));
  expect(parsed.backup.data.games).toHaveLength(library.games.length);
});

test("con una copia automática de hace menos de 2 días, Inicio no recuerda exportar", () => {
  const now = new Date("2026-11-27T12:00:00");
  // Sin copia manual nunca: tocaría avisar.
  const status = backupStatus(null, null, now, 30);
  expect(shouldRemind(status, 10, 30)).toBe(true);
  expect(shouldRemind(status, 10, 30, 0)).toBe(false);
  expect(shouldRemind(status, 10, 30, 1)).toBe(false);
  // Si las automáticas se paran, vuelve a avisar.
  expect(shouldRemind(status, 10, 30, 2)).toBe(true);
});

test("Ajustes dice cuándo fue la última copia automática", () => {
  expect(describeAutoBackup(null)).toBe("Aún no se ha hecho ninguna copia automática.");
  expect(describeAutoBackup(0)).toBe("Última copia automática: hoy.");
  expect(describeAutoBackup(1)).toBe("Última copia automática: ayer.");
  expect(describeAutoBackup(5)).toBe("Última copia automática: hace 5 días.");
});

test("en modo local no hay copia automática que pedir", async ({ request }) => {
  const res = await request.post("/api/copia-de-seguridad", { headers: { Authorization: "Bearer cualquiera" } });
  expect(res.status()).toBe(404);
});
