import { type Page, expect, test } from "@playwright/test";
import { loadDemo, openApp } from "./helpers";

const menu = (page: Page) => page.getByRole("group", { name: "Menú principal" });
const item = (page: Page, name: string) => menu(page).getByRole("button", { name, exact: true });
const startLine = (page: Page) => page.getByRole("button", { name: "Pulsa Start para entrar" });

test.describe("pantalla de título", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sale una vez al día y entra con una tecla", async ({ page }) => {
    await loadDemo(page);
    await openApp(page, "/");
    await expect(startLine(page)).toBeVisible();
    await expect(menu(page)).toBeHidden();

    await page.keyboard.press("Enter");
    await expect(startLine(page)).toHaveCount(0);
    await expect(menu(page)).toBeVisible();
    await expect(item(page, "Continuar")).toBeFocused();

    await page.reload();
    await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
    await expect(menu(page)).toBeVisible();
    await expect(startLine(page)).toHaveCount(0);

    // Se puede volver a ella y entrar con un clic.
    await page.getByRole("button", { name: "Pantalla de título" }).click();
    await startLine(page).click();
    await expect(menu(page)).toBeVisible();
  });

  test("con la biblioteca vacía no sale: primero, la bienvenida", async ({ page }) => {
    await openApp(page, "/");
    await expect(page.getByRole("heading", { name: "Bienvenida a tu ludoteca" })).toBeVisible();
    await expect(startLine(page)).toHaveCount(0);
  });
});

test("el menú lleva a cada parte de la biblioteca", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/");

  await expect(page.getByRole("heading", { name: "Partidas guardadas" })).toBeVisible();

  await item(page, "Nueva partida").click();
  await expect(page.getByRole("heading", { name: "Te están esperando" })).toBeVisible();

  await item(page, "Novedades").click();
  await expect(page.getByRole("heading", { name: "Añadidos recientemente" })).toBeVisible();
  await page.getByRole("link", { name: /^Ver todo/ }).click();
  await expect(page).toHaveURL(/\/biblioteca\?agrupar=ninguno/);

  await page.goBack();
  await item(page, "Récords").click();
  const records = page.locator("dl").filter({ hasText: "Títulos" });
  await expect(records).toContainText("22");
  await expect(page.getByRole("link", { name: "Ver estadísticas" })).toHaveAttribute("href", "/estadisticas");

  await item(page, "Elegir modo").click();
  await page.getByRole("link", { name: /Modo rápido/ }).click();
  await expect(page).toHaveURL(/\/que-juego\?min=30/);
});

test("«He jugado hoy» se aplica a la partida elegida, aunque el ratón pase por otras", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/");

  const slots = page.getByRole("group", { name: "Partidas guardadas" }).getByRole("button");
  await expect(slots.first()).toHaveAttribute("aria-pressed", "true");
  await slots.nth(1).click();
  await expect(slots.nth(1)).toHaveAttribute("aria-pressed", "true");

  const chosen = (await slots.nth(1).locator("b").textContent())!;
  await slots.nth(2).hover();
  const action = page.getByRole("button", { name: /^(He jugado hoy|Retomar)$/ });
  await action.click();
  await expect(page.getByText(new RegExp(`«${chosen}»`))).toBeVisible();
});

test("las flechas mueven el menú sin robar las de un cuadro de diálogo", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/");

  await page.keyboard.press("ArrowDown");
  await expect(item(page, "Nueva partida")).toBeFocused();
  await expect(item(page, "Nueva partida")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp");
  await expect(item(page, "Continuar")).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("group", { name: "Partidas guardadas" }).getByRole("button").first()).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(item(page, "Continuar")).toBeFocused();

  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(item(page, "Continuar")).toHaveAttribute("aria-pressed", "true");
});

test("en una ventana baja, las opciones del menú no se mueven al cambiar de panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await loadDemo(page);
  await openApp(page, "/");
  const options = page.getByRole("group", { name: "Menú principal" }).getByRole("button");
  const tops = new Set<number>();
  for (let i = 0; i < 5; i++) {
    await options.nth(i).evaluate((button: HTMLElement) => button.click());
    await page.waitForTimeout(450);
    tops.add(Math.round((await options.first().boundingBox())!.y));
  }
  expect([...tops]).toHaveLength(1);

  // Con el ratón quieto sobre el borde de una opción, la elegida no cambia sola.
  const box = (await options.nth(2).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3);
  await page.waitForTimeout(300);
  const chosen = page.getByRole("group", { name: "Menú principal" }).locator('[aria-pressed="true"]');
  const label = await chosen.textContent();
  await page.waitForTimeout(1000);
  await expect(chosen).toHaveText(label!);
});
