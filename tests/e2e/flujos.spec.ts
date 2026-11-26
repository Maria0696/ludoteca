import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addGame, cards, expectCarcasaText, loadDemo, openApp } from "./helpers";

test("pasar un deseo a la biblioteca conservando sus datos", async ({ page }) => {
  await openApp(page, "/deseos");
  await expect(page.getByRole("heading", { name: "Nada en la lista todavía" })).toBeVisible();

  await page.getByRole("button", { name: "Añadir el primer deseo" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Okami HD");
  await dialog.getByLabel("Plataforma deseada").selectOption("Switch");
  await dialog.getByLabel("Precio objetivo (€)").fill("12");
  await dialog.getByRole("radio", { name: "Alta" }).click();
  await dialog.getByLabel("Notas").fill("Edición con caja si aparece.");
  await dialog.getByRole("button", { name: "Añadir deseo" }).click();

  await page.getByRole("button", { name: "Precio" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Precio (€)").fill("15,99");
  await dialog.getByLabel("Tienda").fill("GAME");
  await dialog.getByRole("button", { name: "Registrar precio" }).click();
  await expect(page.getByText("3,99 € por encima")).toBeVisible();

  await page.getByRole("button", { name: "Ya lo tengo" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Plataforma")).toHaveValue("Switch");
  await expect(dialog.getByLabel("Precio pagado (€)")).toHaveValue("15,99");
  await dialog.getByRole("button", { name: "Pasar a la biblioteca" }).click();
  await expect(page.getByText("«Okami HD» ya está en tu biblioteca")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nada en la lista todavía" })).toBeVisible();

  await page.goto("/biblioteca");
  await cards(page).getByRole("link", { name: /Okami HD/ }).click();
  await expect(page.getByRole("region", { name: "Tus récords" }).getByText("15,99 €")).toBeVisible();
  await expect(page.getByRole("region", { name: "Misiones" }).getByText(/GAME/)).toBeVisible();
  const notes = page.getByRole("region", { name: "Misiones" }).getByRole("button", { name: /^Notas:/ });
  await expect(notes).toContainText("Edición con caja si aparece.");
  await expect(notes).toContainText("Precio objetivo en la lista de deseos: 12");
});

test("las recomendaciones respetan filtros y disponibilidad", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/que-juego");

  await page.getByRole("combobox", { name: "Plataforma", exact: true }).selectOption({ label: "PS5" });
  await page.getByRole("combobox", { name: "Partida", exact: true }).selectOption({ label: "Nueva" });
  await page.getByRole("combobox", { name: "Compañía", exact: true }).selectOption({ label: "Acompañada" });
  await page.getByRole("combobox", { name: "Tiempo", exact: true }).selectOption({ label: "1 h" });

  const picks = page.locator("ol > li");
  await expect(picks.first()).toContainText("It Takes Two");
  for (const text of await picks.allInnerTexts()) {
    expect(text).toContain("PS5");
    expect(text).toContain("Pendiente");
  }
  await expect(picks.first()).toContainText("Se puede jugar acompañada.");

  // Descartar trae otra propuesta o explica por qué no hay más.
  await picks.first().getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByText("It Takes Two")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Recuperar descartados/ }).first()).toBeVisible();

  // Una copia prestada no se recomienda: Red Dead Redemption 2 (PS4) está prestado en los datos de demostración.
  await page.getByRole("combobox", { name: "Plataforma", exact: true }).selectOption({ label: "PS4" });
  await page.getByRole("combobox", { name: "Partida", exact: true }).selectOption({ label: "Continuar" });
  await page.getByRole("combobox", { name: "Compañía", exact: true }).selectOption({ label: "Sola" });
  await expect(page.getByText("Red Dead Redemption 2")).toHaveCount(0);
  await expect(page.getByText(/tienen la copia prestada/)).toBeVisible();

  // Sin datos de sesión explica la limitación en vez de inventar.
  await page.getByRole("combobox", { name: "Plataforma", exact: true }).selectOption({ label: "Cualquiera" });
  await page.getByRole("combobox", { name: "Partida", exact: true }).selectOption({ label: "Me da igual" });
  await expect(page.getByText(/candidatos/).first()).toBeVisible();
});

test("exportar e importar una copia de seguridad, resolviendo duplicados", async ({ page, browser }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });
  await addGame(page, { title: "Celeste", platform: "Switch", format: "Físico" });

  await page.goto("/ajustes?apartado=copia");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ludoteca-\d{4}-\d{2}-\d{2}\.json$/);
  const path = test.info().outputPath("copia.json");
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.data.games).toHaveLength(2);
  expect(backup.data.copies).toHaveLength(2);
  expect(backup.data).not.toHaveProperty("lists");

  // Otro navegador limpio: ya tiene un «Celeste» propio distinto.
  const context = await browser.newContext({ locale: "es-ES" });
  const other = await context.newPage();
  await openApp(other, "/biblioteca");
  await addGame(other, { title: "Celeste", platform: "PS4", format: "Digital" });
  await other.goto("/importar?origen=copia");
  await other.getByTestId("importar-archivo").setInputFiles(path);
  // Como en Steam: lo del archivo en su bahía y, al lado, lo que entra en la ludoteca.
  const bay = other.getByRole("region", { name: /^Copia de seguridad/ });
  await expect(bay.getByText(/Nuevo: 1 juego, 2 copias/)).toBeVisible();
  await expect(bay.getByText(/mismo título que «Celeste»/)).toBeVisible();
  await expectCarcasaText(bay); // la lista de duplicados, en la carcasa
  // Por defecto se mantiene lo propio; aquí elegimos conservar los dos.
  await expect(bay.getByRole("radio", { name: "Mantener el mío" })).toHaveAttribute("aria-checked", "true");
  await bay.getByRole("radio", { name: "Conservar los dos" }).click();
  await other.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  await expect(other.getByText(/Importado: 2 juegos, 2 copias/)).toBeVisible();
  await other.goto("/biblioteca");
  await expect(other.getByText("3 títulos · 3 copias")).toBeVisible();

  // Importar el mismo archivo otra vez no duplica nada.
  await other.goto("/importar?origen=copia");
  await other.getByTestId("importar-archivo").setInputFiles(path);
  await expect(other.getByRole("region", { name: /^Copia de seguridad/ }).getByText(/ya los tienes iguales/)).toBeVisible();
  await expect(other.getByRole("button", { name: "Copiar a la ludoteca" })).toBeDisabled();

  // Un archivo que no es una copia se rechaza sin tocar nada.
  const bad = test.info().outputPath("malo.json");
  await import("node:fs/promises").then((fs) => fs.writeFile(bad, JSON.stringify({ hola: "mundo" })));
  await other.getByTestId("importar-archivo").setInputFiles(bad);
  await expect(other.getByRole("alert").filter({ hasText: "No se ha importado nada" })).toBeVisible();
  await expectCarcasaText(other.locator("main")); // el aviso de error, también
  await context.close();
});

test("una copia de antes, con listas, se sigue importando y las listas se ignoran", async ({ page, browser }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });
  await page.goto("/ajustes?apartado=copia");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar copia" }).click();
  const backup = JSON.parse(await readFile(await (await downloadPromise).path(), "utf8"));
  // Así eran las copias cuando había «Mis listas».
  backup.data.lists = [
    { id: "lista-antigua", name: "Para el verano", gameIds: [backup.data.games[0].id], createdAt: backup.exportedAt, updatedAt: backup.exportedAt },
  ];
  const path = test.info().outputPath("copia-antigua.json");
  await writeFile(path, JSON.stringify(backup));

  const context = await browser.newContext({ locale: "es-ES" });
  const other = await context.newPage();
  await openApp(other, "/importar?origen=copia");
  await other.getByTestId("importar-archivo").setInputFiles(path);
  const bay = other.getByRole("region", { name: /^Copia de seguridad/ });
  await expect(bay.getByText(/Nuevo: 1 juego, 1 copia y 0 deseos\./)).toBeVisible();
  await expect(bay).not.toContainText("lista");
  await other.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  await expect(other.getByText("Importado: 1 juego, 1 copia y 0 deseos")).toBeVisible();
  await other.goto("/biblioteca");
  await expect(other.getByText("1 título · 1 copia")).toBeVisible();
  await context.close();
});

test("datos de demostración separados y retirables", async ({ page }) => {
  await loadDemo(page);
  // Sin juegos propios no se habla de «0 juegos tuyos».
  await page.goto("/ajustes?apartado=demostracion");
  await expect(page.getByText(/^Ahora hay \d+ elementos de demostración y ningún juego tuyo\.$/)).toBeVisible();
  await page.getByRole("button", { name: "Retirar datos de demostración" }).click();
  await expect(page.getByRole("dialog").getByText("No tienes juegos tuyos todavía: solo se va lo de demostración.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await addGame(page, { title: "Mi juego real", platform: "PC", format: "Digital" });
  await openApp(page, "/ajustes?apartado=demostracion");
  await expect(page.getByText(/^Ahora hay \d+ elementos de demostración junto a 1 juego tuyo\.$/)).toBeVisible();
  await page.getByRole("button", { name: "Retirar datos de demostración" }).click();
  await expect(page.getByRole("dialog").getByText(/Tu juego no se toca\.$/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Retirar \d+ elementos/ }).click();
  await expect(page.getByText("No hay datos de demostración cargados.")).toBeVisible();
  await page.goto("/biblioteca");
  await expect(page.getByText("1 título · 1 copia")).toBeVisible();
  await expect(cards(page).first()).toContainText("Mi juego real");
});

test("estados vacíos y de error", async ({ page }) => {
  await openApp(page, "/");
  await expect(page.getByRole("heading", { name: "Bienvenida a tu ludoteca" })).toBeVisible();
  await expect(page.getByText(/Modo local: tu biblioteca se guarda solo en este navegador/)).toBeVisible();

  await page.goto("/que-juego");
  await expect(page.getByRole("heading", { name: "Aún no hay juegos en tu biblioteca" })).toBeVisible();
  await page.goto("/estadisticas");
  await expect(page.getByRole("heading", { name: "Sin datos todavía" })).toBeVisible();
  await page.goto("/juego/no-existe");
  await expect(page.getByRole("heading", { name: "Este juego no está en tu biblioteca" })).toBeVisible();
  await page.goto("/una-ruta-que-no-existe");
  await expect(page.getByRole("heading", { name: "Esta página no está en tu ludoteca" })).toBeVisible();

  // Sin claves del catálogo, el alta lo dice y deja seguir a mano.
  await page.goto("/biblioteca");
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  await page.getByRole("dialog").getByLabel("Título").fill("Hades");
  await expect(page.getByRole("dialog").getByText(/no está configurada/)).toBeVisible();
});

test("navegación por teclado con foco visible", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  // El diálogo de alta se abre y se cierra con Escape devolviendo el foco.
  await page.getByRole("button", { name: "Añadir juego" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByLabel("Título")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const outline = await page.getByRole("button", { name: "Añadir juego" }).evaluate((el) => {
    (el as HTMLElement).focus();
    return getComputedStyle(el).outlineStyle;
  });
  expect(outline).not.toBe("none");
});
