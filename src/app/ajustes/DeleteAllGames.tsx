"use client";

import { Download, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { downloadBackup } from "@/lib/backup-download";
import { describeLastBackup, useBackupStatus } from "@/lib/backup-reminder";
import { useLibrary } from "@/lib/store";
import styles from "./settings.module.css";

const CONFIRM_WORD = "ELIMINAR";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DeleteAllGames() {
  const { library } = useLibrary();
  const [open, setOpen] = useState(false);
  const games = library.games.length;

  return (
    <section className={`window ${styles.row}`} aria-labelledby="h-eliminar">
      <div className={styles.label}>
        <h2 id="h-eliminar">Eliminar todos los juegos</h2>
        <p>Vacía la biblioteca de una vez. Tu lista de deseos no se toca.</p>
      </div>
      <div className={styles.panel}>
        <p>{games > 0 ? `Ahora tienes ${count(games, "juego", "juegos")} y ${count(library.copies.length, "copia", "copias")}.` : "No hay juegos que eliminar."}</p>
        {games > 0 && (
          <div className={styles.actions}>
            <button type="button" className="btn btn-danger" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden />
              Eliminar todos los juegos
            </button>
          </div>
        )}
      </div>
      {open && <Warnings onClose={() => setOpen(false)} />}
    </section>
  );
}

function Warnings({ onClose }: { onClose: () => void }) {
  const { library, actions } = useLibrary();
  const backup = useBackupStatus();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [understood, setUnderstood] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wordRef = useRef<HTMLInputElement>(null);

  // Al cambiar de aviso, el foco nunca se queda en el botón que lleva al siguiente.
  useEffect(() => {
    (step === 3 ? wordRef : cancelRef).current?.focus();
  }, [step]);

  const games = count(library.games.length, "juego", "juegos");
  const copies = count(library.copies.length, "copia", "copias");
  const close = () => {
    if (!busy) onClose();
  };

  async function deleteEverything() {
    setBusy(true);
    try {
      await actions.deleteAllGames();
      toast(`Biblioteca vaciada: ${games}`);
      onClose();
    } catch (e) {
      toast.error("No se han podido eliminar", { description: e instanceof Error ? e.message : undefined });
      setBusy(false);
      void actions.reload();
    }
  }

  const titles = { 1: library.games.length === 1 ? "¿Eliminar tu único juego?" : `¿Eliminar tus ${games}?`, 2: "Esto no se puede deshacer", 3: "Último aviso" };

  return (
    <Dialog
      open
      onClose={close}
      title={titles[step]}
      footer={
        <>
          <button ref={cancelRef} type="button" className="btn btn-ink" disabled={busy} onClick={close}>
            Cancelar
          </button>
          {step === 1 && (
            <button type="button" className="btn" onClick={() => setStep(2)}>
              Sí, continuar
            </button>
          )}
          {step === 2 && (
            <button type="button" className="btn" disabled={!understood} onClick={() => setStep(3)}>
              Continuar
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn btn-danger" disabled={busy || word.trim().toUpperCase() !== CONFIRM_WORD} onClick={() => void deleteEverything()}>
              <Trash2 aria-hidden />
              {busy ? "Eliminando…" : `Eliminar ${games}`}
            </button>
          )}
        </>
      }
    >
      <p className="muted">Aviso {step} de 3</p>

      {step === 1 && (
        <>
          <p>
            Se borrarán <strong>{games}</strong> y <strong>{copies}</strong>, con sus horas, notas, valoraciones, fechas y datos de compra.
          </p>
          <p>Tu lista de deseos no se toca.</p>
        </>
      )}

      {step === 2 && (
        <>
          <p className="notice is-error">No hay papelera ni botón de deshacer. Solo podrás recuperar los juegos con una copia de seguridad guardada antes de borrarlos.</p>
          {backup && <p>{describeLastBackup(backup.daysSinceBackup)}</p>}
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={() => toast(`Copia exportada: ${downloadBackup(library)}`)}>
              <Download aria-hidden />
              Exportar copia ahora
            </button>
          </div>
          <label className="check">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            Entiendo que mis juegos se borrarán para siempre
          </label>
        </>
      )}

      {step === 3 && (
        <div className="field">
          <label htmlFor="confirmar-eliminar">Para eliminar {games}, escribe {CONFIRM_WORD}</label>
          <input
            ref={wordRef}
            id="confirmar-eliminar"
            className="input"
            value={word}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setWord(e.target.value)}
          />
        </div>
      )}
    </Dialog>
  );
}
