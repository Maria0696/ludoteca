import type { CatalogGame } from "./catalog";

/** Un juego de la cuenta de Steam, tal como lo usa la app. */
export interface SteamGame {
  appId: number;
  name: string;
  /** Minutos jugados en total. */
  minutes: number;
  /** Icono pequeño del juego, si Steam lo tiene. */
  icon: string | null;
}

export type SteamLibraryResponse =
  | { ok: true; games: SteamGame[] }
  | { ok: false; reason: "no-configurado" | "no-autorizado" | "perfil" | "privado" | "vacio" | "error"; message: string };

export type SteamSheetsResponse =
  | { ok: true; matches: Record<number, CatalogGame> }
  | { ok: false; reason: "no-configurado" | "no-autorizado" | "error"; message: string };

export type SteamProfile = { kind: "id"; steamId: string } | { kind: "nombre"; vanity: string };

/** Entiende el enlace del perfil, el número de 17 cifras o el nombre personalizado. */
export function parseSteamProfile(input: string): SteamProfile | null {
  const text = input.trim();
  if (/^\d{17}$/.test(text)) return { kind: "id", steamId: text };
  const byNumber = text.match(/steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i);
  if (byNumber) return { kind: "id", steamId: byNumber[1] };
  const byName = text.match(/steamcommunity\.com\/id\/([\w-]{2,64})(?:[/?#]|$)/i);
  if (byName) return { kind: "nombre", vanity: byName[1] };
  return /^[\w-]{2,64}$/.test(text) ? { kind: "nombre", vanity: text } : null;
}
