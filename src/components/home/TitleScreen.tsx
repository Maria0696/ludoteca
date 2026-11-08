"use client";

import { useEffect, useRef } from "react";
import styles from "./menu.module.css";

const LETTERS = [..."Ludoteca"];
const IGNORED_KEYS = new Set(["Tab", "Shift", "Control", "Alt", "Meta", "CapsLock"]);

/** «Pulsa Start»: cualquier tecla, clic o toque entra en el menú. */
export function TitleScreen({ leaving, onStart }: { leaving: boolean; onStart: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (IGNORED_KEYS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
      // Si estás escribiendo en el buscador o usando la barra superior, la tecla es tuya.
      const active = document.activeElement;
      if (active && active !== document.body && active.id !== "contenido" && active !== buttonRef.current) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leaving, onStart]);

  return (
    <button ref={buttonRef} type="button" className={`${styles.title} ${leaving ? styles.titleOut : ""}`} onClick={onStart} aria-label="Pulsa Start para entrar">
      <span className={styles.logo} aria-hidden>
        {LETTERS.map((letter, i) => (
          <span key={i} style={{ "--i": i } as React.CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
      <span className={styles.startLine}>Pulsa Start</span>
      <span className={styles.flash} aria-hidden />
    </button>
  );
}
