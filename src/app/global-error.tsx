"use client";

import { useEffect } from "react";
import { sendErrorReport } from "@/lib/error-report";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * Pantalla de error general: aparece si falla el propio armazón de la app
 * (barra de navegación incluida). Dibuja su propio documento.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    sendErrorReport("pantalla-general", error);
  }, [error]);

  return (
    <html lang="es-ES" className={fontVariables}>
      <body>
        <title>Algo ha fallado · Ludoteca</title>
        <main style={{ padding: "48px var(--gutter)" }}>
          <div className="empty" role="alert">
            <h1>La ludoteca no ha podido abrirse</h1>
            <p>Lo que ya tenías guardado no se ha perdido. Prueba otra vez en unos segundos.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ink" onClick={() => retry()}>
                Volver a intentarlo
              </button>
              {/* Enlace normal a propósito: recarga la app entera desde cero. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="btn">
                Ir al inicio
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
