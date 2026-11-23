"use client";

import { Check, Info, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { GuideHint } from "@/components/ui/GuideHint";
import { OptionRow } from "@/components/ui/OptionRow";
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
/** `label` para el resumen de la sesión; `short`, para que quepa en la fila del menú. */
const INTENTS: { value: Intent; label: string; short: string }[] = [
  { value: "cualquiera", label: "Me da igual", short: "Me da igual" },
  { value: "continuar", label: "Continuar una partida", short: "Continuar" },
  { value: "nuevo", label: "Empezar algo nuevo", short: "Nueva" },
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

/** La sesión en una línea: «1 h · Cualquier plataforma · Sola», y lo que no esté en «da igual». */
function sessionSummary(input: RecommendInput): string {
  return [
    TIMES.find((t) => t.value === input.minutes)?.label ?? `${input.minutes} min`,
    input.platform ?? "Cualquier plataforma",
    COMPANY.find((c) => c.value === input.company)?.label,
    input.intent !== "cualquiera" && INTENTS.find((i) => i.value === input.intent)?.label,
    input.mood && MOOD_LABEL[input.mood],
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PickerView() {
  const params = useSearchParams();
  const { library, actions } = useLibrary();
  const [input, setInput] = useState<RecommendInput>(() => initialInput(params));
  const [discarded, setDiscarded] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
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
        <h1 className="screen-title">¿A qué juego?</h1>
        <p>Solo con juegos de tu biblioteca que tienes disponibles. Las reglas se explican en cada propuesta.</p>
      </header>

      <GuideHint id="quejuego" />

      <div className={styles.layout}>
        <form className={`window ${styles.form}`} onSubmit={(e) => e.preventDefault()} aria-labelledby="h-sesion">
          <h2 id="h-sesion">Tu sesión</h2>
          <SessionChoices input={input} platforms={platforms} set={set} />
        </form>

        <section className={`window ${styles.results}`} aria-labelledby="h-propuestas" aria-live="polite">
          <div className={styles.resultsHead}>
            <h2 id="h-propuestas">
              {result.picks.length ? "Mis propuestas" : "Sin propuestas"}
              <span className="num"> · {result.eligible} {result.eligible === 1 ? "candidato" : "candidatos"}</span>
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

          {/* En el móvil la respuesta va primero y la sesión, resumida, se ajusta en una hoja. */}
          <div className={styles.summary}>
            <p>{sessionSummary(input)}</p>
            <button type="button" className="btn btn-sm" aria-label="Ajustar la sesión" onClick={() => setSheet(true)}>
              <SlidersHorizontal aria-hidden />
              Ajustar
            </button>
          </div>

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

          {/* Lo que falta por saber va después: en el móvil, la primera propuesta se ve sin bajar. */}
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
        </section>
      </div>

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        title="Tu sesión"
        footer={
          <button type="button" className="btn btn-ink" onClick={() => setSheet(false)}>
            {result.picks.length === 0 ? "Ver por qué no hay propuestas" : `Ver ${result.picks.length} ${result.picks.length === 1 ? "propuesta" : "propuestas"}`}
          </button>
        }
      >
        <div className={styles.sheetChoices}>
          <SessionChoices input={input} platforms={platforms} set={set} />
        </div>
      </Dialog>
    </div>
  );
}

/** Las preguntas de la sesión: en el panel del ordenador y en la hoja del móvil. */
function SessionChoices({
  input,
  platforms,
  set,
}: {
  input: RecommendInput;
  platforms: string[];
  set: <K extends keyof RecommendInput>(k: K, v: RecommendInput[K]) => void;
}) {
  // Como el menú de opciones de un juego: una fila por pregunta, sin cajas.
  return (
    <div className={styles.menu}>
      <OptionRow label="Tiempo" options={TIMES} value={input.minutes} onChange={(v) => set("minutes", v)} />
      <OptionRow
        label="Plataforma"
        options={[{ value: null, label: "Cualquiera" }, ...platforms.map((p) => ({ value: p, label: p }))]}
        value={input.platform}
        onChange={(v) => set("platform", v)}
      />
      <OptionRow label="Partida" options={INTENTS.map((i) => ({ value: i.value, label: i.short }))} value={input.intent} onChange={(v) => set("intent", v)} />
      <OptionRow label="Compañía" options={COMPANY} value={input.company} onChange={(v) => set("company", v)} />
      <OptionRow
        label="Experiencia"
        options={[{ value: null, label: "Cualquiera" }, ...MOODS.map((m) => ({ value: m, label: MOOD_LABEL[m] }))]}
        value={input.mood}
        onChange={(v) => set("mood", v)}
      />
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
