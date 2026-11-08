"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef } from "react";
import { KEEPER_URL, TROPHY_URL } from "@/components/pixel/sprites";
import styles from "./adventure.module.css";
import { STAGES, TROPHY_STAGE, currentStage } from "./progress";

/* Posición de cada nivel, en %: una versión apaisada y otra para móvil. */
const WIDE_SPOTS = [[7, 56], [20, 26], [33, 58], [47, 24], [60, 56], [75, 26], [91, 20]];
const TALL_SPOTS = [[12, 84], [28, 69], [17, 44], [39, 31], [59, 50], [74, 30], [89, 13]];
const WIDE_QUERY = "(min-width: 900px)";

const spotStyle = (i: number) =>
  ({
    "--wx": `${WIDE_SPOTS[i][0]}%`,
    "--wy": `${WIDE_SPOTS[i][1]}%`,
    "--tx": `${TALL_SPOTS[i][0]}%`,
    "--ty": `${TALL_SPOTS[i][1]}%`,
  }) as CSSProperties;

type Point = [x: number, y: number, segment: number];

function pathPoints(W: number, H: number, spots: number[][]): Point[] {
  const points: Point[] = [];
  spots.forEach(([x, y], i) => {
    const [nx, ny] = spots[i + 1] ?? [x, y];
    for (let t = 0; t < 1; t += 0.02) {
      points.push([((x + (nx - x) * t) / 100) * W, ((y + (ny - y) * t) / 100) * H + Math.sin(t * Math.PI * 2) * 3, i]);
    }
  });
  return points;
}

/** La isla: siempre la misma para un tamaño dado. */
function paintTerrain(W: number, H: number, points: Point[], wide: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wobble = (x: number, y: number) => Math.sin(x * 0.17) * 3 + Math.sin(y * 0.21 + x * 0.05) * 3 + Math.sin(x * 0.05 + y * 0.09) * 5;
  const distance = (x: number, y: number) => {
    let min = Infinity;
    for (let k = 0; k < points.length; k += 3) min = Math.min(min, Math.hypot(points[k][0] - x, points[k][1] - y));
    return min;
  };
  const reach = Math.min(W, H) * (wide ? 0.36 : 0.2);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = distance(x, y) + wobble(x, y);
      g.fillStyle =
        d < reach - 4
          ? (x + y) % 7 === 0
            ? "#4b9a55"
            : "#57a862"
          : d < reach
            ? "#e7cf8e"
            : d < reach + 3
              ? "#2a7aa0"
              : (x * 3 + y * 5) % 41 === 0
                ? "#1d5c86"
                : "#174a73";
      g.fillRect(x, y, 1, 1);
    }
  }
  for (let n = 0; n < (W * H) / 90; n++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * H);
    const near = distance(x, y);
    if (near + wobble(x, y) < reach - 7 && near > 7) {
      g.fillStyle = "#2c6e3f";
      g.fillRect(x - 1, y - 2, 3, 3);
      g.fillRect(x, y - 3, 1, 1);
      g.fillStyle = "#6b4a2a";
      g.fillRect(x, y + 1, 1, 1);
    }
  }
  return canvas;
}

export function AdventureMap({
  reached,
  selected,
  onSelect,
  line,
  hopSignal,
}: {
  reached: boolean[];
  selected: number | null;
  onSelect: (stage: number) => void;
  line: string;
  /** Cambia cada vez que la guardiana debe dar un salto. */
  hopSignal: number;
}) {
  const stop = currentStage(reached);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keeperRef = useRef<HTMLImageElement>(null);
  const terrainRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const lastStop = useRef(stop);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const draw = () => {
      const px = window.innerWidth < 700 ? 4 : 6;
      const W = Math.max(1, Math.ceil(canvas.clientWidth / px));
      const H = Math.max(1, Math.ceil(canvas.clientHeight / px));
      const wide = window.matchMedia(WIDE_QUERY).matches;
      const points = pathPoints(W, H, wide ? WIDE_SPOTS : TALL_SPOTS);
      const key = `${W}x${H}x${wide}`;
      if (terrainRef.current?.key !== key) terrainRef.current = { key, canvas: paintTerrain(W, H, points, wide) };
      canvas.width = W;
      canvas.height = H;
      g.drawImage(terrainRef.current.canvas, 0, 0);
      points.forEach(([x, y, segment], k) => {
        if (k % 4 >= 2) return;
        g.fillStyle = segment < stop ? "#ffd76a" : "#ffffff55";
        g.fillRect(Math.round(x), Math.round(y), 2, 2);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [stop]);

  useEffect(() => {
    const advanced = stop > lastStop.current;
    lastStop.current = stop;
    if (!advanced && !hopSignal) return;
    const keeper = keeperRef.current;
    if (!keeper) return;
    keeper.classList.remove(styles.hop);
    void keeper.offsetWidth;
    keeper.classList.add(styles.hop);
  }, [stop, hopSignal]);

  return (
    <div className={styles.map}>
      <canvas ref={canvasRef} className={styles.mapCanvas} aria-hidden />
      <Link href="/biblioteca" className={styles.backLink}>
        <ArrowLeft aria-hidden />
        Biblioteca
      </Link>
      {STAGES.map((stage, i) => (
        <div key={stage}>
          <button
            type="button"
            className={`${styles.node} ${reached[i] ? styles.nodeDone : ""}`}
            style={spotStyle(i)}
            aria-pressed={(selected ?? stop) === i}
            aria-label={`${stage}, ${reached[i] ? "conseguido" : "pendiente"}`}
            onClick={() => onSelect(i)}
          >
            {i === TROPHY_STAGE && reached[i] ? (
              // eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio
              <img src={TROPHY_URL} alt="" />
            ) : (
              i + 1
            )}
          </button>
          <span className={styles.nodeTag} style={spotStyle(i)}>
            {stage}
          </span>
        </div>
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
      <img ref={keeperRef} className={styles.keeper} style={spotStyle(stop)} src={KEEPER_URL} alt="" />
      <div className={`${styles.window} ${styles.talk}`}>
        <span className={styles.talkName}>Guardiana</span>
        <p>{line}</p>
      </div>
    </div>
  );
}
