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

test("navegar, volver atrás y recargar no cambia ningún estado", async ({ page }) => {
  await loadDemo(page);
  const before = await statuses(page);

  await page.goto("/");
  await page.getByRole("link", { name: "Ver todo" }).first().click();
  await page.goBack();
  await page.reload();
  await page.goto("/biblioteca?vista=lista&orden=valoracion");
  await page.getByRole("link", { name: "Hades" }).click();
  await page.goBack();
  await page.goForward();
  await page.goBack();
  await page.reload();
  await page.goto("/");
  await page.reload();

  expect(await statuses(page)).toEqual(before);
});
