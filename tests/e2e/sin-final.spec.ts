import { type Page, expect, test } from "@playwright/test";
import { loadDemo } from "./helpers";

/* Juegos sin final (Mario Kart, Stardew…): no se terminan, se juegan. */

async function openGame(page: Page, title: string) {
  await page.goto("/biblioteca?agrupar=ninguno");
  await page.getByRole("link", { name: new RegExp(`^${title}`) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test("en la ficha, un juego sin final no se completa: se juega, y su mapa acaba en la última partida", async ({ page }) => {
  await loadDemo(page);
  // Mario Kart 8 Deluxe viene marcado como sin final en la demostración.
  await openGame(page, "Mario Kart 8 Deluxe");
  const endless = page.getByRole("button", { name: "Sin final" });
  await expect(endless).toHaveAttribute("aria-pressed", "true");
  const status = page.getByRole("radiogroup", { name: "Estado" });
  await expect(status.getByRole("radio")).toHaveText(["Pendiente", "Jugando", "Pausado", "Abandonado"]);
  const quests = page.getByRole("region", { name: "Misiones" });
  await expect(quests.getByText("Termina la historia")).toHaveCount(0);
  await expect(quests.getByRole("checkbox", { name: "Echa una partida" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Última partida, / })).toBeVisible();
  // El 100 % (sus logros) no lo da por terminado.
  await page.getByRole("button", { name: "100 %", exact: true }).click();
  await expect(status.getByRole("radio", { name: "Jugando" })).toHaveAttribute("aria-checked", "true");

  // Quitar la marca le devuelve el final de siempre, también tras recargar.
  await endless.click();
  await expect(endless).toHaveAttribute("aria-pressed", "false");
  await expect(status.getByRole("radio", { name: "Completado" })).toBeVisible();
  await expect(quests.getByRole("checkbox", { name: "Termina la historia" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sin final" })).toHaveAttribute("aria-pressed", "false");
});

test("¿A qué juego? no dice que un juego sin final sea corto", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, "Overcooked! 2");
  await page.getByRole("button", { name: "Sin final" }).click();
  await expect(page.getByRole("button", { name: "Sin final" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/que-juego");
  await page.getByRole("combobox", { name: "Partida", exact: true }).selectOption({ label: "Nueva" });
  await page.getByRole("combobox", { name: "Compañía", exact: true }).selectOption({ label: "Acompañada" });
  await page.getByRole("combobox", { name: "Plataforma", exact: true }).selectOption({ label: "Switch" });
  const pick = page.locator("ol > li").filter({ hasText: "Overcooked! 2" });
  await expect(pick).toContainText("No tiene final: echa una partida y lo dejas cuando quieras.");
  await expect(pick).not.toContainText("Es corto");
});

test("Estadísticas no cuenta los juegos sin final en la pila de pendientes", async ({ page }) => {
  await loadDemo(page);
  await openGame(page, "Overcooked! 2");
  await page.getByRole("button", { name: "Sin final" }).click();
  await expect(page.getByRole("button", { name: "Sin final" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/estadisticas");
  const board = page.getByRole("region", { name: "Marcador" });
  await expect(board.locator("dt", { hasText: /^Por jugar$/ }).locator("xpath=following-sibling::dd[1]")).toHaveText("7");
  await expect(board).toContainText("«Por jugar» no cuenta 1 juego sin final que aún no has empezado.");
  // En la estantería, los sin final son cuadros huecos, y la leyenda lo dice.
  const shelf = page.getByRole("region", { name: "Tu estantería" });
  await expect(shelf.locator("[data-endless]")).toHaveCount(3);
  // Ya van contados en su estado: la leyenda no los suma otra vez.
  await expect(shelf).toContainText("Sin final 3 (ya contados)");
  // Las joyas por jugar tampoco los proponen.
  await expect(page.getByRole("region", { name: "Joyas por jugar" })).not.toContainText("Overcooked! 2");
});
