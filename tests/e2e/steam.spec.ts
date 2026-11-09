import { type Page, expect, test } from "@playwright/test";
import type { CatalogGame } from "../../src/lib/catalog";
import { emptyLibrary, createCopy, createGame } from "../../src/lib/model";
import { parseSteamProfile, type SteamGame } from "../../src/lib/steam";
import { planSteamImport } from "../../src/lib/steam-import";
import { addGame, openApp } from "./helpers";

const GAMES: SteamGame[] = [
  { appId: 10, name: "Faro sin Mar", minutes: 600, icon: null },
  { appId: 20, name: "Cocina Galáctica", minutes: 90, icon: null },
  { appId: 30, name: "Reino Pendiente", minutes: 0, icon: null },
];

const sheet = (igdbId: number, title: string): CatalogGame => ({
  igdbId,
  title,
  year: 2020,
  coverUrl: "https://images.example/caratula.jpg",
  backdropUrl: null,
  genres: ["Aventura"],
  platforms: ["PC"],
  modes: ["solo"],
  moods: [],
  lengthHours: 12,
  criticRating: 81,
  summary: "Una historia.",
  developer: "Estudio",
  saga: null,
  releaseDate: "2020-05-01",
  ageRating: "PEGI 12",
});

async function mockSteam(page: Page, games = GAMES, matches: Record<number, CatalogGame> = { 10: sheet(1, "Faro sin Mar") }) {
  await page.route("**/api/steam", (route) => route.fulfill({ json: { ok: true, games } }));
  await page.route("**/api/steam/fichas", (route) => route.fulfill({ json: { ok: true, matches } }));
}

async function searchProfile(page: Page) {
  await page.getByLabel("Tu perfil de Steam").fill("https://steamcommunity.com/id/alguien/");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
}

test("entiende el enlace, el número y el nombre del perfil", () => {
  const id = "76561198000000000";
  expect(parseSteamProfile(id)).toEqual({ kind: "id", steamId: id });
  expect(parseSteamProfile(` https://steamcommunity.com/profiles/${id}/ `)).toEqual({ kind: "id", steamId: id });
  expect(parseSteamProfile("https://steamcommunity.com/id/mi_nombre/games?tab=all")).toEqual({ kind: "nombre", vanity: "mi_nombre" });
  expect(parseSteamProfile("mi-nombre")).toEqual({ kind: "nombre", vanity: "mi-nombre" });
  for (const bad of ["", "a", "https://otra-web.example/id/nombre", "nombre con espacios"]) {
    expect(parseSteamProfile(bad), bad).toBeNull();
  }
});

test("volver a importar no duplica y nunca baja las horas ni pisa lo escrito", () => {
  const library = emptyLibrary();
  const mine = createGame({ title: "Faro sin Mar", hoursPlayed: 50, summary: "Mi sinopsis" });
  library.games.push(mine);
  library.copies.push(createCopy(mine.id, { platform: "PS5", format: "fisico" }));

  const first = planSteamImport(library, [{ game: GAMES[0], catalog: sheet(1, "Faro sin Mar") }]);
  expect(first.counts).toEqual({ nuevos: 0, actualizados: 1, sinCaratula: 0 });
  expect(first.games).toHaveLength(1);
  expect(first.games[0]).toMatchObject({ id: mine.id, hoursPlayed: 50, steamAppId: 10, summary: "Mi sinopsis", developer: "Estudio", igdbId: 1 });
  expect(first.copies).toEqual([expect.objectContaining({ gameId: mine.id, platform: "PC", format: "digital", store: "Steam" })]);

  const after = { ...library, games: first.games, copies: [...library.copies, ...first.copies] };
  const again = planSteamImport(after, [{ game: { ...GAMES[0], minutes: 6000 } }]);
  expect(again.copies).toHaveLength(0);
  expect(again.games).toHaveLength(1);
  expect(again.games[0].hoursPlayed).toBe(100);
});

test("elige, copia y los juegos llegan a la biblioteca", async ({ page }) => {
  await mockSteam(page);
  await openApp(page, "/importar");
  await searchProfile(page);

  await expect(page.getByText("3 juegos para copiar")).toBeVisible();
  await page.getByRole("button", { name: /Reino Pendiente/ }).click();
  await expect(page.getByRole("button", { name: /Reino Pendiente/ })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("2 juegos para copiar")).toBeVisible();

  await page.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  const done = page.getByRole("status").filter({ hasText: "Copia terminada" });
  await expect(done).toContainText("2 juegos nuevos en tu ludoteca");
  await expect(done).toContainText("1 sin carátula, para completar a mano");

  await done.getByRole("link", { name: "Ver mi biblioteca" }).click();
  await expect(page.getByText("2 títulos · 2 copias")).toBeVisible();
  await page.getByRole("link", { name: /Faro sin Mar/ }).first().click();
  await expect(page.getByRole("heading", { name: "Faro sin Mar", level: 1 })).toBeVisible();
  await expect(page.getByText("Estudio")).toBeVisible();
});

test("avisa de los juegos que ya tienes", async ({ page }) => {
  await mockSteam(page);
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Probar con datos de demostración" }).waitFor();
  await addGame(page, { title: "Cocina Galáctica", platform: "PS5" });
  await page.goto("/importar");
  await searchProfile(page);
  await expect(page.getByRole("button", { name: /Cocina Galáctica/ })).toContainText("Ya la tienes: se añade tu copia de Steam");
  await expect(page.getByRole("button", { name: /Faro sin Mar/ })).not.toContainText("Ya la tienes");
});

test("los juegos de la familia llegan sin marcar y entran como prestados", async ({ page }) => {
  const family: SteamGame = { appId: 40, name: "Granja Orbital", minutes: 120, icon: null, family: true };
  expect(planSteamImport(emptyLibrary(), [{ game: family }]).copies[0]).toMatchObject({ availability: "prestado", store: "Steam" });

  await mockSteam(page, [...GAMES, family]);
  await openApp(page, "/importar");
  await searchProfile(page);
  const row = page.getByRole("button", { name: /Granja Orbital/ });
  await expect(row).toHaveAttribute("aria-pressed", "false");
  await expect(row).toContainText("De tu familia de Steam");
  await expect(page.getByText("3 juegos para copiar")).toBeVisible();
});

test("un icono que no carga deja la inicial y los minutos sueltos no salen como 0 h", async ({ page }) => {
  await page.route("https://media.steampowered.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  await mockSteam(page, [{ appId: 50, name: "Torre de Naipes", minutes: 2, icon: "https://media.steampowered.com/roto.jpg" }]);
  await openApp(page, "/importar");
  await searchProfile(page);
  const row = page.getByRole("button", { name: /Torre de Naipes/ });
  await expect(row).toContainText("2 min");
  await expect(row.getByText("T", { exact: true })).toBeVisible();
  await expect(row.locator("img")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ludoteca" }).locator("img")).toHaveCount(0);
});

test("un perfil privado explica qué hacer", async ({ page }) => {
  await page.route("**/api/steam", (route) =>
    route.fulfill({ json: { ok: false, reason: "privado", message: "Steam no deja ver tus juegos. Pon «Detalles de los juegos» como público." } }),
  );
  await openApp(page, "/importar");
  await searchProfile(page);
  await expect(page.getByRole("alert").filter({ hasText: "Detalles de los juegos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar a la ludoteca" })).toBeDisabled();
});

test("sin clave de Steam, el servidor lo dice sin fallar", async ({ page, request }) => {
  const res = await request.post("/api/steam", { data: { perfil: "alguien" } });
  expect(await res.json()).toMatchObject({ ok: false, reason: "no-configurado" });
  await openApp(page, "/importar");
  await searchProfile(page);
  await expect(page.getByRole("alert").filter({ hasText: "STEAM_API_KEY" })).toBeVisible();
});
