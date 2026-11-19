"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { type GtCounts, type GtItem, type PlannedCopy, classifyGameTracker, parseGameTracker } from "@/lib/gametracker-import";
import { DEFAULT_PLATFORMS, FORMAT_LABEL, FORMATS, type Format, normalizeTitle } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { OriginNav } from "./OriginNav";
import styles from "./importar.module.css";

type Phase = "inicio" | "revision" | "copiando" | "hecho";

/** Grupos pequeños: la barra avanza de verdad y un fallo no pierde lo ya guardado. */
const BATCH = 50;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const copyLabel = (c: PlannedCopy) => (c.store ? `${c.platform} · ${c.store}` : `${c.platform} · ${FORMAT_LABEL[c.format]}`);
const sameCopy = (a: PlannedCopy, b: PlannedCopy) => a.platform === b.platform && a.format === b.format && a.store === b.store;

export function GameTrackerImport() {
  const { library, actions } = useLibrary();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [problem, setProblem] = useState<string | null>(null);
  const [items, setItems] = useState<GtItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<GtCounts | null>(null);

  const fresh = useMemo(() => items.filter((i) => i.state !== "ya"), [items]);
  const review = fresh.filter((i) => i.state === "dudoso");
  const games = fresh.filter((i) => !i.entry.wish);
  const wishes = fresh.filter((i) => i.entry.wish);
  const owned = items.filter((i) => i.state === "ya");
  const queue = fresh.filter((i) => selected.has(i.id));
  const copying = phase === "copiando";

  const q = normalizeTitle(query);
  const matches = (i: GtItem) => !q || normalizeTitle(i.entry.title).includes(q);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setResult(null);
    const parsed = parseGameTracker(await file.text());
    if (!parsed.ok) {
      setItems([]);
      setProblem(parsed.message);
      setPhase("inicio");
      return;
    }
    const next = classifyGameTracker(library, parsed.entries);
    setItems(next);
    setSelected(new Set(next.filter((i) => i.state !== "ya").map((i) => i.id)));
    setQuery("");
    setPhase("revision");
  }

  async function copyAll() {
    if (!queue.length) return;
    setProblem(null);
    setDone(0);
    setPhase("copiando");
    const totals: GtCounts = { juegos: 0, copias: 0, deseos: 0, saltados: 0 };
    for (let i = 0; i < queue.length; i += BATCH) {
      try {
        const counts = await actions.importGameTracker(queue.slice(i, i + BATCH));
        totals.juegos += counts.juegos;
        totals.copias += counts.copias;
        totals.deseos += counts.deseos;
        totals.saltados += counts.saltados;
      } catch (e) {
        const reason = e instanceof Error ? ` (${e.message})` : "";
        setProblem(`Se ha parado tras guardar ${count(totals.juegos, "juego", "juegos")}${reason}. Vuelve a copiar: lo ya guardado no se duplica.`);
        setPhase("revision");
        return;
      }
      setDone(Math.min(i + BATCH, queue.length));
    }
    setResult(totals);
    setPhase("hecho");
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const setCopies = (id: string, change: (copies: PlannedCopy[]) => PlannedCopy[]) =>
    setItems((current) => current.map((i) => (i.id === id ? { ...i, copies: change(i.copies) } : i)));
  const setAll = (list: GtItem[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const i of list) {
        if (on) next.add(i.id);
        else next.delete(i.id);
      }
      return next;
    });

  const pick = (item: GtItem) => (
    <input
      type="checkbox"
      aria-label={`Copiar «${item.entry.title}»`}
      checked={selected.has(item.id)}
      disabled={copying}
      onChange={() => toggle(item.id)}
    />
  );

  return (
    <div className={styles.page} data-fase={phase}>
      <OriginNav current="gametracker" />
      <header className={styles.top}>
        <h1>Copiar desde Game Tracker</h1>
      </header>

      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      {(phase === "inicio" || phase === "revision") && (
        <section
          className={`${styles.card} ${styles.file}`}
          aria-labelledby="gt-archivo"
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
          <h2 id="gt-archivo">Tu archivo</h2>
          {phase === "inicio" && (
            <p>
              En Game Tracker, exporta tu colección en CSV y elígela aquí (o suéltala encima). Verás qué entra, qué ya tienes y qué conviene revisar antes de
              copiar nada.
            </p>
          )}
          <label className={styles.fileField}>
            <span>Archivo de Game Tracker</span>
            <input type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} />
          </label>
        </section>
      )}

      {(phase === "revision" || copying) && (
        <>
          <p className={styles.summary} role="status">
            {count(games.length, "juego nuevo", "juegos nuevos")} · {count(wishes.length, "deseo nuevo", "deseos nuevos")} ·{" "}
            {count(owned.length, "ya lo tienes", "ya los tienes")} · {review.length} para revisar
          </p>

          {review.length > 0 && (
            <section className={styles.card} aria-labelledby="gt-revisar">
              <h2 id="gt-revisar">Para revisar</h2>
              <p className={styles.fine}>El archivo no dice qué formato va con cada consola. Quita las copias que no tengas y añade las que falten.</p>
              <ul className={styles.items}>
                {review.map((item) => (
                  <li key={item.id} className={styles.item}>
                    <label className={styles.itemHead}>
                      {pick(item)}
                      <span>{item.entry.title}</span>
                    </label>
                    <ul className={styles.copies}>
                      {item.copies.map((c) => (
                        <li key={copyLabel(c)}>
                          {copyLabel(c)}
                          <button
                            type="button"
                            aria-label={`Quitar ${copyLabel(c)}`}
                            disabled={copying}
                            onClick={() => setCopies(item.id, (list) => list.filter((x) => !sameCopy(x, c)))}
                          >
                            <X aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <AddCopy title={item.entry.title} disabled={copying} onAdd={(c) => setCopies(item.id, (list) => (list.some((x) => sameCopy(x, c)) ? list : [...list, c]))} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.tools}>
            <input type="search" aria-label="Buscar en el archivo" placeholder="Buscar juego" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" disabled={copying} onClick={() => setAll(fresh, true)}>
              Todos
            </button>
            <button type="button" disabled={copying} onClick={() => setAll(fresh, false)}>
              Ninguno
            </button>
          </div>

          {games.length > 0 && (
            <section className={styles.card} aria-labelledby="gt-juegos">
              <h2 id="gt-juegos">
                Juegos nuevos <small>{games.length}</small>
              </h2>
              <ul className={styles.items}>
                {games.filter((i) => i.state === "nuevo" && matches(i)).map((item) => (
                  <li key={item.id} className={styles.item}>
                    <label className={styles.itemHead}>
                      {pick(item)}
                      <span>
                        {item.entry.title}
                        <small>{item.copies.map(copyLabel).join(", ") || "Sin copia"}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {wishes.length > 0 && (
            <section className={styles.card} aria-labelledby="gt-deseos">
              <h2 id="gt-deseos">
                Deseos nuevos <small>{wishes.length}</small>
              </h2>
              <ul className={styles.items}>
                {wishes.filter(matches).map((item) => (
                  <li key={item.id} className={styles.item}>
                    <label className={styles.itemHead}>
                      {pick(item)}
                      <span>
                        {item.entry.title}
                        {item.entry.platforms[0] && <small>{item.entry.platforms[0]}</small>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {owned.length > 0 && (
            <details className={styles.owned}>
              <summary>Ya los tienes ({owned.length}): no se tocan</summary>
              <ul>
                {owned.map((item) => (
                  <li key={item.id}>{item.entry.title}</li>
                ))}
              </ul>
            </details>
          )}

          <section className={`${styles.card} ${styles.send}`} aria-label="Copiar">
            <p className={styles.fine}>
              <Link href="/ajustes?apartado=copia">Haz antes una copia de seguridad</Link>: si algo no te convence, podrás volver a como estaba.
            </p>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Progreso de la copia"
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-valuenow={done}
            >
              <i style={{ transform: `scaleX(${queue.length ? done / queue.length : 0})` }} />
            </div>
            <p className={styles.status} aria-live="polite">
              {copying ? `Copiando ${done} de ${queue.length}. No cierres esta pantalla.` : `${queue.length} para copiar`}
            </p>
            <button type="button" className={styles.go} disabled={copying || queue.length === 0} onClick={() => void copyAll()}>
              {copying ? "Copiando…" : "Copiar a la ludoteca"}
            </button>
          </section>
        </>
      )}

      {phase === "hecho" && result && (
        <section className={styles.done} role="status">
          <h2>Copia terminada</h2>
          <p>
            Copiados {count(result.juegos, "juego", "juegos")}, {count(result.copias, "copia", "copias")} y {count(result.deseos, "deseo", "deseos")}.
          </p>
          {result.saltados > 0 && <p>{count(result.saltados, "ya estaba y no se ha tocado", "ya estaban y no se han tocado")}.</p>}
          <div className={styles.doneActions}>
            <Link href="/biblioteca" className={styles.go}>
              Ver la biblioteca
            </Link>
            <button type="button" onClick={() => setPhase("inicio")}>
              Importar otro archivo
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Añadir a mano una copia que el archivo no dejaba adivinar. */
function AddCopy({ title, disabled, onAdd }: { title: string; disabled: boolean; onAdd: (copy: PlannedCopy) => void }) {
  const [platform, setPlatform] = useState(DEFAULT_PLATFORMS[0]);
  const [format, setFormat] = useState<Format>("fisico");
  return (
    <div className={styles.addCopy}>
      <select aria-label={`Plataforma para «${title}»`} value={platform} disabled={disabled} onChange={(e) => setPlatform(e.target.value)}>
        {DEFAULT_PLATFORMS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <select aria-label={`Formato para «${title}»`} value={format} disabled={disabled} onChange={(e) => setFormat(e.target.value as Format)}>
        {FORMATS.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABEL[f]}
          </option>
        ))}
      </select>
      <button type="button" aria-label={`Añadir copia a «${title}»`} disabled={disabled} onClick={() => onAdd({ platform, format, store: null })}>
        Añadir copia
      </button>
    </div>
  );
}
