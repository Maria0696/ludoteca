import { type Page, expect, test } from "@playwright/test";
import { choosePlatform, openApp } from "./helpers";

async function openDialog(page: Page) {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("el cofre entrega el juego y se puede seguir añadiendo", async ({ page }) => {
  const dialog = await openDialog(page);

  // Sin datos avisa y no abre el cofre.
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByText("Escribe el título del juego.")).toBeVisible();
  await expect(dialog.getByText("Elige una plataforma para guardar la copia.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Añadir otro" })).toHaveCount(0);

  await dialog.getByLabel("Título").fill("Tunic");
  await choosePlatform(dialog, "PC");
  await dialog.getByRole("radio", { name: "Digital", exact: true }).click();
  await dialog.getByRole("radio", { name: "Jugando", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();

  await expect(dialog.getByRole("heading", { name: "¡Has conseguido Tunic!" })).toBeVisible();
  await expect(dialog.getByText("PC · Digital · Jugando")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Añadir otro" })).toBeFocused();
  // El juego recién guardado no se avisa como repetido.
  await expect(dialog.getByText(/^Ya tienes/)).toHaveCount(0);

  await dialog.getByRole("button", { name: "Añadir otro" }).click();
  await expect(dialog.getByLabel("Título")).toHaveValue("");
  await expect(dialog.getByLabel("Título")).toBeFocused();

  // Una plataforma que no está en la lista.
  await dialog.getByLabel("Título").fill("Tetris");
  await dialog.getByRole("radiogroup", { name: "Plataforma" }).getByRole("radio", { name: "Otra…" }).click();
  await dialog.getByLabel("Nombre de la plataforma").fill("Game Boy");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByText("Game Boy · Físico · Pendiente")).toBeVisible();

  await dialog.getByRole("button", { name: "Ver ficha" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/juego\//);
  await expect(page.getByRole("heading", { level: 1, name: "Tetris" })).toBeVisible();
});

test("un juego repetido se añade como otra copia", async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.getByLabel("Título").fill("Celeste");
  await choosePlatform(dialog, "Switch");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await dialog.getByRole("button", { name: "Añadir otro" }).click();

  await dialog.getByLabel("Título").fill("celeste");
  await expect(dialog.getByText(/Ya tienes/)).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "Estado" })).toHaveCount(0);
  await choosePlatform(dialog, "PC");
  await dialog.getByRole("button", { name: "Añadir copia" }).click();
  await expect(dialog.getByRole("heading", { name: "¡Otra copia de Celeste!" })).toBeVisible();
});

test("cerrar durante la celebración no pierde el juego", async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.getByLabel("Título").fill("Inside");
  await choosePlatform(dialog, "PS4");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("1 título · 1 copia")).toBeVisible();
});

test("Escape cierra la ventana y no guarda nada", async ({ page }) => {
  const dialog = await openDialog(page);
  await dialog.getByLabel("Título").fill("Sin guardar");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();
});
