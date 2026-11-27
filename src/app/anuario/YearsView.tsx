"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Cover } from "@/components/ui/Cover";
import { type WrapGame, type YearWrapData, activeYears, computeYear } from "@/lib/anuario";
import { formatDate } from "@/lib/format";
import { useLibrary } from "@/lib/store";
import styles from "./anuario.module.css";
import { yearColor } from "./colors";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Las carátulas del año en abanico. */
export function CoverFan({ games, className }: { games: WrapGame[]; className?: string }) {
  if (games.length === 0) return null;
  return (
    <span className={`${styles.coverFan} ${className ?? ""}`} aria-hidden>
      {games.map((g, i) => (
        <span key={g.id} className={styles.coverFanItem} style={{ "--i": i, "--n": games.length } as CSSProperties}>
          <Cover src={g.coverUrl} title={g.title} caption="" className={styles.coverFanCover} />
        </span>
      ))}
    </span>
  );
}

const METRICS = [
  ["Terminados", (d: YearWrapData) => d.finished.games],
  ["Empezados", (d: YearWrapData) => d.started],
  ["Copias", (d: YearWrapData) => d.library.copies],
] as const;

/**
 * El Anuario: cada año es un cartucho de su color (el más reciente, en grande) que abre su Wrapped, y una tabla con
 * barras para ponerlos uno al lado del otro.
 */
export function YearsView() {
  const { library } = useLibrary();
  const thisYear = new Date().getFullYear();
  const years = [...new Set([...activeYears(library), ...library.wraps.map((w) => w.year)])].sort((a, b) => b - a);
  const rows = years.map((year) => {
    const frozen = library.wraps.find((w) => w.year === year) ?? null;
    const data: YearWrapData = frozen?.data ?? computeYear(library, year);
    const status = frozen ? `Guardado el ${formatDate(frozen.frozenAt)}` : year === thisYear ? "En curso" : "Sin guardar";
    return { year, data, status };
  });
  const max = METRICS.map(([, value]) => Math.max(1, ...rows.map((r) => value(r.data))));

  return (
    <div className={`${styles.page} ${styles.yearsPage}`}>
      <header className={styles.head}>
        <h1 className="screen-title">Anuario</h1>
        <p className={styles.note}>Tu año de juego, guardado como recuerdo. Cada año se guarda solo cuando acaba; el que está en curso se calcula con tus datos.</p>
      </header>

      {rows.length === 0 ? (
        <section className={`window ${styles.emptyYear}`} aria-label="Tus años">
          <p>Aún no hay ningún año que contar: cuando termines, empieces o compres juegos, aparecerá aquí.</p>
        </section>
      ) : (
        <>
          <section className={styles.years} aria-label="Tus años">
            {rows.map(({ year, data, status }, i) => {
              const color = yearColor(year);
              return (
                <Link
                  key={year}
                  href={`/anuario/${year}`}
                  className={styles.cartridge}
                  data-grande={i === 0 || undefined}
                  style={{ "--bg": color.bg, "--ink": color.ink, "--i": i } as CSSProperties}
                >
                  <strong className={styles.cartridgeYear}>{year}</strong>
                  <span className={styles.cartridgeStatus}>{status}</span>
                  <CoverFan games={data.finishedCovers.slice(0, i === 0 ? 5 : 4)} className={styles.cartridgeFan} />
                  <span className={styles.cartridgeFigures}>
                    {count(data.finished.games, "terminado", "terminados")} · {count(data.started, "empezado", "empezados")} ·{" "}
                    {count(data.library.copies, "copia", "copias")}
                  </span>
                  <span className={styles.cartridgePlay}>
                    Ver tu {year} <Play aria-hidden />
                  </span>
                </Link>
              );
            })}
          </section>

          {rows.length > 1 && (
            <div className={`window ${styles.tableBox}`}>
              <table className={styles.table}>
                <caption>Tus años, uno al lado del otro</caption>
                <thead>
                  <tr>
                    <th scope="col">Año</th>
                    {METRICS.map(([label]) => (
                      <th key={label} scope="col">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ year, data }) => (
                    <tr key={year} style={{ "--bg": yearColor(year).bg } as CSSProperties}>
                      <th scope="row">{year}</th>
                      {METRICS.map(([label, value], m) => (
                        <td key={label}>
                          <span className={styles.barCell}>
                            <span className={styles.miniBar} style={{ "--w": value(data) / max[m] } as CSSProperties} aria-hidden />
                            <span className={styles.barValue}>{value(data)}</span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
