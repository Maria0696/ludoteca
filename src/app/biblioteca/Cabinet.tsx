import { Star } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Cover } from "@/components/ui/Cover";
import type { LibraryEntry } from "@/lib/filters";
import { FORMAT_LABEL, STATUS_LABEL } from "@/lib/model";
import { ARCADE_STATUS } from "./arcade";
import styles from "./library.module.css";

/** Lo que dice la cabina debajo de la carátula: cuántas copias o de qué tipo es la única. */
export function copyDetail({ copies }: LibraryEntry): string {
  const first = copies[0];
  if (copies.length > 1) return `${copies.length} copias`;
  if (!first) return "Sin copias";
  if (first.availability === "suscripcion") return "Suscripción";
  if (first.lentTo) return "Prestado";
  if (first.format === "digital" && first.hasCase) return "Digital · caja";
  return FORMAT_LABEL[first.format];
}

/**
 * Un juego como cabina de recreativa: rótulo con el título, la carátula como
 * pantalla y el estado en idioma arcade. Pulsarla abre la ficha; al pasar por
 * encima o llegar con el teclado, se muestra en «Elegido».
 */
export const Cabinet = memo(function Cabinet({
  entry,
  priority,
  index = 0,
  onChoose,
}: {
  entry: LibraryEntry;
  priority?: boolean;
  /** Posición en la rejilla, para escalonar la entrada. */
  index?: number;
  onChoose: (id: string) => void;
}) {
  const { game, copies } = entry;
  const platforms = [...new Set(copies.map((c) => c.platform))];
  const status = ARCADE_STATUS[game.status];
  return (
    <li className={`${styles.cab} rise`} style={{ "--i": index, "--sc": status.color } as React.CSSProperties}>
      <div className={styles.cabBody}>
        <Link
          href={`/juego/${game.id}`}
          className={styles.cabLink}
          title={game.title}
          onFocus={() => onChoose(game.id)}
          // Solo si el ratón se mueve de verdad: al reordenarse la rejilla, una cabina puede quedar bajo el ratón quieto.
          onPointerMove={(e) => e.pointerType === "mouse" && onChoose(game.id)}
        >
          <span className={styles.marquee} data-card-title>
            <span className={styles.marqueeText}>{game.title}</span>
            {game.favorite && <Star aria-label="Favorito" className={styles.fav} />}
          </span>
          <span className={styles.screen}>
            <Cover src={game.coverUrl} title={game.title} caption={platforms[0]} priority={priority} />
          </span>
        </Link>
        <span className={styles.badge} data-status={game.status}>
          <span aria-hidden>{status.label}</span>
          <span className="sr-only">{STATUS_LABEL[game.status]}</span>
        </span>
      </div>
      <span className={styles.cabMeta}>
        {platforms.map((p) => (
          <span key={p} className="tag">
            {p}
          </span>
        ))}
        <span>{copyDetail(entry)}</span>
      </span>
    </li>
  );
});
