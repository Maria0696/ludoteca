import { expect, test } from "@playwright/test";
import { type Game, createGame, gameSchema } from "../../src/lib/model";
import { pickSeries } from "../../src/lib/igdb-maps";
import { buildStories, groupByBrand, moveInStory, nextInStory, orderStory } from "../../src/lib/sagas";

/* Sagas: los juegos de cada historia, en orden de lanzamiento o en el de la historia (puesto a mano). */

const game = (title: string, patch: Partial<Game>): Game => ({ ...createGame({ title }), ...patch });
const titles = (games: Game[]) => games.map((g) => g.title);

test("las historias reúnen dos o más juegos y la marca «Sin saga» no cuenta", () => {
  const stories = buildStories([
    game("Jedi: Fallen Order", { series: "Star Wars Jedi", saga: "Star Wars" }),
    game("Jedi: Survivor", { series: "Star Wars Jedi", saga: "Star Wars" }),
    game("KOTOR", { series: "Star Wars: KOTOR", saga: "Star Wars" }),
    game("Half-Life", { series: "Half-Life", saga: "Sin saga" }),
    game("Half-Life 2", { series: "Half-Life", saga: "Sin saga" }),
  ]);
  expect(stories.map((s) => [s.name, s.brand])).toEqual([
    ["Half-Life", null],
    ["Star Wars Jedi", "Star Wars"],
  ]);
  expect(groupByBrand(stories).map((g) => [g.brand, g.stories.map((s) => s.name)])).toEqual([
    [null, ["Half-Life"]],
    ["Star Wars", ["Star Wars Jedi"]],
  ]);
});

const fallen = game("Jedi: Fallen Order", { series: "Jedi", releaseDate: "2019-11-15" });
const survivor = game("Jedi: Survivor", { series: "Jedi", releaseDate: "2023-04-28" });

test("orden de lanzamiento y orden de la historia", () => {
  const [story] = buildStories([survivor, fallen]);
  expect(titles(orderStory(story, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  // Sin orden puesto, la historia es el lanzamiento.
  expect(titles(orderStory(story, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
  const [ordered] = buildStories([{ ...survivor, seriesOrder: 1 }, { ...fallen, seriesOrder: 2 }]);
  expect(titles(orderStory(ordered, "historia"))).toEqual(["Jedi: Survivor", "Jedi: Fallen Order"]);
  expect(titles(orderStory(ordered, "lanzamiento"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor"]);
});

test("mover un juego guarda el orden de todos; uno nuevo va al final", () => {
  const [story] = buildStories([fallen, survivor]);
  expect(moveInStory(story, survivor.id, -1)).toEqual([
    { id: survivor.id, seriesOrder: 1 },
    { id: fallen.id, seriesOrder: 2 },
  ]);
  expect(moveInStory(story, fallen.id, -1)).toEqual([]);
  // Uno que entra sin puesto va al final de la historia, aunque saliera antes.
  const prequel = game("Jedi: precuela", { series: "Jedi", releaseDate: "2015-01-01" });
  const [grown] = buildStories([{ ...fallen, seriesOrder: 1 }, { ...survivor, seriesOrder: 2 }, prequel]);
  expect(titles(orderStory(grown, "historia"))).toEqual(["Jedi: Fallen Order", "Jedi: Survivor", "Jedi: precuela"]);
});

test("el siguiente es el primero sin superar ni abandonar", () => {
  const done = game("Uno", { status: "completado", finishedAt: "2024-01-01" });
  const dropped = game("Dos", { status: "abandonado" });
  const waiting = game("Tres", { status: "pendiente" });
  expect(nextInStory([done, dropped, waiting])?.title).toBe("Tres");
  expect(nextInStory([done])).toBeNull();
});

test("una copia antigua, sin historia, se sigue leyendo", () => {
  const { series, seriesOrder, ...old } = game("Viejo", {});
  void series;
  void seriesOrder;
  const parsed = gameSchema.parse(old);
  expect(parsed.series ?? null).toBeNull();
  expect(parsed.seriesOrder ?? null).toBeNull();
});

test("de varias series de IGDB, la más concreta", () => {
  const many = Array.from({ length: 40 }, (_, i) => i + 1);
  expect(pickSeries([{ name: "Star Wars", games: many }, { name: "Star Wars Jedi", games: [1, 2] }], "Star Wars")).toBe("Star Wars Jedi");
  // Si la única serie se llama como la marca, es esa.
  expect(pickSeries([{ name: "Resident Evil", games: many }], "Resident Evil")).toBe("Resident Evil");
  // Entre varias que no se llaman como la marca, la de menos juegos.
  expect(pickSeries([{ name: "LEGO Star Wars", games: [1, 2, 3] }, { name: "Star Wars: Squadrons", games: [1] }], "Star Wars")).toBe("Star Wars: Squadrons");
  expect(pickSeries(undefined, "Star Wars")).toBeNull();
});
