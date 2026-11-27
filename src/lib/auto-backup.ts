"use client";

import { useEffect, useState } from "react";
import { daysBetween } from "./backup-reminder";
import { getBrowserSupabase } from "./supabase/client";

/*
 * Copias automáticas: cada noche, una tarea de GitHub pide la copia a la app (con su clave) y la guarda 90 días. La
 * fecha de la última queda en Supabase (`backup_runs`); aquí se lee para Ajustes y para el aviso de Inicio.
 */

export function describeAutoBackup(days: number | null): string {
  if (days === null) return "Aún no se ha hecho ninguna copia automática.";
  if (days === 0) return "Última copia automática: hoy.";
  if (days === 1) return "Última copia automática: ayer.";
  return `Última copia automática: hace ${days} días.`;
}

/**
 * Días desde la última copia automática, en la nube: `null` si aún no hay ninguna (o no se puede saber) y `undefined`
 * mientras se pregunta o en modo local, donde no las hay.
 */
export function useAutoBackupDays(mode: "local" | "supabase" | null): number | null | undefined {
  const [days, setDays] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (mode !== "supabase") return;
    let alive = true;
    void getBrowserSupabase()
      .from("backup_runs")
      .select("last_at")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        // Sin la tabla (migración 0018 sin aplicar) o sin copias todavía: como si no hubiera ninguna.
        const last = !error && data?.last_at ? new Date(data.last_at as string) : null;
        setDays(last && !Number.isNaN(last.getTime()) ? daysBetween(last, new Date()) : null);
      });
    return () => {
      alive = false;
    };
  }, [mode]);
  return mode === "supabase" ? days : undefined;
}
