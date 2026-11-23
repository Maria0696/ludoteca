import { expect, test } from "@playwright/test";
import { backupStatus, daysBetween, describeLastBackup, shouldRemind } from "../../src/lib/backup-reminder";
import { addGame, loadDemo, openApp } from "./helpers";

const reminder = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Recordatorio de copia de seguridad" });

test("cuándo toca recordar la copia de seguridad", () => {
  const now = new Date(2026, 10, 7, 12);
  const ago = (days: number) => new Date(2026, 10, 7 - days, 9).toISOString();
  expect(daysBetween(new Date(2026, 9, 31, 23), new Date(2026, 10, 1, 1))).toBe(1);

  // Nunca exportada: se avisa, salvo que no haya nada propio que perder.
  expect(shouldRemind(backupStatus(null, null, now), 3)).toBe(true);
  expect(shouldRemind(backupStatus(null, null, now), 0)).toBe(false);
  // Antes de un mes no se avisa; a partir de 30 días, sí.
  expect(shouldRemind(backupStatus(ago(29), null, now), 3)).toBe(false);
  expect(shouldRemind(backupStatus(ago(30), null, now), 3)).toBe(true);
  // «Ahora no» lo esconde 7 días.
  expect(shouldRemind(backupStatus(ago(40), ago(6), now), 3)).toBe(false);
  expect(shouldRemind(backupStatus(ago(40), ago(7), now), 3)).toBe(true);
  // Cada cuánto se elige en Ajustes: cada semana avisa antes y «nunca» no avisa.
  expect(shouldRemind(backupStatus(ago(10), null, now), 3, 7)).toBe(true);
  expect(shouldRemind(backupStatus(ago(10), null, now), 3, 30)).toBe(false);
  expect(shouldRemind(backupStatus(null, null, now), 3, null)).toBe(false);
  // Una fecha estropeada cuenta como «nunca».
  expect(backupStatus("no-es-una-fecha", null, now).daysSinceBackup).toBeNull();

  expect(describeLastBackup(null)).toBe("Aún no has exportado ninguna copia desde este navegador.");
  expect(describeLastBackup(0)).toBe("Última copia desde este navegador: hoy.");
  expect(describeLastBackup(1)).toBe("Última copia desde este navegador: ayer.");
  expect(describeLastBackup(45)).toBe("Última copia desde este navegador: hace 45 días.");
});

test("el inicio recuerda hacer una copia y deja de hacerlo al exportarla", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });

  await openApp(page, "/");
  await expect(reminder(page)).toContainText("Aún no has guardado ninguna copia de tu biblioteca.");
  const downloadPromise = page.waitForEvent("download");
  await reminder(page).getByRole("button", { name: "Exportar copia" }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^ludoteca-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(page.getByText("Copia exportada: 1 juego, 1 copia y 0 deseos")).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);

  await openApp(page, "/ajustes?apartado=copia");
  await expect(page.getByText("Última copia desde este navegador: hoy.")).toBeVisible();

  // Una copia de hace 45 días vuelve a mostrar el aviso; «Ahora no» lo esconde.
  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 45);
    d.setHours(12, 0, 0, 0);
    localStorage.setItem("ludoteca:ultima-copia", d.toISOString());
  });
  await openApp(page, "/");
  await expect(reminder(page)).toContainText("Tu última copia es de hace 45 días.");
  await reminder(page).getByRole("button", { name: "Ahora no" }).click();
  await expect(page.getByText("Te lo recordaré dentro de 7 días.")).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Menú principal" })).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);
});

test("en modo local, el inicio enseña un solo aviso: el de la copia, que ya dice dónde se guarda todo", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });
  await openApp(page, "/");
  const local = page.getByText(/^Modo local: tu biblioteca se guarda solo en este navegador/);
  await expect(reminder(page)).toContainText("Se guarda solo en este navegador");
  await expect(local).toHaveCount(0);
  // Si lo dejas para luego, vuelve el de modo local, que además ofrece la sincronización.
  await reminder(page).getByRole("button", { name: "Ahora no" }).click();
  await expect(reminder(page)).toHaveCount(0);
  await expect(local).toBeVisible();
});

test("con solo datos de demostración no se pide copia", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/");
  await expect(page.getByRole("group", { name: "Menú principal" })).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);
  await openApp(page, "/ajustes?apartado=copia");
  await expect(page.getByText("Aún no has exportado ninguna copia desde este navegador.")).toBeVisible();
});
