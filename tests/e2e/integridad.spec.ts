import { type Page, expect, test } from "@playwright/test";
import { loadDemo } from "./helpers";

async function statuses(page: Page) {
  await page.goto("/biblioteca?agrupar=ninguno&orden=titulo&vista=lista");
  const rows = page.getByRole("row").filter({ has: page.getByRole("combobox") });
  await expect(rows.first()).toBeVisible();
  return rows.evaluateAll((els) =>
    els.map((el) => `${el.querySelector("a")?.textContent} → ${(el.querySelector("select") as HTMLSelectElement).value}`),
  );
}

/**
 * Espera a que la navegación anterior llegue a `path` y la biblioteca esté
 * cargada. Sin esto, recargar mientras el navegador aún vuelve atrás falla
 * en máquinas lentas («Not attached to an active page»).
 */
async function at(page: Page, path: string | RegExp) {
  await expect(page).toHaveURL((url) =>
    typeof path === "string" ? url.pathname === path : path.test(url.pathname),
  );
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
}

test("navegar, volver atrás y recargar no cambia ningún estado", async ({ page }) => {
  await loadDemo(page);
  const before = await statuses(page);

  await page.goto("/");
  await page.getByRole("link", { name: "Ver todo" }).first().click();
  await at(page, "/biblioteca");
  await page.goBack();
  await at(page, "/");
  await page.reload();
  await at(page, "/");
  await page.goto("/biblioteca?vista=lista&orden=valoracion");
  await page.getByRole("link", { name: "Hades" }).click();
  await at(page, /^\/juego\//);
  await page.goBack();
  await at(page, "/biblioteca");
  await page.goForward();
  await at(page, /^\/juego\//);
  await page.goBack();
  await at(page, "/biblioteca");
  await page.reload();
  await at(page, "/biblioteca");
  await page.goto("/");
  await page.reload();
  await at(page, "/");

  expect(await statuses(page)).toEqual(before);
});
