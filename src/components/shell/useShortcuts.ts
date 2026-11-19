"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAddGame } from "../game/AddGameProvider";

/** Mientras se escribe, con un diálogo abierto o en la pantalla de título, las teclas son de quien las tiene. */
function busy(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return true;
  return Boolean(document.querySelector("dialog[open], [aria-label='Pulsa Start para entrar']"));
}

/** Atajos para quien ya domina la app: «/» busca y «A» abre el cofre de añadir. */
export function useShortcuts(): void {
  const router = useRouter();
  const { open } = useAddGame();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy(e)) return;
      if (e.key === "/") {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>('header input[aria-keyshortcuts="/"]');
        if (search && search.offsetParent !== null) search.focus();
        else router.push("/biblioteca?buscar=1");
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, router]);
}
