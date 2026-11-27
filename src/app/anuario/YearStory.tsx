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
const listed = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}` : (items[0] ?? ""));
/** Lo que dura cada pantalla antes de pasar sola a la siguiente. */
const SCREEN_MS = 6000;

/**
 * Cada pantalla, su color: un Wrapped con el alma arcade de la Ludoteca. `mark` es el color de su fila en la tabla de
 * récords del final, legible sobre el fondo oscuro, para que el resumen recuerde cada pantalla.
 */
const PALETTE: Record<string, { bg: string; ink: string; accent: string; mark: string }> = {
  portada: { bg: "#ffd76a", ink: "#1b1400", accent: "#ff3d8b", mark: "#ffd76a" },
  terminados: { bg: "#ff3d8b", ink: "#1a0610", accent: "#ffd76a", mark: "#ff6ea8" },
  mes: { bg: "#29e3ff", ink: "#04161b", accent: "#ff3d8b", mark: "#29e3ff" },
  favoritos: { bg: "#7b5cff", ink: "#ffffff", accent: "#ffd76a", mark: "#a993ff" },
  primero: { bg: "#5dff8b", ink: "#03170a", accent: "#7b5cff", mark: "#5dff8b" },
  perfil: { bg: "#ff9f1c", ink: "#1f0e00", accent: "#ffffff", mark: "#ffb350" },
  ludoteca: { bg: "#3d7bff", ink: "#ffffff", accent: "#ffd76a", mark: "#7fa6ff" },
  resumen: { bg: "#12101f", ink: "#f3ead2", accent: "#ffd76a", mark: "#f3ead2" },
  logros: { bg: "#00c2a8", ink: "#021a16", accent: "#ffd76a", mark: "#3de0c8" },
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
function Score({ value }: { value: number }) {
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
  return <span data-cifra={value}>{shown}</span>;
}

/** La cifra gigante: su tamaño se ajusta a cuántos caracteres tiene, para que «+124» quepa igual que «3» en el móvil. */
function Giant({ children, chars }: { children: ReactNode; chars: number }) {
  return (
    <span className={styles.giant} style={{ "--chars": Math.max(2, chars) } as CSSProperties}>
      {children}
    </span>
  );
}

/** Cada cifra del año cae como una pieza, una detrás de otra. */
function Digits({ text }: { text: string }) {
  return (
    <span className={styles.digits}>
      {[...text].map((d, i) => (
        <span key={i} className={styles.digit} style={{ "--i": i } as CSSProperties}>
          {d}
        </span>
      ))}
    </span>
  );
}

/** Carátulas que entran volando y quedan en abanico. */
function Fan({ games }: { games: WrapGame[] }) {
  return (
    <span className={styles.fan} aria-hidden>
      {games.map((g, i) => (
        <span key={g.id} className={styles.fanItem} style={{ "--i": i, "--n": games.length } as CSSProperties}>
          <Cover src={g.coverUrl} title={g.title} caption="" className={styles.fanCover} />
        </span>
      ))}
    </span>
  );
}

/** Una cinta de carátulas que cruza la pantalla sin fin (con movimiento reducido, quieta). */
function Belt({ games }: { games: WrapGame[] }) {
  const loop = [...games, ...games];
  return (
    <div className={styles.belt} aria-hidden>
      <div className={styles.beltTrack} style={{ "--n": games.length } as CSSProperties}>
        {loop.map((g, i) => (
          <Cover key={`${g.id}-${i}`} src={g.coverUrl} title={g.title} caption="" className={styles.beltCover} />
        ))}
      </div>
    </div>
  );
}

/** Corona de píxeles para el primero del podio. */
function Crown() {
  return (
    <svg className={styles.crown} viewBox="0 0 9 6" shapeRendering="crispEdges" aria-hidden>
      <g fill="#ffd76a">
        <rect x="0" y="0" width="1" height="1" />
        <rect x="4" y="0" width="1" height="1" />
        <rect x="8" y="0" width="1" height="1" />
        <rect x="0" y="1" width="2" height="1" />
        <rect x="3" y="1" width="3" height="1" />
        <rect x="7" y="1" width="2" height="1" />
        <rect x="0" y="2" width="9" height="4" />
      </g>
      <g fill="#ff3d8b">
        <rect x="2" y="3" width="1" height="1" />
        <rect x="4" y="3" width="1" height="1" />
        <rect x="6" y="3" width="1" height="1" />
      </g>
      <rect x="0" y="5" width="9" height="1" fill="#c99a2e" />
    </svg>
  );
}

/** Un juego con su carátula y su nombre (primero y último). */
function Fighter({ game, label, side }: { game: WrapGame; label: string; side: 1 | 2 }) {
  return (
    <figure className={styles.fighter} data-lado={side}>
      <Cover src={game.coverUrl} title={game.title} caption="" className={styles.fighterCover} />
      <figcaption>
        <span className={styles.fighterLabel}>{label}</span>
        <strong>{game.title}</strong>
        {game.date && <span className={styles.fighterDate}>{formatDate(game.date)}</span>}
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
          <h2 className={styles.title}>
            <span className={styles.titleTu}>Tu</span> <Digits text={String(year)} />
          </h2>
          {data.finishedCovers.length > 0 && <Fan games={data.finishedCovers.slice(0, 5)} />}
          <p className={styles.lead}>Un año de partidas, pantalla a pantalla.</p>
          <p className={styles.blink}>Pulsa para empezar</p>
        </>
      ),
    },
  ];
  if (data.finished.games > 0) {
    const n = data.finished.games;
    const compare = compareLine(n, before?.finished.games, year - 1);
    screens.push({
      key: "terminados",
      label: "Terminaste",
      body: (
        <>
          <h2 className={styles.sentence}>
            <span className={styles.line}>Este año terminaste</span>
            <span className={styles.giantRow}>
              <Giant chars={String(n).length}>
                <Score value={n} />
              </Giant>{" "}
              <span className={styles.unit}>{n === 1 ? "juego" : "juegos"}</span>
            </span>
          </h2>
          {(compare || data.finished.replays > 0) && (
            <p className={styles.aside}>
              {compare && <span className={styles.sticker}>¡{compare}!</span>}
              {data.finished.replays > 0 && <span className={styles.lead}>Y rejugaste {count(data.finished.replays, "vez", "veces")}.</span>}
            </p>
          )}
          {data.finishedCovers.length > 0 && <Belt games={data.finishedCovers} />}
        </>
      ),
    });
  }
  if (data.achievements) {
    const { count: n, completed, rarest } = data.achievements;
    screens.push({
      key: "logros",
      label: "Tus logros",
      body: (
        <>
          <h2 className={styles.sentence}>
            <span className={styles.line}>Este año conseguiste</span>
            <span className={styles.giantRow}>
              <Giant chars={String(n).length}>
                <Score value={n} />
              </Giant>{" "}
              <span className={styles.unit}>{n === 1 ? "logro" : "logros"}</span>
            </span>
          </h2>
          {(rarest || completed.length > 0) && (
            <p className={styles.aside}>
              {rarest && (
                <span className={styles.sticker}>
                  Tu más raro: «{rarest.name}» ({rarest.title}), {formatNumber(rarest.percent)} %
                </span>
              )}
              {completed.length > 0 && <span className={styles.lead}>Completaste al 100 %: {listed(completed.map((g) => g.title))}.</span>}
            </p>
          )}
        </>
      ),
    });
  }
  if (data.bestMonth != null) {
    const max = Math.max(...data.byMonth);
    // Si varios meses empatan, todos son tu mes.
    const best = data.byMonth.flatMap((n, m) => (n === max ? [m] : []));
    screens.push({
      key: "mes",
      label: best.length > 1 ? "Tus meses" : "Tu mes",
      body: (
        <>
          <h2 className={styles.sentence}>
            <span className={styles.line}>{best.length > 1 ? "Tus meses de vicio" : "Tu mes de vicio"}</span>
            <span className={styles.big}>{capital(listed(best.map(monthName)))}</span>
          </h2>
          <p className={styles.lead}>
            {count(max, "juego terminado", "juegos terminados")}
            {best.length > 1 ? " en cada uno" : ""}
          </p>
          <ol className={styles.months} aria-label="Terminados por mes">
            {data.byMonth.map((n, m) => (
              <li key={m} data-fuerte={best.includes(m) || undefined} aria-label={`${capital(monthName(m))}: ${n}`} style={{ "--i": m } as CSSProperties}>
                <span className={styles.barWrap} style={{ "--h": max ? n / max : 0 } as CSSProperties}>
                  <span className={styles.bar} />
                  {best.includes(m) && (
                    <span className={styles.barCount} aria-hidden>
                      {n}
                    </span>
                  )}
                </span>
                <span className={styles.monthLabel} aria-hidden>
                  <span className={styles.monthLong}>{monthName(m).slice(0, 3)}</span>
                  <span className={styles.monthShort}>{monthName(m).charAt(0)}</span>
                </span>
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
          <h2 className={styles.line}>Tu podio del año</h2>
          <ol className={styles.podium} aria-label="Tu podio del año">
            {data.favorites.map((g, i) => (
              <li key={g.id} data-puesto={i + 1}>
                <div className={styles.podiumGame}>
                  {i === 0 && <Crown />}
                  <Cover src={g.coverUrl} title={g.title} caption="" className={styles.podiumCover} />
                  <p className={styles.podiumName}>
                    <strong>{g.title}</strong>
                    <span>Tu nota: {formatNumber(g.rating ?? 0)}</span>
                  </p>
                </div>
                <span className={styles.step}>
                  <span className="sr-only">Puesto </span>
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>
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
          <h2 className={styles.line}>Primero y último</h2>
          <div className={styles.versus} data-solo={same || undefined}>
            {!same && <span className={styles.versusSplit} aria-hidden />}
            <Fighter game={data.first} label="Abriste el año con" side={1} />
            {!same && (
              <>
                <span className={styles.vs} aria-hidden>
                  VS
                </span>
                <Fighter game={data.last} label="Y lo cerraste con" side={2} />
              </>
            )}
          </div>
        </>
      ),
    });
  }
  if (data.profile.genres.length > 0) {
    const p = data.profile;
    const avatar = data.favorites[0] ?? data.finishedCovers[0];
    const rows: [string, string][] = [
      ["Género estrella", p.genres[0]],
      ...(p.genres.length > 1 ? [["También", listed(p.genres.slice(1))] as [string, string]] : []),
      ...(p.family ? [["Plataforma", p.family] as [string, string]] : []),
      ...(p.moods.length > 0 ? [["Lo que buscabas", listed(p.moods.map((m) => MOOD_LABEL[m]))] as [string, string]] : []),
    ];
    screens.push({
      key: "perfil",
      label: "Tu perfil",
      body: (
        <>
          <h2 className={styles.big}>{p.line ?? "Tu perfil de jugadora"}</h2>
          <div className={styles.sheet}>
            {avatar && <Cover src={avatar.coverUrl} title={avatar.title} caption="" className={styles.sheetAvatar} />}
            <div className={styles.sheetBody}>
              <p className={styles.sheetTitle}>Ficha de jugadora</p>
              <dl className={styles.sheetRows}>
                {rows.map(([term, value], i) => (
                  <div key={term} style={{ "--i": i } as CSSProperties}>
                    <dt>{term}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </>
      ),
    });
  }
  if (data.library.copies > 0) {
    const l = data.library;
    const tags = [
      count(l.newGames, "juego nuevo", "juegos nuevos"),
      ...(l.spent > 0 ? [`${formatMoney(l.spent)} gastados`] : []),
      ...(l.gifts > 0 ? [count(l.gifts, "regalo", "regalos")] : []),
      ...(l.free > 0 ? [`${l.free} gratis`] : []),
    ];
    screens.push({
      key: "ludoteca",
      label: "Tu ludoteca creció",
      body: (
        <>
          <h2 className={styles.sentence}>
            <span className={styles.line}>Tu ludoteca creció</span>
            <span className={styles.giantRow}>
              <Giant chars={String(l.copies).length + 1}>
                <span className={styles.popup}>
                  +<Score value={l.copies} />
                </span>
              </Giant>{" "}
              <span className={styles.unit}>{l.copies === 1 ? "copia" : "copias"}</span>
            </span>
          </h2>
          <ul className={styles.tags}>
            {tags.map((t, i) => (
              <li key={t} style={{ "--i": i } as CSSProperties}>
                {t}
              </li>
            ))}
          </ul>
          {l.undatedCopies > 0 && <p className={styles.small}>{count(l.undatedCopies, "copia no tiene", "copias no tienen")} fecha de compra y no cuenta.</p>}
        </>
      ),
    });
  }
  screens.push({ key: "resumen", label: "Tu año en una tarjeta", body: summary });
  return screens;
}

/**
 * El año del Anuario a pantalla completa, como un Wrapped: cada pantalla con su color y su propia escena, y pasan solas
 * (6 s) con la barra de arriba. Cada pantalla nueva barre la anterior en bloques, desde el lado hacia el que vas.
 * Tocar a la izquierda vuelve, a la derecha sigue; mantener pulsado o «Pausar» para. También ←/→, espacio y Esc. Si el
 * año está congelado, se enseña tal cual se guardó; si no, se calcula en vivo.
 */
export function YearStory({ year }: { year: number }) {
  const { library, actions } = useLibrary();
  const router = useRouter();
  // La pantalla actual y de la que se viene: su color queda debajo mientras la nueva la barre.
  const [nav, setNav] = useState({ at: 0, from: 0 });
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

  const poster = data.favorites[0] ?? data.finishedCovers[0] ?? null;
  const marks: { label: string; value: ReactNode; screen: string }[] = [
    { label: "Terminados", value: data.finished.games, screen: "terminados" },
    { label: "Empezados", value: data.started, screen: "mes" },
    { label: "Copias nuevas", value: data.library.copies, screen: "ludoteca" },
    ...(data.favorites[0] ? [{ label: "Tu favorito", value: data.favorites[0].title, screen: "favoritos" }] : []),
    ...(data.profile.genres[0] ? [{ label: "Tu género", value: data.profile.genres[0], screen: "perfil" }] : []),
  ];
  const summary = (
    <>
      <div className={styles.records}>
        {poster && (
          <figure className={styles.poster} aria-hidden>
            <Cover src={poster.coverUrl} title={poster.title} caption="" className={styles.posterCover} />
          </figure>
        )}
        <div className={styles.recordsBody}>
          <h2 className={styles.recordsTitle}>Tu {year}</h2>
          <p className={styles.recordsSub}>Mejores marcas</p>
          <dl className={styles.scores}>
            {marks.map((m, i) => (
              <div key={m.label} style={{ "--i": i, "--mark": PALETTE[m.screen].mark } as CSSProperties}>
                <dt>{m.label}</dt>
                <dd>{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.status}>{frozen ? `Guardado el ${formatDate(frozen.frozenAt)}` : current ? "En curso" : "Sin guardar"}</p>
        </div>
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
  const at = Math.min(nav.at, last);
  const from = Math.min(nav.from, last);
  const screen = screens[at];
  const palette = PALETTE[screen.key];
  const move = (to: (at: number) => number) =>
    setNav((n) => {
      const next = Math.max(0, Math.min(last, to(n.at)));
      return next === n.at ? n : { at: next, from: n.at };
    });
  const go = (i: number) => {
    setConfirming(false);
    move(() => i);
  };

  useEffect(() => {
    const step = (to: (at: number) => number) =>
      setNav((n) => {
        const next = Math.max(0, Math.min(last, to(n.at)));
        return next === n.at ? n : { at: next, from: n.at };
      });
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") step((i) => i + 1);
      else if (e.key === "ArrowLeft") step((i) => i - 1);
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
      style={
        {
          "--bg": palette.bg,
          "--ink": palette.ink,
          "--accent": palette.accent,
          "--under": PALETTE[screens[from].key].bg,
        } as CSSProperties
      }
    >
      <section
        key={screen.key}
        className={`anuario-pantalla ${styles.screen}`}
        data-pantalla={screen.key}
        data-dir={at < from ? "atras" : "adelante"}
        aria-label={`Pantalla ${at + 1} de ${screens.length}`}
      >
        <h2 className="sr-only">{screen.label}</h2>
        <div className={styles.body}>{screen.body}</div>
      </section>
      <div className={styles.scan} aria-hidden />

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

      {/* Tocar: el tercio izquierdo vuelve, el resto sigue; mantener pulsado para, y deslizar también pasa. */}
      <button type="button" className={`${styles.tap} ${styles.tapBack}`} aria-label="Anterior" disabled={at === 0} onClick={() => go(at - 1)} {...tapGestures} />
      <button type="button" className={`${styles.tap} ${styles.tapNext}`} aria-label="Siguiente" disabled={at === last} onClick={() => go(at + 1)} {...tapGestures} />
    </div>
  );
}
