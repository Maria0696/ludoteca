import { expect, test } from "@playwright/test";
import { describeAutoBackup } from "../../src/lib/auto-backup";
import { createBackup, parseBackup } from "../../src/lib/backup";
import { backupStatus, reminderText, shouldRemind } from "../../src/lib/backup-reminder";
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

test("en la nube, Inicio solo avisa si las copias automáticas se paran (no por la copia manual ni por «cada cuánto»)", () => {
  const now = new Date("2026-11-27T12:00:00");
  const never = backupStatus(null, null, now, 30);
  const recentManual = backupStatus("2026-11-26T10:00:00", null, now, 30);
  // En local, como siempre: según la copia manual.
  expect(shouldRemind(never, 10, 30)).toBe(true);
  expect(shouldRemind(recentManual, 10, 30)).toBe(false);
  // En la nube, con la automática al día, nada; aunque nunca se haya exportado a mano.
  expect(shouldRemind(never, 10, 30, { autoDays: 0 })).toBe(false);
  expect(shouldRemind(never, 10, 30, { autoDays: 1 })).toBe(false);
  // Si se paran, avisa; aunque la copia manual sea de ayer y aunque se haya elegido «nunca».
  expect(shouldRemind(recentManual, 10, 30, { autoDays: 2 })).toBe(true);
  expect(shouldRemind(recentManual, 10, null, { autoDays: 3 })).toBe(true);
  expect(shouldRemind(never, 10, 30, { autoDays: null })).toBe(true);
  // «Ahora no» lo esconde igual, y sin nada propio no hay nada que perder.
  expect(shouldRemind(backupStatus(null, "2026-11-25T10:00:00", now, 30), 10, 30, { autoDays: 5 })).toBe(false);
  expect(shouldRemind(never, 0, 30, { autoDays: 5 })).toBe(false);
});

test("el aviso de Inicio dice lo que pasa: en la nube, que las automáticas se pararon", () => {
  expect(reminderText({ autoDays: 3 }, null)).toEqual({
    headline: "Las copias automáticas se pararon hace 3 días.",
    detail: "Mira el correo de GitHub o exporta una copia ahora.",
  });
  expect(reminderText({ autoDays: null }, null).headline).toBe("Aún no se ha hecho ninguna copia automática.");
  expect(reminderText(undefined, 40).headline).toBe("Tu última copia es de hace 40 días.");
  expect(reminderText(undefined, null).headline).toBe("Aún no has guardado ninguna copia de tu biblioteca.");
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
