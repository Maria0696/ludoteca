"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatMoney, formatNumber } from "@/lib/format";
import { GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { computeStats } from "@/lib/stats";
import { useLibrary } from "@/lib/store";
import styles from "./stats.module.css";

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export function StatsView() {
  const { library } = useLibrary();
  const s = useMemo(() => computeStats(library), [library]);
  const year = new Date().getFullYear();
  const hasDemo = library.games.some((g) => g.demo);
  const maxPlatform = Math.max(1, ...s.copiesByPlatform.map((p) => p.copies));
  const maxStatus = Math.max(1, ...GAME_STATUSES.map((st) => s.byStatus[st]));

  if (s.titles === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Estadísticas</h1>
        <div className="empty">
          <h2>Sin datos todavía</h2>
          <p>Las estadísticas se calculan con tu biblioteca. Añade juegos y aparecerán aquí.</p>
          <Link href="/biblioteca" className="btn btn-ink">
            Ir a la biblioteca
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>Estadísticas</h1>
        <p className="muted">
          Calculadas con lo que has registrado{hasDemo ? ", incluidos los datos de demostración" : ""}. Un título es un juego; una copia, cada
          ejemplar que tienes de él.
        </p>
      </header>

      <dl className={styles.kpis}>
        <Kpi label="Títulos" value={s.titles} note="Juegos distintos" />
        <Kpi label="Copias" value={s.copies} note={s.copies > s.titles ? `${s.copies - s.titles} títulos repetidos en otra copia` : "Una por título"} />
        <Kpi label="Jugando" value={s.byStatus.jugando} note="Marcados como «Jugando»" />
        <Kpi label="Pendientes" value={s.byStatus.pendiente} note="Sin empezar" />
        <Kpi label="Completados" value={s.byStatus.completado} note={`${s.completed100} al 100 %`} />
        <Kpi
          label={`Terminados en ${year}`}
          value={s.finishedThisYear}
          note={s.completedWithoutDate ? `${s.completedWithoutDate} completados sin fecha no cuentan` : "Con fecha de fin este año"}
        />
      </dl>

      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="h-plataformas">
          <h2 id="h-plataformas">Copias por plataforma</h2>
          <ul className={styles.bars}>
            {s.copiesByPlatform.map((p) => (
              <li key={p.platform}>
                <span className={styles.barLabel}>
                  <Link href={`/biblioteca?plataforma=${encodeURIComponent(p.platform)}`}>{p.platform}</Link>
                  <span className="num">
                    {p.copies} {p.copies === 1 ? "copia" : "copias"}
                    {p.titles !== p.copies && <small> · {p.titles} títulos</small>}
                  </span>
                </span>
                <span className={styles.track}>
                  <span className={styles.fill} style={{ width: `${(p.copies / maxPlatform) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="h-estado">
          <h2 id="h-estado">Títulos por estado</h2>
          <ul className={styles.bars}>
            {GAME_STATUSES.map((st) => (
              <li key={st}>
                <span className={styles.barLabel}>
                  <Link href={`/biblioteca?estado=${st}&agrupar=ninguno`}>{STATUS_LABEL[st]}</Link>
                  <span className="num">{s.byStatus[st]}</span>
                </span>
                <span className={styles.track}>
                  <span className={styles.fill} style={{ width: `${(s.byStatus[st] / maxStatus) * 100}%`, background: `var(--st-${st})` }} />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.panel} aria-labelledby="h-formato">
          <h2 id="h-formato">Formato de las copias</h2>
          <div className={styles.stack} role="img" aria-label={`${s.copiesByFormat.fisico} físicas y ${s.copiesByFormat.digital} digitales`}>
            <span style={{ flexGrow: s.copiesByFormat.fisico || 0.0001 }} className={styles.stackA} />
            <span style={{ flexGrow: s.copiesByFormat.digital || 0.0001 }} className={styles.stackB} />
          </div>
          <dl className={styles.legend}>
            <div>
              <dt>
                <i className={styles.stackA} /> Físico
              </dt>
              <dd className="num">
                {s.copiesByFormat.fisico} <small>{pct(s.copiesByFormat.fisico, s.copies)} %</small>
              </dd>
            </div>
            <div>
              <dt>
                <i className={styles.stackB} /> Digital
              </dt>
              <dd className="num">
                {s.copiesByFormat.digital} <small>{pct(s.copiesByFormat.digital, s.copies)} %</small>
              </dd>
            </div>
          </dl>
          <p className={styles.footnote}>Una copia digital con caja decorativa cuenta como digital.</p>
        </section>

        <section className={styles.panel} aria-labelledby="h-registro">
          <h2 id="h-registro">Horas y gasto registrados</h2>
          <dl className={styles.pair}>
            <div>
              <dt>Horas jugadas</dt>
              <dd className="num">{formatNumber(s.hours.total)} h</dd>
              <p className={styles.footnote}>
                {s.hours.missing
                  ? `Suma de ${s.hours.withData} juegos. Faltan horas en ${s.hours.missing}: el total real es mayor.`
                  : "Todos los juegos tienen horas registradas."}
              </p>
            </div>
            <div>
              <dt>Gasto</dt>
              <dd className="num">{formatMoney(s.spend.total)}</dd>
              <p className={styles.footnote}>
                {s.spend.missing
                  ? `Suma de ${s.spend.withData} copias compradas. Faltan precios en ${s.spend.missing}: el total real es mayor.`
                  : "Todas las copias compradas tienen precio."}{" "}
                No incluye copias prestadas ni de suscripción.
              </p>
            </div>
          </dl>
        </section>
      </div>

      <p className={`muted ${styles.extra}`}>
        {s.lentOut > 0 ? `${s.lentOut} ${s.lentOut === 1 ? "copia prestada" : "copias prestadas"} ahora mismo · ` : ""}
        {s.wishlist} {s.wishlist === 1 ? "juego" : "juegos"} en la lista de deseos
      </p>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
      <p>{note}</p>
    </div>
  );
}
