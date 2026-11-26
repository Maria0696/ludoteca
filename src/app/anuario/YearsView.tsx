"use client";

import Link from "next/link";
import { Cover } from "@/components/ui/Cover";
import { type YearWrapData, activeYears, computeYear } from "@/lib/anuario";
import { formatDate } from "@/lib/format";
import { useLibrary } from "@/lib/store";
import styles from "./anuario.module.css";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** El Anuario: cada año con su estado y sus cifras, y una tabla para ponerlos uno al lado del otro. */
export function YearsView() {
  const { library } = useLibrary();
  const thisYear = new Date().getFullYear();
  const years = [...new Set([...activeYears(library), ...library.wraps.map((w) => w.year)])].sort((a, b) => b - a);
  const rows = years.map((year) => {
    const frozen = library.wraps.find((w) => w.year === year) ?? null;
    const data: YearWrapData = frozen?.data ?? computeYear(library, year);
    const status = frozen ? `Guardado el ${formatDate(frozen.frozenAt.slice(0, 10))}` : year === thisYear ? "En curso" : "Sin guardar";
    return { year, data, status };
  });

  return (
    <div className={styles.page}>
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
            {rows.map(({ year, data, status }) => (
              <Link key={year} href={`/anuario/${year}`} className={`window ${styles.yearCard}`}>
                <strong className={styles.yearNumber}>{year}</strong>
                <span className={styles.yearCovers} aria-hidden>
                  {data.finishedCovers.slice(0, 4).map((g) => (
                    <Cover key={g.id} src={g.coverUrl} title={g.title} caption="" className={styles.yearCover} />
                  ))}
                </span>
                <span className={styles.yearFigures}>
                  {count(data.finished.games, "terminado", "terminados")} · {count(data.started, "empezado", "empezados")} ·{" "}
                  {count(data.library.copies, "copia", "copias")}
                </span>
                <span className={styles.status}>{status}</span>
              </Link>
            ))}
          </section>

          {rows.length > 1 && (
            <div className={`window ${styles.tableBox}`}>
              <table className={styles.table}>
                <caption>Tus años, uno al lado del otro</caption>
                <thead>
                  <tr>
                    <td />
                    {rows.map(({ year }) => (
                      <th key={year} scope="col">
                        {year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Terminados", (d: YearWrapData) => d.finished.games],
                      ["Empezados", (d: YearWrapData) => d.started],
                      ["Copias", (d: YearWrapData) => d.library.copies],
                    ] as const
                  ).map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {rows.map(({ year, data }) => (
                        <td key={year}>{value(data)}</td>
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
