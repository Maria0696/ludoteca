"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { type ImportPlan, type Resolution, resolveImport } from "@/lib/backup";
import { backupSummary as summary } from "@/lib/backup-download";
import { useLibrary } from "@/lib/store";
import styles from "./backup-import.module.css";

/* Las decisiones de una importación: lo nuevo entra solo; cada coincidencia, como tú digas (por defecto, lo tuyo). */

const RESOLUTION_LABEL: Record<Resolution, string> = {
  mantener: "Mantener el mío",
  importado: "Usar el del archivo",
  ambos: "Conservar los dos",
};

export function ImportDialog({ plan, onClose }: { plan: ImportPlan; onClose: () => void }) {
  const { actions } = useLibrary();
  const [decisions, setDecisions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const n = plan.newCounts;
  const nothing = n.games + n.copies + n.wishlist === 0 && plan.conflicts.length === 0;
  const setAll = (r: Resolution) => setDecisions(Object.fromEntries(plan.conflicts.map((c) => [c.key, r])));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Importar copia de seguridad"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-ink"
            disabled={busy || nothing}
            onClick={async () => {
              setBusy(true);
              try {
                const changes = resolveImport(plan, decisions);
                await actions.applyChanges(changes);
                toast(
                  `Importado: ${summary({ games: changes.games.length, copies: changes.copies.length, wishlist: changes.wishlist.length })}`,
                );
                onClose();
              } catch (e) {
                toast.error("No se ha podido importar", { description: e instanceof Error ? e.message : undefined });
                setBusy(false);
              }
            }}
          >
            {busy ? "Importando…" : "Importar"}
          </button>
        </>
      }
    >
      <p>
        Archivo del {new Date(plan.backup.exportedAt).toLocaleString("es-ES")}. Nuevo: {summary(n)}.
        {plan.identical > 0 && ` ${plan.identical} elementos ya los tienes iguales y se dejan como están.`}
      </p>
      {nothing && <p className="notice">No hay nada nuevo que importar.</p>}
      {plan.conflicts.length > 0 && (
        <div className={styles.conflicts}>
          <div className={styles.conflictsHead}>
            <h3>
              {plan.conflicts.length} {plan.conflicts.length === 1 ? "coincidencia" : "coincidencias"} con tu biblioteca
            </h3>
            <div className="segmented" aria-label="Aplicar a todas">
              {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((r) => (
                <button key={r} type="button" onClick={() => setAll(r)}>
                  Todas: {RESOLUTION_LABEL[r].toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <ul>
            {plan.conflicts.map((c) => {
              const value = decisions[c.key] ?? "mantener";
              return (
                <li key={c.key} className={styles.conflict}>
                  <p>
                    <strong>{c.incomingLabel}</strong>{" "}
                    <span className="muted">
                      ({c.kind}, {c.reason === "mismo-id" ? "mismo registro con cambios" : `mismo título que «${c.existingLabel}»`})
                    </span>
                  </p>
                  <div className="segmented" role="radiogroup" aria-label={`Qué hacer con ${c.incomingLabel}`}>
                    {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((r) => (
                      <button key={r} type="button" role="radio" aria-checked={value === r} onClick={() => setDecisions((d) => ({ ...d, [c.key]: r }))}>
                        {RESOLUTION_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
