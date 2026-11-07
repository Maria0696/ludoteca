"use client";

import Link from "next/link";
import { useEffect } from "react";
import { sendErrorReport } from "@/lib/error-report";

/**
 * Pantalla de error de cualquier página. Mantiene la barra de navegación,
 * avisa del fallo al servidor y deja volver a intentarlo.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    sendErrorReport("pantalla", error);
  }, [error]);

  return (
    <div style={{ padding: "32px var(--gutter)" }}>
      <div className="empty" role="alert">
        <h1>Algo ha fallado en esta pantalla</h1>
        <p>Lo que ya tenías guardado no se ha perdido. Prueba otra vez; si vuelve a pasar, sigue desde el inicio.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ink" onClick={() => retry()}>
            Volver a intentarlo
          </button>
          <Link href="/" className="btn">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
