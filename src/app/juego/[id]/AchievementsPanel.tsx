"use client";

import Link from "next/link";
import { useState } from "react";
import { SteamChooser } from "@/components/ui/StoreChooser";
import { chooseSteamForGame, syncAchievements, usePendingSteamGames, useSteamProfilePrivate } from "@/lib/achievement-sync";
import { completion, missingSorted, unlockedSorted } from "@/lib/achievements";
import { formatDate, formatNumber } from "@/lib/format";
import type { Achievement, Copy, Game } from "@/lib/model";
import { checkedLabel } from "@/lib/price-watch";
import { useLibrary } from "@/lib/store";
import adventure from "./adventure.module.css";
import styles from "./achievements.module.css";

/** Cuántos de cada lista se ven de entrada: con cientos de logros, el resto queda a un toque. */
const FIRST = 12;

export const PRIVATE_HINT = "Steam no deja ver tus logros. En tu perfil de Steam → Editar perfil → Privacidad, pon «Detalles de juego» en Público.";

/** Si la ficha de este juego lleva el panel de logros: si los tiene, o si es de PC y puede estar en Steam. */
export function hasAchievementsPanel(game: Game, copies: Copy[], total: number | undefined): boolean {
  if (total != null) return total > 0;
  return game.steamAppId != null || copies.some((c) => c.platform === "PC");
}

/** El icono del logro (en gris si aún no es tuyo); sin icono, o si está tapado, un hueco. */
function Icon({ src, locked = false }: { src: string | null; locked?: boolean }) {
  if (!src) return <span className={`${styles.icon} ${styles.blank}`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- icono de 64 píxeles servido por Steam
  return <img className={`${styles.icon} ${locked ? styles.locked : ""}`} src={src} alt="" width={40} height={40} loading="lazy" />;
}

const rarity = (a: Achievement) => (a.percent != null ? `${formatNumber(a.percent)} %` : null);

/** Los logros de Steam del juego: el progreso, los que te faltan (del más raro al más común) y los conseguidos. */
export function AchievementsPanel({ game }: { game: Game }) {
  const { library, actions } = useLibrary();
  const rec = library.achievements.find((a) => a.gameId === game.id);
  const steamId = library.settings.steamId;
  const privado = useSteamProfilePrivate();
  const pending = usePendingSteamGames().has(game.id);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [allMissing, setAllMissing] = useState(false);
  const [allGot, setAllGot] = useState(false);
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
        <p className={styles.note}>
          <Link href="/ajustes?apartado=traer">Guarda tu perfil de Steam en Ajustes</Link> para ver tus logros.
        </p>
      </>
    );
  }

  const footer = (
    <p className={styles.footer} aria-live="polite">
      {busy ? (
        "Mirando tus logros en Steam…"
      ) : (
        <>
          {rec ? `Mirados ${checkedLabel(rec.checkedAt)}` : "Aún sin mirar"} ·{" "}
          <button type="button" className="link-btn" onClick={look}>
            Mirar ahora
          </button>
          {" · "}
          <Link href="/logros">Todos tus logros</Link>
        </>
      )}
    </p>
  );

  // Sin enlazar (y sin logros guardados de antes): se elige en Steam.
  if (game.steamAppId == null && !rec) {
    return (
      <>
        {head}
        <p className={styles.note}>
          {pending ? "En Steam hay varios juegos con ese título." : "Este juego aún no está enlazado con Steam."} Elígelo para ver sus logros.
        </p>
        <div>
          <button type="button" className="btn btn-sm" onClick={() => setChoosing(true)}>
            Elegir en Steam
          </button>
        </div>
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

  const missing = rec ? missingSorted(rec.items) : [];
  const got = rec ? unlockedSorted(rec.items) : [];
  const shownMissing = allMissing ? missing : missing.slice(0, FIRST);
  const shownGot = allGot ? got : got.slice(0, FIRST);

  return (
    <>
      {head}
      {privado && (
        <p className={styles.alert} role="alert">
          {PRIVATE_HINT}
        </p>
      )}
      {rec && rec.total > 0 && (
        <div className={styles.progress}>
          <p className={`${styles.count} num`}>
            {rec.unlocked} de {rec.total} · {completion(rec)} %
          </p>
          <div className={styles.bar} role="progressbar" aria-label="Logros conseguidos" aria-valuemin={0} aria-valuemax={rec.total} aria-valuenow={rec.unlocked}>
            <span style={{ width: `${(rec.unlocked / rec.total) * 100}%` }} />
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <section className={styles.group} aria-labelledby="logros-faltan">
          <h3 id="logros-faltan" className={styles.groupHead}>
            Te faltan ({missing.length}){missing.some((a) => a.percent != null) ? ", del más raro al más común" : ""}
          </h3>
          <ul className={styles.list} aria-label="Te faltan">
            {shownMissing.map((a) => {
              const hidden = a.hidden && !revealed.has(a.api);
              return (
                <li key={a.api} className={styles.item}>
                  <Icon src={hidden ? null : a.icon} locked />
                  <div className={styles.text}>
                    <strong>{hidden ? "Logro oculto" : a.name}</strong>
                    {hidden ? (
                      <button type="button" className={`link-btn ${styles.reveal}`} aria-label="Ver el logro oculto" onClick={() => setRevealed((s) => new Set(s).add(a.api))}>
                        Ver
                      </button>
                    ) : (
                      a.description && <span>{a.description}</span>
                    )}
                  </div>
                  {rarity(a) && <span className={`${styles.rarity} num`}>{rarity(a)}</span>}
                </li>
              );
            })}
          </ul>
          {missing.length > FIRST && !allMissing && (
            <button type="button" className="link-btn" onClick={() => setAllMissing(true)}>
              Ver los {missing.length - FIRST} restantes
            </button>
          )}
        </section>
      )}
      {got.length > 0 && (
        <section className={styles.group} aria-labelledby="logros-conseguidos">
          <h3 id="logros-conseguidos" className={styles.groupHead}>
            Conseguidos ({got.length})
          </h3>
          <ul className={styles.list} aria-label="Conseguidos">
            {shownGot.map((a) => (
              <li key={a.api} className={styles.item}>
                <Icon src={a.icon} />
                <div className={styles.text}>
                  <strong>{a.name}</strong>
                  <span className="num">{formatDate(a.unlockedAt)}</span>
                </div>
                {rarity(a) && <span className={`${styles.rarity} num`}>{rarity(a)}</span>}
              </li>
            ))}
          </ul>
          {got.length > FIRST && !allGot && (
            <button type="button" className="link-btn" onClick={() => setAllGot(true)}>
              Ver los {got.length - FIRST} restantes
            </button>
          )}
        </section>
      )}
      {footer}
    </>
  );
}
