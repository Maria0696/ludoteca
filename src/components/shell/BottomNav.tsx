"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav";
import styles from "./shell.module.css";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.bottom} aria-label="Principal">
      {NAV.map(({ href, short, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <span className={styles.pill}>
              <Icon aria-hidden strokeWidth={1.75} />
            </span>
            {short}
          </Link>
        );
      })}
    </nav>
  );
}
