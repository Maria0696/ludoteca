"use client";

import { RefreshCw, Trophy } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { AchievementCard, achievementGrid } from "@/components/ui/AchievementCard";
import { SteamChooser } from "@/components/ui/StoreChooser";
import { chooseSteamForGame, syncAchievements, usePendingSteamGames, useSteamProfilePrivate } from "@/lib/achievement-sync";
import { completion, missingSorted, unlockedSorted } from "@/lib/achievements";
import { formatDate } from "@/lib/format";
import type { Copy, Game } from "@/lib/model";
import { checkedLabel } from "@/lib/price-watch";
import { useLibrary } from "@/lib/store";
import adventure from "./adventure.module.css";
import styles from "./achievements.module.css";

/** Qué logros se ven: todos (los que faltan y luego los conseguidos), solo los que faltan o solo los conseguidos. */
type Show = "todos" | "faltan" | "conseguidos";

export const PRIVATE_HINT = "Steam no deja ver tus logros. En tu perfil de Steam → Editar perfil → Privacidad, pon «Detalles de juego» en Público.";

/** Si la ficha de este juego lleva el panel de logros: si los tiene, o si es de PC y puede estar en Steam. */
export function hasAchievementsPanel(game: Game, copies: Copy[], total: number | undefined): boolean {
  if (total != null) return total > 0;
  return game.steamAppId != null || copies.some((c) => c.platform === "PC");
}

/** Cuando aún no hay logros que enseñar: qué pasa y el botón para arreglarlo. */
function Empty({ title, note, children }: { title: string; note: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.empty}>
      <Trophy className={styles.emptyIcon} size={32} aria-hidden />
      <div className={styles.emptyText}>
        <p className={styles.emptyTitle}>{title}</p>
        <p className={styles.note} aria-live="polite">
          {note}
        </p>
      </div>
      <div className={styles.emptyAction}>{children}</div>
    </div>
  );
}

/** Los logros de Steam del juego: el progreso, los que te faltan (del más raro al más común) y los conseguidos. */
export function AchievementsPanel({ game }: { game: Game }) {
  const { library, actions } = useLibrary();
  const rec = library.achievements.find((a) => a.gameId === game.id);
  const steamId = library.settings.steamId;
  const privado = useSteamProfilePrivate();
  const pending = usePendingSteamGames().has(game.id);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [show, setShow] = useState<Show>("todos");
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const look = async () => {
    setBusy(true);
    try {
      await syncAchievements(library, actions, { gameId: game.id });
    } finally {
      setBusy(false);
    }
  };

  const head = (
    <h2 id="logros" className={adventure.panelHead}>
      Logros
    </h2>
  );

  if (!steamId) {
    return (
      <>
        {head}
        <Empty title="Guarda tu perfil de Steam para ver sus logros." note="Se guarda una vez y sirve para todos tus juegos.">
          <Link className="btn btn-sm" href="/ajustes?apartado=traer">
            Ir a Ajustes
          </Link>
        </Empty>
      </>
    );
  }

  const alert = privado && (
    <p className={styles.alert} role="alert">
      {PRIVATE_HINT}
    </p>
  );

  // Sin enlazar (y sin logros guardados de antes): se elige en Steam.
  if (game.steamAppId == null && !rec) {
    return (
      <>
        {head}
        <Empty title={pending ? "En Steam hay varios juegos con ese título." : "Este juego aún no está enlazado con Steam."} note="Elígelo para ver sus logros.">
          <button type="button" className="btn btn-sm" onClick={() => setChoosing(true)}>
            Elegir en Steam
          </button>
        </Empty>
        {choosing && (
          <SteamChooser
            title={game.title}
            done={`«${game.title}» enlazado con Steam`}
            choose={(appId) => chooseSteamForGame(library, game, appId, actions)}
            onClose={() => setChoosing(false)}
          />
        )}
      </>
    );
  }

  // Enlazado pero aún sin mirar.
  if (!rec) {
    return (
      <>
        {head}
        {alert}
        <Empty
          title="Todavía no has mirado sus logros."
          note={busy ? "Mirando sus logros en Steam…" : "La app los mira sola una vez al día; si no quieres esperar, míralos ahora."}
        >
          <button type="button" className="btn btn-sm" onClick={look} disabled={busy}>
            Mirar ahora
          </button>
        </Empty>
      </>
    );
  }

  const missing = missingSorted(rec.items);
  const got = unlockedSorted(rec.items);
  const options: [Show, string, number][] = [
    ["todos", "Todos", rec.items.length],
    ["faltan", "Te faltan", missing.length],
    ["conseguidos", "Conseguidos", got.length],
  ];

  return (
    <>
      {head}
      {alert}
      {rec.total > 0 && (
        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <p className={`${styles.count} num`}>
              {rec.unlocked} de {rec.total} · {completion(rec)} %
            </p>
            <p className={styles.checked} aria-live="polite">
              {busy ? "Mirando en Steam…" : `Mirados ${checkedLabel(rec.checkedAt)}`}
              <button type="button" className={`btn btn-sm btn-quiet btn-icon ${styles.lookNow}`} aria-label="Mirar ahora" title="Mirar ahora" onClick={look} disabled={busy}>
                <RefreshCw aria-hidden />
              </button>
            </p>
          </div>
          <div className={styles.bar} role="progressbar" aria-label="Logros conseguidos" aria-valuemin={0} aria-valuemax={rec.total} aria-valuenow={rec.unlocked}>
            <span style={{ width: `${(rec.unlocked / rec.total) * 100}%` }} />
          </div>
        </div>
      )}
      {missing.length > 0 && got.length > 0 && (
        <div className={`segmented ${styles.show}`} role="radiogroup" aria-label="Qué logros ver">
          {options.map(([value, label, n]) => (
            <button key={value} type="button" role="radio" aria-checked={show === value} onClick={() => setShow(value)}>
              {label} <span className="num">{n}</span>
            </button>
          ))}
        </div>
      )}
      {missing.length > 0 && show !== "conseguidos" && (
        <section className={styles.group} aria-labelledby="logros-faltan">
          <h3 id="logros-faltan" className={styles.groupHead}>
            Te faltan {missing.length}
            {missing.some((a) => a.percent != null) && <small> · del más raro al más común</small>}
          </h3>
          <ul className={achievementGrid} aria-label="Te faltan">
            {missing.map((a) => (
              <AchievementCard key={a.api} item={a} locked hidden={a.hidden && !revealed.has(a.api)} onReveal={() => setRevealed((s) => new Set(s).add(a.api))} />
            ))}
          </ul>
        </section>
      )}
      {got.length > 0 && show !== "faltan" && (
        <section className={styles.group} aria-labelledby="logros-conseguidos">
          <h3 id="logros-conseguidos" className={styles.groupHead}>
            Conseguidos {got.length}
          </h3>
          <ul className={achievementGrid} aria-label="Conseguidos">
            {got.map((a) => (
              <AchievementCard key={a.api} item={a} meta={<span className="num">{formatDate(a.unlockedAt)}</span>} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
