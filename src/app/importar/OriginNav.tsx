import Link from "next/link";
import styles from "./importar.module.css";

export type Origin = "steam" | "gametracker";

/** Los dos orígenes de la importación, enlazables con `?origen=`. */
export function OriginNav({ current }: { current: Origin }) {
  return (
    <nav className={styles.origin} aria-label="Origen de la importación">
      <Link href="/importar?origen=steam" aria-current={current === "steam" ? "page" : undefined}>
        Steam
      </Link>
      <Link href="/importar?origen=gametracker" aria-current={current === "gametracker" ? "page" : undefined}>
        Game Tracker
      </Link>
    </nav>
  );
}
