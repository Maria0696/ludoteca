import { expect, test } from "@playwright/test";
import { loadDemo, openApp } from "./helpers";

test("«/» lleva al buscador y «A» abre el alta", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Buscar en tu biblioteca" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Buscar en tu biblioteca" })).toHaveValue("");
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("a");
  await expect(page.getByRole("dialog", { name: "Añadir juego" })).toBeVisible();
});

test("los atajos no saltan mientras se escribe", async ({ page }) => {
  await openApp(page, "/deseos");
  const search = page.getByRole("combobox", { name: "Buscar en tu biblioteca" });
  await search.click();
  await page.keyboard.type("zelda/a");
  await expect(search).toHaveValue("zelda/a");
  await expect(search).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").pressSequentially("a/");
  await expect(dialog.getByLabel("Título")).toHaveValue("a/");
  await expect(dialog.getByLabel("Título")).toBeFocused();
});

test("con un diálogo abierto, «/» no se va al buscador", async ({ page }) => {
  await openApp(page, "/deseos");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByRole("radio", { name: "Físico", exact: true }).focus();
  await page.keyboard.press("/");
  await expect(page.getByRole("combobox", { name: "Buscar en tu biblioteca" })).not.toBeFocused();
});

test("con la pantalla de título, «A» solo la cierra", async ({ page }) => {
  await loadDemo(page);
  await page.evaluate(() => localStorage.removeItem("ludoteca:titulo-visto"));
  await openApp(page, "/");
  const title = page.getByRole("button", { name: "Pulsa Start para entrar" });
  await expect(title).toBeVisible();
  await page.keyboard.press("a");
  await expect(title).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("los atajos se anuncian", async ({ page }) => {
  await openApp(page, "/deseos");
  await expect(page.getByRole("combobox", { name: "Buscar en tu biblioteca" })).toHaveAttribute("aria-keyshortcuts", "/");
  const add = page.locator("header").getByRole("button", { name: "Añadir juego" });
  await expect(add).toHaveAttribute("aria-keyshortcuts", "A");
  await expect(add).toHaveAttribute("title", "Añadir juego (A)");
});
