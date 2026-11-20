import { readChoice } from "./local-choice";

/*
 * Las pistas de la guardiana: cada una sale una sola vez por navegador, en el
 * momento en que hace falta. Sin almacenamiento no sale ninguna: mejor eso que
 * repetirla en cada visita.
 */

export type PistaId = "mapa" | "moneda" | "datos" | "quejuego" | "steam";

/** Cortas: caben en un bocadillo junto a la guardiana. */
export const PISTAS: Record<PistaId, string> = {
  mapa: "Cada casilla es un nivel de tu partida. ¡Toca una!",
  moneda: "¡Moneda echada! Apunto que has jugado hoy.",
  datos: "Todo en la ficha se cambia tocándolo, y se guarda solo.",
  quejuego: "Dime cuánto tiempo tienes y con quién juegas: te propongo juegos que tienes a mano. Cada propuesta explica por qué.",
  steam: "Puedes copiar de Steam cuantas veces quieras: lo que ya tienes no se duplica nada, y tus horas solo suben.",
};

/** La página del manual de instrucciones que lo cuenta con calma. */
export const PISTA_PAGINA: Partial<Record<PistaId, number>> = { mapa: 3, datos: 3, moneda: 4, quejuego: 6 };

export const PISTAS_KEY = "ludoteca:pistas-vistas";
/** Las pistas se pueden apagar en Ajustes: entonces cuentan todas como vistas. */
export const PISTAS_MODE_KEY = "ludoteca:pistas";
export const PISTAS_MODES = ["activadas", "desactivadas"] as const;
export type PistasMode = (typeof PISTAS_MODES)[number];

const TODAS = Object.keys(PISTAS) as PistaId[];

export function pistasVistas(): Set<PistaId> {
  if (readChoice<PistasMode>(PISTAS_MODE_KEY, "activadas", PISTAS_MODES) === "desactivadas") return new Set(TODAS);
  try {
    const raw = localStorage.getItem(PISTAS_KEY);
    // Si no se puede escribir (cuota llena), la pista no se recordaría: mejor no enseñar ninguna.
    localStorage.setItem(PISTAS_KEY, raw ?? "[]");
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is PistaId => TODAS.includes(id as PistaId)) : []);
  } catch {
    return new Set(TODAS);
  }
}

export function marcarPista(id: PistaId): void {
  try {
    const vistas = pistasVistas();
    vistas.add(id);
    localStorage.setItem(PISTAS_KEY, JSON.stringify([...vistas]));
  } catch {
    // Sin almacenamiento, la pista simplemente no se recuerda.
  }
}

export function reiniciarPistas(): void {
  try {
    localStorage.removeItem(PISTAS_KEY);
  } catch {
    // Nada que reiniciar.
  }
}
