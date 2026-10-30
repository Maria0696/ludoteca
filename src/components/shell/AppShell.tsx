"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { LibraryProvider } from "@/lib/store";
import { AddGameProvider } from "../game/AddGameProvider";
import { BottomNav } from "./BottomNav";
import { StateGate } from "./StateGate";
import { TopBar } from "./TopBar";
import styles from "./shell.module.css";

function AppToaster() {
  return (
    <Toaster
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: "calc(var(--bottombar) + 12px)" }}
      toastOptions={{ className: styles.toast }}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/entrar")) {
    return (
      <>
        {children}
        <AppToaster />
      </>
    );
  }
  return (
    <LibraryProvider>
      <AddGameProvider>
        <a href="#contenido" className={styles.skip}>
          Saltar al contenido
        </a>
        <TopBar />
        <main id="contenido" className={styles.main} tabIndex={-1}>
          <StateGate>{children}</StateGate>
        </main>
        <BottomNav />
        <AppToaster />
      </AddGameProvider>
    </LibraryProvider>
  );
}
