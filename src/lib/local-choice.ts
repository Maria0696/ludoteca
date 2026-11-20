import { useCallback, useSyncExternalStore } from "react";

/*
 * Preferencias de este navegador (la pantalla de título, las pistas, el aviso de copia).
 * Viven en localStorage: son de cómo usas la app aquí, no datos de la biblioteca.
 * Si el navegador no deja guardarlas, la app sigue con el valor por defecto.
 */

const CHANGE_EVENT = "ludoteca:preferencia-cambiada";

export function readChoice<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const value = window.localStorage.getItem(key);
    return value !== null && (valid as readonly string[]).includes(value) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeChoice(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Almacenamiento bloqueado: la preferencia no se recuerda.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Una preferencia guardada en este navegador; en el servidor y en la primera pintura, su valor por defecto. */
export function useLocalChoice<T extends string>(key: string, fallback: T, valid: readonly T[]): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readChoice(key, fallback, valid),
    () => fallback,
  );
  const set = useCallback((next: T) => writeChoice(key, next), [key]);
  return [value, set];
}
