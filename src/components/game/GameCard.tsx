import { Star } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import type { LibraryEntry } from "@/lib/filters";
import { FORMAT_LABEL } from "@/lib/model";
import { Cover } from "../ui/Cover";
import { StatusMark } from "../ui/StatusMark";
import styles from "./game.module.css";

/** Póster del juego: la carátula manda y los datos van debajo, sin taparla. */
export const GameCard = memo(function GameCard({
  entry,
  priority,
  index = 0,
  as: Tag = "li",
}: {
  entry: LibraryEntry;
  priority?: boolean;
  /** Posición en la rejilla, para escalonar la entrada. */
  index?: number;
  as?: "li" | "div";
}) {
  const { game, copies } = entry;
  const platforms = [...new Set(copies.map((c) => c.platform))];
  const first = copies[0];
  const detail =
    copies.length > 1
      ? `${copies.length} copias`
      : first
        ? first.availability === "suscripcion"
          ? "Suscripción"
          : first.lentTo
            ? "Prestado"
            : first.format === "digital" && first.hasCase
              ? "Digital · caja"
              : FORMAT_LABEL[first.format]
        : "Sin copias";
  return (
    <Tag className={`${styles.card} rise`} style={{ "--i": index } as React.CSSProperties}>
      <Link href={`/juego/${game.id}`} className={styles.cardLink}>
        <span className={styles.cardArt}>
          <Cover src={game.coverUrl} title={game.title} caption={platforms[0]} priority={priority} />
        </span>
        <span className={styles.cardTitle} data-card-title>
          {game.title}
          {game.favorite && <Star aria-label="Favorito" className={styles.fav} />}
        </span>
      </Link>
      <span className={styles.cardMeta}>
        <StatusMark status={game.status} />
      </span>
      <span className={styles.cardMeta}>
        {platforms.map((p) => (
          <span key={p} className="tag">
            {p}
          </span>
        ))}
        <span className={styles.cardCopies}>{detail}</span>
      </span>
    </Tag>
  );
});

export function GroupHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <li className={styles.groupHeading} aria-hidden>
      <strong>{title}</strong>
      <span>{detail}</span>
    </li>
  );
}
