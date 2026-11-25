"use client";

import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DateInput } from "@/components/ui/DateInput";
import { isoToDmy, parseDecimal, parseDmy } from "@/lib/format";
import styles from "./adventure.module.css";

type Common = {
  /** Nombre del dato, para lectores de pantalla y para el campo al editar. */
  label: string;
  /** Texto cuando hay valor. Si falta, se ofrece el botón de añadir. */
  display: string | null;
  empty: string;
  /** En una fila de datos: el hueco vacío es texto discreto, sin recuadro de añadir. */
  quiet?: boolean;
};

type Props = Common &
  (
    | { kind: "number"; value: number | null | undefined; onSave: (v: number | null) => void; min?: number; max?: number; step?: number; integer?: boolean }
    | { kind: "date"; value: string | null | undefined; onSave: (v: string | null) => void }
    | {
        kind: "text" | "multiline";
        value: string | null | undefined;
        onSave: (v: string | null) => void;
        maxLength?: number;
        validate?: (text: string) => string | null;
        rows?: number;
        /** Valores ya usados, para elegirlos al escribir (solo en texto de una línea). */
        suggestions?: string[];
      }
  );

/** Un dato que se ve como texto y se edita al pulsarlo. */
export function Editable(props: Props) {
  const { label, display, empty, quiet } = props;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Lo escrito en una fecha, como día/mes/año. */
  const [dateText, setDateText] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  const returnFocus = useRef(false);
  // «Guardado», un momento, tras cada cambio: el dato se guarda solo y así se sabe.
  const [justSaved, setJustSaved] = useState(0);
  const listId = useId();
  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(0), 1600);
    return () => window.clearTimeout(t);
  }, [justSaved]);
  const save = (v: string | number | null) => {
    (props.onSave as (v: string | number | null) => void)(v);
    setJustSaved((n) => n + 1);
  };

  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const close = (refocus: boolean) => {
    returnFocus.current = refocus;
    setError(null);
    setEditing(false);
  };

  const commit = (raw: string, refocus: boolean) => {
    if (props.kind === "date") {
      const parsed = parseDmy(raw);
      if (!parsed.ok) return setError(parsed.error);
      if (parsed.iso !== (props.value ?? null)) save(parsed.iso);
      return close(refocus);
    }
    if (props.kind === "number") {
      const n = parseDecimal(raw);
      if (n === null) {
        if (props.value != null) save(null);
        return close(refocus);
      }
      const { min = 0, max, step = 1, integer } = props;
      if (Number.isNaN(n)) return setError("Escribe un número, por ejemplo 12,5.");
      if (n < min || (max != null && n > max)) return setError(`Tiene que estar entre ${min} y ${max}.`);
      if (integer && !Number.isInteger(n)) return setError("Escribe un número entero.");
      const rounded = step < 1 ? Math.round(n / step) * step : n;
      if (rounded !== props.value) save(rounded);
      return close(refocus);
    }
    const text = raw.trim();
    const problem = text ? props.validate?.(text) : null;
    if (problem) return setError(problem);
    if (text !== (props.value ?? "")) save(text || null);
    close(refocus);
  };

  if (!editing) {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          className={display ? styles.value : quiet ? `${styles.value} ${styles.valueEmpty}` : styles.add}
          aria-label={display ? `${label}: ${display}. Editar` : `${label}: añadir`}
          onClick={() => {
            cancelled.current = false;
            if (props.kind === "date") setDateText(isoToDmy(props.value));
            setEditing(true);
          }}
        >
          {display ??
            (quiet ? (
              empty
            ) : (
              <>
                <Plus aria-hidden />
                {empty}
              </>
            ))}
        </button>
        <span className={styles.saved} aria-live="polite">
          {justSaved ? <span key={justSaved}>Guardado</span> : null}
        </span>
      </>
    );
  }

  const field = {
    "aria-label": label,
    "aria-invalid": error ? true : undefined,
    autoFocus: true,
    className: styles.edit,
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.target.select(),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        cancelled.current = true;
        close(true);
      } else if (e.key === "Enter" && props.kind !== "multiline") {
        e.preventDefault();
        commit(e.currentTarget.value, true);
      }
    },
  };
  const shared = {
    ...field,
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!cancelled.current) commit(e.target.value, false);
    },
  };

  const initial = props.kind === "number" ? (props.value == null ? "" : String(props.value).replace(".", ",")) : (props.value ?? "");

  return (
    <span className={styles.editWrap}>
      {props.kind === "date" ? (
        <DateInput
          {...field}
          value={dateText}
          onChange={setDateText}
          onLeave={() => {
            if (!cancelled.current) commit(dateText, false);
          }}
          pickClassName={styles.datePick}
        />
      ) : props.kind === "multiline" ? (
        <textarea {...shared} rows={props.rows ?? 3} defaultValue={initial} maxLength={props.maxLength ?? 2000} />
      ) : (
        <input
          {...shared}
          type="text"
          inputMode={props.kind === "number" ? "decimal" : undefined}
          maxLength={props.kind === "text" ? props.maxLength : undefined}
          list={props.kind === "text" && props.suggestions?.length ? listId : undefined}
          defaultValue={initial}
        />
      )}
      {props.kind === "text" && props.suggestions?.length ? (
        <datalist id={listId}>
          {props.suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      {error && (
        <span className={styles.editError} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
