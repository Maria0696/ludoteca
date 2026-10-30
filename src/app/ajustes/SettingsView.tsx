"use client";

import { Cloud, Download, HardDrive, LogOut, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import {
  type ImportPlan,
  type Resolution,
  backupFileName,
  createBackup,
  parseBackup,
  planImport,
  resolveImport,
} from "@/lib/backup";
import { DEMO_ART } from "@/lib/demo-art";
import { useLibrary } from "@/lib/store";
import styles from "./settings.module.css";

export function SettingsView() {
  const router = useRouter();
  const { library, mode, actions } = useLibrary();
  const [includeDemo, setIncludeDemo] = useState(false);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<"comprobando" | "si" | "no">("comprobando");
  const fileRef = useRef<HTMLInputElement>(null);

  const demoCount = library.games.filter((g) => g.demo).length + library.wishlist.filter((w) => w.demo).length;
  const realCount = library.games.filter((g) => !g.demo).length;

  useEffect(() => {
    fetch("/api/catalogo/estado")
      .then((r) => r.json())
      .then((d: { configured: boolean }) => setCatalog(d.configured ? "si" : "no"))
      .catch(() => setCatalog("no"));
  }, []);

  function exportBackup() {
    const backup = createBackup(library, { includeDemo });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName();
    a.click();
    URL.revokeObjectURL(url);
    const d = backup.data;
    toast(`Copia exportada: ${summary({ games: d.games.length, copies: d.copies.length, wishlist: d.wishlist.length, lists: d.lists.length })}`);
  }

  async function readFile(file: File) {
    setImportErrors(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setImportErrors(result.errors);
      return;
    }
    setPlan(planImport(library, result.backup));
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Ajustes</h1>

      <section className={styles.row} aria-labelledby="h-datos">
        <div className={styles.label}>
          <h2 id="h-datos">Dónde se guardan tus datos</h2>
          <p>Cómo se almacena tu biblioteca en este dispositivo.</p>
        </div>
        <div className={styles.panel}>
          {mode === "local" ? (
            <>
              <p className={styles.modeLine}>
                <HardDrive aria-hidden />
                <strong>Modo local</strong>
              </p>
              <p>
                Tu biblioteca se guarda solo en este navegador. No se sincroniza con otros dispositivos y se pierde si borras los datos del
                navegador. Exporta copias de seguridad con frecuencia o conecta Supabase siguiendo el README.
              </p>
            </>
          ) : (
            <>
              <p className={styles.modeLine}>
                <Cloud aria-hidden />
                <strong>Sincronizado con tu base de datos</strong>
              </p>
              <p>Tu biblioteca vive en Supabase y solo tu cuenta puede leerla o modificarla.</p>
              <button
                type="button"
                className="btn"
                style={{ justifySelf: "start" }}
                onClick={async () => {
                  const { getBrowserSupabase } = await import("@/lib/supabase/client");
                  await getBrowserSupabase().auth.signOut();
                  router.replace("/entrar");
                  router.refresh();
                }}
              >
                <LogOut aria-hidden />
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </section>

      <section className={styles.row} aria-labelledby="h-copia">
        <div className={styles.label}>
          <h2 id="h-copia">Copia de seguridad</h2>
          <p>Un archivo JSON con juegos, copias, deseos y listas. Al importar, nada se sobrescribe sin que lo decidas.</p>
        </div>
        <div className={styles.panel}>
          <div className={styles.actions}>
            <button type="button" className="btn btn-ink" onClick={exportBackup}>
              <Download aria-hidden />
              Exportar copia
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              Importar copia
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Archivo de copia de seguridad"
              data-testid="importar-archivo"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
                e.target.value = "";
              }}
            />
          </div>
          {demoCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} />
              Incluir los datos de demostración en la copia
            </label>
          )}
          {importErrors && (
            <div className="notice is-error" role="alert">
              <div>
                <p>
                  <strong>No se ha importado nada.</strong> El archivo tiene problemas:
                </p>
                <ul className={styles.errors}>
                  {importErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.row} aria-labelledby="h-demo">
        <div className={styles.label}>
          <h2 id="h-demo">Datos de demostración</h2>
          <p>Juegos inventados para probar la app. Están marcados y se retiran de una vez sin tocar tu colección.</p>
        </div>
        <div className={styles.panel}>
          <p>
            {demoCount > 0
              ? `Ahora hay ${demoCount} elementos de demostración junto a ${realCount} juegos tuyos.`
              : "No hay datos de demostración cargados."}
          </p>
          <div className={styles.actions}>
            {demoCount > 0 ? (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDemo(true)}>
                Retirar datos de demostración
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await actions.loadDemo();
                  setBusy(false);
                  toast("Datos de demostración cargados");
                }}
              >
                {busy ? "Cargando…" : "Cargar datos de demostración"}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className={styles.row} aria-labelledby="h-catalogo">
        <div className={styles.label}>
          <h2 id="h-catalogo">Catálogo de carátulas</h2>
          <p>Búsqueda de carátulas, géneros y duración en IGDB.com. Todo se puede escribir o corregir a mano.</p>
        </div>
        <div className={styles.panel}>
          <p>
            {catalog === "comprobando"
              ? "Comprobando…"
              : catalog === "si"
                ? "Conectado. Al escribir un título verás sugerencias del catálogo."
                : "Sin configurar. Faltan IGDB_CLIENT_ID e IGDB_CLIENT_SECRET en el servidor; el README explica cómo obtenerlas gratis con una cuenta de Twitch."}
          </p>
          <p className="muted" style={{ fontSize: 12 }}>
            Datos del catálogo proporcionados por IGDB.com, gratuito para uso no comercial.
          </p>
        </div>
      </section>

      <section className={styles.row} aria-labelledby="h-creditos">
        <div className={styles.label}>
          <h2 id="h-creditos">Imágenes de demostración</h2>
          <p>Los juegos de demostración se ilustran con obras de dominio público, no con sus carátulas oficiales.</p>
        </div>
        <div className={styles.panel}>
          <details>
            <summary className={styles.summary}>Ver las {DEMO_ART.length} obras y sus fuentes</summary>
            <ul className={styles.credits}>
              {DEMO_ART.map((a) => (
                <li key={a.key}>
                  <a href={a.page} target="_blank" rel="noreferrer">
                    {a.title}
                  </a>
                  {a.creator ? `, ${a.creator}` : ""} · {a.license} · {a.via}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <Dialog
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="¿Retirar los datos de demostración?"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDemo(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                setConfirmDemo(false);
                await actions.removeDemo();
                toast("Datos de demostración retirados");
              }}
            >
              Retirar {demoCount} elementos
            </button>
          </>
        }
      >
        <p>Se eliminan los juegos, copias, deseos y listas de demostración. Tus {realCount} juegos no se tocan.</p>
      </Dialog>

      {plan && <ImportDialog plan={plan} onClose={() => setPlan(null)} />}
    </div>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const summary = (c: { games: number; copies: number; wishlist: number; lists: number }) =>
  `${count(c.games, "juego", "juegos")}, ${count(c.copies, "copia", "copias")}, ${count(c.wishlist, "deseo", "deseos")} y ${count(c.lists, "lista", "listas")}`;

const RESOLUTION_LABEL: Record<Resolution, string> = {
  mantener: "Mantener el mío",
  importado: "Usar el del archivo",
  ambos: "Conservar los dos",
};

function ImportDialog({ plan, onClose }: { plan: ImportPlan; onClose: () => void }) {
  const { actions } = useLibrary();
  const [decisions, setDecisions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const n = plan.newCounts;
  const nothing = n.games + n.copies + n.wishlist + n.lists === 0 && plan.conflicts.length === 0;
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
                  `Importado: ${summary({ games: changes.games.length, copies: changes.copies.length, wishlist: changes.wishlist.length, lists: changes.lists.length })}`,
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
