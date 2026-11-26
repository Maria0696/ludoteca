"use client";

import { Play } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { computeYear, hasActivity } from "@/lib/anuario";
import type { Library } from "@/lib/model";
import styles from "./anuario.module.css";
import { yearColor } from "./colors";
import { CoverFan } from "./YearsView";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** La banda que lleva al Wrapped del año en curso (en Estadísticas), si el año ya tiene algo que contar. */
export function AnuarioBanner({ library }: { library: Library }) {
  const year = new Date().getFullYear();
  const data = library.wraps.find((w) => w.year === year)?.data ?? computeYear(library, year);
  if (!hasActivity(data)) return null;
  const color = yearColor(year);
  return (
    <section className={styles.banner} aria-label={`Tu ${year} en el Anuario`} style={{ "--bg": color.bg, "--ink": color.ink } as CSSProperties}>
      <div className={styles.bannerText}>
        <p className={styles.bannerYear}>Tu {year}</p>
        <p className={styles.bannerFigures}>
          {count(data.finished.games, "terminado", "terminados")} · {count(data.started, "empezado", "empezados")} ·{" "}
          {count(data.library.copies, "copia nueva", "copias nuevas")}
        </p>
      </div>
      <CoverFan games={data.finishedCovers.slice(0, 5)} className={styles.bannerFan} />
      <Link href={`/anuario/${year}`} className={styles.bannerPlay}>
        Ver tu {year} <Play aria-hidden />
      </Link>
    </section>
  );
}
