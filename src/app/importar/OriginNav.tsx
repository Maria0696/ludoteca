import Link from "next/link";
import styles from "./importar.module.css";

export type Origin = "steam" | "gametracker" | "copia";

/** Los orígenes de la importación, enlazables con `?origen=`: Steam, Game Tracker y tu propia copia de seguridad. */
export function OriginNav({ current }: { current: Origin }) {
  return (
    <nav className={styles.origin} aria-label="Origen de la importación">
      <Link href="/importar?origen=steam" aria-current={current === "steam" ? "page" : undefined}>
        Steam
      </Link>
      <Link href="/importar?origen=gametracker" aria-current={current === "gametracker" ? "page" : undefined}>
        Game Tracker
      </Link>
      <Link href="/importar?origen=copia" aria-current={current === "copia" ? "page" : undefined}>
        Copia de seguridad
      </Link>
    </nav>
  );
}
