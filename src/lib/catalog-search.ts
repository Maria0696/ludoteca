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

const safeText = (q: string) => q.replace(/["\\]/g, " ").slice(0, 80);

export function catalogSearchQuery(q: string, fields: string): string {
  return `search "${safeText(q)}"; fields ${fields}; where version_parent = null & game_type != (${HIDDEN_GAME_TYPES}); limit ${FETCHED};`;
}

/**
 * Por nombre: el texto dentro del nombre, sin filtrar por tipo. Para cuando la búsqueda de IGDB no trae el juego que
 * se llama así (le pasaba a «God of War Ragnarök: Valhalla», un DLC).
 */
export function catalogNameQuery(q: string, fields: string): string {
  return `fields ${fields}; where name ~ *"${safeText(q)}"*; limit 10;`;
}

/**
 * Busca en el catálogo: primero con la búsqueda de IGDB y, si no trae el juego que se llama exactamente así, también
 * por nombre (si eso falla, quedan los de la primera). Ordenados con `rankCatalogResults`.
 */
export async function searchCatalog(q: string, search: () => Promise<CatalogGame[]>, byName: () => Promise<CatalogGame[]>): Promise<CatalogGame[]> {
  const found = await search();
  const wanted = normalizeTitle(q);
  if (found.some((g) => normalizeTitle(g.title) === wanted)) return rankCatalogResults(found, q);
  const more = await byName().catch((): CatalogGame[] => []);
  const seen = new Set(found.map((g) => g.igdbId));
  return rankCatalogResults([...found, ...more.filter((g) => !seen.has(g.igdbId))], q);
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
