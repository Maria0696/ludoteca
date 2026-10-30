"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

/**
 * Diálogo modal sobre `<dialog>` nativo: atrapa el foco, cierra con Escape
 * y devuelve el foco al disparador. En móvil sube como hoja inferior.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Selector del elemento que recibe el foco al abrir. */
  initialFocus?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="btn btn-quiet btn-icon" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      <div className="sheet-body">{children}</div>
      {footer && <div className="sheet-foot">{footer}</div>}
    </dialog>
  );
}
