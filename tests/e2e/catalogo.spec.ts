import { expect, test } from "@playwright/test";
import type { CatalogGame } from "../../src/lib/catalog";
import { catalogNameQuery, catalogSearchQuery, rankCatalogResults, searchCatalog } from "../../src/lib/catalog-search";
import { baseGameOf, gameTypeOf } from "../../src/lib/igdb-maps";

function game(igdbId: number, title: string): CatalogGame {
  return {
    igdbId,
    title,
    year: null,
    coverUrl: null,
    backdropUrl: null,
    genres: [],
    platforms: [],
    modes: [],
    moods: [],
    lengthHours: null,
    criticRating: null,
    summary: null,
    developer: null,
    franchise: null,
    saga: null,
    gameType: null,
    baseGame: null,
    releaseDate: null,
    ageRating: null,
  };
}

test.describe("buscar en el catálogo", () => {
  test("el juego que se llama exactamente así sale el primero aunque IGDB lo traiga tarde", () => {
    const updates = Array.from({ length: 12 }, (_, i) => game(i + 1, `Genshin Impact: Version ${i + 1}.0`));
    const ranked = rankCatalogResults([...updates, game(119277, "Genshin Impact")], "genshin impact");
    expect(ranked[0].title).toBe("Genshin Impact");
    expect(ranked).toHaveLength(8);
  });

  test("después del exacto, los que empiezan igual y luego el resto, sin desordenar los empates", () => {
    const ranked = rankCatalogResults([game(1, "Otro Hades"), game(2, "Hades II"), game(3, "Hades")], "Hades");
    expect(ranked.map((g) => g.title)).toEqual(["Hades", "Hades II", "Otro Hades"]);
  });

  test("la consulta descarta actualizaciones, temporadas, packs y mods, y pide margen para ordenar", () => {
    const query = catalogSearchQuery('Genshin "Impact"', "name");
    expect(query).toBe('search "Genshin  Impact "; fields name; where version_parent = null & game_type != (5,7,13,14); limit 30;');
  });
});

test.describe("búsqueda por nombre cuando IGDB no trae el título exacto", () => {
  test("si la búsqueda no trae el título exacto, se busca por nombre y sale el primero", async () => {
    let asked = 0;
    const results = await searchCatalog(
      "God of War Ragnarök: Valhalla",
      async () => [game(1, "God of War Ragnarök"), game(2, "God of War")],
      async () => {
        asked++;
        return [game(3, "God of War Ragnarök: Valhalla"), game(1, "God of War Ragnarök")];
      },
    );
    expect(asked).toBe(1);
    expect(results.map((g) => g.title)).toEqual(["God of War Ragnarök: Valhalla", "God of War Ragnarök", "God of War"]);
  });

  test("si ya está el título exacto (aunque sin tilde), no se pregunta más", async () => {
    let asked = 0;
    const results = await searchCatalog("god of war ragnarok", async () => [game(1, "God of War Ragnarök")], async () => {
      asked++;
      return [];
    });
    expect(asked).toBe(0);
    expect(results.map((g) => g.title)).toEqual(["God of War Ragnarök"]);
  });

  test("si la búsqueda por nombre falla, quedan los resultados de la primera", async () => {
    const results = await searchCatalog("Valhalla", async () => [game(1, "Assassin's Creed Valhalla")], async () => {
      throw new Error("IGDB");
    });
    expect(results.map((g) => g.title)).toEqual(["Assassin's Creed Valhalla"]);
  });

  test("escrito sin tilde ni signos, también lo encuentra; lo que no tiene todas las palabras, no", async () => {
    const results = await searchCatalog(
      "God of War Ragnarok Valhalla",
      async () => [],
      async () => [game(1, "Assassin's Creed Valhalla"), game(3, "God of War Ragnarök: Valhalla")],
    );
    expect(results.map((g) => g.title)).toEqual(["God of War Ragnarök: Valhalla"]);
  });

  test("la consulta por nombre busca cada palabra larga (también sin tilde) dentro del nombre, sin filtrar por tipo", () => {
    expect(catalogNameQuery('God of War "Ragnarök": Valhalla', "name")).toBe(
      'fields name; where name ~ *"ragnarök"* | name ~ *"ragnarok"* | name ~ *"valhalla"*; limit 200;',
    );
    // Sin palabras largas, el texto entero.
    expect(catalogNameQuery("Ico", "name")).toBe('fields name; where name ~ *"ico"*; limit 200;');
  });
});



test("el tipo de juego de IGDB: base, DLC, remake, remaster, colección… y de qué juego es", () => {
  expect(gameTypeOf({ game_type: 0 })).toBe("main");
  expect(gameTypeOf({ game_type: 1, parent_game: { name: "God of War Ragnarök" } })).toBe("dlc");
  expect(gameTypeOf({ game_type: 3 })).toBe("bundle");
  expect(gameTypeOf({ game_type: 8 })).toBe("remake");
  expect(gameTypeOf({ game_type: 9 })).toBe("remaster");
  // Una edición (Definitive, GOTY…) es una versión de otro juego.
  expect(gameTypeOf({ game_type: 0, version_parent: { name: "The Witcher 3" } })).toBe("edition");
  expect(gameTypeOf({})).toBeNull();
  expect(gameTypeOf({ game_type: 99 })).toBeNull();
  expect(baseGameOf({ game_type: 1, parent_game: { name: "God of War Ragnarök" } })).toBe("God of War Ragnarök");
  expect(baseGameOf({ version_parent: { name: "The Witcher 3" } })).toBe("The Witcher 3");
  expect(baseGameOf({ game_type: 0 })).toBeNull();
});
