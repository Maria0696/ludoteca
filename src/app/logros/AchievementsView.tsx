"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { syncAchievements, useLastAchievementCheck, useSteamProfilePrivate } from "@/lib/achievement-sync";
import { achievementTotals, completion, nearlyDone } from "@/lib/achievements";
import { checkedLabel } from "@/lib/price-watch";
import { useLibrary } from "@/lib/store";
import { PRIVATE_HINT } from "../juego/[id]/AchievementsPanel";
import styles from "./logros.module.css";

/** «te falta 1», «te faltan 3». */
const left = (n: number) => (n === 1 ? "te falta 1" : `te faltan ${n}`);

/**
 * Todos tus juegos con logros de Steam, para elegir cuál completar: primero los que están más cerca del 100 %, luego
 * los que aún no has empezado y los completos al final. Cada uno lleva a su ficha.
 */
export function AchievementsView() {
  const { library, actions } = useLibrary();
  const steamId = library.settings.steamId;
  const lastCheck = useLastAchievementCheck();
  const privado = useSteamProfilePrivate();
  const [busy, setBusy] = useState(false);
  const games = useMemo(() => new Map(library.games.map((g) => [g.id, g])), [library.games]);
  const list = useMemo(() => nearlyDone(library.achievements).filter((a) => games.has(a.gameId)), [library.achievements, games]);
  const totals = useMemo(() => achievementTotals(library.achievements.filter((a) => games.has(a.gameId))), [library.achievements, games]);

  const look = async () => {
    setBusy(true);
    try {
      await syncAchievements(library, actions, { force: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="screen-title">Logros</h1>
        {list.length > 0 && (
          <p className={`${styles.count} num`}>
            {totals.unlocked} {totals.unlocked === 1 ? "logro" : "logros"} · {totals.complete} al 100 %
          </p>
        )}
        {steamId && (
          <p className={styles.status} aria-live="polite">
            {busy ? (
              "Mirando tus logros en Steam…"
            ) : (
              <>
                Logros de Steam:{" "}
                <span className={styles.nowrap}>
                  {checkedLabel(lastCheck)}
                  <button type="button" className={`btn btn-sm btn-quiet btn-icon ${styles.lookNow}`} aria-label="Mirar ahora" title="Mirar ahora" onClick={look}>
                    <RefreshCw aria-hidden />
                  </button>
                </span>
              </>
            )}
          </p>
        )}
      </header>

      {privado && (
        <p className={styles.alert} role="alert">
          {PRIVATE_HINT}
        </p>
      )}

      {!steamId ? (
        <div className="empty">
          <h2>Falta tu perfil de Steam</h2>
          <p>Guárdalo en Ajustes y la app mirará los logros de tus juegos de Steam una vez al día.</p>
          <Link className="btn btn-sticker" href="/ajustes?apartado=traer">
            Ir a Ajustes
          </Link>
        </div>
      ) : list.length === 0 ? (
        <div className="empty">
          <h2>Aún no hay logros</h2>
          <p>Los de tus juegos de Steam salen aquí en cuanto se miren. Pulsa el botón de recargar para mirarlos ya.</p>
        </div>
      ) : (
        <section className="window">
          <ul className={styles.list} aria-label="Tus juegos con logros">
            {list.map((a) => {
              const game = games.get(a.gameId)!;
              const pct = completion(a);
              const missing = a.total - a.unlocked;
              return (
                <li key={a.gameId}>
                  <Link href={`/juego/${game.id}`} className={styles.row} data-completo={missing === 0 || undefined}>
                    <Cover src={game.coverUrl} title={game.title} className={styles.cover} />
                    <span className={styles.title}>{game.title}</span>
                    <span className={styles.bar} aria-hidden>
                      <span style={{ width: `${(a.unlocked / a.total) * 100}%` }} />
                    </span>
                    <span className={`${styles.meta} num`}>
                      {pct} %{missing > 0 ? ` · ${left(missing)}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
