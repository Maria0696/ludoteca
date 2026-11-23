import Link from "next/link";
import styles from "./importar.module.css";

export type Origin = "copia" | "steam";

/** Los orígenes de la importación, enlazables con `?origen=`: primero tu copia de seguridad, luego Steam. */
export function OriginNav({ current }: { current: Origin }) {
  return (
    <nav className={styles.origin} aria-label="Origen de la importación">
      <Link href="/importar?origen=copia" aria-current={current === "copia" ? "page" : undefined}>
        Copia de seguridad
      </Link>
      <Link href="/importar?origen=steam" aria-current={current === "steam" ? "page" : undefined}>
        Steam
      </Link>
    </nav>
  );
}
