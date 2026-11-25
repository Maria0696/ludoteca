import { expect, test } from "@playwright/test";
import type { CatalogGame } from "../../src/lib/catalog";
import { catalogSearchQuery, rankCatalogResults } from "../../src/lib/catalog-search";

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
    saga: null,
    series: null,
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
