"use client";

import { useEffect, useRef } from "react";

const COUNT = 46;

/** Chispas que suben por el fondo del menú. Con movimiento reducido no aparecen. */
export function Embers({ className }: { className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const embers = Array.from({ length: COUNT }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 1.5 + Math.random() * 3.5,
      speed: 0.0008 + Math.random() * 0.0022,
      sway: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    const tick = () => {
      const { width, height } = canvas;
      g.clearRect(0, 0, width, height);
      for (const e of embers) {
        e.y -= e.speed;
        e.sway += 0.03;
        if (e.y < -0.03) {
          e.y = 1.03;
          e.x = Math.random();
        }
        g.globalAlpha = Math.min(1, e.y * 1.4) * 0.85;
        g.fillStyle = e.size > 3.4 ? "#fff3c4" : "#ffb24a";
        g.fillRect(e.x * width + Math.sin(e.sway) * 16, e.y * height, e.size, e.size);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
