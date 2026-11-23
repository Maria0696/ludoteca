import { type Page, expect, test } from "@playwright/test";
import { addGame, loadDemo, openApp } from "./helpers";

/* Ajustes como los de una consola: un icono por apartado con su estado, y el panel del elegido al lado. */

const tiles = (page: Page) => page.getByRole("navigation", { name: "Apartados de Ajustes" });

test("cada apartado dice su estado sin abrirlo y se abre al lado", async ({ page }) => {
  await loadDemo(page);
  await page.goto("/ajustes");
  await expect(tiles(page).getByRole("link")).toHaveText([/^Partida guardada/, /^Traer juegos/, /^Pantalla/, /^Ayuda/, /^Cuenta/, /^Demostración/, /^Borrar todo/]);
  // En el orden de Importar: primero la copia, luego Steam.
  await expect(tiles(page).getByRole("link", { name: /^Traer juegos/ })).toContainText("De un archivo o de Steam");
  await expect(tiles(page).getByRole("link", { name: /^Partida guardada/ })).toContainText("Sin copia todavía");
  await expect(tiles(page).getByRole("link", { name: /^Pantalla/ })).toContainText("Título una vez al día");
  await expect(tiles(page).getByRole("link", { name: /^Cuenta/ })).toContainText("Modo local");
  await expect(tiles(page).getByRole("link", { name: /^Borrar todo/ })).toContainText("22 juegos");
  // Sin elegir, el primero; un solo panel a la vista.
  await expect(tiles(page).getByRole("link", { name: /^Partida guardada/ })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("main section.window")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Partida guardada" })).toBeVisible();

  // Traer juegos lleva a la pantalla de importar: primero la copia de seguridad, luego Steam.
  await tiles(page).getByRole("link", { name: /^Traer juegos/ }).click();
  await expect(page).toHaveURL(/\?apartado=traer$/);
  const traer = page.getByRole("region", { name: "Traer juegos" });
  await expect(traer.getByRole("link")).toHaveText([/^Copia de seguridad/, /^Steam/]);
  await expect(traer.getByRole("link", { name: /^Copia de seguridad/ })).toHaveAttribute("href", "/importar?origen=copia");
  await expect(traer.getByRole("link", { name: /^Steam/ })).toHaveAttribute("href", "/importar?origen=steam");

  // Los enlaces de antes siguen llevando a su sitio.
  for (const [old, name] of [["copia", "Partida guardada"], ["datos", "Cuenta"], ["steam", "Traer juegos"], ["catalogo", "Ayuda"], ["eliminar", "Borrar todo"], ["creditos", "Demostración"]]) {
    await page.goto(`/ajustes?apartado=${old}`);
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await page.goto("/ajustes?apartado=ayuda");
  await expect(page.getByRole("region", { name: "Ayuda" }).getByRole("link", { name: "Abrir el manual" })).toHaveAttribute("href", "/manual");
});

test("Importar: primero la copia de seguridad y luego Steam, con el mismo formato", async ({ page }) => {
  // Sin decir de dónde, se abre la copia de seguridad, que va la primera.
  await openApp(page, "/importar");
  const origins = page.getByRole("navigation", { name: "Origen de la importación" });
  await expect(origins.getByRole("link")).toHaveText(["Copia de seguridad", "Steam"]);
  await expect(origins.getByRole("link", { name: "Copia de seguridad" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1, name: "Copiar desde tu copia de seguridad" })).toBeVisible();
  await expect(page.getByTestId("importar-archivo")).toBeAttached();
  // Como en Steam: la bahía del origen y la de la ludoteca, con su botón.
  await expect(page.getByRole("region", { name: /^Copia de seguridad/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Ludoteca" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar a la ludoteca" })).toBeDisabled();
  // Game Tracker ya no está; un enlace antiguo lleva a la copia de seguridad.
  await openApp(page, "/importar?origen=gametracker");
  await expect(page.getByRole("heading", { level: 1, name: "Copiar desde tu copia de seguridad" })).toBeVisible();
});

test("la pantalla de título sale siempre, una vez al día o nunca", async ({ page }) => {
  // Con la biblioteca vacía el inicio es la bienvenida: hacen falta juegos para ver el menú.
  await loadDemo(page);
  await openApp(page, "/ajustes?apartado=pantalla");
  const title = page.getByRole("combobox", { name: "Pantalla de título", exact: true });
  await expect(title.locator("option:checked")).toHaveText("Una vez al día");
  await page.getByRole("button", { name: "Pantalla de título: anterior" }).click();
  await expect(title.locator("option:checked")).toHaveText("Siempre");
  await openApp(page, "/");
  await expect(page.getByRole("button", { name: "Pulsa Start para entrar" })).toBeVisible();

  await openApp(page, "/ajustes?apartado=pantalla");
  await title.selectOption({ label: "Nunca" });
  await expect(page.getByRole("link", { name: /^Pantalla/ })).toContainText("Sin pantalla de título");
  await page.evaluate(() => localStorage.removeItem("ludoteca:titulo-visto"));
  await openApp(page, "/");
  await expect(page.getByRole("group", { name: "Menú principal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pulsa Start para entrar" })).toHaveCount(0);
});

test("las pistas de la guardiana se pueden apagar", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/ajustes?apartado=pantalla");
  await page.getByRole("combobox", { name: "Pistas de la guardiana", exact: true }).selectOption({ label: "Desactivadas" });
  // Aunque no se haya visto, con las pistas apagadas no sale.
  await page.evaluate(() => localStorage.removeItem("ludoteca:pistas-vistas"));
  await page.goto("/que-juego");
  await expect(page.getByRole("heading", { level: 1, name: "¿A qué juego?" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Pista de la guardiana" })).toHaveCount(0);

  await openApp(page, "/ajustes?apartado=pantalla");
  await page.getByRole("combobox", { name: "Pistas de la guardiana", exact: true }).selectOption({ label: "Activadas" });
  await page.goto("/que-juego");
  await expect(page.getByRole("status", { name: "Pista de la guardiana" })).toContainText("Cada propuesta explica por qué");
});

test("el recordatorio de copia avisa cada semana, cada mes o nunca", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await addGame(page, { title: "Tunic", platform: "PC", format: "Digital" });
  const reminder = page.getByRole("region", { name: "Recordatorio de copia de seguridad" });
  await openApp(page, "/");
  await expect(reminder).toBeVisible();

  await openApp(page, "/ajustes?apartado=partida");
  await page.getByRole("combobox", { name: "Recordarme guardar", exact: true }).selectOption({ label: "Nunca" });
  await openApp(page, "/");
  await expect(page.getByRole("group", { name: "Menú principal" })).toBeVisible();
  await expect(reminder).toHaveCount(0);

  // Con una copia de hace 10 días: cada mes no avisa todavía; cada semana, sí.
  await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    localStorage.setItem("ludoteca:ultima-copia", d.toISOString());
  });
  await openApp(page, "/ajustes?apartado=partida");
  await page.getByRole("combobox", { name: "Recordarme guardar", exact: true }).selectOption({ label: "Cada mes" });
  await openApp(page, "/");
  await expect(page.getByRole("group", { name: "Menú principal" })).toBeVisible();
  await expect(reminder).toHaveCount(0);
  await openApp(page, "/ajustes?apartado=partida");
  await page.getByRole("combobox", { name: "Recordarme guardar", exact: true }).selectOption({ label: "Cada semana" });
  await openApp(page, "/");
  await expect(reminder).toContainText("hace 10 días");
});
