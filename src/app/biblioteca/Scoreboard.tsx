import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import type { LibraryEntry } from "@/lib/filters";
import { formatNumber, relativeDay } from "@/lib/format";
import { formatHours } from "@/lib/recommend";
import { ARCADE_STATUS } from "./arcade";
import { copyDetail } from "./Cabinet";
import styles from "./library.module.css";

const HISCORE_ROWS = 6;

/** El juego por el que pasas: sus datos sin salir de la biblioteca. */
export function Chosen({ entry }: { entry?: LibraryEntry }) {
  if (!entry) return null;
  const { game, copies } = entry;
  const status = ARCADE_STATUS[game.status];
  const platforms = [...new Set(copies.map((c) => c.platform))].join(" + ");
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
      <dl className={styles.stats}>
        <dt>Horas</dt>
        <dd>{game.hoursPlayed ? formatHours(game.hoursPlayed) : "---"}</dd>
        <dt>Tu nota</dt>
        <dd>{game.rating != null ? formatNumber(game.rating) : "---"}</dd>
        <dt>Última partida</dt>
        <dd>{game.lastPlayedAt ? relativeDay(game.lastPlayedAt) : "---"}</dd>
      </dl>
      <Link href={`/juego/${game.id}`} className={styles.start}>
        Pulsa start ▶ ficha
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
      <h2 className={styles.boxHead}>Hi-score · horas</h2>
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
