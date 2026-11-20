"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadBackup } from "@/lib/backup-download";
import { SNOOZE_DAYS, shouldRemind, snoozeBackupReminder, useBackupStatus } from "@/lib/backup-reminder";
import type { Library } from "@/lib/model";
import styles from "./backup-reminder.module.css";

/**
 * Aviso discreto en el inicio cuando hace más de lo elegido en Ajustes (un mes, si no se cambia) que no se exporta
 * una copia (o nunca se ha hecho) y hay juegos o deseos propios que perder.
 */
export function BackupReminder({ library }: { library: Library }) {
  const status = useBackupStatus();
  const own = library.games.filter((g) => !g.demo).length + library.wishlist.filter((w) => !w.demo).length;
  if (!status || !shouldRemind(status, own, status.remindEvery)) return null;

  const days = status.daysSinceBackup;
  return (
    <section className={`notice ${styles.reminder}`} aria-label="Recordatorio de copia de seguridad">
      <Download aria-hidden />
      <p className={styles.text}>
        <strong>{days === null ? "Aún no has guardado ninguna copia de tu biblioteca." : `Tu última copia es de hace ${days} días.`}</strong>{" "}
        Si algo se borrara por error, es la forma de recuperarlo.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className="btn btn-ink btn-sm"
          onClick={() => toast(`Copia exportada: ${downloadBackup(library)}`)}
        >
          Exportar copia
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            snoozeBackupReminder();
            toast(`Te lo recordaré dentro de ${SNOOZE_DAYS} días.`);
          }}
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
