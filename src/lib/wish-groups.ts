import { type WishItem, normalizeTitle } from "./model";

/**
 * Los deseos agrupados por juego: los del mismo título (sin mayúsculas, tildes ni signos) o el mismo juego de IGDB van
 * juntos, uno por plataforma. Cada grupo conserva el orden de la lista: queda donde está el primero de los suyos, así que
 * con la lista ya ordenada (por prioridad, por objetivo…) cada juego se coloca por su mejor plataforma.
 */
export function groupWishes(list: WishItem[]): WishItem[][] {
  const groups: WishItem[][] = [];
  const byKey = new Map<string, WishItem[]>();
  for (const w of list) {
    const keys = [`titulo:${normalizeTitle(w.title)}`, ...(w.igdbId != null ? [`igdb:${w.igdbId}`] : [])];
    let group = keys.map((k) => byKey.get(k)).find(Boolean);
    if (!group) {
      group = [];
      groups.push(group);
    }
    group.push(w);
    for (const k of keys) if (!byKey.has(k)) byKey.set(k, group);
  }
  return groups;
}
