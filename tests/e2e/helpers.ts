import { type Page, expect } from "@playwright/test";

export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
}

export async function loadDemo(page: Page) {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Probar con datos de demostración" }).click();
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
}

export async function addGame(
  page: Page,
  game: { title: string; platform: string; format?: "Físico" | "Digital"; status?: string },
) {
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const title = dialog.getByLabel("Título");
  if (await title.count()) await title.fill(game.title);
  await dialog.getByLabel("Plataforma").selectOption(game.platform);
  if (game.format) await dialog.getByRole("radio", { name: game.format, exact: true }).click();
  if (game.status) await dialog.getByRole("radio", { name: game.status, exact: true }).click();
  await dialog.getByRole("button", { name: /^Añadir (a la biblioteca|copia)$/ }).click();
  await expect(dialog).toBeHidden();
}

/** Tarjetas visibles en la rejilla de la biblioteca. */
export function cards(page: Page) {
  return page.getByRole("list", { name: "Juegos" }).getByRole("listitem").filter({ has: page.getByRole("link") });
}
