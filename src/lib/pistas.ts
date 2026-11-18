/*
 * Las pistas de la guardiana: cada una sale una sola vez por navegador, en el
 * momento en que hace falta. Sin almacenamiento no sale ninguna: mejor eso que
 * repetirla en cada visita.
 */

export type PistaId = "mapa" | "moneda" | "datos";

export const PISTAS: Record<PistaId, string> = {
  mapa: "Cada casilla es un nivel de tu partida con este juego. Toca una y te llevo a su misión.",
  moneda: "¡Moneda echada! Apunto que has jugado hoy: lo verás en «Última partida» y en tu inicio.",
  datos: "Todo lo que ves en la ficha se cambia tocándolo, y se guarda solo.",
};

export const PISTAS_KEY = "ludoteca:pistas-vistas";

const TODAS = Object.keys(PISTAS) as PistaId[];

export function pistasVistas(): Set<PistaId> {
  try {
    const raw = localStorage.getItem(PISTAS_KEY);
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
