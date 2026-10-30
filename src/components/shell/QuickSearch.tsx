"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { copiesSummary } from "@/lib/format";
import { buildEntries } from "@/lib/filters";
import { normalizeTitle } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { Cover } from "../ui/Cover";
import styles from "./shell.module.css";

/** Búsqueda rápida desde cualquier pantalla: salta a la ficha del juego. */
export function QuickSearch({ className }: { className?: string }) {
  const router = useRouter();
  const { library } = useLibrary();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => buildEntries(library), [library]);
  const results = useMemo(() => {
    const n = normalizeTitle(q);
    if (!n) return [];
    return entries
      .filter((e) => normalizeTitle(e.game.title).includes(n))
      .sort((a, b) => Number(!normalizeTitle(a.game.title).startsWith(n)) - Number(!normalizeTitle(b.game.title).startsWith(n)))
      .slice(0, 6);
  }, [entries, q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(href);
  };
  const showAll = () => go(`/biblioteca?q=${encodeURIComponent(q.trim())}`);

  return (
    <div className={`${styles.qs} ${className ?? ""}`}>
      <Search className={styles.qsIcon} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={open && q.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        aria-label="Buscar en tu biblioteca"
        placeholder="Buscar en tu biblioteca"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[active]) go(`/juego/${results[active].game.id}`);
            else if (q.trim()) showAll();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && q.trim().length > 0 && (
        <ul id={listId} role="listbox" className={styles.qsList} aria-label="Resultados">
          {results.map(({ game, copies }, i) => (
            <li
              key={game.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(`/juego/${game.id}`)}
              onMouseEnter={() => setActive(i)}
            >
              <Cover src={game.coverUrl} title={game.title} caption="" className={styles.qsCover} />
              <span>
                <strong>{game.title}</strong>
                <small>{copiesSummary(copies)}</small>
              </span>
            </li>
          ))}
          <li
            role="option"
            id={`${listId}-${results.length}`}
            aria-selected={active === results.length}
            className={styles.qsAll}
            onMouseDown={(e) => e.preventDefault()}
            onClick={showAll}
            onMouseEnter={() => setActive(results.length)}
          >
            {results.length ? `Ver todo «${q.trim()}» en la biblioteca` : `Nada con «${q.trim()}». Buscar en la biblioteca`}
          </li>
        </ul>
      )}
    </div>
  );
}
