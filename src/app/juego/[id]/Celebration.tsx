"use client";

import { type CSSProperties, useEffect } from "react";
import { TROPHY_URL } from "@/components/pixel/sprites";
import styles from "./adventure.module.css";

const COLORS = ["#ffd76a", "#fff8d0", "#57e6ff", "#ff7ad9", "#5dff8b"];

/* Confeti repartido con una fórmula fija: variado, pero siempre igual. */
const CONFETTI = Array.from({ length: 80 }, (_, i) => ({
  "--x": `${(i * 37) % 100}%`,
  "--s": `${7 + ((i * 13) % 9)}px`,
  "--c": COLORS[i % COLORS.length],
  "--d": `${1.5 + ((i * 17) % 18) / 10}s`,
  "--w": `${((i * 11) % 10) / 10}s`,
  "--dx": `${((i * 29) % 180) - 90}px`,
})) as CSSProperties[];

/** La celebración de conseguir un juego al 100 %. */
export function Celebration({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3800);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={styles.celebration} role="status" onClick={onClose}>
      {CONFETTI.map((style, i) => (
        <i key={i} style={style} aria-hidden />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
      <img src={TROPHY_URL} alt="" />
      <b>¡100 %!</b>
      <span>Has completado {title} del todo. Trofeo conseguido.</span>
    </div>
  );
}
