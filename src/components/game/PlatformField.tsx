"use client";

import { useMemo, useState } from "react";
import { DEFAULT_PLATFORMS } from "@/lib/model";
import { useLibrary } from "@/lib/store";

const OTHER = "__otra__";

/** Plataformas conocidas más las que ya usas; «Otra…» permite escribir una nueva. */
export function usePlatformOptions(extra: (string | null | undefined)[] = []) {
  const { library } = useLibrary();
  const extraKey = extra.filter(Boolean).join("|");
  return useMemo(() => {
    const used = new Set(library.copies.map((c) => c.platform));
    const all = new Set<string>([...DEFAULT_PLATFORMS, ...used]);
    for (const e of extraKey.split("|")) if (e) all.add(e);
    return [...all];
  }, [library.copies, extraKey]);
}

export function PlatformField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  allowEmpty,
  emptyLabel = "Elige una",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const options = usePlatformOptions([value]);
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id={id}
          className="input"
          value={value}
          placeholder="Nombre de la plataforma"
          autoFocus
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="btn" onClick={() => setCustom(false)}>
          Lista
        </button>
      </div>
    );
  }

  return (
    <select
      id={id}
      className="select"
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setCustom(true);
          onChange("");
        } else onChange(e.target.value);
      }}
    >
      {(allowEmpty || !value) && <option value="">{emptyLabel}</option>}
      {options.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value={OTHER}>Otra…</option>
    </select>
  );
}
