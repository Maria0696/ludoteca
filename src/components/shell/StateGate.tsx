"use client";

import { AlertTriangle } from "lucide-react";
import { useLibrary } from "@/lib/store";
import styles from "./shell.module.css";

/** Muestra carga, error o configuración pendiente antes del contenido. */
export function StateGate({ children }: { children: React.ReactNode }) {
  const { state, error, actions } = useLibrary();

  if (state === "loading") {
    return (
      <div className={styles.gate} aria-busy="true" aria-live="polite">
        <span className="sr-only">Cargando tu biblioteca…</span>
        <div className="skeleton" style={{ width: 220, height: 28 }} />
        <div className={styles.gateGrid}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: "3 / 4" }} />
          ))}
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={styles.gate}>
        <div className="empty" role="alert">
          <h1>No se ha podido abrir tu biblioteca</h1>
          <p>{error ?? "Error desconocido."} Tus datos no se han tocado; vuelve a intentarlo en un momento.</p>
          <button type="button" className="btn btn-ink" onClick={() => void actions.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (state === "setup") {
    return (
      <div className={styles.gate}>
        <div className="empty">
          <h1>Configuración pendiente</h1>
          <p>
            Este despliegue no tiene la base de datos conectada y el modo local está desactivado en producción para que nadie más
            pueda usarlo. Añade las variables de Supabase en Vercel y vuelve a desplegar.
          </p>
          <p className="notice">
            <AlertTriangle aria-hidden />
            Faltan NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y OWNER_EMAIL. Los pasos están en el README.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
