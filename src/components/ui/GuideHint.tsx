"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KEEPER_URL } from "@/components/pixel/sprites";
import { PISTAS, PISTA_PAGINA, type PistaId, marcarPista, pistasVistas } from "@/lib/pistas";
import styles from "./guide-hint.module.css";

/**
 * La guardiana explica una pantalla la primera vez que entras: una ventana pequeña que se cierra
 * con la equis. Sale una sola vez por navegador, como las pistas de la ficha.
 */
export function GuideHint({ id }: { id: PistaId }) {
  const [shown, setShown] = useState(() => typeof window !== "undefined" && !pistasVistas().has(id));
  useEffect(() => {
    if (shown) marcarPista(id);
  }, [shown, id]);
  if (!shown) return null;
  const page = PISTA_PAGINA[id];
  return (
    <div className={`window ${styles.hint}`} role="status" aria-label="Pista de la guardiana">
      {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
      <img src={KEEPER_URL} alt="" className={styles.keeper} />
      <p>
        {PISTAS[id]}
        {page && (
          <>
            {" "}
            <Link href={`/manual?pagina=${page}`} className={styles.link}>
              Ver el manual
            </Link>
          </>
        )}
      </p>
      <button type="button" className={styles.close} aria-label="Cerrar la pista" onClick={() => setShown(false)}>
        <X aria-hidden />
      </button>
    </div>
  );
}
