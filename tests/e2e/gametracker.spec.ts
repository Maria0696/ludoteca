import { writeFileSync } from "node:fs";
import path from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { parseCsv } from "../../src/lib/csv";
import { type GtEntry, type GtItem, classifyGameTracker, gtPlatform, parseGameTracker, planCopies, planGameTrackerImport } from "../../src/lib/gametracker-import";
import { EMPTY_FILTERS, buildEntries, facetValues, filterEntries } from "../../src/lib/filters";
import { type Library, createCopy, createGame, emptyLibrary } from "../../src/lib/model";
import { addGame, expectCarcasaText, openApp } from "./helpers";

const HEADER =
  "createdAt;updatedAt;id;externalId;source;title;alternativeNames;externalLink;cover;artworks;externalRating;userRating;firstReleaseDate;gameModes;playerPerspectives;releaseStatus;summary;availablePlatforms;userPlatforms;genres;developers;publishers;spaces;tags;videos;formats;location;storageUnit;section";
const COLUMNS = HEADER.split(";");

/** Una fila del CSV con las columnas citadas; las demás, vacías. */
function row(values: Record<string, string>): string {
  return COLUMNS.map((c) => {
    const v = values[c] ?? "";
    return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(";");
}

function readOne(values: Record<string, string>): GtEntry {
  const parsed = parseGameTracker(`${HEADER}\n${row(values)}`);
  if (!parsed.ok) throw new Error(parsed.message);
  expect(parsed.entries).toHaveLength(1);
  return parsed.entries[0];
}

const ARK = {
  createdAt: "2026-02-22",
  source: "igdb",
  externalId: "10239",
  title: "Ark: Survival Evolved",
  cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co493k.png",
  artworks: "https://images.igdb.com/igdb/image/upload/t_screenshot_big/ar5kw.png;https://images.igdb.com/igdb/image/upload/t_screenshot_big/ar67gg.png",
  externalRating: "67.66",
  genres: "Role-playing (RPG);Shooter",
  gameModes: "Single player;Multiplayer;Co-operative;Split screen",
  developers: "Studio Wildcard",
  firstReleaseDate: "2017-08-27",
  spaces: "Propiedad",
  userPlatforms: "PC (Microsoft Windows)",
  tags: "Epic Games;Steam",
  formats: "DIGITAL",
};

test.describe("leer el archivo", () => {
  test("el CSV respeta comillas, separadores y saltos de línea dentro de un campo", () => {
    expect(parseCsv('a;"b;c";"d ""e""\nf"\r\n1;2;3')).toEqual([
      ["a", "b;c", 'd "e"\nf'],
      ["1", "2", "3"],
    ]);
  });

  test("un archivo que no es de Game Tracker se rechaza", () => {
    expect(parseGameTracker("hola;adios\n1;2")).toEqual({ ok: false, message: "Este archivo no parece una exportación de Game Tracker." });
  });

  test("una fila completa se traduce a la Ludoteca", () => {
    const e = readOne(ARK);
    expect(e).toMatchObject({
      title: "Ark: Survival Evolved",
      igdbId: 10239,
      wish: false,
      platforms: ["PC"],
      stores: ["Epic Games", "Steam"],
      formats: ["digital"],
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co493k.png",
      backdropUrl: "https://images.igdb.com/igdb/image/upload/t_1080p/ar5kw.png",
      criticRating: 68,
      genres: ["Rol", "Disparos"],
      developer: "Studio Wildcard",
      releaseDate: "2017-08-27",
      createdAt: "2026-02-22T12:00:00.000Z",
    });
    expect(e.modes).toEqual(expect.arrayContaining(["solo", "coop_online", "coop_local", "competitivo"]));
    expect(e.moods).toEqual(expect.arrayContaining(["accion", "historia"]));
  });

  test("las plataformas de Game Tracker se traducen y los visores de PlayStation no cuentan", () => {
    expect(gtPlatform("PlayStation VR")).toBeNull();
    expect(gtPlatform("PlayStation VR2")).toBeNull();
    expect(gtPlatform("Oculus Rift")).toBe("PC");
    expect(gtPlatform("Meta Quest 3")).toBe("Meta Quest");
    expect(gtPlatform("PlayStation Portable")).toBe("PSP");
    expect(gtPlatform("Atari 2600")).toBe("Atari 2600");
    expect(readOne({ ...ARK, userPlatforms: "PlayStation 5;PlayStation VR;PlayStation 4" }).platforms).toEqual(["PS5", "PS4"]);
  });

  test("juegos sin catálogo, sin nota, deseos y sinopsis largas", () => {
    const user = readOne({ ...ARK, source: "user", externalId: "", externalRating: "0.0" });
    expect(user.igdbId).toBeNull();
    expect(user.criticRating).toBeNull();
    const wish = readOne({ ...ARK, spaces: "Deseos", formats: "" });
    expect(wish.wish).toBe(true);
    expect(wish.formats).toEqual([]);
    expect(readOne({ ...ARK, summary: "x".repeat(2500) }).summary).toHaveLength(2000);
  });

  test("una fila sin título no produce entrada", () => {
    const parsed = parseGameTracker(`${HEADER}\n${row({ ...ARK, title: "" })}\n${row(ARK)}`);
    expect(parsed.ok && parsed.entries.map((e) => e.title)).toEqual(["Ark: Survival Evolved"]);
  });
});

function entry(partial: Partial<GtEntry>): GtEntry {
  return {
    title: "Juego",
    igdbId: null,
    wish: false,
    platforms: [],
    stores: [],
    formats: [],
    coverUrl: null,
    backdropUrl: null,
    summary: null,
    genres: [],
    modes: [],
    moods: [],
    developer: null,
    releaseDate: null,
    criticRating: null,
    createdAt: "2026-02-22T12:00:00.000Z",
    ...partial,
  };
}

const copy = (platform: string, format: "fisico" | "digital", store: string | null = null) => ({ platform, format, store });

test.describe("planificar", () => {
  test("PC: una copia digital por tienda, o una sin tienda", () => {
    expect(planCopies(entry({ platforms: ["PC"], stores: ["Epic Games", "Steam"], formats: ["digital"] }))).toEqual({
      copies: [copy("PC", "digital", "Epic Games"), copy("PC", "digital", "Steam")],
      doubtful: false,
    });
    expect(planCopies(entry({ platforms: ["PC"], formats: ["digital"] })).copies).toEqual([copy("PC", "digital")]);
    expect(planCopies(entry({ platforms: ["PC"], formats: ["fisico"] })).copies).toEqual([copy("PC", "fisico")]);
  });

  test("una consola con físico y digital lleva las dos copias", () => {
    expect(planCopies(entry({ platforms: ["PS4"], formats: ["fisico", "digital"] }))).toEqual({
      copies: [copy("PS4", "fisico"), copy("PS4", "digital")],
      doubtful: false,
    });
  });

  test("con PC, el PC se queda con el digital y las consolas con el físico", () => {
    const plan = planCopies(entry({ platforms: ["PS3", "PC", "PS4"], formats: ["digital", "fisico"], stores: ["Steam"] }));
    expect(plan.doubtful).toBe(false);
    expect(plan.copies).toEqual(expect.arrayContaining([copy("PC", "digital", "Steam"), copy("PS3", "fisico"), copy("PS4", "fisico")]));
    expect(plan.copies).toHaveLength(3);
  });

  test("un solo formato vale para todas las consolas", () => {
    expect(planCopies(entry({ platforms: ["PS5", "PS4"], formats: ["fisico"] })).copies).toEqual([copy("PS5", "fisico"), copy("PS4", "fisico")]);
  });

  test("varias consolas con los dos formatos, sin plataformas o sin formato: para revisar", () => {
    expect(planCopies(entry({ platforms: ["Switch", "Switch 2"], formats: ["fisico", "digital"] }))).toEqual({
      copies: [copy("Switch", "fisico"), copy("Switch", "digital"), copy("Switch 2", "fisico"), copy("Switch 2", "digital")],
      doubtful: true,
    });
    expect(planCopies(entry({ platforms: [] }))).toEqual({ copies: [], doubtful: true });
    expect(planCopies(entry({ platforms: ["PS4", "PS5"] }))).toEqual({ copies: [copy("PS4", "fisico"), copy("PS5", "fisico")], doubtful: true });
  });

  test("lo que ya está se reconoce por catálogo o por título, sin contar la demostración", () => {
    const library: Library = { ...emptyLibrary(), games: [createGame({ title: "Hades" }), createGame({ title: "Celeste", demo: true }), createGame({ title: "Otro nombre", igdbId: 42 })] };
    library.wishlist = [{ id: "w", title: "Fable", priority: "media", genres: [], prices: [], createdAt: "x", updatedAt: "x" }];
    const items = classifyGameTracker(library, [
      entry({ title: "Hades", platforms: ["Switch"], formats: ["digital"] }),
      entry({ title: "Celeste", platforms: ["Switch"], formats: ["digital"] }),
      entry({ title: "Con catálogo", igdbId: 42, platforms: ["PC"] }),
      entry({ title: "Celeste", platforms: ["PC"] }),
      entry({ title: "Fable", wish: true, platforms: ["PS5"] }),
      entry({ title: "HADES", wish: true }),
      entry({ title: "Kirby", platforms: ["Switch", "Switch 2"], formats: ["fisico", "digital"] }),
    ]);
    expect(items.map((i) => i.state)).toEqual(["ya", "nuevo", "ya", "ya", "ya", "ya", "dudoso"]);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  test("se guardan juegos, copias y deseos con lo que trae el archivo", () => {
    const items = classifyGameTracker(emptyLibrary(), [
      entry({ title: "Ark", igdbId: 10239, platforms: ["PC"], stores: ["Epic Games", "Steam"], formats: ["digital"], genres: ["Rol"] }),
      entry({ title: "Horizon", platforms: ["PS4"], formats: ["fisico"] }),
      entry({ title: "Fable", igdbId: 92550, wish: true, platforms: ["PS5", "PC"], coverUrl: "https://x/c.png", genres: ["Rol"] }),
    ]);
    const plan = planGameTrackerImport(emptyLibrary(), items);
    expect(plan.counts).toEqual({ juegos: 2, copias: 3, deseos: 1, saltados: 0 });
    const ark = plan.games.find((g) => g.title === "Ark")!;
    expect(ark).toMatchObject({ igdbId: 10239, status: "pendiente", createdAt: "2026-02-22T12:00:00.000Z", genres: ["Rol"] });
    expect(plan.copies.filter((c) => c.gameId === ark.id).map((c) => [c.platform, c.format, c.store, c.availability])).toEqual([
      ["PC", "digital", "Epic Games", "comprado"],
      ["PC", "digital", "Steam", "comprado"],
    ]);
    expect(plan.wishlist[0]).toMatchObject({ title: "Fable", priority: "media", platform: "PS5", igdbId: 92550, coverUrl: "https://x/c.png", genres: ["Rol"] });
  });

  test("planificar dos veces lo mismo no duplica nada", () => {
    const items = classifyGameTracker(emptyLibrary(), [
      entry({ title: "Ark", platforms: ["PC"], formats: ["digital"] }),
      entry({ title: "Fable", wish: true }),
    ]);
    const first = planGameTrackerImport(emptyLibrary(), items);
    const after: Library = { ...emptyLibrary(), games: first.games, copies: first.copies, wishlist: first.wishlist };
    const second = planGameTrackerImport(after, items);
    expect(second.games).toEqual([]);
    expect(second.copies).toEqual([]);
    expect(second.wishlist).toEqual([]);
    expect(second.counts).toEqual({ juegos: 0, copias: 0, deseos: 0, saltados: 2 });
  });

  test("las copias editadas en la revisión son las que se guardan", () => {
    const [kirby] = classifyGameTracker(emptyLibrary(), [entry({ title: "Kirby", platforms: ["Switch", "Switch 2"], formats: ["fisico", "digital"] })]);
    const edited: GtItem = { ...kirby, copies: [copy("Switch", "fisico")] };
    const plan = planGameTrackerImport(emptyLibrary(), [edited]);
    expect(plan.copies.map((c) => [c.platform, c.format])).toEqual([["Switch", "fisico"]]);
  });
});

const SAMPLE = path.join(__dirname, "fixtures", "gametracker-muestra.csv");

async function loadSample(page: Page) {
  await openApp(page, "/importar?origen=gametracker");
  await page.getByLabel("Archivo de Game Tracker").setInputFiles(SAMPLE);
}

test.describe("pantalla", () => {
  test("la pantalla importa de Game Tracker lo que falta y lo repetido no entra", async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page, "/biblioteca");
    await addGame(page, { title: "Hades", platform: "Switch" });
    await page.getByRole("link", { name: "Importar…" }).click();
    await expect(page).toHaveURL(/\/importar$/);
    const origin = page.getByRole("navigation", { name: "Origen de la importación" });
    await origin.getByRole("link", { name: "Game Tracker" }).click();
    await expect(page).toHaveURL(/origen=gametracker/);
    await expect(origin.getByRole("link", { name: "Game Tracker" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Copiar desde Game Tracker" })).toBeVisible();

    await page.getByLabel("Archivo de Game Tracker").setInputFiles(SAMPLE);
    await expect(page.getByRole("status").filter({ hasText: "juegos nuevos" })).toHaveText("7 juegos nuevos · 1 deseo nuevo · 2 ya los tienes · 1 para revisar");

    const review = page.getByRole("region", { name: "Para revisar" });
    await expect(review.getByRole("button", { name: /^Quitar / })).toHaveCount(4);
    await review.getByRole("button", { name: "Quitar Switch 2 · Físico" }).click();
    await review.getByRole("button", { name: "Quitar Switch · Digital" }).click();
    await expect(review.getByRole("button", { name: /^Quitar / })).toHaveCount(2);

    await page.getByRole("checkbox", { name: "Copiar «Genshin Impact»" }).uncheck();
    await expect(page.getByRole("link", { name: "Haz antes una copia de seguridad" })).toHaveAttribute("href", "/ajustes?apartado=copia");
    await expectCarcasaText(page.locator("main"));

    await page.getByRole("button", { name: "Copiar a la ludoteca" }).click();
    await expect(page.getByText("Copiados 6 juegos, 12 copias y 1 deseo.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver la biblioteca" })).toBeVisible();

    await openApp(page, "/biblioteca?q=Kirby&agrupar=ninguno");
    const kirby = page.locator("main").getByRole("listitem").filter({ hasText: "Kirby and the Forgotten Land" });
    await expect(kirby).toContainText("Switch 2");
    await expect(kirby).toContainText("2 copias");
    await openApp(page, "/deseos");
    await expect(page.getByRole("region", { name: "Deseos" }).getByRole("listitem").filter({ hasText: "Fable" })).toHaveCount(1);
    await openApp(page, "/biblioteca?q=Genshin");
    await expect(page.getByText("Genshin Impact")).toHaveCount(0);

    await loadSample(page);
    await expect(page.getByRole("status").filter({ hasText: "nuevo" })).toHaveText("1 juego nuevo · 0 deseos nuevos · 9 ya los tienes · 0 para revisar");
  });

  test("un archivo que no es de Game Tracker no deja copiar nada", async ({ page }) => {
    const bad = test.info().outputPath("otra-cosa.csv");
    writeFileSync(bad, "hola;adios\n1;2\n");
    await openApp(page, "/importar?origen=gametracker");
    await page.getByLabel("Archivo de Game Tracker").setInputFiles(bad);
    await expect(page.getByRole("alert").filter({ hasText: "Game Tracker" })).toHaveText("Este archivo no parece una exportación de Game Tracker.");
    await expect(page.getByRole("button", { name: "Copiar a la ludoteca" })).toHaveCount(0);
  });
});

async function importSample(page: Page) {
  await loadSample(page);
  await page.getByRole("button", { name: "Copiar a la ludoteca" }).click();
  await expect(page.getByText(/^Copiados /)).toBeVisible();
}

/** Cabeceras de balda de la biblioteca (son decorativas: están ocultas a los lectores de pantalla). */
const shelf = (page: Page, name: string) => page.locator("main li[aria-hidden] > strong").filter({ hasText: new RegExp(`^${name}$`) });

test.describe("tienda", () => {
  test("el filtro de tienda deja los juegos con alguna copia de esa tienda", () => {
    const a = createGame({ title: "A" });
    const b = createGame({ title: "B" });
    const c = createGame({ title: "C" });
    const library: Library = {
      ...emptyLibrary(),
      games: [a, b, c],
      copies: [
        createCopy(a.id, { platform: "PC", format: "digital", store: "Steam" }),
        createCopy(b.id, { platform: "PC", format: "digital", store: "Epic Games" }),
        createCopy(b.id, { platform: "PC", format: "digital", store: "Steam" }),
        createCopy(c.id, { platform: "PS4", format: "fisico" }),
      ],
    };
    const entries = buildEntries(library);
    expect(filterEntries(entries, { ...EMPTY_FILTERS, stores: ["Steam"] }).map((e) => e.game.title)).toEqual(["A", "B"]);
    expect(facetValues(entries).stores).toEqual([
      { value: "Steam", count: 2 },
      { value: "Epic Games", count: 1 },
    ]);
  });

  test("la balda de PC se divide por tienda y se filtra por tienda", async ({ page }) => {
    test.setTimeout(90_000);
    await importSample(page);
    await openApp(page, "/biblioteca");
    for (const name of ["PC · Steam", "PC · Epic Games", "PC · sin tienda"]) await expect(shelf(page, name)).toHaveCount(1);
    await expect(shelf(page, "PC")).toHaveCount(0);
    await expect(page.locator("main").getByRole("listitem").filter({ hasText: "Ark: Survival Evolved" })).toHaveCount(2);

    await page.getByRole("group", { name: "Tienda" }).getByRole("button", { name: /^Steam/ }).click();
    await expect(page).toHaveURL(/tienda=Steam/);
    const main = page.locator("main");
    await expect(main.getByRole("listitem").filter({ hasText: "Final Fantasy X/X-2 HD Remaster" }).first()).toBeVisible();
    await expect(main.getByRole("listitem").filter({ hasText: "Ark: Survival Evolved" }).first()).toBeVisible();
    await expect(main.getByText("Horizon Zero Dawn")).toHaveCount(0);
    await page.getByRole("button", { name: "Restablecer", exact: true }).first().click();
    await expect(page).not.toHaveURL(/tienda=/);
  });

  test("sin tiendas, la balda se llama PC y no hay filtro de tienda", async ({ page }) => {
    await openApp(page, "/biblioteca");
    await addGame(page, { title: "Celeste", platform: "PC" });
    await expect(shelf(page, "PC")).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Tienda" })).toHaveCount(0);
  });
});
