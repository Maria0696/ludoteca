"use client";

import { useState } from "react";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY, disablePush, enablePush, testPush, usePushStatus } from "@/lib/push-client";
import { useLibrary } from "@/lib/store";
import styles from "./wishlist.module.css";

const BUSY = { on: "Activando los avisos…", off: "Desactivando los avisos…", test: "Enviando una de prueba…" } as const;

/**
 * Bajo la línea de los precios: los avisos de ofertas en este móvil, activados o no. Solo en la nube (la tarea que los
 * manda lee los deseos de Supabase) y con la clave pública de los avisos configurada.
 */
export function OfferAlertsLine() {
  const { mode } = useLibrary();
  if (mode !== "supabase" || !VAPID_PUBLIC_KEY) return null;
  return <Line />;
}

function Line() {
  const { status, refresh } = usePushStatus();
  const [busy, setBusy] = useState<keyof typeof BUSY | null>(null);

  const run = (kind: keyof typeof BUSY, action: () => Promise<void>, done?: string) => async () => {
    setBusy(kind);
    try {
      await action();
      if (done) toast(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No ha salido bien. Prueba otra vez.");
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  if (status == null) return null;
  const text = (() => {
    if (busy) return BUSY[busy];
    switch (status) {
      case "ios-browser":
        return "Para recibir avisos de ofertas, abre la app desde su icono en la pantalla de inicio.";
      case "unsupported":
        return "Este navegador no puede recibir avisos de ofertas.";
      case "denied":
        return "Avisos de ofertas: bloqueados. Permite las notificaciones de la Ludoteca en los ajustes del móvil.";
      case "off":
        return (
          <>
            Avisos de ofertas en este móvil:{" "}
            <span className={styles.nowrap}>
              desactivados ·{" "}
              <button type="button" className="link-btn" onClick={run("on", enablePush, "Avisos de ofertas activados.")}>
                Activar
              </button>
            </span>
          </>
        );
      case "on":
        return (
          <>
            Avisos de ofertas en este móvil:{" "}
            <span className={styles.nowrap}>
              activados ·{" "}
              <button type="button" className="link-btn" onClick={run("test", testPush, "Notificación de prueba enviada.")}>
                Probar
              </button>{" "}
              ·{" "}
              <button type="button" className="link-btn" onClick={run("off", disablePush, "Avisos de ofertas desactivados.")}>
                Desactivar
              </button>
            </span>
          </>
        );
    }
  })();
  return (
    <p className={`${styles.priceStatus} ${styles.alertsStatus}`} aria-live="polite">
      {text}
    </p>
  );
}
