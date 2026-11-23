import { type Page, expect, test } from "@playwright/test";
import { addGame, cards, choosePlatform, openApp } from "./helpers";

async function openFicha(page: Page, title: string) {
  await cards(page).getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.getByRole("region", { name: "Inventario" });
}

test("cada copia enseña sus datos y se cambian sin abrir ninguna ventana", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });
  const inventory = await openFicha(page, "Celeste");

  await inventory.getByRole("button", { name: /^Tienda/ }).click();
  await inventory.getByLabel("Tienda").fill("GAME");
  await inventory.getByLabel("Tienda").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Tienda: GAME/ })).toBeFocused();

  // Otra copia desde la casilla «+»: el cofre la deja elegida en el inventario.
  await inventory.getByRole("button", { name: "Añadir copia" }).click();
  const dialog = page.getByRole("dialog");
  await choosePlatform(dialog, "PC");
  await dialog.getByRole("radio", { name: "Digital", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir copia" }).click();
  await dialog.getByRole("button", { name: "Apuntar detalles" }).click();
  await expect(dialog).toBeHidden();
  await expect(inventory.getByRole("button", { name: "PC, Digital" })).toHaveAttribute("aria-pressed", "true");
  await expect(inventory.getByRole("button", { name: "PC, Digital" })).toBeFocused();
  await expect(inventory.getByRole("heading", { level: 3, name: "PC" })).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Tienda: añadir/ })).toBeVisible();

  // Cada copia guarda lo suyo.
  await inventory.getByRole("button", { name: "Switch, Físico" }).click();
  await expect(inventory.getByRole("button", { name: /^Tienda: GAME/ })).toBeVisible();

  // Los campos que dependen de otro aparecen y desaparecen con él.
  await inventory.getByLabel("Disponibilidad").selectOption("suscripcion");
  await expect(inventory.getByRole("button", { name: /^Servicio/ })).toBeVisible();
  await inventory.getByLabel("Disponibilidad").selectOption("comprado");
  await expect(inventory.getByRole("button", { name: /^Servicio/ })).toHaveCount(0);

  await inventory.getByRole("button", { name: /^Prestada a/ }).click();
  await inventory.getByLabel("Prestada a").fill("Lucía");
  await inventory.getByLabel("Prestada a").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Prestada desde/ })).toBeVisible();
  await inventory.getByRole("button", { name: /^Prestada a: Lucía/ }).click();
  await inventory.getByLabel("Prestada a").fill("");
  await inventory.getByLabel("Prestada a").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Prestada desde/ })).toHaveCount(0);

  // Plataforma: de la lista o escrita a mano.
  await inventory.getByLabel("Plataforma", { exact: true }).selectOption("PS1");
  await expect(inventory.getByRole("heading", { level: 3, name: "PS1" })).toBeVisible();
  await inventory.getByLabel("Plataforma", { exact: true }).selectOption({ label: "Otra…" });
  await inventory.getByLabel("Nombre de la plataforma").fill("Neo Geo");
  await inventory.getByLabel("Nombre de la plataforma").press("Enter");
  await expect(inventory.getByRole("heading", { level: 3, name: "Neo Geo" })).toBeVisible();

  // Un enlace mal escrito avisa y no se guarda. La carátula imprimible es de las copias digitales (su caja decorativa).
  await inventory.getByRole("button", { name: "PC, Digital" }).click();
  await inventory.getByRole("button", { name: /^Enlace de la carátula/ }).click();
  await inventory.getByRole("textbox", { name: "Enlace de la carátula imprimible" }).fill("caratulas.com");
  await inventory.getByRole("textbox", { name: "Enlace de la carátula imprimible" }).press("Enter");
  await expect(inventory.getByText("El enlace debe empezar por http:// o https://.")).toBeVisible();
  await inventory.getByRole("textbox", { name: "Enlace de la carátula imprimible" }).fill("https://www.caratulas.com/celeste");
  await inventory.getByRole("textbox", { name: "Enlace de la carátula imprimible" }).press("Enter");
  await expect(inventory.getByRole("button", { name: /^Enlace de la carátula imprimible: caratulas\.com/ })).toBeVisible();

  await page.reload();
  await expect(inventory.getByRole("button", { name: "Neo Geo, Físico" })).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Tienda: GAME/ })).toBeVisible();

  // Quitar una copia se puede deshacer.
  await inventory.getByRole("button", { name: "Eliminar la copia de Neo Geo" }).click();
  await expect(inventory.getByRole("button", { name: "Neo Geo, Físico" })).toHaveCount(0);
  await expect(inventory.getByRole("button", { name: "PC, Digital" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(inventory.getByRole("button", { name: "Neo Geo, Físico" })).toBeVisible();
});

test("desde el cofre, «Apuntar detalles» lleva al inventario del juego nuevo", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Añadir juego" });
  await dialog.getByLabel("Título").fill("Tunic");
  await choosePlatform(dialog, "PS5");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await dialog.getByRole("button", { name: "Apuntar detalles" }).click();

  await expect(page).toHaveURL(/\/juego\//);
  await expect(page.getByRole("heading", { level: 1, name: "Tunic" })).toBeVisible();
  const inventory = page.getByRole("region", { name: "Inventario" });
  await expect(inventory.getByRole("button", { name: "PS5, Físico" })).toBeFocused();
  await expect(inventory).toBeInViewport();

  // Volver a la ficha más tarde no repite el aviso.
  await page.goBack();
  await expect(page).toHaveURL(/\/biblioteca/);
  await cards(page).getByRole("link", { name: /Tunic/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tunic" })).toBeVisible();
  await expect(inventory.getByRole("button", { name: "PS5, Físico" })).not.toBeFocused();
});

test("«En tu ludoteca» es la fecha de compra apuntada, no el día de meterlo en la app", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Hades", platform: "Switch 2" });
  const inventory = await openFicha(page, "Hades");
  const record = page.getByRole("region", { name: "Tus récords" }).getByRole("listitem").filter({ hasText: "En tu ludoteca" });
  await expect(record).toContainText("---");

  await inventory.getByRole("button", { name: /^Fecha de adquisición/ }).click();
  await inventory.getByLabel("Fecha de adquisición").fill("05/11/2026");
  await inventory.getByLabel("Fecha de adquisición").press("Enter");
  await expect(record).toContainText("5 nov 2026");
});

test("en el móvil, con un título largo, nada se sale de la pantalla", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "The Legend of Zelda: Tears of the Kingdom", platform: "Xbox Series" });
  const inventory = await openFicha(page, "The Legend of Zelda: Tears of the Kingdom");
  await expect(inventory).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("un juego sin copias lo dice y deja añadir una", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Inside", platform: "PS4" });
  const inventory = await openFicha(page, "Inside");
  await inventory.getByRole("button", { name: "Eliminar la copia de PS4" }).click();
  await expect(inventory.getByText("Este juego no tiene copias.")).toBeVisible();
  await expect(inventory.getByText("0 copias")).toBeVisible();
  await inventory.getByRole("button", { name: "Añadir copia" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("una copia física no pregunta por caja, carátula ni carátula imprimible: se dan por hechas; una digital, sí", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });
  const inventory = await openFicha(page, "Celeste");
  await expect(inventory.getByRole("button", { name: /^Tienda/ })).toBeVisible();
  await expect(inventory.getByLabel(/^Tengo caja/)).toHaveCount(0);
  await expect(inventory.getByLabel("Tiene la carátula completa")).toHaveCount(0);
  await expect(inventory.getByText("Carátula imprimible")).toHaveCount(0);
  // Al pasarla a digital, la caja decorativa y su carátula vuelven a tener sentido.
  await inventory.getByRole("radiogroup", { name: "Formato" }).getByRole("radio", { name: "Digital" }).click();
  await expect(inventory.getByLabel("Tengo caja (decorativa)")).toBeVisible();
  await expect(inventory.getByLabel("Tiene la carátula completa")).toBeVisible();
  await expect(inventory.getByText("Carátula imprimible")).toBeVisible();
});
