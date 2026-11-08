"use client";

import { HardDrive, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { BackupReminder } from "@/components/home/BackupReminder";
import { MainMenu } from "@/components/home/MainMenu";
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

  if (library.games.length === 0) {
    return (
      <div className={styles.welcome}>
        <h1 className="sr-only">Inicio</h1>
        <div className={styles.welcomeCard}>
          <Sparkles aria-hidden className={styles.welcomeIcon} />
          <h2>Bienvenida a tu ludoteca</h2>
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
            {mode === "local" && (
              <p className={`notice ${styles.localNotice}`}>
                <HardDrive aria-hidden />
                <span>
                  Modo local: tu biblioteca se guarda solo en este navegador. <Link href="/ajustes">Haz una copia o conecta la sincronización</Link>.
                </span>
              </p>
            )}
          </>
        }
      />
    </>
  );
}
