import type { CatalogGame } from "./catalog";
import { normalizeTitle } from "./model";

/** Resultados que enseña la búsqueda al añadir un juego. */
export const CATALOG_RESULTS = 8;

/*
 * IGDB da ficha propia a cada actualización, temporada o pack de un juego
 * («Genshin Impact: Version 2.0…»), y su orden de relevancia no garantiza que
 * el juego que se llama exactamente así quede entre los primeros. Por eso se
 * descartan esos tipos (mod 5, temporada 7, pack 13, actualización 14), se
 * piden más resultados y se ordenan aquí.
 */
const HIDDEN_GAME_TYPES = "5,7,13,14";
const FETCHED = 30;

export function catalogSearchQuery(q: string, fields: string): string {
  const safe = q.replace(/["\\]/g, " ").slice(0, 80);
  return `search "${safe}"; fields ${fields}; where version_parent = null & game_type != (${HIDDEN_GAME_TYPES}); limit ${FETCHED};`;
}

/** Primero el título exacto, luego los que empiezan igual y después el resto, respetando el orden de IGDB dentro de cada grupo. */
export function rankCatalogResults(results: CatalogGame[], q: string, max = CATALOG_RESULTS): CatalogGame[] {
  const wanted = normalizeTitle(q);
  const score = (g: CatalogGame) => {
    const title = normalizeTitle(g.title);
    return title === wanted ? 0 : title.startsWith(wanted) ? 1 : 2;
  };
  return results
    .map((g, i) => ({ g, i, s: score(g) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, max)
    .map((x) => x.g);
}
