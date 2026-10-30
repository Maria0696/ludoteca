"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CatalogGame, CatalogResponse } from "@/lib/catalog";
import { Cover } from "../ui/Cover";
import styles from "./game.module.css";

/**
 * Campo de título con sugerencias del catálogo. Escribir y dejarlo tal cual
 * siempre es válido: el catálogo solo ayuda a rellenar carátula y datos.
 */
export function TitleWithCatalog({
  id,
  value,
  onChange,
  onPick,
  invalid,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (title: string) => void;
  onPick: (game: CatalogGame) => void;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "off" | "error">("idle");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const picked = useRef<string | null>(null);
  const listId = useId();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2 || q === picked.current || status === "off") return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/catalogo?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as CatalogResponse;
        if (data.ok) {
          setResults(data.results);
          setStatus("ok");
          setOpen(true);
          setActive(-1);
        } else {
          setResults([]);
          setStatus(data.reason === "no-configurado" ? "off" : "error");
          setMessage(data.message);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setStatus("error");
          setMessage("No se pudo consultar el catálogo. Puedes seguir escribiendo los datos a mano.");
        }
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // `status` se lee solo para no insistir cuando el catálogo está apagado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pick = (g: CatalogGame) => {
    picked.current = g.title;
    onPick(g);
    setOpen(false);
  };

  const showList = open && results.length > 0 && value.trim().length >= 2;

  return (
    <div className={styles.catalog}>
      <input
        id={id}
        className="input"
        value={value}
        autoComplete="off"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          picked.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {status === "loading" && <span className={styles.catalogStatus}>Buscando en el catálogo…</span>}
      {(status === "off" || status === "error") && (
        <p className={styles.catalogNote}>
          <Info aria-hidden />
          {message}
        </p>
      )}
      {showList && (
        <div className={styles.catalogPanel}>
        <ul id={listId} role="listbox" className={styles.catalogList} aria-label="Sugerencias del catálogo">
          {results.map((g, i) => (
            <li
              key={g.igdbId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(g)}
              onMouseEnter={() => setActive(i)}
            >
              <Cover src={g.coverUrl} title={g.title} caption="" className={styles.catalogCover} />
              <span>
                <strong>{g.title}</strong>
                <small>{[g.year, g.platforms.slice(0, 4).join(", ")].filter(Boolean).join(" · ")}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.catalogCredit}>Datos del catálogo de IGDB.com</p>
        </div>
      )}
    </div>
  );
}
