import { type Page, expect, test } from "@playwright/test";
import { addGame, loadDemo, openApp } from "./helpers";

/* El precio de una copia: un importe, o por qué no lo tiene (regalo, gratis, en un pack, no lo sé). */

async function inventoryOf(page: Page, title: string) {
  await page.goto("/biblioteca?agrupar=ninguno");
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.getByRole("region", { name: "Inventario" });
}

test("el precio puede ser un importe, un regalo, gratis, de un pack o no saberse", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });
  const inventory = await inventoryOf(page, "Celeste");
  const how = inventory.getByLabel("Cómo lo conseguiste");
  await expect(how).toHaveValue("pagado");

  // Un importe, como siempre.
  await inventory.getByRole("button", { name: /^Precio/ }).click();
  await inventory.getByLabel("Precio").fill("19,99");
  await inventory.getByLabel("Precio").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Precio: 19,99/ })).toBeVisible();
  // Con importe ya se sabe que se pagó: no hace falta el desplegable.
  await expect(how).toHaveCount(0);

  // Al borrar el importe vuelve, y un regalo no tiene importe que anotar.
  await inventory.getByRole("button", { name: /^Precio: 19,99/ }).click();
  await inventory.getByLabel("Precio").fill("");
  await inventory.getByLabel("Precio").press("Enter");
  await how.selectOption({ label: "Regalo" });
  await expect(inventory.getByRole("button", { name: /^Precio/ })).toHaveCount(0);
  // Un regalo no se compró en ninguna tienda: no se pregunta.
  await expect(inventory.getByRole("button", { name: /^Tienda/ })).toHaveCount(0);

  // En un pack: se puede decir con cuál.
  await how.selectOption({ label: "En un pack" });
  await expect(inventory.getByRole("button", { name: /^Tienda/ })).toBeVisible();
  await inventory.getByRole("button", { name: /^En un pack con/ }).click();
  await inventory.getByLabel("En un pack con").fill("Hades");
  await inventory.getByLabel("En un pack con").press("Enter");
  await expect(inventory.getByRole("button", { name: /^En un pack con: Hades/ })).toBeVisible();
  await page.reload();
  await expect(how).toHaveValue("pack");
  await expect(inventory.getByRole("button", { name: /^En un pack con: Hades/ })).toBeVisible();

  // Si no sabes el precio, tampoco sabes cuándo lo conseguiste: la fecha no se pregunta.
  const date = inventory.getByRole("button", { name: /^Fecha de adquisición/ });
  await expect(date).toBeVisible();
  await how.selectOption({ label: "No lo sé" });
  await expect(date).toHaveCount(0);
  await how.selectOption({ label: "Regalo" });
  await expect(date).toBeVisible();

  // Volver a «Pagado» deja anotar el importe otra vez, y el pack se olvida.
  await how.selectOption({ label: "Pagado" });
  await expect(inventory.getByRole("button", { name: /^Precio: añadir/i })).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^En un pack con/ })).toHaveCount(0);
});

test("en Estadísticas, un juego gratis o regalado no cuenta como precio que falta", async ({ page }) => {
  await loadDemo(page);
  const inventory = await inventoryOf(page, "Hades");
  // Hades tiene precio: para decir que fue gratis, primero se borra el importe.
  await inventory.getByRole("button", { name: /^Precio: 24,99/ }).click();
  await inventory.getByLabel("Precio").fill("");
  await inventory.getByLabel("Precio").press("Enter");
  await inventory.getByLabel("Cómo lo conseguiste").selectOption({ label: "Gratis" });
  await expect(inventory.getByRole("button", { name: /^Precio/ })).toHaveCount(0);

  await page.goto("/estadisticas");
  const ledger = page.getByRole("region", { name: "Horas y gasto" });
  await expect(ledger).toContainText("22 de 22 copias compradas con precio o motivo");
  await expect(ledger).toContainText("21 con precio · 1 gratis");
});
