"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import { isoToDmy, parseDmy } from "@/lib/format";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onBlur" | "max"> & {
  /** Lo escrito, como día/mes/año. */
  value: string;
  onChange: (text: string) => void;
  /** El foco sale del campo y del calendario: momento de guardar. */
  onLeave?: () => void;
  /** Último día que deja elegir el calendario (AAAA-MM-DD). */
  max?: string;
  /** Aspecto del botón del calendario. */
  pickClassName?: string;
};

/**
 * Fecha que siempre se escribe como día/mes/año, sea cual sea el idioma del
 * navegador. El campo de fecha nativo va invisible encima del icono: tocarlo
 * abre el calendario propio de cada sistema, y el día elegido pasa al texto.
 */
export function DateInput({ value, onChange, onLeave, max, pickClassName, className, ...input }: Props) {
  const wrap = useRef<HTMLSpanElement>(null);
  const parsed = parseDmy(value);
  const pickerValue = parsed.ok && parsed.iso ? parsed.iso : "";

  const fromPicker = (iso: string) => {
    if (iso) onChange(isoToDmy(iso));
  };

  return (
    <span
      ref={wrap}
      className="date-input"
      onBlur={(e) => {
        // Pasar del texto al calendario no es salir; que la ventana pierda el foco (el calendario del móvil), tampoco.
        if (wrap.current?.contains(e.relatedTarget as Node | null) || !document.hasFocus()) return;
        onLeave?.();
      }}
    >
      <input {...input} type="text" className={className} value={value} placeholder="dd/mm/aaaa" autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      <span className={`date-input-pick ${pickClassName ?? ""}`}>
        <CalendarDays aria-hidden />
        <input
          type="date"
          tabIndex={-1}
          aria-label="Elegir en el calendario"
          title="Elegir en el calendario"
          value={pickerValue}
          max={max}
          onChange={(e) => fromPicker(e.target.value)}
          onInput={(e) => fromPicker(e.currentTarget.value)}
        />
      </span>
    </span>
  );
}
