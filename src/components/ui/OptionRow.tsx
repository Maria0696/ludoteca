"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import styles from "./option-row.module.css";

/**
 * Una opción como en el menú de un juego: ◀ valor ▶. Las flechas pasan a la anterior o la siguiente y dan la vuelta;
 * el valor es un desplegable, para ir directa a la que quieras sin pulsar diez veces.
 * La usan la sesión de ¿A qué juego? y las preferencias de Ajustes.
 */
export function OptionRow<T>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  /** Una línea corta bajo la pregunta. */
  hint?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  // Un id por fila: la misma pregunta puede vivir en dos sitios a la vez (el panel y la hoja).
  const id = useId();
  const hintId = `${id}-pista`;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const step = (delta: number) => onChange(options[(index + delta + options.length) % options.length].value);
  return (
    <div className={styles.option} data-option-row>
      <span className={styles.question}>
        <label htmlFor={id}>{label}</label>
        {hint && <small id={hintId}>{hint}</small>}
      </span>
      <div className={styles.stepper}>
        <button type="button" aria-label={`${label}: anterior`} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden />
        </button>
        <select id={id} aria-describedby={hint ? hintId : undefined} value={index} onChange={(e) => onChange(options[Number(e.target.value)].value)}>
          {options.map((o, i) => (
            <option key={o.label} value={i}>
              {o.label}
            </option>
          ))}
        </select>
        <button type="button" aria-label={`${label}: siguiente`} onClick={() => step(1)}>
          <ChevronRight aria-hidden />
        </button>
      </div>
    </div>
  );
}
