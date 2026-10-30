import { expect, test } from "@playwright/test";
import { addGame, cards, loadDemo, openApp } from "./helpers";

test("añadir un juego, editarlo y conservar los cambios tras recargar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();

  await addGame(page, { title: "Hollow Knight", platform: "Switch", format: "Digital" });
  await expect(page.getByText("«Hollow Knight» añadido a tu biblioteca")).toBeVisible();
  await expect(page.getByText("1 título · 1 copia")).toBeVisible();

  await cards(page).getByRole("link", { name: /Hollow Knight/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();

  await page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" }).click();
  await page.getByLabel("Tu valoración").fill("8,5");
  await page.getByLabel("Horas jugadas").fill("12");
  await page.getByLabel("Horas jugadas").press("Enter");
  await page.getByRole("textbox", { name: "Notas", exact: true }).fill("Me falta el Panteón.");
  await page.getByRole("textbox", { name: "Notas", exact: true }).blur();

  // Editar la copia: precio y estantería, como digital con caja decorativa.
  await page.getByRole("button", { name: "Editar la copia de Switch" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Precio pagado (€)").fill("14,99");
  await dialog.getByLabel("Tengo caja (decorativa)").check();
  await dialog.getByLabel("Carátula pendiente de imprimir").check();
  await dialog.getByLabel("Ubicación").fill("Balda 2");
  await dialog.getByRole("button", { name: "Guardar copia" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Tu valoración")).toHaveValue("8,5");
  await expect(page.getByLabel("Horas jugadas")).toHaveValue("12");
  await expect(page.getByRole("textbox", { name: "Notas", exact: true })).toHaveValue("Me falta el Panteón.");
  await expect(page.getByText("14,99 €")).toBeVisible();
  await expect(page.getByText("Caja decorativa · carátula por imprimir · Balda 2")).toBeVisible();
  // La caja decorativa no cambia el formato.
  await expect(page.getByText("Digital", { exact: true }).first()).toBeVisible();
});

test("validación del alta: sin título ni plataforma no se guarda", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByText("Escribe el título del juego.")).toBeVisible();
  await expect(dialog.getByText("Elige una plataforma para guardar la copia.")).toBeVisible();
  await expect(dialog.getByLabel("Título")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();
});

test("registrar dos copias del mismo título sin duplicar el juego", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico", status: "Completado" });

  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("celeste");
  await expect(dialog.getByText(/Ya tienes «Celeste»/)).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Añadir otra copia" })).toHaveAttribute("aria-checked", "true");
  await dialog.getByLabel("Plataforma").selectOption("PC");
  await dialog.getByRole("radio", { name: "Digital", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir copia" }).click();

  await expect(page.getByText("1 título · 2 copias")).toBeVisible();
  await expect(cards(page)).toHaveCount(2); // aparece en el separador de cada plataforma
  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("2 copias");
  await expect(cards(page).first().locator(".tag")).toHaveText(["Switch", "PC"]);

  await page.goto("/estadisticas");
  const kpi = (label: string) => page.locator("dt", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");
  await expect(kpi("Títulos")).toHaveText("1");
  await expect(kpi("Copias")).toHaveText("2");
});

test("buscar, filtrar por plataforma, formato y estado, y ordenar", async ({ page }) => {
  await loadDemo(page);

  await page.getByPlaceholder("Buscar por título").fill("hollow");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Hollow Knight");
  await expect(page).toHaveURL(/q=hollow/);

  await page.getByPlaceholder("Buscar por título").fill("zzz");
  await expect(page.getByRole("heading", { name: "Ningún juego coincide" })).toBeVisible();
  await page.getByRole("button", { name: "Restablecer filtros" }).click();
  await expect(page.getByText("22 títulos", { exact: true })).toBeVisible();

  await page.getByRole("tab", { name: /PS5/ }).click();
  await expect(page.getByText("6 de 22 títulos")).toBeVisible();
  const ps5 = await cards(page).allInnerTexts();
  expect(ps5).toHaveLength(6);
  for (const text of ps5) expect(text).toContain("PS5");

  await page.getByRole("button", { name: "Completado" }).click();
  await page.getByRole("tab", { name: /Todas/ }).click();
  await expect(page).toHaveURL(/estado=completado/);
  await expect(page).not.toHaveURL(/plataforma=/);
  await expect(page.getByText("4 de 22 títulos")).toBeVisible();
  for (const text of await cards(page).allInnerTexts()) expect(text).toContain("Completado");

  await page.getByRole("button", { name: "Digital", exact: true }).click();
  await expect(page.getByText(/de 22 títulos/)).toBeVisible();
  await page.getByRole("button", { name: "Restablecer", exact: true }).click();
  await expect(page.getByText("22 títulos", { exact: true })).toBeVisible();

  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");
  await page.getByRole("combobox").filter({ hasText: "Añadidos recientemente" }).selectOption("titulo");
  await expect(page).toHaveURL(/orden=titulo/);
  await expect(cards(page).first()).toContainText("A Short Hike");
  const titles = await cards(page).locator("[data-card-title]").allInnerTexts();
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base", numeric: true }));
  expect(titles).toEqual(sorted);

  await page.getByRole("combobox").filter({ hasText: "Título (A–Z)" }).selectOption("valoracion");
  await expect(cards(page).first()).toContainText("The Legend of Zelda");
});

test("cambiar el estado desde la lista compacta y conservarlo tras recargar", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: "Lista" }).click();
  const select = page.getByLabel("Estado de Outer Wilds");
  await select.selectOption("jugando");
  await expect(page.getByText("«Outer Wilds» pasa a Jugando")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Estado de Outer Wilds")).toHaveValue("jugando");

  // Deshacer devuelve el estado anterior.
  await page.getByLabel("Estado de Outer Wilds").selectOption("completado");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByLabel("Estado de Outer Wilds")).toHaveValue("jugando");
});

test("eliminar un juego pide confirmación y se puede deshacer", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("link", { name: /Inside/ }).first().click();
  await page.getByRole("button", { name: "Eliminar «Inside»" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar juego" }).click();
  await expect(page.getByText("21 títulos · 23 copias")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
});

test("listas personales", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/listas");
  await page.getByLabel("Nombre de la nueva lista").fill("Para el verano");
  await page.getByRole("button", { name: "Crear" }).click();
  await page.getByRole("button", { name: "Añadir juegos" }).click();
  await page.getByRole("dialog").getByLabel("Hades").check();
  await page.getByRole("dialog").getByRole("button", { name: "Hecho" }).click();
  await expect(page.getByRole("list").getByRole("link", { name: /Hades/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Para el verano\s*1/ })).toBeVisible();
});
