import { type Page, expect, test } from "@playwright/test";
import { addGame, loadDemo, openApp } from "./helpers";

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
  await page.getByRole("table", { name: "Juegos" }).getByRole("link", { name: "Hades" }).click();
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

test("mientras se guarda un cambio, la página lo marca; al terminar, se quita y el cambio sigue al recargar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  // Apunta cada vez que aparece o se va la marca, para no depender de mirar justo en el momento.
  await page.evaluate(() => {
    const w = window as unknown as { marcas: string[] };
    w.marcas = [];
    new MutationObserver(() => w.marcas.push(document.documentElement.hasAttribute("data-guardando") ? "guardando" : "guardado")).observe(
      document.documentElement,
      { attributeFilter: ["data-guardando"] },
    );
  });
  await addGame(page, { title: "Tunic", platform: "PC" });
  await expect(page.locator("html")).not.toHaveAttribute("data-guardando");
  expect(await page.evaluate(() => (window as unknown as { marcas: string[] }).marcas)).toContain("guardando");
  await page.reload();
  await expect(page.getByRole("link", { name: /^Tunic/ }).first()).toBeVisible();
});
