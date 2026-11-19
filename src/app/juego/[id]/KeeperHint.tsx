"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import styles from "./adventure.module.css";

type Placement = { left: number; top: number; side: "arriba" | "abajo" | "izquierda" | "derecha"; tail: number };

const GAP = 10;
const EDGE = 8;

const overlap = (a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * El bocadillo de la guardiana: sale junto a ella, donde menos tape (casillas, sus nombres,
 * la carátula y su cuadro de diálogo), y se cierra al tocar la equis.
 */
export function KeeperHint({
  text,
  page,
  onClose,
  keeperRef,
}: {
  text: string;
  /** Página del manual que lo cuenta con más calma. */
  page: number;
  onClose: () => void;
  keeperRef: RefObject<HTMLImageElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    // El mapa es su contenedor: al montarse a la vez que él, su ref aún no estaría puesta.
    const bubble = ref.current;
    const map = bubble?.parentElement;
    const keeper = keeperRef.current;
    if (!map || !keeper || !bubble) return;

    const measure = () => {
      const m = map.getBoundingClientRect();
      const k = keeper.getBoundingClientRect();
      const w = bubble.offsetWidth;
      const h = bubble.offsetHeight;
      const obstacles = [
        ...map.querySelectorAll(`.${styles.node}, .${styles.nodeTag}, .${styles.talk}, .${styles.backLink}`),
        document.querySelector(`.${styles.coverWrap}`),
        keeper,
      ]
        .filter((el): el is Element => Boolean(el))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);

      const kx = k.left + k.width / 2;
      const ky = k.top + k.height / 2;
      // Ella está de pie sobre una casilla: el bocadillo rodea a las dos, nunca se pone encima de la suya.
      const stand = [...map.querySelectorAll(`.${styles.node}`)]
        .map((el) => el.getBoundingClientRect())
        .sort((a, b) => Math.hypot(a.left + a.width / 2 - kx, a.top - k.bottom) - Math.hypot(b.left + b.width / 2 - kx, b.top - k.bottom))[0];
      const a = stand
        ? { left: Math.min(k.left, stand.left), top: k.top, right: Math.max(k.right, stand.right), bottom: Math.max(k.bottom, stand.bottom) }
        : { left: k.left, top: k.top, right: k.right, bottom: k.bottom };
      const candidates: Omit<Placement, "tail">[] = [];
      for (const shift of [0, -0.35, 0.35, -0.7, 0.7, -1, 1]) {
        candidates.push({ side: "arriba", left: kx - w / 2 + shift * w, top: a.top - GAP - h });
        candidates.push({ side: "abajo", left: kx - w / 2 + shift * w, top: a.bottom + GAP });
      }
      for (const shift of [0, -0.4, 0.4, -0.8, 0.8, -1.2, 1.2]) {
        candidates.push({ side: "derecha", left: a.right + GAP, top: ky - h / 2 + shift * h });
        candidates.push({ side: "izquierda", left: a.left - GAP - w, top: ky - h / 2 + shift * h });
      }

      let best: (Omit<Placement, "tail"> & { score: number }) | null = null;
      for (const c of candidates) {
        const left = Math.min(Math.max(c.left, m.left + EDGE), m.right - EDGE - w);
        const top = Math.min(Math.max(c.top, m.top + EDGE), m.bottom - EDGE - h);
        const box = { left, top, right: left + w, bottom: top + h };
        // Lo que tapa, más lo que se aleja de la guardiana si el borde del mapa lo ha empujado.
        const covered = obstacles.reduce((sum, r) => sum + overlap(r, box), 0);
        const drift = Math.hypot(left - c.left, top - c.top);
        const score = covered * 10 + drift;
        if (!best || score < best.score) best = { ...c, left, top, score };
      }
      if (!best) return;
      const tail =
        best.side === "arriba" || best.side === "abajo"
          ? Math.min(Math.max(kx - best.left, 18), w - 18)
          : Math.min(Math.max(ky - best.top, 18), h - 18);
      setPlace({ side: best.side, left: best.left - m.left, top: best.top - m.top, tail });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(map);
    // La guardiana se desliza (0,9 s) cuando el mapa cambia de tamaño: se vuelve a medir al llegar.
    keeper.addEventListener("transitionend", measure);
    return () => {
      observer.disconnect();
      keeper.removeEventListener("transitionend", measure);
    };
  }, [keeperRef, text]);

  return (
    <div
      ref={ref}
      className={styles.hint}
      role="status"
      aria-label="Pista de la guardiana"
      data-side={place?.side}
      style={
        {
          left: place?.left ?? 0,
          top: place?.top ?? 0,
          visibility: place ? undefined : "hidden",
          "--tail": `${place?.tail ?? 0}px`,
        } as React.CSSProperties
      }
    >
      <p>{text}</p>
      <Link href={`/manual?pagina=${page}`} className={styles.hintLink}>
        Ver el manual
      </Link>
      <button type="button" className={styles.hintClose} aria-label="Cerrar la pista" onClick={onClose}>
        <X aria-hidden />
      </button>
    </div>
  );
}
