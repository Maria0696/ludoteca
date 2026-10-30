"use client";

import { ArrowRight, HardDrive, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { GameCard } from "@/components/game/GameCard";
import gameStyles from "@/components/game/game.module.css";
import { Hero } from "@/components/home/Hero";
import { buildEntries } from "@/lib/filters";
import { computeStats } from "@/lib/stats";
import { useLibrary } from "@/lib/store";
import styles from "./home.module.css";

const PRESETS = [
  { label: "Tengo 30 minutos", href: "/que-juego?min=30" },
  { label: "Tengo una hora", href: "/que-juego?min=60" },
  { label: "Juego acompañada", href: "/que-juego?con=acompanado" },
  { label: "Algo tranquilo", href: "/que-juego?tipo=tranquila" },
];

export function HomeView() {
  const { library, actions, mode } = useLibrary();
  const { open } = useAddGame();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const entries = useMemo(() => buildEntries(library), [library]);
  const stats = useMemo(() => computeStats(library), [library]);

  // El cartel recorre lo que estás jugando; si es poco, añade lo que más espera.
  const featured = useMemo(() => {
    const inProgress = entries
      .filter((e) => e.game.status === "jugando" || e.game.status === "pausado")
      .sort((a, b) => (b.game.lastPlayedAt ?? "").localeCompare(a.game.lastPlayedAt ?? ""));
    const waiting = entries.filter((e) => e.game.status === "pendiente");
    return [...inProgress, ...waiting].slice(0, 8);
  }, [entries]);
  const waiting = useMemo(
    () =>
      entries
        .filter((e) => e.game.status === "pendiente")
        .map((e) => ({ e, since: e.copies.map((c) => c.acquiredAt ?? c.createdAt).sort()[0] ?? e.game.createdAt }))
        .sort((a, b) => a.since.localeCompare(b.since))
        .map(({ e }) => e)
        .slice(0, 12),
    [entries],
  );
  const recent = useMemo(() => [...entries].sort((a, b) => b.game.createdAt.localeCompare(a.game.createdAt)).slice(0, 12), [entries]);
  const moods = useMemo(() => entries.filter((e) => e.game.backdropUrl || e.game.coverUrl).slice(0, 3), [entries]);

  if (library.games.length === 0) {
    return (
      <div className={styles.welcome}>
        <h1 className="sr-only">Inicio</h1>
        <div className={styles.welcomeCard}>
          <Sparkles aria-hidden className={styles.welcomeIcon} />
          <h2>Bienvenida a tu sala</h2>
          <p>
            Aquí verás lo que estás jugando a pantalla completa, lo último que has añadido y lo que lleva más tiempo esperando. Empieza
            añadiendo un juego: título, plataforma y formato bastan.
          </p>
          {mode === "local" && (
            <p className="notice">
              <HardDrive aria-hidden />
              Modo local: tu biblioteca se guarda solo en este navegador. Para usarla en varios dispositivos, conecta Supabase (ver Ajustes).
            </p>
          )}
          <div className={styles.actions}>
            <button type="button" className="btn btn-sticker btn-lg" onClick={() => open()}>
              Añadir el primer juego
            </button>
            <button
              type="button"
              className="btn btn-lg"
              disabled={loadingDemo}
              onClick={async () => {
                setLoadingDemo(true);
                await actions.loadDemo();
                setLoadingDemo(false);
              }}
            >
              {loadingDemo ? "Cargando…" : "Probar con datos de demostración"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Inicio</h1>
      <Hero entries={featured} />

      <div className={styles.rows}>
        {mode === "local" && (
          <p className={`notice ${styles.localNotice}`}>
            <HardDrive aria-hidden />
            <span>
              Modo local: tu biblioteca se guarda solo en este navegador. <Link href="/ajustes">Haz una copia o conecta la sincronización</Link>.
            </span>
          </p>
        )}

        {waiting.length > 0 && (
          <Shelf title="Te están esperando" detail={`${stats.byStatus.pendiente} pendientes`} href="/biblioteca?estado=pendiente&agrupar=ninguno">
            {waiting.map((e, i) => (
              <GameCard key={e.game.id} entry={e} index={i} as="div" />
            ))}
          </Shelf>
        )}

        <section className={styles.band} aria-labelledby="h-jugar">
          <div className={styles.bandArt} aria-hidden>
            {moods.map(({ game }) => (
              // eslint-disable-next-line @next/next/no-img-element -- collage decorativo con el arte de tus juegos
              <img key={game.id} src={(game.backdropUrl ?? game.coverUrl)!} alt="" loading="lazy" />
            ))}
          </div>
          <div className={styles.bandCopy}>
            <h2 id="h-jugar">¿A qué juego?</h2>
            <p>Dime cuánto tiempo tienes y con quién juegas; te propongo tres juegos de tu biblioteca y por qué.</p>
            <div className={styles.presets}>
              {PRESETS.map((p) => (
                <Link key={p.href} href={p.href} className="chip">
                  {p.label}
                </Link>
              ))}
            </div>
            <Link href="/que-juego" className="btn btn-sticker btn-lg">
              Elegir con calma <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>

        <Shelf title="Añadidos recientemente" detail={`${stats.titles} en tu biblioteca`} href="/biblioteca?agrupar=ninguno">
          {recent.map((e, i) => (
            <GameCard key={e.game.id} entry={e} index={i} as="div" />
          ))}
        </Shelf>

        <section className={styles.section} aria-labelledby="h-resumen">
          <div className={styles.sectionHead}>
            <h2 id="h-resumen">Tu colección</h2>
            <Link href="/estadisticas" className={styles.more}>
              Estadísticas <ArrowRight aria-hidden />
            </Link>
          </div>
          <dl className={styles.summary}>
            <Stat label="Títulos" value={stats.titles} />
            <Stat label="Copias" value={stats.copies} />
            <Stat label="Jugando" value={stats.byStatus.jugando} />
            <Stat label="Pendientes" value={stats.byStatus.pendiente} />
            <Stat label={`Terminados en ${new Date().getFullYear()}`} value={stats.finishedThisYear} />
          </dl>
        </section>
      </div>
    </div>
  );
}

function Shelf({ title, detail, href, children }: { title: string; detail: string; href: string; children: React.ReactNode }) {
  const id = `h-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className={styles.shelfSection} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id}>
          {title} <small>{detail}</small>
        </h2>
        <Link href={href} className={styles.more}>
          Ver todo <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className={gameStyles.shelf}>{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
