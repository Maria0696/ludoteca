"use client";

import type { ReactNode } from "react";
import { RARITY_LABEL, rarityTier } from "@/lib/achievements";
import { formatNumber } from "@/lib/format";
import type { Achievement } from "@/lib/model";
import styles from "./achievement-card.module.css";

/** La rejilla de la vitrina: tres por fila en el ordenador, dos en tableta y una en el móvil. */
export const achievementGrid = styles.grid;

/**
 * Un logro en su tarjeta: el icono (en gris si aún no es tuyo), el nombre, la pegatina de rareza (rarísimo, raro o
 * común, con el %), la descripción y, debajo, lo que haga falta (la fecha, el juego). Oculto, va tapado con «Ver».
 */
export function AchievementCard({ item, locked = false, hidden = false, onReveal, meta }: { item: Achievement; locked?: boolean; hidden?: boolean; onReveal?: () => void; meta?: ReactNode }) {
  const tier = rarityTier(item.percent);
  const icon = hidden ? null : item.icon;
  return (
    <li className={styles.card}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- icono de 64 píxeles servido por Steam
        <img className={`${styles.icon} ${locked ? styles.locked : ""}`} src={icon} alt="" width={48} height={48} loading="lazy" />
      ) : (
        <span className={`${styles.icon} ${styles.blank}`} aria-hidden />
      )}
      <div className={styles.body}>
        <strong className={styles.name}>{hidden ? "Logro oculto" : item.name}</strong>
        {tier && (
          <span className={`${styles.tier} num`} data-tier={tier}>
            {RARITY_LABEL[tier]} · {formatNumber(item.percent!)} %
          </span>
        )}
        {hidden ? (
          <button type="button" className={`link-btn ${styles.reveal}`} aria-label="Ver el logro oculto" onClick={onReveal}>
            Ver
          </button>
        ) : (
          item.description && <span className={styles.desc}>{item.description}</span>
        )}
        {meta && <span className={styles.meta}>{meta}</span>}
      </div>
    </li>
  );
}
