/*
 * Lo que se proyecta en la pantalla de «Entrar». Antes de iniciar sesión la
 * app no puede ver las carátulas de la biblioteca, así que usa obras de
 * dominio público de la demo. Sus fichas completas están en src/lib/demo-art.ts.
 */

export interface ProjectedWork {
  src: string;
  title: string;
  author: string;
}

const fondo = (key: string) => `/demo-art/${key}-fondo.webp`;

export const PROJECTION: ProjectedWork[] = [
  { src: fondo("ghost-of-tsushima"), title: "Fuji rojo", author: "Katsushika Hokusai" },
  { src: fondo("outer-wilds"), title: "Nebulosa de Orión", author: "Telescopio Hubble (NASA, ESA)" },
  { src: fondo("red-dead-redemption-2"), title: "Las montañas Rocosas, pico Lander", author: "Albert Bierstadt" },
  { src: fondo("okami-hd"), title: "Dragón del carro de festival", author: "Katsushika Hokusai" },
  { src: fondo("metroid-dread"), title: "Saturno durante el equinoccio", author: "NASA / JPL" },
  { src: fondo("spiritfarer"), title: "La gran ola de Kanagawa", author: "Katsushika Hokusai" },
  { src: fondo("final-fantasy-vii-remake"), title: "Nocturno en negro y oro: el cohete que cae", author: "James McNeill Whistler" },
  { src: fondo("split-fiction"), title: "Galaxias Antena", author: "Telescopio Hubble (NASA, ESA)" },
];

/** Segundos que permanece cada obra en pantalla. */
export const SECONDS_PER_WORK = 7;
