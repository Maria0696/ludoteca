"use client";

import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { type WrapGame, type YearWrapData, compareLine, computeYear, hasActivity } from "@/lib/anuario";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { MOOD_LABEL } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./anuario.module.css";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const monthName = (m: number) => new Date(2000, m, 1).toLocaleString("es-ES", { month: "long" });
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Screen = { key: string; title: string; body: ReactNode };

/** Carátulas en abanico, como en la lista de Sagas. */
function Fan({ games }: { games: WrapGame[] }) {
  return (
    <span className={styles.fan} aria-hidden>
      {games.map((g) => (
        <Cover key={g.id} src={g.coverUrl} title={g.title} caption="" className={styles.fanCover} />
      ))}
    </span>
  );
}

function GameCard({ game, label }: { game: WrapGame; label: string }) {
  return (
    <figure className={styles.gameCard}>
      <Cover src={game.coverUrl} title={game.title} caption="" className={styles.cardCover} />
      <figcaption>
        <span className={styles.cardLabel}>{label}</span>
        <strong>{game.title}</strong>
        {game.date && <span className={styles.cardMeta}>{formatDate(game.date, "long")}</span>}
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
      title: `Tu ${year}`,
      body: (
        <>
          {data.finishedCovers.length > 0 && <Fan games={data.finishedCovers.slice(0, 5)} />}
          <p className={styles.lead}>Tu año de juego en la Ludoteca.</p>
        </>
      ),
    },
  ];
  if (data.finished.games > 0) {
    const compare = compareLine(data.finished.games, before?.finished.games, year - 1);
    screens.push({
      key: "terminados",
      title: "Terminaste",
      body: (
        <>
          <p className={styles.big}>{data.finished.games}</p>
          <p className={styles.lead}>{data.finished.games === 1 ? "juego" : "juegos"}</p>
          {data.finished.replays > 0 && <p className={styles.note}>y {count(data.finished.replays, "vuelta", "vueltas")} de rejugar</p>}
          {compare && <p className={styles.compare}>{compare}</p>}
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
      title: best.length > 1 ? "Tus meses" : "Tu mes",
      body: (
        <>
          <p className={styles.lead}>
            {capital(joined)}: {count(max, "juego terminado", "juegos terminados")}
            {best.length > 1 ? " en cada uno" : ""}
          </p>
          <ol className={styles.months} aria-label="Terminados por mes">
            {data.byMonth.map((n, m) => (
              <li key={m} data-fuerte={best.includes(m) || undefined} aria-label={`${capital(monthName(m))}: ${n}`}>
                <span className={styles.bar} style={{ height: `${max ? (n / max) * 100 : 0}%` }} />
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
      title: "Favoritos",
      body: (
        <div className={styles.cards}>
          {data.favorites.map((g) => (
            <GameCard key={g.id} game={g} label={`Tu nota: ${formatNumber(g.rating ?? 0)}`} />
          ))}
        </div>
      ),
    });
  }
  if (data.first && data.last) {
    screens.push({
      key: "primero",
      title: "Primero y último",
      body: (
        <div className={styles.cards}>
          <GameCard game={data.first} label="El primero" />
          {data.last.id !== data.first.id || data.last.date !== data.first.date ? <GameCard game={data.last} label="El último" /> : null}
        </div>
      ),
    });
  }
  if (data.profile.genres.length > 0) {
    screens.push({
      key: "perfil",
      title: "Tu perfil",
      body: (
        <>
          {data.profile.line && <p className={styles.line}>{data.profile.line}</p>}
          <dl className={styles.facts}>
            <dt>Géneros</dt>
            <dd>{data.profile.genres.join(", ")}</dd>
            {data.profile.family && (
              <>
                <dt>Plataforma</dt>
                <dd>{data.profile.family}</dd>
              </>
            )}
            {data.profile.moods.length > 0 && (
              <>
                <dt>Tipo de experiencia</dt>
                <dd>{data.profile.moods.map((m) => MOOD_LABEL[m]).join(", ")}</dd>
              </>
            )}
          </dl>
        </>
      ),
    });
  }
  if (data.library.copies > 0) {
    const l = data.library;
    screens.push({
      key: "ludoteca",
      title: "Tu ludoteca creció",
      body: (
        <>
          <p className={styles.big}>{l.copies}</p>
          <p className={styles.lead}>{l.copies === 1 ? "copia nueva" : "copias nuevas"}</p>
          <dl className={styles.facts}>
            <dt>Juegos nuevos</dt>
            <dd>{l.newGames}</dd>
            {l.spent > 0 && (
              <>
                <dt>Gastaste</dt>
                <dd>{formatMoney(l.spent)}</dd>
              </>
            )}
            {l.gifts > 0 && (
              <>
                <dt>Regalos</dt>
                <dd>{l.gifts}</dd>
              </>
            )}
            {l.free > 0 && (
              <>
                <dt>Gratis</dt>
                <dd>{l.free}</dd>
              </>
            )}
          </dl>
          {l.undatedCopies > 0 && <p className={styles.note}>{count(l.undatedCopies, "copia no tiene", "copias no tienen")} fecha de compra y no cuenta.</p>}
        </>
      ),
    });
  }
  screens.push({ key: "resumen", title: "Tu año en una tarjeta", body: summary });
  return screens;
}

/**
 * El año del Anuario en pantallas que se pasan una a una (botones, ←/→, deslizar; Esc vuelve a los años). Si el año
 * está congelado, se enseña tal cual se guardó; si no, se calcula en vivo.
 */
export function YearStory({ year }: { year: number }) {
  const { library, actions } = useLibrary();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const touch = useRef<number | null>(null);

  const frozen = library.wraps.find((w) => w.year === year) ?? null;
  const data = frozen?.data ?? computeYear(library, year);
  const before = library.wraps.find((w) => w.year === year - 1)?.data ?? computeYear(library, year - 1);
  const current = new Date().getFullYear() === year;
  const empty = !frozen && !hasActivity(data);

  const freeze = () => {
    actions.freezeYear(year);
    setConfirming(false);
  };
  const action = frozen ? "Volver a calcular" : current ? "Cerrar el año" : "Guardar este año";
  const warning = frozen
    ? `Se sustituye el ${year} guardado por lo que dicen ahora tus datos.`
    : current
      ? `Se guarda tu ${year} tal como está hoy: lo que pase después no contará.`
      : `Se guarda tu ${year} tal como está: luego no cambiará aunque edites juegos.`;

  const summary = (
    <>
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
      </dl>
      <p className={styles.status}>{frozen ? `Guardado el ${formatDate(frozen.frozenAt.slice(0, 10))}` : current ? "En curso" : "Sin guardar"}</p>
      <div className={styles.actions}>
        {!confirming && (
          <button type="button" className="btn" onClick={() => setConfirming(true)}>
            {action}
          </button>
        )}
        <Link href="/anuario" className="btn btn-quiet">
          Ver todos los años
        </Link>
      </div>
      {confirming && (
        <div className={styles.confirm} role="alert">
          <p>{warning}</p>
          <div className={styles.actions}>
            <button type="button" className="btn btn-ink" onClick={freeze}>
              {action}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
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
  const go = (i: number) => {
    setConfirming(false);
    setIndex(Math.max(0, Math.min(last, i)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(last, i + 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      else if (e.key === "Escape") router.push("/anuario");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, router]);

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

  const screen = screens[at];
  return (
    <div className={styles.page}>
      <div className={styles.topLine}>
        <ol className={styles.dots} aria-hidden>
          {screens.map((s, i) => (
            <li key={s.key} data-hecha={i <= at || undefined} />
          ))}
        </ol>
        <Link href="/anuario" className="btn btn-quiet btn-icon" aria-label="Cerrar">
          <X aria-hidden />
        </Link>
      </div>
      <section
        key={screen.key}
        className={`window anuario-pantalla ${styles.screen}`}
        aria-label={`Pantalla ${at + 1} de ${screens.length}`}
        onPointerDown={(e) => (touch.current = e.clientX)}
        onPointerUp={(e) => {
          if (touch.current == null) return;
          const dx = e.clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 50) go(at + (dx < 0 ? 1 : -1));
        }}
      >
        <h2 className={styles.title}>{screen.title}</h2>
        <div className={styles.body}>{screen.body}</div>
      </section>
      <div className={styles.nav}>
        <button type="button" className="btn btn-quiet" aria-label="Anterior" disabled={at === 0} onClick={() => go(at - 1)}>
          <ArrowLeft aria-hidden />
          <span className={styles.navText}>Anterior</span>
        </button>
        <button type="button" className="btn" aria-label="Siguiente" disabled={at === last} onClick={() => go(at + 1)}>
          <span className={styles.navText}>Siguiente</span>
          <ArrowRight aria-hidden />
        </button>
      </div>
    </div>
  );
}
