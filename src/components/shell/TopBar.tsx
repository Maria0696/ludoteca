"use client";

import { HardDrive, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLibrary } from "@/lib/store";
import { useAddGame } from "../game/AddGameProvider";
import { NAV, isActive } from "./nav";
import { QuickSearch } from "./QuickSearch";
import styles from "./shell.module.css";

export function TopBar() {
  const pathname = usePathname();
  const { mode, library } = useLibrary();
  const { open } = useAddGame();
  const hasDemo = library.games.some((g) => g.demo) || library.wishlist.some((w) => w.demo);
  // En Inicio la barra flota sobre el cartel y se vuelve sólida al bajar.
  const overlay = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={[styles.top, overlay && styles.overlay, overlay && scrolled && styles.scrolled].filter(Boolean).join(" ")}>
      <Link href="/" className={styles.brand} aria-label="Sala de los Menesteres, inicio">
        <span className={styles.brandLong}>Sala de los Menesteres</span>
        <span className={styles.brandShort}>Menesteres</span>
      </Link>

      <nav className={styles.nav} aria-label="Principal">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.spacer} />

      {(mode === "local" || hasDemo) && (
        <Link href="/ajustes" className={styles.modeChip} title="Ver detalles en Ajustes">
          {mode === "local" && (
            <>
              <HardDrive aria-hidden />
              <span>Modo local</span>
            </>
          )}
          {mode === "local" && hasDemo && <span aria-hidden>·</span>}
          {hasDemo && <span>Demostración</span>}
        </Link>
      )}

      <QuickSearch className={styles.quickSearch} />

      <Link href="/biblioteca?buscar=1" className={`btn btn-quiet btn-icon ${styles.mobileOnly}`} aria-label="Buscar">
        <Search />
      </Link>
      <Link href="/ajustes" className="btn btn-quiet btn-icon" aria-label="Ajustes" aria-current={pathname.startsWith("/ajustes") ? "page" : undefined}>
        <Settings />
      </Link>
      <button type="button" className={`btn btn-sticker ${styles.addBtn}`} onClick={() => open()}>
        <Plus strokeWidth={2.5} />
        <span className={styles.addLabel}>Añadir juego</span>
      </button>
    </header>
  );
}
