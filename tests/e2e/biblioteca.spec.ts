import { expect, test } from "@playwright/test";
import { addGame, cards, choosePlatform, loadDemo, openApp } from "./helpers";

test("añadir un juego, editarlo y conservar los cambios tras recargar", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await expect(page.getByRole("heading", { name: "Tu biblioteca está vacía" })).toBeVisible();

  await addGame(page, { title: "Hollow Knight", platform: "Switch", format: "Digital" });
  await expect(page.getByText("1 título · 1 copia")).toBeVisible();

  await cards(page).getByRole("link", { name: /Hollow Knight/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();

  await page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" }).click();
  await page.getByRole("button", { name: "8 de 10", exact: true }).click();
  await page.getByRole("button", { name: /^Tu valoración/ }).click();
  await page.getByLabel("Tu valoración").fill("8,5");
  await page.getByLabel("Tu valoración").press("Enter");
  await page.getByRole("button", { name: /^Horas jugadas/ }).click();
  await page.getByLabel("Horas jugadas").fill("12");
  await page.getByLabel("Horas jugadas").press("Enter");
  await page.getByRole("button", { name: /^Notas/ }).click();
  await page.getByRole("textbox", { name: "Notas", exact: true }).fill("Me falta el Panteón.");
  await page.getByRole("textbox", { name: "Notas", exact: true }).blur();

  // La copia se rellena en el inventario: precio y estantería, como digital con caja decorativa.
  const inventory = page.getByRole("region", { name: "Inventario" });
  await inventory.getByRole("button", { name: /^Precio/ }).click();
  await inventory.getByLabel("Precio").fill("14,99");
  await inventory.getByLabel("Precio").press("Enter");
  await inventory.getByLabel("Tengo caja (decorativa)").check();
  await inventory.getByLabel("Tiene la carátula completa").check();
  await inventory.getByRole("button", { name: /^Ubicación/ }).click();
  await inventory.getByLabel("Ubicación").fill("Balda 2");
  await inventory.getByLabel("Ubicación").press("Enter");
  await expect(inventory.getByRole("button", { name: /^Ubicación: Balda 2/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Hollow Knight" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Estado" }).getByRole("radio", { name: "Jugando" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: /^Tu valoración: 8,5/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Horas jugadas: 12 h/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Notas: Me falta el Panteón\./ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tus récords" }).getByText("14,99 €")).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Precio: 14,99/ })).toBeVisible();
  await expect(inventory.getByRole("button", { name: /^Ubicación: Balda 2/ })).toBeVisible();
  await expect(inventory.getByLabel("Tengo caja (decorativa)")).toBeChecked();
  await expect(inventory.getByLabel("Tiene la carátula completa")).toBeChecked();
  await expect(inventory.getByLabel("Carátula pendiente de imprimir")).toHaveCount(0);
  // La caja decorativa no cambia el formato.
  await expect(inventory.getByRole("radio", { name: "Digital" })).toHaveAttribute("aria-checked", "true");
});

test("validación del alta: sin título ni plataforma no se guarda", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Añadir a la biblioteca" }).click();
  await expect(dialog.getByText("Escribe el título del juego.")).toBeVisible();
  await expect(dialog.getByText("Elige una plataforma para guardar la copia.")).toBeVisible();
  await expect(dialog.getByLabel("Título")).toHaveAttribute("aria-invalid", "true");
  await dialog.getByRole("button", { name: "Cerrar" }).click();
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
  await choosePlatform(dialog, "PC");
  await dialog.getByRole("radio", { name: "Digital", exact: true }).click();
  await dialog.getByRole("button", { name: "Añadir copia" }).click();
  await expect(dialog.getByRole("button", { name: "Añadir otro" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar" }).click();

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

test("recreativa: cada juego en su cabina, «Elegido» sigue al cursor y las flechas lo mueven", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("combobox").filter({ hasText: "Por plataforma" }).selectOption("ninguno");
  await page.getByRole("combobox").filter({ hasText: "Añadidos recientemente" }).selectOption("titulo");

  // El estado se dice en idioma arcade, sin perder el nombre de siempre para los lectores de pantalla.
  const shortHike = cards(page).first();
  await expect(shortHike).toContainText("PRESS START");
  await expect(shortHike).toContainText("Pendiente");
  await expect(cards(page).filter({ hasText: "Disco Elysium" })).toContainText("GAME OVER");

  // Pasar por encima o llegar con el teclado muestra el juego en «Elegido».
  const chosen = page.getByRole("region", { name: "Elegido" });
  const celeste = cards(page).filter({ hasText: "Celeste" }).getByRole("link");
  const box = (await celeste.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(chosen).toContainText("Celeste");

  // Con el ratón quieto, una cabina que queda debajo (al reordenar o al cargar) no pasa a ser la elegida.
  const hike = cards(page).filter({ hasText: "A Short Hike" }).getByRole("link");
  await hike.dispatchEvent("pointerover", { pointerType: "mouse", bubbles: true });
  await hike.dispatchEvent("pointerenter", { pointerType: "mouse" });
  await page.waitForTimeout(200);
  await expect(chosen).toContainText("Celeste");
  await cards(page).filter({ hasText: "Celeste" }).getByRole("link").hover();
  await expect(chosen).toContainText("Celeste");
  await expect(chosen).toContainText("CLEAR!");

  await cards(page).first().getByRole("link").focus();
  await page.keyboard.press("ArrowRight");
  await expect(cards(page).nth(1).getByRole("link")).toBeFocused();
  await expect(chosen).toContainText((await cards(page).nth(1).locator("[data-card-title]").textContent())!);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/juego\//);
  await page.goBack();

  // La tabla de récords ordena por horas de toda la colección.
  const hiscore = page.getByRole("region", { name: "Récords de horas" }).getByRole("listitem");
  await expect(hiscore.first()).toContainText("The Legend of Zelda");
  await expect(hiscore.first()).toContainText("132 h");
});

test("un título largo cabe en el rótulo de la cabina sin cortarse a media línea", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page, "/biblioteca");
    if (width === 1440) await addGame(page, { title: "The Legend of Zelda: Ocarina of Time", platform: "Switch 2" });
    const card = cards(page).filter({ hasText: "Ocarina of Time" });
    const marquee = card.locator("[data-card-title]");
    // Nada del rótulo queda escondido por debajo: o cabe entero, o termina en «…».
    const hidden = await marquee.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(hidden).toBeLessThanOrEqual(0);
    await expect(card.getByRole("link")).toHaveAttribute("title", "The Legend of Zelda: Ocarina of Time");
  }
});

test("cambiar el estado desde la lista compacta y conservarlo tras recargar", async ({ page }) => {
  await loadDemo(page);
  await page.getByRole("button", { name: "Tabla" }).click();
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
