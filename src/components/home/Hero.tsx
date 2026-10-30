"use client";

import { CalendarCheck, Info, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusMark } from "@/components/ui/StatusMark";
import type { LibraryEntry } from "@/lib/filters";
import { relativeDay } from "@/lib/format";
import { formatHours, formatMinutes } from "@/lib/recommend";
import { useLibrary } from "@/lib/store";
import styles from "./hero.module.css";

const ADVANCE_MS = 8000;

function describe({ game, copies }: LibraryEntry): string {
  const parts: string[] = [];
  if (game.status === "pendiente") {
    const since = copies.map((c) => c.acquiredAt).filter(Boolean).sort()[0];
    parts.push(
      since
        ? `Te espera desde ${new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(since))}.`
        : "Todavía no lo has empezado.",
    );
    if (game.lengthHours) parts.push(`Unas ${formatHours(game.lengthHours)} en total.`);
  } else {
    if (game.lastPlayedAt) parts.push(`${game.status === "pausado" ? "Lo dejaste en pausa; última" : "Última"} partida ${relativeDay(game.lastPlayedAt)}.`);
    else if (game.status === "pausado") parts.push("Lo dejaste en pausa.");
    if (game.sessionMinutes) parts.push(`Una sesión suele durar ${formatMinutes(game.sessionMinutes)}.`);
  }
  return parts.join(" ");
}

/**
 * Cartel de Inicio: el arte del juego destacado ocupa la pantalla y la fila
 * de carátulas permite recorrer lo que estás jugando. Avanza solo cada pocos
 * segundos hasta que lo tocas; con movimiento reducido no avanza.
 */
export function Hero({ entries }: { entries: LibraryEntry[] }) {
  const { actions } = useLibrary();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const tilesRef = useRef<HTMLDivElement>(null);
  const current = entries[Math.min(active, entries.length - 1)];

  useEffect(() => {
    if (!auto || entries.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((i) => (i + 1) % entries.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [auto, entries.length]);

  const choose = useCallback((i: number) => {
    setAuto(false);
    setActive(i);
  }, []);

  if (!current) return null;
  const { game, copies } = current;
  const platforms = [...new Set(copies.map((c) => c.platform))];
  const meta = [platforms.join(" + "), game.hoursPlayed ? `${formatHours(game.hoursPlayed)} jugadas` : null].filter(Boolean).join(" · ");

  return (
    <section className={styles.hero} aria-roledescription="carrusel" aria-label="Juegos destacados">
      <div className={styles.stage} aria-hidden>
        {entries.map(({ game: g }, i) => {
          const art = g.backdropUrl ?? g.coverUrl;
          return (
            <div key={g.id} className={`${styles.slide} ${i === active ? styles.on : ""} ${g.backdropUrl ? "" : styles.fromCover}`}>
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element -- arte externo, sin optimización de imágenes
                <img src={art} alt="" loading={i < 2 ? "eager" : "lazy"} decoding="async" />
              ) : (
                <span className={styles.noArt} />
              )}
            </div>
          );
        })}
        <div className={styles.scrim} />
      </div>

      {!game.backdropUrl && game.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- carátula a la vista cuando no hay arte apaisado
        <img key={`portada-${game.id}`} src={game.coverUrl} alt="" className={styles.floatingCover} aria-hidden />
      )}

      <div className={styles.copy} key={`texto-${game.id}`} aria-live="polite">
        <p className={styles.meta}>
          <StatusMark status={game.status} />
          <span>{meta}</span>
        </p>
        <h2 className={styles.title}>{game.title}</h2>
        <p className={styles.desc}>{describe(current)}</p>
        <div className={styles.actions}>
          {game.status === "jugando" ? (
            <button type="button" className="btn btn-sticker btn-lg" onClick={() => actions.markPlayedToday(game.id)}>
              <CalendarCheck aria-hidden />
              He jugado hoy
            </button>
          ) : (
            <button type="button" className="btn btn-sticker btn-lg" onClick={() => actions.setStatus(game.id, "jugando")}>
              <Play aria-hidden fill="currentColor" />
              {game.status === "pendiente" ? "Empezar" : "Retomar"}
            </button>
          )}
          <Link href={`/juego/${game.id}`} className="btn btn-lg">
            <Info aria-hidden />
            Ver ficha
          </Link>
        </div>
      </div>

      {entries.length > 1 && (
        <div
          ref={tilesRef}
          className={styles.tiles}
          role="group"
          aria-label="Elegir juego destacado"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const next = (active + (e.key === "ArrowRight" ? 1 : -1) + entries.length) % entries.length;
            choose(next);
            tilesRef.current?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
          }}
        >
          {entries.map(({ game: g }, i) => (
            <button
              key={g.id}
              type="button"
              className={`${styles.tile} ${i === active ? styles.tileOn : ""}`}
              aria-pressed={i === active}
              aria-label={g.title}
              tabIndex={i === active ? 0 : -1}
              onClick={() => choose(i)}
              onMouseEnter={() => choose(i)}
              onFocus={() => choose(i)}
            >
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniaturas de carátula
                <img src={g.coverUrl} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className={styles.tileFallback}>{g.title}</span>
              )}
              {i === active && auto && entries.length > 1 && <span className={styles.progress} key={`p-${active}`} />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
