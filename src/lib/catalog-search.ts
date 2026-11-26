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

const stripMarks = (word: string) => word.normalize("NFD").replace(/\p{Diacritic}/gu, "");

/**
 * Por nombre, sin filtrar por tipo: los que llevan alguna de las palabras largas en el nombre (tal cual y sin tilde),
 * porque IGDB compara el texto literal: «God of War Ragnarok Valhalla» no casa con «God of War Ragnarök: Valhalla»,
 * pero «Valhalla» sí. Luego `searchCatalog` se queda con los que tienen todas las palabras.
 */
export function catalogNameQuery(q: string, fields: string): string {
  const tokens = q.toLowerCase().split(/[^\p{Letter}\p{Number}]+/u).filter((w) => stripMarks(w).length >= 4);
  const words = [...new Set(tokens.flatMap((w) => [w, stripMarks(w)]))].slice(0, 8);
  const where = words.length ? words.map((w) => `name ~ *"${w}"*`).join(" | ") : `name ~ *"${safeText(q.toLowerCase()).trim()}"*`;
  return `fields ${fields}; where ${where}; limit 200;`;
}

/** Si el título tiene todas las palabras buscadas, sin contar tildes, mayúsculas ni signos. */
const hasAllWords = (title: string, q: string) => {
  const name = normalizeTitle(title);
  return normalizeTitle(q)
    .split(" ")
    .filter(Boolean)
    .every((w) => name.includes(w));
};

/**
 * Busca en el catálogo: primero con la búsqueda de IGDB y, si no trae el juego que se llama exactamente así, también
 * por nombre, quedándose con los que tienen todas las palabras (si eso falla, quedan los de la primera). Ordenados
 * con `rankCatalogResults`.
 */
export async function searchCatalog(q: string, search: () => Promise<CatalogGame[]>, byName: () => Promise<CatalogGame[]>): Promise<CatalogGame[]> {
  const found = await search();
  const wanted = normalizeTitle(q);
  if (found.some((g) => normalizeTitle(g.title) === wanted)) return rankCatalogResults(found, q);
  const more = await byName().catch((): CatalogGame[] => []);
  const seen = new Set(found.map((g) => g.igdbId));
  return rankCatalogResults([...found, ...more.filter((g) => !seen.has(g.igdbId) && hasAllWords(g.title, q))], q);
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
