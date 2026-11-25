"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import type { CatalogGame, CatalogResponse } from "@/lib/catalog";
import styles from "./sagas.module.css";

/**
 * Buscar un juego en IGDB para meterlo en una saga: los resultados se eligen con un toque. Los que ya tienes lo dicen;
 * los ya elegidos no se repiten.
 */
export function IgdbSearch({ onPick, owned, chosen = [] }: { onPick: (game: CatalogGame) => void; owned: (game: CatalogGame) => boolean; chosen?: number[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  // El mensaje va con su búsqueda: si escribes otra cosa, deja de verse.
  const [message, setMessage] = useState<{ query: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/catalogo?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as CatalogResponse;
        setResults(data.ok ? data.results : []);
        const text = data.ok ? (data.results.length ? null : `Nada con «${query}» en IGDB.`) : data.message;
        setMessage(text ? { query, text } : null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setMessage({ query, text: "No se pudo consultar el catálogo." });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const visible = q.trim().length >= 2 ? results.filter((r) => !chosen.includes(r.igdbId)) : [];

  return (
    <div className={styles.igdb}>
      <label className={styles.search}>
        <Search aria-hidden />
        <span className="sr-only">Buscar en IGDB</span>
        <input className="input" type="search" placeholder="Busca el juego en IGDB" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {loading && <p className={styles.hint}>Buscando…</p>}
      {message?.query === q.trim() && !loading && <p className={styles.hint}>{message.text}</p>}
      {visible.length > 0 && (
        <ul className={styles.results}>
          {visible.map((r) => (
            <li key={r.igdbId}>
              <button type="button" className={styles.result} onClick={() => onPick(r)}>
                <Cover src={r.coverUrl} title={r.title} caption="" className={styles.miniCover} />
                <span className={styles.proposalText}>
                  <strong>{r.title}</strong>
                  <span>
                    {r.year ?? "Sin fecha"}
                    {owned(r) ? " · Ya lo tienes" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
