"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { familyColor } from "@/app/biblioteca/arcade";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { type GameStatus, GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { computeStats } from "@/lib/stats";
import { useLibrary } from "@/lib/store";
import styles from "./stats.module.css";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const STATUS_COUNT: Record<GameStatus, [one: string, many: string]> = {
  pendiente: ["pendiente", "pendientes"],
  jugando: ["jugando", "jugando"],
  pausado: ["pausado", "pausados"],
  completado: ["completado", "completados"],
  abandonado: ["abandonado", "abandonados"],
};
const count = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const decadeLabel = (decade: number) => (decade < 2000 ? `Años ${String(decade).slice(2)}` : `${decade}s`);

/*
 * Estadísticas como la pantalla de récords de un juego: el marcador arriba, tu estantería y el año mes a mes,
 * lo útil (joyas por jugar, de dónde vienen, géneros) y, al final, la nota y el año de salida.
 * Las horas y el gasto, que casi nunca están completos, van en una línea que dice cuántos tienen el dato.
 */
export function StatsView() {
  const { library } = useLibrary();
  const s = useMemo(() => computeStats(library), [library]);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const hasDemo = library.games.some((g) => g.demo);

  if (s.titles === 0) {
    return (
      <div className={styles.page}>
        <h1 className="screen-title">Estadísticas</h1>
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

  const statuses = GAME_STATUSES.filter((st) => s.byStatus[st] > 0);
  // Un regalo, un juego gratis, uno de un pack o uno que no se sabe no son precios que falten.
  const reasons = s.spend.regalo + s.spend.gratis + s.spend.pack + s.spend.desconocido;
  const answered = s.spend.withData + reasons;
  const priceDetail =
    reasons > 0
      ? [
          `${formatNumber(s.spend.withData)} con precio`,
          s.spend.gratis > 0 && `${formatNumber(s.spend.gratis)} gratis`,
          s.spend.regalo > 0 && count(s.spend.regalo, "regalo", "regalos"),
          s.spend.pack > 0 && `${formatNumber(s.spend.pack)} en pack`,
          s.spend.desconocido > 0 && `${formatNumber(s.spend.desconocido)} sin saber`,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;
  const maxMonth = Math.max(1, ...s.finishedByMonth);
  const maxScore = Math.max(1, ...s.metacritic.buckets.map((b) => b.titles));
  const maxDecade = Math.max(1, ...s.decades.map((d) => d.titles));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="screen-title">Estadísticas</h1>
        <p>
          Calculadas con lo que has registrado,{hasDemo ? " incluidos los datos de demostración," : ""} contando cada juego como un título y cada
          ejemplar como una copia.
        </p>
      </header>

      <section className="window" aria-labelledby="h-marcador">
        <h2 id="h-marcador">Marcador</h2>
        <dl className={styles.board}>
          <div>
            <dt>Títulos</dt>
            <dd className="num">{formatNumber(s.titles)}</dd>
          </div>
          <div>
            <dt>Copias</dt>
            <dd className="num">{formatNumber(s.copies)}</dd>
          </div>
          <div>
            <dt>Por jugar</dt>
            <dd className="num" data-status="pendiente">
              {formatNumber(s.byStatus.pendiente - s.endless.pending)}
            </dd>
          </div>
          <div>
            <dt>Superados en {year}</dt>
            <dd className="num" data-status="completado">
              {formatNumber(s.finishedThisYear)}
            </dd>
          </div>
        </dl>
        {s.endless.pending > 0 && (
          <p className={styles.note}>
            «Por jugar» no cuenta {count(s.endless.pending, "juego sin final que aún no has empezado", "juegos sin final que aún no has empezado")}.
          </p>
        )}
        {s.completedWithoutDate > 0 && (
          <p className={styles.note}>
            {count(s.completedWithoutDate, "completado sin fecha de fin no cuenta", "completados sin fecha de fin no cuentan")} en «Superados en {year}».
          </p>
        )}
      </section>

      <div className={styles.hero}>
        <section className={`window ${styles.panel}`} aria-labelledby="h-estanteria">
          <h2 id="h-estanteria">Tu estantería</h2>
          <div
            className={styles.waffle}
            data-size={s.titles > 1000 ? "s" : undefined}
            role="img"
            aria-label={`${count(s.titles, "juego", "juegos")}: ${statuses.map((st) => count(s.byStatus[st], ...STATUS_COUNT[st])).join(", ")}${
              s.endless.total > 0 ? `; ${count(s.endless.total, "sin final", "sin final")}` : ""
            }`}
          >
            {/* Los sin final, al final de su estado y huecos: no se terminan, se juegan. */}
            {statuses.flatMap((st) =>
              Array.from({ length: s.byStatus[st] }, (_, i) => (
                <i key={`${st}-${i}`} data-status={st} data-endless={i >= s.byStatus[st] - s.endless.byStatus[st] || undefined} />
              )),
            )}
          </div>
          <ul className={styles.legend}>
            {statuses.map((st) => (
              <li key={st}>
                <Link href={`/biblioteca?estado=${st}&agrupar=ninguno`}>
                  <i data-status={st} aria-hidden />
                  {STATUS_LABEL[st]} {formatNumber(s.byStatus[st])}
                </Link>
              </li>
            ))}
            {s.endless.total > 0 && (
              <li className={styles.endlessKey}>
                <i aria-hidden />
                Sin final {formatNumber(s.endless.total)}
              </li>
            )}
          </ul>
          <p className={styles.note}>
            Cada cuadro es un juego{s.completed100 > 0 ? `; ${count(s.completed100, "completado al 100 %", "completados al 100 %")}` : ""}.
          </p>
        </section>

        <section className={`window ${styles.panel}`} aria-labelledby="h-meses">
          <h2 id="h-meses">Superados mes a mes</h2>
          <div
            className={styles.cols}
            role="img"
            aria-label={`Juegos superados cada mes de ${year}: ${s.finishedByMonth
              .slice(0, month)
              .map((n, i) => `${MONTHS[i]} ${n}`)
              .join(", ")}`}
          >
            {s.finishedByMonth.map((n, i) => (
              <div key={MONTHS[i]} className={styles.col} data-month={i + 1} data-count={n} data-now={i + 1 === month || undefined} data-future={i + 1 > month || undefined}>
                {n > 0 && <b className="num">{n}</b>}
                <i data-tone="completado" style={{ height: `${(n / maxMonth) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className={styles.colx} aria-hidden>
            {MONTHS.map((m, i) => (
              <span key={m} data-now={i + 1 === month || undefined}>
                {m[0].toUpperCase()}
              </span>
            ))}
          </div>
          <p className={styles.note}>
            {s.lastFinished ? (
              <>
                El último: <Link href={`/juego/${s.lastFinished.id}`}>{s.lastFinished.title}</Link>, el {formatDate(s.lastFinished.finishedAt)}.
              </>
            ) : (
              "Aún no has anotado la fecha de fin de ningún juego."
            )}
          </p>
        </section>
      </div>

      <div className={styles.trio}>
        <section className={`window ${styles.panel}`} aria-labelledby="h-joyas">
          <h2 id="h-joyas">Joyas por jugar</h2>
          {s.gems.length > 0 ? (
            <ol className={styles.gems}>
              {s.gems.map((g) => (
                <li key={g.id}>
                  <span className={styles.gemTitle}>
                    <Link href={`/juego/${g.id}`}>{g.title}</Link>
                    {g.platform && <small>{g.platform}</small>}
                  </span>
                  <span className={styles.score} data-top={g.metacritic >= 90 || undefined}>
                    <span className="sr-only">Metacritic </span>
                    <span className="num" data-score>
                      {g.metacritic}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>Ninguno de tus pendientes tiene nota de Metacritic todavía.</p>
          )}
          <p className={styles.note}>Las de mejor nota en Metacritic entre tus pendientes.</p>
        </section>

        <section className={`window ${styles.panel}`} aria-labelledby="h-familias">
          <h2 id="h-familias">De dónde vienen</h2>
          <div className={styles.famBar} role="img" aria-label={`Copias por familia de plataformas: ${s.families.map((f) => `${f.name} ${f.copies}`).join(", ")}`}>
            {s.families.map((f) => (
              <i key={f.name} style={{ flexGrow: f.copies, background: familyColor(f.name) }} />
            ))}
          </div>
          <dl className={styles.families}>
            {s.families.map((f) => {
              // El PC se desglosa por tienda; las consolas, por plataforma.
              const parts =
                f.name === "PC"
                  ? s.pcStores.map((st) => ({ label: st.store, n: st.copies, href: `/biblioteca?plataforma=PC&tienda=${encodeURIComponent(st.store)}` }))
                  : f.platforms.map((p) => ({ label: p.platform, n: p.copies, href: `/biblioteca?plataforma=${encodeURIComponent(p.platform)}` }));
              return (
                <div key={f.name}>
                  <dt>
                    <i style={{ background: familyColor(f.name) }} aria-hidden />
                    {f.name}
                  </dt>
                  <dd className="num" data-count>
                    {formatNumber(f.copies)}
                  </dd>
                  {parts.length > 0 && (
                    <dd className={styles.sub}>
                      {parts.map((p, i) => (
                        <Fragment key={p.label}>
                          {i > 0 && " · "}
                          <Link href={p.href}>
                            {p.label} {formatNumber(p.n)}
                          </Link>
                        </Fragment>
                      ))}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
          <p className={styles.note}>
            {count(s.copiesByFormat.fisico, "física", "físicas")} y {count(s.copiesByFormat.digital, "digital", "digitales")}
            {s.lentOut > 0 ? ` · ${count(s.lentOut, "prestada", "prestadas")}` : ""}
          </p>
        </section>

        <section className={`window ${styles.panel}`} aria-labelledby="h-generos">
          <h2 id="h-generos">Géneros</h2>
          {s.genres.length > 0 ? (
            <ol className={styles.ranking}>
              {s.genres.map((g, i) => (
                <li key={g.genre}>
                  <span className={styles.rank}>{i + 1}º</span>
                  <Link href={`/biblioteca?genero=${encodeURIComponent(g.genre)}`}>{g.genre}</Link>
                  <span className={styles.dots} aria-hidden />
                  <span className="num">{formatNumber(g.titles)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>Tus juegos aún no tienen géneros.</p>
          )}
          {s.byStatus.pendiente > 0 && (
            <p className={styles.note}>
              {count(s.pendingQuick, "pendiente se juega", "pendientes se juegan")} en 30 min o menos, y {formatNumber(s.pendingCoop)}{" "}
              {s.pendingCoop === 1 ? "admite" : "admiten"} jugar acompañada.
            </p>
          )}
        </section>
      </div>

      <div className={styles.duo}>
        <section className={`window ${styles.panel}`} aria-labelledby="h-nota">
          <h2 id="h-nota">Nota en Metacritic</h2>
          {s.metacritic.withData > 0 && (
            <>
              <div className={styles.cols} role="img" aria-label={`Juegos por nota de Metacritic: ${s.metacritic.buckets.map((b) => `${b.label} ${b.titles}`).join(", ")}`}>
                {s.metacritic.buckets.map((b) => (
                  <div key={b.label} className={styles.col}>
                    <b className="num">{b.titles}</b>
                    <i data-tone="lavanda" style={{ height: `${(b.titles / maxScore) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className={styles.colx} aria-hidden>
                {s.metacritic.buckets.map((b) => (
                  <span key={b.label}>{b.label}</span>
                ))}
              </div>
            </>
          )}
          <p className={styles.note}>
            {s.metacritic.average != null
              ? `Media ${formatNumber(s.metacritic.average)} en ${count(s.metacritic.withData, "juego", "juegos")} con nota.`
              : "Ningún juego tiene nota de Metacritic todavía."}
          </p>
        </section>

        <section className={`window ${styles.panel}`} aria-labelledby="h-salida">
          <h2 id="h-salida">Año de salida</h2>
          {s.decades.length > 0 && (
            <>
              <div className={styles.cols} role="img" aria-label={`Juegos por década de salida: ${s.decades.map((d) => `${decadeLabel(d.decade)} ${d.titles}`).join(", ")}`}>
                {s.decades.map((d) => (
                  <div key={d.decade} className={styles.col}>
                    <b className="num">{d.titles}</b>
                    <i style={{ height: `${(d.titles / maxDecade) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className={styles.colx} aria-hidden>
                {s.decades.map((d) => (
                  <span key={d.decade}>{decadeLabel(d.decade)}</span>
                ))}
              </div>
            </>
          )}
          <p className={styles.note}>{s.oldest ? `El más antiguo: ${s.oldest.title} (${s.oldest.year}).` : "Ningún juego tiene fecha de salida todavía."}</p>
        </section>
      </div>

      <section className={`window ${styles.panel}`} aria-labelledby="h-registro">
        <h2 id="h-registro">Horas y gasto</h2>
        <div className={styles.ledger}>
          <Ledger
            label="Horas jugadas"
            value={`${formatNumber(s.hours.total)} h`}
            have={s.hours.withData}
            of={s.titles}
            what={s.titles === 1 ? "juego con horas" : "juegos con horas"}
          />
          <Ledger
            label="Gasto"
            value={formatMoney(s.spend.total)}
            have={answered}
            of={answered + s.spend.missing}
            what={answered + s.spend.missing === 1 ? "copia comprada con precio o motivo" : "copias compradas con precio o motivo"}
            detail={priceDetail}
          />
        </div>
        <p className={styles.note}>Se suman a medida que las anotas en la ficha de cada juego. El gasto no incluye copias prestadas ni de suscripción; los regalos y los juegos gratis cuentan como respondidos.</p>
      </section>
    </div>
  );
}

/** Una cifra que casi nunca está completa: el total y cuántos registros lo tienen anotado. */
function Ledger({ label, value, have, of, what, detail }: { label: string; value: string; have: number; of: number; what: string; detail?: string }) {
  return (
    <div>
      <dl>
        <dt>{label}</dt>
        <dd className="num">{value}</dd>
      </dl>
      <p className={styles.coverage}>
        <span className={styles.meter} aria-hidden>
          <i style={{ width: `${of ? (have / of) * 100 : 0}%` }} />
        </span>
        {formatNumber(have)} de {formatNumber(of)} {what}
      </p>
      {detail && <p className={styles.coverageDetail}>{detail}</p>}
    </div>
  );
}
