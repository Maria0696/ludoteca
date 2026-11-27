"use client";

import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY, bellState, disablePush, enablePush, testPush, usePushStatus } from "@/lib/push-client";
import { useLibrary } from "@/lib/store";

/**
 * Junto a «Añadir deseo»: la campana de los avisos de ofertas en este dispositivo. Un toque los activa (y el aviso
 * ofrece «Probar»); otro, los desactiva. Si aquí no se puede, explica por qué. Solo en la nube (la tarea que los manda
 * lee los deseos de Supabase) y con la clave pública de los avisos configurada.
 */
export function OfferAlertsBell() {
  const { mode } = useLibrary();
  if (mode !== "supabase" || !VAPID_PUBLIC_KEY) return null;
  return <BellButton />;
}

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "No ha salido bien. Prueba otra vez.");

function BellButton() {
  const { status, refresh } = usePushStatus();
  const [busy, setBusy] = useState(false);
  const state = bellState(status ?? "off");

  const probar = () =>
    testPush().then(
      () => toast("Notificación de prueba enviada."),
      (e) => fail(e),
    );

  const onClick = async () => {
    if (state.hint) {
      toast(state.hint);
      return;
    }
    setBusy(true);
    try {
      if (state.pressed) {
        await disablePush();
        toast("Avisos de ofertas desactivados en este dispositivo.");
      } else {
        await enablePush();
        toast("Te avisaré aquí cuando un deseo baje de su precio objetivo.", { action: { label: "Probar", onClick: () => void probar() } });
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const Icon = state.pressed ? Bell : BellOff;
  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      disabled={status == null || busy}
      aria-busy={busy || undefined}
      title={state.hint ?? (state.pressed ? "Desactivar los avisos de ofertas en este dispositivo" : "Activar los avisos de ofertas en este dispositivo")}
    >
      <Icon aria-hidden />
      {state.label}
    </button>
  );
}
