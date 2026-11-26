"use client";

import { Pause, Play, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cover } from "@/components/ui/Cover";
import { type WrapGame, type YearWrapData, compareLine, computeYear, hasActivity } from "@/lib/anuario";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { MOOD_LABEL } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./anuario.module.css";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const monthName = (m: number) => new Date(2000, m, 1).toLocaleString("es-ES", { month: "long" });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Lo que dura cada pantalla antes de pasar sola a la siguiente. */
const SCREEN_MS = 6000;

/** Cada pantalla, su color: un Wrapped con el alma arcade de la Ludoteca. */
const PALETTE: Record<string, { bg: string; ink: string; accent: string }> = {
  portada: { bg: "#ffd76a", ink: "#1b1400", accent: "#ff3d8b" },
  terminados: { bg: "#ff3d8b", ink: "#1a0610", accent: "#ffd76a" },
  mes: { bg: "#29e3ff", ink: "#04161b", accent: "#ff3d8b" },
  favoritos: { bg: "#7b5cff", ink: "#ffffff", accent: "#ffd76a" },
  primero: { bg: "#5dff8b", ink: "#03170a", accent: "#7b5cff" },
  perfil: { bg: "#ff9f1c", ink: "#1f0e00", accent: "#ffffff" },
  ludoteca: { bg: "#3d7bff", ink: "#ffffff", accent: "#ffd76a" },
  resumen: { bg: "#12101f", ink: "#f3ead2", accent: "#ffd76a" },
};

type Screen = { key: string; label: string; body: ReactNode };

const REDUCE = "(prefers-reduced-motion: reduce)";
/** Si se pidió «Reducir movimiento» (y avisa si cambia). */
function useReducedMotion() {
  return useSyncExternalStore(
    (on) => {
      const media = window.matchMedia(REDUCE);
      media.addEventListener("change", on);
      return () => media.removeEventListener("change", on);
    },
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );
}

/** Una cifra que sube como una puntuación hasta su número (con movimiento reducido, directa). */
function Score({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [counted, setCounted] = useState(0);
  const shown = reduce || value === 0 ? value : counted;
  useEffect(() => {
    if (reduce || value === 0) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setCounted(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return (
    <span className={className} data-cifra={value}>
      {shown}
    </span>
  );
}

/** Carátulas que entran volando, una detrás de otra. */
function Flying({ games, size = "big" }: { games: WrapGame[]; size?: "big" | "small" }) {
  return (
    <span className={`${styles.flying} ${size === "small" ? styles.flyingSmall : ""}`} aria-hidden>
      {games.map((g, i) => (
        <span key={g.id} className={styles.flyer} style={{ "--i": i } as CSSProperties}>
          <Cover src={g.coverUrl} title={g.title} caption="" className={styles.flyerCover} />
        </span>
      ))}
    </span>
  );
}

function GameCard({ game, label, note, i }: { game: WrapGame; label: string; note?: string; i: number }) {
  return (
    <figure className={styles.gameCard} style={{ "--i": i } as CSSProperties}>
      <Cover src={game.coverUrl} title={game.title} caption="" className={styles.cardCover} />
      <figcaption>
        <span className={styles.cardLabel}>{label}</span>
        <strong>{game.title}</strong>
        <span className={styles.cardMeta}>{[note, game.date && formatDate(game.date)].filter(Boolean).join(" · ")}</span>
      </figcaption>
    </figure>
  );
}

/** Las pantallas del año, solo las que tienen algo que contar. */
function buildScreens(data: YearWrapData, before: YearWrapData | null, summary: ReactNode): Screen[] {
  const { year } = data;
  const screens: Screen[] = [
    {
      key: "portada",
      label: `Tu ${year}`,
      body: (
        <>
          <p className={styles.kicker}>Ludoteca presenta</p>
          <h2 className={styles.mega}>
            Tu <Score value={year} />
          </h2>
          {data.finishedCovers.length > 0 && <Flying games={data.finishedCovers.slice(0, 5)} />}
          <p className={styles.lead}>Un año de partidas. Pulsa para empezar.</p>
        </>
      ),
    },
  ];
  if (data.finished.games > 0) {
    const compare = compareLine(data.finished.games, before?.finished.games, year - 1);
    screens.push({
      key: "terminados",
      label: "Terminaste",
      body: (
        <>
          <p className={styles.kicker}>En {year} terminaste</p>
          <p className={styles.giant}>
            <Score value={data.finished.games} />
          </p>
          <p className={styles.headline}>{data.finished.games === 1 ? "juego" : "juegos"}</p>
          {data.finished.replays > 0 && <p className={styles.lead}>y rejugaste {count(data.finished.replays, "vez", "veces")}</p>}
          {compare && <p className={styles.badge}>¡{compare}!</p>}
        </>
      ),
    });
  }
  if (data.bestMonth != null) {
    const max = Math.max(...data.byMonth);
    // Si varios meses empatan, todos son tu mes.
    const best = data.byMonth.flatMap((n, m) => (n === max ? [m] : []));
    const names = best.map(monthName);
    const joined = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0];
    screens.push({
      key: "mes",
      label: best.length > 1 ? "Tus meses" : "Tu mes",
      body: (
        <>
          <p className={styles.kicker}>{best.length > 1 ? "Tus meses" : "Tu mes"} de vicio</p>
          <h2 className={styles.headline}>{capital(joined)}</h2>
          <p className={styles.lead}>
            {count(max, "juego terminado", "juegos terminados")}
            {best.length > 1 ? " en cada uno" : ""}
          </p>
          <ol className={styles.months} aria-label="Terminados por mes">
            {data.byMonth.map((n, m) => (
              <li key={m} data-fuerte={best.includes(m) || undefined} aria-label={`${capital(monthName(m))}: ${n}`} style={{ "--i": m } as CSSProperties}>
                <span className={styles.bar} style={{ "--h": max ? n / max : 0 } as CSSProperties} />
                <span className={styles.monthLabel}>{monthName(m).slice(0, 3)}</span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }
  if (data.favorites.length > 0) {
    screens.push({
      key: "favoritos",
      label: "Favoritos",
      body: (
        <>
          <p className={styles.kicker}>Tu podio del año</p>
          <div className={styles.cards}>
            {data.favorites.map((g, i) => (
              <GameCard key={g.id} game={g} label={`#${i + 1}`} note={`Tu nota: ${formatNumber(g.rating ?? 0)}`} i={i} />
            ))}
          </div>
        </>
      ),
    });
  }
  if (data.first && data.last) {
    const same = data.last.id === data.first.id && data.last.date === data.first.date;
    screens.push({
      key: "primero",
      label: "Primero y último",
      body: (
        <>
          <p className={styles.kicker}>Primero y último</p>
          <div className={styles.cards}>
            <GameCard game={data.first} label="Abriste el año con" i={0} />
            {!same && <GameCard game={data.last} label="Y lo cerraste con" i={1} />}
          </div>
        </>
      ),
    });
  }
  if (data.profile.genres.length > 0) {
    screens.push({
      key: "perfil",
      label: "Tu perfil",
      body: (
        <>
          <p className={styles.kicker}>Tu perfil de jugadora</p>
          {data.profile.line && <h2 className={styles.headline}>{data.profile.line}</h2>}
          <ul className={styles.chips}>
            {data.profile.genres.map((g, i) => (
              <li key={g} style={{ "--i": i } as CSSProperties}>
                {g}
              </li>
            ))}
            {data.profile.family && <li style={{ "--i": 3 } as CSSProperties}>{data.profile.family}</li>}
            {data.profile.moods.map((m, i) => (
              <li key={m} style={{ "--i": 4 + i } as CSSProperties}>
                {MOOD_LABEL[m]}
              </li>
            ))}
          </ul>
        </>
      ),
    });
  }
  if (data.library.copies > 0) {
    const l = data.library;
    screens.push({
      key: "ludoteca",
      label: "Tu ludoteca creció",
      body: (
        <>
          <p className={styles.kicker}>Tu ludoteca creció</p>
          <p className={styles.giant}>
            +<Score value={l.copies} />
          </p>
          <p className={styles.headline}>{l.copies === 1 ? "copia" : "copias"}</p>
          <p className={styles.lead}>
            {count(l.newGames, "juego nuevo", "juegos nuevos")}
            {l.spent > 0 ? ` · ${formatMoney(l.spent)}` : ""}
            {l.gifts > 0 ? ` · ${count(l.gifts, "regalo", "regalos")}` : ""}
            {l.free > 0 ? ` · ${l.free} gratis` : ""}
          </p>
          {l.undatedCopies > 0 && <p className={styles.small}>{count(l.undatedCopies, "copia no tiene", "copias no tienen")} fecha de compra y no cuenta.</p>}
        </>
      ),
    });
  }
  screens.push({ key: "resumen", label: "Tu año en una tarjeta", body: summary });
  return screens;
}

/**
 * El año del Anuario a pantalla completa, como un Wrapped: cada pantalla con su color, y pasan solas (6 s) con la
 * barra de arriba. Tocar a la izquierda vuelve, a la derecha sigue; mantener pulsado o «Pausar» para. También ←/→,
 * espacio y Esc. Si el año está congelado, se enseña tal cual se guardó; si no, se calcula en vivo.
 */
export function YearStory({ year }: { year: number }) {
  const { library, actions } = useLibrary();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const press = useRef<{ x: number; at: number } | null>(null);
  const holdTimer = useRef<number | null>(null);

  const frozen = library.wraps.find((w) => w.year === year) ?? null;
  const data = frozen?.data ?? computeYear(library, year);
  const before = library.wraps.find((w) => w.year === year - 1)?.data ?? computeYear(library, year - 1);
  const current = new Date().getFullYear() === year;
  const empty = !frozen && !hasActivity(data);

  const action = frozen ? "Volver a calcular" : current ? "Cerrar el año" : "Guardar este año";
  const warning = frozen
    ? `Se sustituye el ${year} guardado por lo que dicen ahora tus datos.`
    : current
      ? `Se guarda tu ${year} tal como está hoy: lo que pase después no contará.`
      : `Se guarda tu ${year} tal como está: luego no cambiará aunque edites juegos.`;

  const summary = (
    <>
      <p className={styles.kicker}>Tu {year} en una tarjeta</p>
      <div className={styles.summaryCard}>
        {data.finishedCovers.length > 0 && <Flying games={data.finishedCovers.slice(0, 4)} size="small" />}
        <dl className={styles.summary}>
          <dt>Terminados</dt>
          <dd>{data.finished.games}</dd>
          <dt>Empezados</dt>
          <dd>{data.started}</dd>
          <dt>Copias nuevas</dt>
          <dd>{data.library.copies}</dd>
          {data.favorites[0] && (
            <>
              <dt>Tu favorito</dt>
              <dd>{data.favorites[0].title}</dd>
            </>
          )}
          {data.profile.genres[0] && (
            <>
              <dt>Tu género</dt>
              <dd>{data.profile.genres[0]}</dd>
            </>
          )}
        </dl>
        <p className={styles.status}>{frozen ? `Guardado el ${formatDate(frozen.frozenAt.slice(0, 10))}` : current ? "En curso" : "Sin guardar"}</p>
      </div>
      <div className={styles.actions}>
        {!confirming && (
          <button type="button" className="btn btn-ink" onClick={() => setConfirming(true)}>
            {action}
          </button>
        )}
        <Link href="/anuario" className="btn">
          Ver todos los años
        </Link>
      </div>
      {confirming && (
        <div className={styles.confirm} role="alert">
          <p>{warning}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className="btn btn-ink"
              onClick={() => {
                actions.freezeYear(year);
                setConfirming(false);
              }}
            >
              {action}
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
  const screens = buildScreens(data, before, summary);
  const last = screens.length - 1;
  const at = Math.min(index, last);
  const screen = screens[at];
  const palette = PALETTE[screen.key];
  const go = (i: number) => {
    setConfirming(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(last, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) setPaused((p) => !p);
      else if (e.key === "Escape") router.push("/anuario");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, router]);

  // A pantalla completa: la página de detrás no se desplaza.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, []);

  if (empty) {
    return (
      <div className={styles.page}>
        <section className={`window ${styles.emptyYear}`} aria-label={`Anuario ${year}`}>
          <h1 className="screen-title">{year}</h1>
          <p>No hay nada de {year} en tu ludoteca.</p>
          <Link href="/anuario" className="btn">
            Ver todos los años
          </Link>
        </section>
      </div>
    );
  }

  const stopped = paused || holding || at === last;
  /** Mantener pulsado para (y entonces soltar no pasa de pantalla); deslizar pasa hacia ese lado. */
  const tapGestures = {
    onPointerDown: (e: React.PointerEvent) => {
      press.current = { x: e.clientX, at: performance.now() };
      holdTimer.current = window.setTimeout(() => setHolding(true), 220);
    },
    onPointerUp: () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      setHolding(false);
    },
    onPointerCancel: () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      press.current = null;
      setHolding(false);
    },
    onClickCapture: (e: React.MouseEvent) => {
      const p = press.current;
      press.current = null;
      if (!p) return;
      const dx = e.clientX - p.x;
      if (performance.now() - p.at > 220 || Math.abs(dx) > 50) {
        e.preventDefault();
        e.stopPropagation();
        if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
      }
    },
  };
  return (
    <div
      className={styles.stage}
      data-anuario=""
      style={{ "--bg": palette.bg, "--ink": palette.ink, "--accent": palette.accent } as CSSProperties}
    >
      <div className={styles.pixels} aria-hidden />
      <div className={styles.topLine}>
        <ol className={styles.dots} aria-hidden>
          {screens.map((s, i) => (
            <li key={s.key} data-hecha={i < at || undefined}>
              {i === at && (
                <span
                  key={at}
                  className={styles.fill}
                  data-quieta={at === last || undefined}
                  style={{ animationDuration: `${SCREEN_MS}ms`, animationPlayState: stopped ? "paused" : "running" }}
                  onAnimationEnd={() => go(at + 1)}
                />
              )}
            </li>
          ))}
        </ol>
        <button type="button" className={styles.round} aria-label={paused ? "Seguir" : "Pausar"} onClick={() => setPaused((p) => !p)}>
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
        </button>
        <Link href="/anuario" className={styles.round} aria-label="Cerrar">
          <X aria-hidden />
        </Link>
      </div>

      <section key={screen.key} className={`anuario-pantalla ${styles.screen}`} aria-label={`Pantalla ${at + 1} de ${screens.length}`}>
        <h2 className="sr-only">{screen.label}</h2>
        <div className={styles.body}>{screen.body}</div>
      </section>

      {/* Tocar: el tercio izquierdo vuelve, el resto sigue; mantener pulsado para, y deslizar también pasa. */}
      <button type="button" className={`${styles.tap} ${styles.tapBack}`} aria-label="Anterior" disabled={at === 0} onClick={() => go(at - 1)} {...tapGestures} />
      <button type="button" className={`${styles.tap} ${styles.tapNext}`} aria-label="Siguiente" disabled={at === last} onClick={() => go(at + 1)} {...tapGestures} />
    </div>
  );
}
