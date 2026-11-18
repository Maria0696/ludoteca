"use client";

import { HardDrive } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { BackupReminder } from "@/components/home/BackupReminder";
import { MainMenu } from "@/components/home/MainMenu";
import { CHEST_CLOSED_URL } from "@/components/pixel/sprites";
import { buildEntries } from "@/lib/filters";
import { computeStats } from "@/lib/stats";
import { useLibrary } from "@/lib/store";
import styles from "./home.module.css";

export function HomeView() {
  const { library, actions, mode } = useLibrary();
  const { open } = useAddGame();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const entries = useMemo(() => buildEntries(library), [library]);
  const stats = useMemo(() => computeStats(library), [library]);

  // Las partidas guardadas: lo que tienes en marcha, lo último jugado primero.
  const saves = useMemo(
    () =>
      entries
        .filter((e) => e.game.status === "jugando" || e.game.status === "pausado")
        .sort((a, b) => (b.game.lastPlayedAt ?? "").localeCompare(a.game.lastPlayedAt ?? "")),
    [entries],
  );
  const waiting = useMemo(
    () =>
      entries
        .filter((e) => e.game.status === "pendiente")
        .map((e) => ({ e, since: e.copies.map((c) => c.acquiredAt ?? c.createdAt).sort()[0] ?? e.game.createdAt }))
        .sort((a, b) => a.since.localeCompare(b.since))
        .map(({ e }) => e),
    [entries],
  );
  const recent = useMemo(() => [...entries].sort((a, b) => b.game.createdAt.localeCompare(a.game.createdAt)).slice(0, 12), [entries]);
  const champion = useMemo(() => [...entries].sort((a, b) => (b.game.hoursPlayed ?? 0) - (a.game.hoursPlayed ?? 0))[0], [entries]);

  // Mismo aviso de modo local aquí y en el menú: sin jerga, con el camino a Ajustes.
  const localNotice = (className?: string) => (
    <p className={`notice ${className ?? ""}`}>
      <HardDrive aria-hidden />
      <span>
        Modo local: tu biblioteca se guarda solo en este navegador. <Link href="/ajustes">Haz una copia o conecta la sincronización</Link>.
      </span>
    </p>
  );

  if (library.games.length === 0) {
    return (
      <div className={styles.welcome}>
        <h1 className="sr-only">Inicio</h1>
        <section className={`window ${styles.welcomeCard}`} aria-labelledby="h-bienvenida">
          {/* El cofre anticipa lo que pasa al añadir un juego. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
          <img src={CHEST_CLOSED_URL} alt="" className={styles.welcomeChest} />
          <div className={styles.welcomeBody}>
            <h2 id="h-bienvenida" className="screen-title">
              Bienvenida a tu ludoteca
            </h2>
            <p>Aquí estará tu menú de partida: lo que juegas ahora, lo último que has añadido y lo que lleva más tiempo esperando.</p>
            <p>Para empezar bastan el título, la plataforma y el formato. Lo demás, cuando quieras.</p>
            <div className={styles.actions}>
              <button type="button" className="btn btn-sticker btn-lg" onClick={() => open()}>
                Añadir el primer juego
              </button>
              {mode === "local" && (
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
              )}
            </div>
            {mode === "local" && (
              <>
                <p className={styles.welcomeNote}>Los juegos de demostración van marcados y se retiran de una vez desde Ajustes.</p>
                {localNotice(styles.welcomeNotice)}
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">Inicio</h1>
      <MainMenu
        saves={saves}
        waiting={waiting}
        recent={recent}
        champion={champion}
        stats={{
          titles: stats.titles,
          copies: stats.copies,
          playing: stats.byStatus.jugando,
          pending: stats.byStatus.pendiente,
          finished: stats.finishedThisYear,
        }}
        notices={
          <>
            <BackupReminder library={library} />
            {mode === "local" && localNotice(styles.localNotice)}
          </>
        }
      />
    </>
  );
}
