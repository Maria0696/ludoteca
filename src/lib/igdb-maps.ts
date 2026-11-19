import type { Mood, PlayMode } from "./model";

/*
 * Tablas del catálogo de IGDB compartidas por el servidor y el navegador:
 * géneros, plataformas, modos y ganas de jugar.
 */

export const GENRES_ES: Record<string, string> = {
  "Role-playing (RPG)": "Rol",
  Adventure: "Aventura",
  Platform: "Plataformas",
  Puzzle: "Puzles",
  Shooter: "Disparos",
  Strategy: "Estrategia",
  Simulator: "Simulación",
  Racing: "Carreras",
  Sport: "Deportes",
  Fighting: "Lucha",
  "Hack and slash/Beat 'em up": "Acción",
  Indie: "Independiente",
  Arcade: "Arcade",
  "Turn-based strategy (TBS)": "Estrategia por turnos",
  "Real Time Strategy (RTS)": "Estrategia en tiempo real",
  Tactical: "Táctico",
  "Visual Novel": "Novela visual",
  "Card & Board Game": "Cartas y tablero",
  Music: "Música",
  "Point-and-click": "Aventura gráfica",
  MOBA: "MOBA",
  Pinball: "Pinball",
  Quiz: "Preguntas",
};

/** Abreviaturas y nombres del catálogo, traducidos a las consolas de la Ludoteca. */
export const PLATFORM_NAMES: Record<string, string> = {
  PS5: "PS5",
  PS4: "PS4",
  PS3: "PS3",
  PS2: "PS2",
  PS1: "PS1",
  PlayStation: "PS1",
  "PlayStation 2": "PS2",
  "PlayStation 3": "PS3",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  Vita: "PS Vita",
  "PlayStation Vita": "PS Vita",
  PSP: "PSP",
  "PlayStation Portable": "PSP",
  "Series X|S": "Xbox Series",
  "Xbox Series X|S": "Xbox Series",
  XONE: "Xbox Series",
  "Xbox One": "Xbox Series",
  X360: "Xbox 360",
  "Xbox 360": "Xbox 360",
  XBOX: "Xbox",
  Xbox: "Xbox",
  Switch: "Switch",
  "Switch 2": "Switch 2",
  NSW: "Switch",
  NSW2: "Switch 2",
  "Nintendo Switch": "Switch",
  "Nintendo Switch 2": "Switch 2",
  WiiU: "Wii U",
  "Wii U": "Wii U",
  Wii: "Wii",
  NGC: "GameCube",
  "Nintendo GameCube": "GameCube",
  N64: "N64",
  "Nintendo 64": "N64",
  SNES: "SNES",
  "Super Nintendo Entertainment System": "SNES",
  NES: "NES",
  "Nintendo Entertainment System": "NES",
  "3DS": "3DS",
  "Nintendo 3DS": "3DS",
  NDS: "DS",
  "Nintendo DS": "DS",
  GBA: "GBA",
  "Game Boy Advance": "GBA",
  GB: "Game Boy",
  "Game Boy": "Game Boy",
  PC: "PC",
  "PC (Microsoft Windows)": "PC",
  "Steam Deck": "PC",
  "Oculus Rift": "PC",
  "Oculus Quest": "Meta Quest",
  "Meta Quest 2": "Meta Quest",
  "Meta Quest 3": "Meta Quest",
  DC: "Dreamcast",
  Dreamcast: "Dreamcast",
  "Sega Mega Drive/Genesis": "Mega Drive",
};

/** Modos de juego del catálogo (en inglés) a los de la Ludoteca. */
export function mapModes(names: string[]): PlayMode[] {
  const out = new Set<PlayMode>();
  for (const name of names) {
    if (name === "Single player") out.add("solo");
    if (name === "Co-operative") out.add("coop_online");
    if (name === "Split screen") out.add("coop_local");
    if (name === "Multiplayer" || name === "Battle Royale") out.add("competitivo");
  }
  return [...out];
}

/** Ganas de jugar que sugieren los géneros y temas del catálogo (en inglés). */
export function guessMoods(list: string[]): Mood[] {
  const names = new Set(list);
  const out = new Set<Mood>();
  if (names.has("Action") || names.has("Shooter") || names.has("Fighting") || names.has("Hack and slash/Beat 'em up")) out.add("accion");
  if (names.has("Drama") || names.has("Mystery") || names.has("Visual Novel") || names.has("Role-playing (RPG)")) out.add("historia");
  if (names.has("Simulator") || names.has("Sandbox") || names.has("Puzzle")) out.add("tranquila");
  if (names.has("Arcade") || names.has("Party") || names.has("Racing")) out.add("rapida");
  return [...out];
}
