"use client";

import { Check, Info, Play, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { StatusMark } from "@/components/ui/StatusMark";
import { copiesSummary } from "@/lib/format";
import { type Mood, MOODS, MOOD_LABEL } from "@/lib/model";
import { type Company, type Intent, type RecommendInput, recommend } from "@/lib/recommend";
import { useLibrary } from "@/lib/store";
import styles from "./picker.module.css";

const TIMES: { value: number | null; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 h" },
  { value: 120, label: "2 h" },
  { value: null, label: "Sin prisa" },
];
const INTENTS: { value: Intent; label: string }[] = [
  { value: "cualquiera", label: "Me da igual" },
  { value: "continuar", label: "Continuar una partida" },
  { value: "nuevo", label: "Empezar algo nuevo" },
];
const COMPANY: { value: Company; label: string }[] = [
  { value: "solo", label: "Sola" },
  { value: "acompanado", label: "Acompañada" },
];

function initialInput(params: URLSearchParams): RecommendInput {
  const min = Number(params.get("min"));
  const tipo = params.get("tipo");
  const intencion = params.get("intencion");
  return {
    minutes: Number.isFinite(min) && min > 0 ? min : 60,
    platform: params.get("plataforma") || null,
    intent: intencion === "nuevo" || intencion === "continuar" ? intencion : "cualquiera",
    company: params.get("con") === "acompanado" ? "acompanado" : "solo",
    mood: tipo && (MOODS as readonly string[]).includes(tipo) ? (tipo as Mood) : null,
  };
}

export function PickerView() {
  const params = useSearchParams();
  const { library, actions } = useLibrary();
  const [input, setInput] = useState<RecommendInput>(() => initialInput(params));
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const set = <K extends keyof RecommendInput>(k: K, v: RecommendInput[K]) => {
    setInput((i) => ({ ...i, [k]: v }));
    setDiscarded(new Set());
  };

  const platforms = useMemo(() => [...new Set(library.copies.map((c) => c.platform))].sort((a, b) => a.localeCompare(b, "es")), [library.copies]);
  const result = useMemo(() => recommend(library, input, { discarded }), [library, input, discarded]);
  const discard = (ids: string[]) => setDiscarded((d) => new Set([...d, ...ids]));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>¿A qué juego?</h1>
        <p className="muted">Solo con juegos de tu biblioteca que tienes disponibles. Las reglas se explican en cada propuesta.</p>
      </header>

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()} aria-label="Preferencias de esta sesión">
          <Choice label="Tiempo para esta sesión">
            {TIMES.map((t) => (
              <button key={t.label} type="button" role="radio" aria-checked={input.minutes === t.value} onClick={() => set("minutes", t.value)}>
                {t.label}
              </button>
            ))}
          </Choice>
          <Choice label="Plataforma">
            <button type="button" role="radio" aria-checked={input.platform === null} onClick={() => set("platform", null)}>
              Cualquiera
            </button>
            {platforms.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={input.platform === p} onClick={() => set("platform", p)}>
                {p}
              </button>
            ))}
          </Choice>
          <Choice label="Partida">
            {INTENTS.map((i) => (
              <button key={i.value} type="button" role="radio" aria-checked={input.intent === i.value} onClick={() => set("intent", i.value)}>
                {i.label}
              </button>
            ))}
          </Choice>
          <Choice label="Compañía">
            {COMPANY.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={input.company === c.value} onClick={() => set("company", c.value)}>
                {c.label}
              </button>
            ))}
          </Choice>
          <Choice label="Experiencia">
            <button type="button" role="radio" aria-checked={input.mood === null} onClick={() => set("mood", null)}>
              Cualquiera
            </button>
            {MOODS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={input.mood === m} onClick={() => set("mood", m)}>
                {MOOD_LABEL[m]}
              </button>
            ))}
          </Choice>
        </form>

        <section className={styles.results} aria-labelledby="h-propuestas" aria-live="polite">
          <div className={styles.resultsHead}>
            <h2 id="h-propuestas">
              {result.picks.length ? "Mis propuestas" : "Sin propuestas"}
              <span className="muted num"> · {result.eligible} {result.eligible === 1 ? "candidato" : "candidatos"}</span>
            </h2>
            <div className={styles.resultsActions}>
              {result.picks.length > 0 && result.eligible > result.picks.length && (
                <button type="button" className="btn btn-sm" onClick={() => discard(result.picks.map((p) => p.game.id))}>
                  <RotateCcw aria-hidden />
                  Otras propuestas
                </button>
              )}
              {discarded.size > 0 && (
                <button type="button" className="btn btn-sm btn-quiet" onClick={() => setDiscarded(new Set())}>
                  Recuperar descartados ({discarded.size})
                </button>
              )}
            </div>
          </div>

          {result.limitations.length > 0 && (
            <div className="notice">
              <Info aria-hidden />
              <div>
                {result.limitations.map((l) => (
                  <p key={l}>{l}</p>
                ))}
                <p>Completa esos datos en la ficha de cada juego para afinar.</p>
              </div>
            </div>
          )}

          {result.picks.length === 0 ? (
            <EmptyPicks
              excluded={result.excluded}
              total={library.games.length}
              company={input.company}
              hasDiscarded={discarded.size > 0}
              onReset={() => setDiscarded(new Set())}
            />
          ) : (
            <ol className={styles.picks}>
              {result.picks.map((p, i) => (
                <li key={p.game.id} className={`${styles.pick} rise`} style={{ "--i": i } as React.CSSProperties}>
                  {(p.game.backdropUrl ?? p.game.coverUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element -- arte de fondo de la propuesta
                    <img className={styles.pickBg} src={(p.game.backdropUrl ?? p.game.coverUrl)!} alt="" aria-hidden loading="lazy" />
                  )}
                  <Link href={`/juego/${p.game.id}`} className={styles.pickCover} aria-label={`Ficha de ${p.game.title}`}>
                    <Cover src={p.game.coverUrl} title={p.game.title} caption={p.copies[0]?.platform} priority={i === 0} />
                  </Link>
                  <div className={styles.pickBody}>
                    <h3>
                      <Link href={`/juego/${p.game.id}`}>{p.game.title}</Link>
                    </h3>
                    <p className={styles.pickMeta}>
                      <StatusMark status={p.game.status} />
                      <span className="muted">{copiesSummary(p.copies)}</span>
                    </p>
                    <ul className={styles.reasons}>
                      {p.reasons.map((r) => (
                        <li key={r}>
                          <Check aria-hidden />
                          {r}
                        </li>
                      ))}
                      {p.caveats.map((c) => (
                        <li key={c} className={styles.caveat}>
                          <Info aria-hidden />
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className={styles.pickActions}>
                      <button type="button" className="btn btn-sticker btn-sm" onClick={() => actions.markPlayedToday(p.game.id)}>
                        <Play aria-hidden />
                        Jugar a este
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => discard([p.game.id])}>
                        <X aria-hidden />
                        Descartar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  const id = `choice-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <span className="label" id={id}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id}>
        {children}
      </div>
    </div>
  );
}

function EmptyPicks({
  excluded,
  total,
  company,
  hasDiscarded,
  onReset,
}: {
  excluded: ReturnType<typeof recommend>["excluded"];
  total: number;
  company: Company;
  hasDiscarded: boolean;
  onReset: () => void;
}) {
  if (total === 0) {
    return (
      <div className="empty">
        <h3>Aún no hay juegos en tu biblioteca</h3>
        <p>Añade algunos y te propondré a qué jugar.</p>
        <Link href="/biblioteca" className="btn btn-ink">
          Ir a la biblioteca
        </Link>
      </div>
    );
  }
  const reasons = [
    excluded.platform && `${excluded.platform} no tienen copia en esa plataforma`,
    excluded.unavailable && `${excluded.unavailable} tienen la copia prestada`,
    excluded.status && `${excluded.status} no encajan con la partida que buscas (o ya están terminados o abandonados)`,
    excluded.company && `${excluded.company} no se pueden jugar ${company === "acompanado" ? "acompañada" : "en solitario"}`,
    excluded.discarded && `${excluded.discarded} los has descartado`,
  ].filter(Boolean) as string[];
  return (
    <div className="empty">
      <h3>Nada encaja con todo a la vez</h3>
      <p>De tus {total} juegos: {reasons.join("; ")}.</p>
      <p>Prueba con otra plataforma, cambia «Partida» a «Me da igual» o amplía el tiempo.</p>
      {hasDiscarded && (
        <button type="button" className="btn btn-ink" onClick={onReset}>
          Recuperar descartados
        </button>
      )}
    </div>
  );
}
