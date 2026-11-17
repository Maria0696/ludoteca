/** Moverse con las flechas por una rejilla, como en el menú de una consola. */

export type Direction = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export const isDirection = (key: string): key is Direction =>
  key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";

/**
 * La opción más cercana en esa dirección, dentro de `container`: en una columna
 * es la siguiente; en una rejilla, la de al lado o la de justo debajo. A los
 * lados solo cuenta lo que está en la misma fila.
 */
export function nearest(container: HTMLElement, from: HTMLElement, dir: Direction): HTMLElement | null {
  const r = from.getBoundingClientRect();
  const vertical = dir === "ArrowUp" || dir === "ArrowDown";
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of container.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)")) {
    if (el === from || el.tabIndex < 0) continue;
    const c = el.getBoundingClientRect();
    if (!c.width || !c.height) continue;
    const gapX = Math.max(0, c.left - r.right, r.left - c.right);
    const gapY = Math.max(0, c.top - r.bottom, r.top - c.bottom);
    const ahead = {
      ArrowDown: c.top - r.bottom,
      ArrowUp: r.top - c.bottom,
      ArrowRight: c.left - r.right,
      ArrowLeft: r.left - c.right,
    }[dir];
    if (ahead < -4) continue; // en la dirección contraria o encima del de partida
    if (!vertical && gapY > 0) continue; // otra fila
    const score = vertical ? ahead + gapX * 3 : ahead;
    if (score < bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}
