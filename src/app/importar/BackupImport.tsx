"use client";

import { ChevronsRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { type ImportChanges, type ImportPlan, type Resolution, parseBackup, planImport, resolveImport } from "@/lib/backup";
import { backupSummary as summary } from "@/lib/backup-download";
import type { Game } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import backupStyles from "./backup-import.module.css";
import styles from "./importar.module.css";
import { OriginNav } from "./OriginNav";

type Phase = "inicio" | "revision" | "copiando" | "hecho";

/** Como en Steam: más casillas no se distinguen; el resto se resume con un número. */
const MAX_CELLS = 77;
const EMPTY_CELLS = 44;

const RESOLUTION_LABEL: Record<Resolution, string> = {
  mantener: "Mantener el mío",
  importado: "Usar el del archivo",
  ambos: "Conservar los dos",
};

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Recuperar una copia de seguridad, con el mismo formato que Steam: a la izquierda lo que trae el archivo
 * (y las coincidencias con lo que ya tienes, para decidir una a una); a la derecha, lo que entra en la ludoteca.
 * Nada se sobrescribe sin que lo digas: en cada coincidencia, por defecto, se mantiene lo tuyo.
 */
export function BackupImport() {
  const { library, actions } = useLibrary();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Resolution>>({});
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportChanges | null>(null);
  const copying = phase === "copiando";

  // Lo que entraría con las decisiones de ahora: se recalcula al cambiar cada una.
  const changes = plan ? resolveImport(plan, decisions) : null;
  // Para contar, solo lo nuevo o lo que cambia: lo que ya tienes igual se vuelve a guardar sin más.
  const fresh = changes && {
    games: changes.games.filter((g) => library.games.find((x) => x.id === g.id)?.updatedAt !== g.updatedAt),
    copies: changes.copies.filter((c) => !library.copies.some((x) => x.id === c.id)),
    wishlist: changes.wishlist.filter((w) => library.wishlist.find((x) => x.id === w.id)?.updatedAt !== w.updatedAt),
  };
  const incoming = fresh ? fresh.games.length + fresh.copies.length + fresh.wishlist.length : 0;

  async function readFile(file: File | undefined) {
    if (!file) return;
    setErrors(null);
    setResult(null);
    setFileName(file.name);
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setPlan(null);
      setErrors(parsed.errors);
      setPhase("inicio");
      return;
    }
    setPlan(planImport(library, parsed.backup));
    setDecisions({});
    setPhase("revision");
  }

  async function copyAll() {
    if (!plan || !changes || !fresh || incoming === 0) return;
    setPhase("copiando");
    try {
      await actions.applyChanges(changes);
      // El resumen cuenta lo que de verdad ha entrado o cambiado, no lo que ya era igual.
      toast(`Importado: ${summary({ games: fresh.games.length, copies: fresh.copies.length, wishlist: fresh.wishlist.length })}`);
      setResult({ ...changes, ...fresh });
      setPhase("hecho");
    } catch (e) {
      toast.error("No se ha podido importar", { description: e instanceof Error ? e.message : undefined });
      setPhase("revision");
    }
  }

  const setAll = (r: Resolution) => plan && setDecisions(Object.fromEntries(plan.conflicts.map((c) => [c.key, r])));

  const fileInput = (
    <input
      type="file"
      accept="application/json,.json"
      className="sr-only"
      aria-label="Archivo de copia de seguridad"
      data-testid="importar-archivo"
      disabled={copying}
      onChange={(e) => {
        void readFile(e.target.files?.[0]);
        // Así se puede volver a elegir el mismo archivo.
        e.target.value = "";
      }}
    />
  );

  const n = plan?.newCounts;

  return (
    <div className={styles.page} data-fase={phase}>
      <OriginNav current="copia" />
      <header className={styles.top}>
        <h1>Copiar desde tu copia de seguridad</h1>
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

      {phase !== "hecho" && (
        <div className={styles.bays}>
          <section
            className={styles.card}
            aria-labelledby="bahia-copia"
            data-arrastrando={dragging || undefined}
            onDragOver={(e) => {
              e.preventDefault();
              if (!copying) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!copying) void readFile(e.dataTransfer.files[0]);
            }}
          >
            <h2 id="bahia-copia">
              Copia de seguridad {plan && <small>{count(plan.backup.data.games.length, "juego", "juegos")}</small>}
            </h2>

            {!plan ? (
              <div className={styles.intro}>
                <p>
                  Elige el archivo que guardaste desde <Link href="/ajustes?apartado=partida">Ajustes, en «Partida guardada»</Link>. Verás qué trae de
                  nuevo y, si algo coincide con lo que ya tienes, decidirás qué hacer.
                </p>
                <div className={styles.drop}>
                  <p>Suelta aquí tu archivo</p>
                  <label className={styles.pickFile}>
                    {fileInput}
                    <span>Elegir archivo</span>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.fileRow}>
                  <span>{fileName}</span>
                  <label className={styles.pickFile}>
                    {fileInput}
                    <span>Elegir otro</span>
                  </label>
                </div>
                <div className={styles.list}>
                  <p className={backupStyles.summary}>
                    Archivo del {new Date(plan.backup.exportedAt).toLocaleString("es-ES")}. Nuevo: {summary(n!)}.
                    {plan.identical > 0 && ` ${plan.identical} elementos ya los tienes iguales y se dejan como están.`}
                  </p>
                  {plan.conflicts.length > 0 && (
                    <section className={styles.group} aria-labelledby="copia-coincidencias">
                      <h3 id="copia-coincidencias">
                        {plan.conflicts.length} {plan.conflicts.length === 1 ? "coincidencia" : "coincidencias"} con tu biblioteca
                      </h3>
                      <div className={backupStyles.all} role="group" aria-label="Aplicar a todas">
                        {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((r) => (
                          <button key={r} type="button" disabled={copying} onClick={() => setAll(r)}>
                            Todas: {RESOLUTION_LABEL[r].toLowerCase()}
                          </button>
                        ))}
                      </div>
                      <ul className={backupStyles.conflicts}>
                        {plan.conflicts.map((c) => {
                          const value = decisions[c.key] ?? "mantener";
                          return (
                            <li key={c.key} className={backupStyles.conflict}>
                              <p>
                                <strong>{c.incomingLabel}</strong>{" "}
                                <span className={styles.fine}>
                                  ({c.kind}, {c.reason === "mismo-id" ? "mismo registro con cambios" : `mismo título que «${c.existingLabel}»`})
                                </span>
                              </p>
                              <div className={backupStyles.choices} role="radiogroup" aria-label={`Qué hacer con ${c.incomingLabel}`}>
                                {(Object.keys(RESOLUTION_LABEL) as Resolution[]).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    role="radio"
                                    aria-checked={value === r}
                                    disabled={copying}
                                    onClick={() => setDecisions((d) => ({ ...d, [c.key]: r }))}
                                  >
                                    {RESOLUTION_LABEL[r]}
                                  </button>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  )}
                </div>
              </>
            )}
          </section>

          <div className={styles.arrow} aria-hidden>
            <ChevronsRight />
          </div>

          <section className={styles.card} aria-labelledby="bahia-ludoteca">
            <h2 id="bahia-ludoteca">Ludoteca</h2>
            {fresh && (
              <p className={styles.tally} role="status">
                <span>{count(fresh.games.length, "juego", "juegos")}</span>
                <i> · </i>
                <span>{count(fresh.copies.length, "copia", "copias")}</span>
                <i> · </i>
                <span>{count(fresh.wishlist.length, "deseo", "deseos")}</span>
              </p>
            )}
            <div className={styles.cells} aria-hidden>
              {(!fresh || fresh.games.length === 0) && Array.from({ length: EMPTY_CELLS }, (_, i) => <span key={i} className={styles.slot} />)}
              {fresh?.games.slice(0, MAX_CELLS).map((game) => (
                <span key={game.id} className={copying ? styles.cellDone : styles.cell}>
                  <CoverImg game={game} />
                </span>
              ))}
              {fresh && fresh.games.length > MAX_CELLS && <span className={styles.more}>+{fresh.games.length - MAX_CELLS}</span>}
            </div>
            <div className={styles.bar} role="progressbar" aria-label="Progreso de la copia" aria-valuemin={0} aria-valuemax={1} aria-valuenow={copying ? 1 : 0}>
              <i style={{ transform: `scaleX(${copying ? 1 : 0})` }} />
            </div>
            <p className={styles.status} aria-live="polite">
              {copying ? "Copiando. No cierres esta pantalla." : plan && incoming === 0 ? "No hay nada nuevo que importar." : `${incoming} para copiar`}
            </p>
            {!copying && <p className={styles.fine}>En cada coincidencia, por defecto, se mantiene lo tuyo: nada se sobrescribe sin que lo digas.</p>}
            <button type="button" className={styles.go} disabled={copying || incoming === 0} onClick={() => void copyAll()}>
              {copying ? "Copiando…" : "Copiar a la ludoteca"}
            </button>
          </section>
        </div>
      )}

      {phase === "hecho" && result && (
        <section className={styles.done} role="status">
          <h2>Copia terminada</h2>
          <p>Copiados {summary({ games: result.games.length, copies: result.copies.length, wishlist: result.wishlist.length })}.</p>
          <div className={styles.doneActions}>
            <Link href="/biblioteca" className={styles.go}>
              Ver la biblioteca
            </Link>
            <button
              type="button"
              onClick={() => {
                setPlan(null);
                setResult(null);
                setPhase("inicio");
              }}
            >
              Importar otro archivo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Carátula del juego del archivo; si falta o no carga, la inicial del título. */
function CoverImg({ game }: { game: Game }) {
  const [broken, setBroken] = useState(false);
  if (!game.coverUrl || broken) {
    return (
      <span className={styles.noIcon} aria-hidden>
        {game.title[0]}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- carátula del catálogo, pequeña y diferida
  return <img src={game.coverUrl} alt="" loading="lazy" onError={() => setBroken(true)} />;
}
