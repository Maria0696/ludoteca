import { type Page, expect, test } from "@playwright/test";
import { addGame, loadDemo, openApp } from "./helpers";

async function openWarnings(page: Page) {
  await page.goto("/ajustes?apartado=eliminar");
  await page.getByRole("button", { name: "Eliminar todos los juegos" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "¿Eliminar tus 22 juegos?" })).toBeVisible();
  return dialog;
}

test("hay que pasar los tres avisos para eliminar todos los juegos", async ({ page }) => {
  await loadDemo(page);
  const dialog = await openWarnings(page);
  await expect(dialog).toContainText("24 copias");
  // Con Intro en el primer aviso solo se cancela: el foco está en el botón seguro.
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await dialog.getByRole("button", { name: "Sí, continuar" }).click();

  await expect(dialog.getByRole("heading", { name: "Esto no se puede deshacer" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: /Entiendo que mis juegos/ }).check();
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();

  await expect(dialog.getByRole("heading", { name: "Último aviso" })).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Eliminar 22 juegos" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/escribe ELIMINAR/).fill("borrar");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/escribe ELIMINAR/).fill("ELIMINAR");
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("No hay juegos que eliminar.")).toBeVisible();

  // Sigue vacía al volver a cargar, y los deseos no se han tocado.
  await openApp(page, "/biblioteca");
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();
  await page.goto("/deseos");
  await expect(page.getByText("Hollow Knight: Silksong").first()).toBeVisible();
});

test("cancelar en cualquier aviso no borra nada", async ({ page }) => {
  await loadDemo(page);
  let dialog = await openWarnings(page);
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();

  dialog = await openWarnings(page);
  await dialog.getByRole("button", { name: "Sí, continuar" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.goto("/biblioteca");
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
});

test("sin juegos no se ofrece el botón", async ({ page }) => {
  await openApp(page, "/ajustes?apartado=eliminar");
  await expect(page.getByText("No hay juegos que eliminar.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Eliminar todos los juegos" })).toHaveCount(0);
});

test("con un solo juego, el aviso no dice «tus 1 juego»", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });
  await page.goto("/ajustes?apartado=eliminar");
  await page.getByRole("button", { name: "Eliminar todos los juegos" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "¿Eliminar tu único juego?" })).toBeVisible();
});
