"use client";

import Link from "next/link";
import { useState } from "react";
import { type ImportPlan, parseBackup, planImport } from "@/lib/backup";
import { useLibrary } from "@/lib/store";
import backupStyles from "./backup-import.module.css";
import { ImportDialog } from "./ImportDialog";
import styles from "./importar.module.css";
import { OriginNav } from "./OriginNav";

/**
 * Recuperar una copia de seguridad: el archivo que se guarda desde Ajustes, en «Partida guardada».
 * Como los otros orígenes: eliges el archivo y decides; nada se sobrescribe sin que lo digas.
 */
export function BackupImport() {
  const { library } = useLibrary();
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setErrors(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setPlan(planImport(library, result.backup));
  }

  return (
    <div className={styles.page} data-fase="inicio">
      <OriginNav current="copia" />
      <header className={styles.top}>
        <h1>Recuperar una copia de seguridad</h1>
      </header>

      {errors && (
        <div className={styles.problem} role="alert">
          <p>
            <strong>No se ha importado nada.</strong> El archivo tiene problemas:
          </p>
          <ul className={backupStyles.errors}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.bays}>
        <section
          className={styles.card}
          aria-labelledby="bahia-copia"
          data-arrastrando={dragging || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFile(e.dataTransfer.files[0]);
          }}
        >
          <h2 id="bahia-copia">Copia de seguridad</h2>
          <div className={styles.intro}>
            <p>
              Elige el archivo que guardaste desde <Link href="/ajustes?apartado=partida">Ajustes, en «Partida guardada»</Link>. Verás qué trae de
              nuevo y, si algo coincide con lo que ya tienes, decidirás qué hacer: por defecto se mantiene lo tuyo.
            </p>
            <div className={styles.drop}>
              <p>Suelta aquí tu archivo</p>
              <label className={styles.pickFile}>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  aria-label="Archivo de copia de seguridad"
                  data-testid="importar-archivo"
                  onChange={(e) => {
                    void readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <span>Elegir archivo</span>
              </label>
            </div>
          </div>
        </section>
      </div>

      {plan && <ImportDialog plan={plan} onClose={() => setPlan(null)} />}
    </div>
  );
}
