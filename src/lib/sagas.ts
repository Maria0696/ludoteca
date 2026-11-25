import type { Game } from "./model";
import { timesFinished } from "./runs";

/*
 * Sagas: los juegos de cada historia (Star Wars Jedi, Half-Life…), agrupadas bajo su marca (Star Wars).
 * El orden de la historia lo pone la propietaria; sin ponerlo, es el de lanzamiento. La app no inventa cronologías.
 */

export type StoryOrder = "lanzamiento" | "historia";

/** Lo que guarda la ficha al quitar una historia a mano: así traer de IGDB no la vuelve a poner. */
export const NO_STORY = "Sin historia";

/** La historia del juego; «Sin historia» y vacío no son historia. */
export function storyOf(game: Game): string | null {
  const name = game.series?.trim();
  return name && name.toLowerCase() !== NO_STORY.toLowerCase() ? name : null;
}
export type Story = { name: string; brand: string | null; games: Game[] };

const byName = (a: string, b: string) => a.localeCompare(b, "es");

/** La marca del juego; «Sin saga» (herencia de una importación) y vacío no son marca. */
export function brandOf(game: Game): string | null {
  const saga = game.saga?.trim();
  return saga && saga.toLowerCase() !== "sin saga" ? saga : null;
}

/** Las historias con dos o más juegos, por nombre; su marca, la más repetida entre sus juegos. */
export function buildStories(games: Game[]): Story[] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const name = storyOf(g);
    if (name) map.set(name, [...(map.get(name) ?? []), g]);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([name, list]) => {
      const counts = new Map<string, number>();
      for (const g of list) {
        const brand = brandOf(g);
        if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
      }
      const brand = [...counts.entries()].sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))[0]?.[0] ?? null;
      return { name, brand: brand && brand.toLowerCase() !== name.toLowerCase() ? brand : null, games: list };
    })
    .sort((a, b) => byName(a.name, b.name));
}

/** Las historias bajo su marca, por nombre; una historia sin marca va sola. */
export function groupByBrand(stories: Story[]): { brand: string | null; stories: Story[] }[] {
  const groups: { brand: string | null; stories: Story[] }[] = [];
  for (const story of stories) {
    const group = story.brand ? groups.find((g) => g.brand === story.brand) : undefined;
    if (group) group.stories.push(story);
    else groups.push({ brand: story.brand, stories: [story] });
  }
  return groups.sort((a, b) => byName(a.brand ?? a.stories[0].name, b.brand ?? b.stories[0].name));
}

const byRelease = (a: Game, b: Game) => (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || byName(a.title, b.title);

/** «lanzamiento»: por fecha (sin fecha, al final). «historia»: los que tienen puesto, por él; los demás, después, por fecha. */
export function orderStory(story: Story, order: StoryOrder): Game[] {
  const release = [...story.games].sort(byRelease);
  if (order === "lanzamiento") return release;
  const placed = release.filter((g) => g.seriesOrder != null).sort((a, b) => a.seriesOrder! - b.seriesOrder!);
  return [...placed, ...release.filter((g) => g.seriesOrder == null)];
}

/** Mueve un juego un puesto en el orden de la historia y devuelve el puesto de todos (1…n); si no se puede, nada. */
export function moveInStory(story: Story, gameId: string, dir: -1 | 1): { id: string; seriesOrder: number }[] {
  const ordered = orderStory(story, "historia");
  const from = ordered.findIndex((g) => g.id === gameId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
  return ordered.map((g, i) => ({ id: g.id, seriesOrder: i + 1 }));
}

/** El siguiente que toca: el primero sin superar ni abandonar. */
export function nextInStory(ordered: Game[]): Game | null {
  return ordered.find((g) => timesFinished(g) === 0 && g.status !== "abandonado" && g.status !== "completado") ?? null;
}

/** El puesto del juego en el orden de su historia, si su historia tiene dos o más juegos. */
export function storyPosition(game: Game, games: Game[]): { name: string; position: number; total: number } | null {
  const story = buildStories(games).find((s) => s.name === storyOf(game));
  if (!story) return null;
  const ordered = orderStory(story, "historia");
  return { name: story.name, position: ordered.findIndex((g) => g.id === game.id) + 1, total: ordered.length };
}
