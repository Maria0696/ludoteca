"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./shell.module.css";

/** Lo que tarda un guardado antes de decirlo: los normales acaban antes y así no parpadea en cada toque. */
const DELAY = 1000;

/**
 * «Guardando…» en la cabecera mientras la app guarda (la página lleva `data-guardando`), solo si tarda más de 1 s:
 * con mala cobertura, se ve que aún no conviene cerrar.
 */
export function SavingStatus() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    let timer: number | undefined;
    const check = () => {
      window.clearTimeout(timer);
      if (html.hasAttribute("data-guardando")) timer = window.setTimeout(() => setSlow(true), DELAY);
      else setSlow(false);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributeFilter: ["data-guardando"] });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);
  if (!slow) return null;
  return (
    <span className={styles.saving} role="status">
      <LoaderCircle aria-hidden />
      <span className={styles.savingText}>Guardando…</span>
    </span>
  );
}
