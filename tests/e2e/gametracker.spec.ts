import { expect, test } from "@playwright/test";
import { parseCsv } from "../../src/lib/csv";
import { type GtEntry, gtPlatform, parseGameTracker } from "../../src/lib/gametracker-import";

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
