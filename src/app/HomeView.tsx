"use client";

import { BookMarked, HardDrive, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { BackupReminder, useBackupReminderDue } from "@/components/home/BackupReminder";
import { MainMenu } from "@/components/home/MainMenu";
import { CHEST_CLOSED_URL } from "@/components/pixel/sprites";
import { computeYear, hasActivity } from "@/lib/anuario";
import { buildEntries } from "@/lib/filters";
import type { Library } from "@/lib/model";
import { computeStats } from "@/lib/stats";
import { useLibrary } from "@/lib/store";
import styles from "./home.module.css";

const LOCAL_NOTICE_KEY = "ludoteca:aviso-local-cerrado";

/** Una vez leído, el aviso de modo local del menú se puede cerrar; Ajustes lo sigue explicando. */
function useLocalNoticeClosed(): [boolean, () => void] {
  const [closed, setClosed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(LOCAL_NOTICE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(LOCAL_NOTICE_KEY, "1");
    } catch {
      // Sin almacenamiento, se cierra solo esta vez.
    }
  };
  return [closed, close];
}

/**
 * Del 15 de diciembre al 31 de enero, el aviso de que ya puedes ver tu año en el Anuario (el que acaba o acaba de
 * acabar), si tiene algo que contar.
 */
function AnuarioNotice({ library }: { library: Library }) {
  const today = new Date();
  const year = today.getMonth() === 11 && today.getDate() >= 15 ? today.getFullYear() : today.getMonth() === 0 ? today.getFullYear() - 1 : null;
  if (year == null) return null;
  const data = library.wraps.find((w) => w.year === year)?.data ?? computeYear(library, year);
  if (!hasActivity(data)) return null;
  return (
    <p className={`notice ${styles.localNotice}`}>
      <BookMarked aria-hidden />
      <span>
        <Link href={`/anuario/${year}`}>Ya puedes ver tu {year}</Link>: tu año de juego, en el Anuario.
      </span>
    </p>
  );
}

export function HomeView() {
  const { library, actions, mode } = useLibrary();
  const { open } = useAddGame();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [noticeClosed, closeNotice] = useLocalNoticeClosed();
  const reminding = useBackupReminderDue(library);
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
  const localNotice = (className?: string, onClose?: () => void) => (
    <p className={`notice ${className ?? ""}`}>
      <HardDrive aria-hidden />
      <span>
        Modo local: tu biblioteca se guarda solo en este navegador. <Link href="/ajustes">Haz una copia o conecta la sincronización</Link>.
      </span>
      {onClose && (
        <button type="button" className={styles.noticeClose} aria-label="Cerrar el aviso de modo local" onClick={onClose}>
          <X aria-hidden />
        </button>
      )}
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
            <AnuarioNotice library={library} />
            {/* Un solo aviso a la vez: si toca la copia, ese ya dice que todo está en este navegador. */}
            <BackupReminder library={library} local={mode === "local"} />
            {mode === "local" && !noticeClosed && !reminding && localNotice(styles.localNotice, closeNotice)}
          </>
        }
      />
    </>
  );
}
