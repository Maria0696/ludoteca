import { useMemo, useSyncExternalStore } from "react";
import { readChoice } from "./local-choice";

/*
 * Recordatorio de copias de seguridad.
 *
 * El plan gratuito de Supabase no guarda copias, así que la app recuerda
 * cuándo exportaste la última y avisa en el inicio si hace más de un mes.
 * La fecha se guarda solo en este navegador: es un recordatorio, no un dato
 * de la biblioteca. Si el navegador no deja guardarla, la app sigue igual.
 */

const LAST_KEY = "ludoteca:ultima-copia";
const SNOOZE_KEY = "ludoteca:recordatorio-copia-pospuesto";
const CHANGE_EVENT = "ludoteca:copia-cambiada";

/** Días sin copia a partir de los cuales aparece el aviso, si no se elige otra cosa en Ajustes. */
export const REMIND_AFTER_DAYS = 30;
/** Cada cuánto avisar, elegido en Ajustes: días, o «nunca». */
export const REMIND_KEY = "ludoteca:recordatorio-copia";
export const REMIND_CHOICES = ["7", "14", "30", "nunca"] as const;
export type RemindChoice = (typeof REMIND_CHOICES)[number];
export const remindEvery = (choice: RemindChoice): number | null => (choice === "nunca" ? null : Number(choice));
/** Días que se esconde el aviso al pulsar «Ahora no». */
export const SNOOZE_DAYS = 7;

export interface BackupStatus {
  /** Días desde la última copia exportada en este navegador; null si nunca. */
  daysSinceBackup: number | null;
  /** Días desde que se pospuso el aviso; null si no se ha pospuesto. */
  daysSinceSnooze: number | null;
  /** Cada cuántos días avisar; null si se ha elegido «nunca». */
  remindEvery: number | null;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado (ventana privada, permisos): no se recuerda.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function markBackupExported(now = new Date()) {
  write(LAST_KEY, now.toISOString());
}

export function snoozeBackupReminder(now = new Date()) {
  write(SNOOZE_KEY, now.toISOString());
}

/** Días naturales (según la hora local) entre dos fechas. */
export function daysBetween(from: Date, to: Date): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  return Math.max(0, Math.round(day(to) - day(from)));
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : daysBetween(date, now);
}

export function backupStatus(lastIso: string | null, snoozeIso: string | null, now: Date, every: number | null = REMIND_AFTER_DAYS): BackupStatus {
  return { daysSinceBackup: daysSince(lastIso, now), daysSinceSnooze: daysSince(snoozeIso, now), remindEvery: every };
}

/** Días que puede tener la última copia automática para que el aviso de Inicio calle. */
export const AUTO_FRESH_DAYS = 2;

/**
 * Solo se avisa si hay algo propio que perder y no se ha pospuesto hace poco. En local, según la copia manual y
 * «cada cuánto». En la nube (`cloud`), las copias son automáticas cada noche: solo se avisa si se han parado (la
 * última tiene 2 días o más, o no hay ninguna), sea cual sea la copia manual o «cada cuánto».
 */
export function shouldRemind(status: BackupStatus, ownItems: number, every: number | null = REMIND_AFTER_DAYS, cloud?: { autoDays: number | null }): boolean {
  if (ownItems === 0) return false;
  const snoozed = status.daysSinceSnooze !== null && status.daysSinceSnooze < SNOOZE_DAYS;
  if (cloud) return !snoozed && (cloud.autoDays === null || cloud.autoDays >= AUTO_FRESH_DAYS);
  if (every === null) return false;
  const due = status.daysSinceBackup === null || status.daysSinceBackup >= every;
  return due && !snoozed;
}

export function describeLastBackup(days: number | null): string {
  if (days === null) return "Aún no has exportado ninguna copia desde este navegador.";
  if (days === 0) return "Última copia desde este navegador: hoy.";
  if (days === 1) return "Última copia desde este navegador: ayer.";
  return `Última copia desde este navegador: hace ${days} días.`;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Texto estable mientras nada cambie; incluye el día para recalcular al cambiar de fecha. */
function snapshot(): string {
  const today = new Date();
  const every = remindEvery(readChoice<RemindChoice>(REMIND_KEY, "30", REMIND_CHOICES));
  return JSON.stringify([read(LAST_KEY), read(SNOOZE_KEY), today.getFullYear(), today.getMonth(), today.getDate(), every]);
}

/**
 * Estado de las copias en este navegador. Devuelve null en el servidor y
 * durante la primera pintura, para no mostrar nada que luego cambie.
 */
export function useBackupStatus(): BackupStatus | null {
  const snap = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => {
    if (snap === null) return null;
    const [last, snooze, y, m, d, every] = JSON.parse(snap) as [string | null, string | null, number, number, number, number | null];
    return backupStatus(last, snooze, new Date(y, m, d, 12), every);
  }, [snap]);
}

/** Lo que dice el aviso de Inicio: en la nube, que las copias automáticas se pararon; en local, la última manual. */
export function reminderText(cloud: { autoDays: number | null } | undefined, manualDays: number | null, local = false): { headline: string; detail: string } {
  if (cloud) {
    return {
      headline: cloud.autoDays === null ? "Aún no se ha hecho ninguna copia automática." : `Las copias automáticas se pararon hace ${cloud.autoDays} días.`,
      detail: "Mira el correo de GitHub o exporta una copia ahora.",
    };
  }
  return {
    headline: manualDays === null ? "Aún no has guardado ninguna copia de tu biblioteca." : `Tu última copia es de hace ${manualDays} días.`,
    detail: local ? "Se guarda solo en este navegador: si algo se borrara, es la forma de recuperarlo." : "Si algo se borrara por error, es la forma de recuperarlo.",
  };
}
