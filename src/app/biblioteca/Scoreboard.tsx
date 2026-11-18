import { Fragment } from "react";
import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import type { LibraryEntry } from "@/lib/filters";
import { formatNumber, relativeDay } from "@/lib/format";
import { formatHours } from "@/lib/recommend";
import { ARCADE_STATUS } from "@/components/ui/StatusMark";
import { copyDetail } from "./Cabinet";
import styles from "./library.module.css";

const HISCORE_ROWS = 6;

/** El juego por el que pasas: sus datos sin salir de la biblioteca. */
export function Chosen({ entry }: { entry?: LibraryEntry }) {
  if (!entry) return null;
  const { game, copies } = entry;
  const status = ARCADE_STATUS[game.status];
  const platforms = [...new Set(copies.map((c) => c.platform))].join(" + ");
  // Solo los datos que hay: un juego sin empezar no enseña filas de «---».
  const rows: [string, string | null][] = [
    ["Horas", game.hoursPlayed ? formatHours(game.hoursPlayed) : null],
    ["Tu nota", game.rating != null ? formatNumber(game.rating) : null],
    ["Última partida", game.lastPlayedAt ? relativeDay(game.lastPlayedAt) : null],
  ];
  const stats = rows.filter((row): row is [string, string] => row[1] !== null);
  return (
    <section className={styles.box} aria-label="Elegido">
      <h2 className={styles.boxHead}>Elegido</h2>
      <div className={styles.chosen}>
        <Cover src={game.coverUrl} title={game.title} caption={copies[0]?.platform} className={styles.chosenCover} />
        <div>
          <p className={styles.chosenTitle}>{game.title}</p>
          <p>{[platforms, copyDetail(entry)].filter(Boolean).join(" · ")}</p>
          <p className={styles.chosenStatus} style={{ "--sc": status.color } as React.CSSProperties}>
            {status.label}
          </p>
        </div>
      </div>
      {stats.length > 0 ? (
        <dl className={styles.stats}>
          {stats.map(([label, value]) => (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p className={styles.noStats}>Sin partidas todavía</p>
      )}
      <Link href={`/juego/${game.id}`} className={styles.start}>
        Ver ficha ▶
      </Link>
    </section>
  );
}

/** Tabla de récords: los juegos con más horas de toda la colección. */
export function HiScore({ entries }: { entries: LibraryEntry[] }) {
  const top = entries
    .filter((e) => (e.game.hoursPlayed ?? 0) > 0)
    .sort((a, b) => (b.game.hoursPlayed ?? 0) - (a.game.hoursPlayed ?? 0))
    .slice(0, HISCORE_ROWS);
  if (top.length === 0) return null;
  return (
    <section className={styles.box} aria-label="Récords de horas">
      <h2 className={styles.boxHead}>Récords · horas</h2>
      <ol className={styles.hiscore}>
        {top.map(({ game }, i) => (
          <li key={game.id}>
            <span>{i + 1}º</span>
            <Link href={`/juego/${game.id}`}>{game.title}</Link>
            <span>{formatHours(game.hoursPlayed ?? 0)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
