"use client";

import { useId, useState } from "react";
import { parseDecimal } from "@/lib/format";

/*
 * Campos que guardan solos al salir del campo. Validan antes de guardar y
 * muestran el error junto al campo, sin perder lo escrito.
 */

export function TextField({
  label,
  value,
  onSave,
  placeholder,
  hint,
  multiline,
  maxLength = 2000,
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string | null) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value ?? "");
  if ((value ?? "") !== seen) {
    setSeen(value ?? "");
    setDraft(value ?? "");
  }
  const commit = () => {
    const v = draft.trim();
    if (v !== (value ?? "")) onSave(v || null);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          className="textarea"
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          id={id}
          className="input"
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onSave,
  min = 0,
  max,
  step = 1,
  integer,
  unit,
  hint,
}: {
  label: string;
  value: number | null | undefined;
  onSave: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  unit?: string;
  hint?: string;
}) {
  const id = useId();
  const fmt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
  const [draft, setDraft] = useState(fmt(value));
  const [seen, setSeen] = useState(value);
  const [error, setError] = useState<string | null>(null);
  if (value !== seen) {
    setSeen(value);
    setDraft(fmt(value));
  }
  const commit = () => {
    const n = parseDecimal(draft);
    if (n === null) {
      setError(null);
      if (value != null) onSave(null);
      return;
    }
    if (Number.isNaN(n)) return setError("Escribe un número, por ejemplo 12,5.");
    if (n < min || (max != null && n > max)) return setError(`Tiene que estar entre ${min} y ${max}.`);
    if (integer && !Number.isInteger(n)) return setError("Escribe un número entero.");
    const rounded = step < 1 ? Math.round(n / step) * step : n;
    setError(null);
    if (rounded !== value) onSave(rounded);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          id={id}
          className="input num"
          inputMode="decimal"
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-e` : hint ? `${id}-h` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        {unit && <span className="muted" style={{ whiteSpace: "nowrap" }}>{unit}</span>}
      </div>
      {error ? (
        <p className="error" id={`${id}-e`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="hint" id={`${id}-h`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function DateField({ label, value, onSave }: { label: string; value: string | null | undefined; onSave: (v: string | null) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        type="date"
        value={value ?? ""}
        onChange={(e) => onSave(e.target.value || null)}
      />
    </div>
  );
}

/** Lista de etiquetas separadas por comas, guardada como array. */
export function TagsField({ label, value, onSave, placeholder, hint }: { label: string; value: string[]; onSave: (v: string[]) => void; placeholder?: string; hint?: string }) {
  return (
    <TextField
      label={label}
      value={value.join(", ")}
      placeholder={placeholder}
      hint={hint ?? "Sepáralas con comas."}
      onSave={(v) =>
        onSave(
          [...new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30),
        )
      }
    />
  );
}

export function ToggleChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Record<T, string>;
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="label" id={id}>
        {label}
      </span>
      <div className="segmented" role="group" aria-labelledby={id}>
        {(Object.keys(options) as T[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value.includes(k)}
            onClick={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])}
          >
            {options[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
