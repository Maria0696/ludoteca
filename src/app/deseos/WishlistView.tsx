"use client";

import { PackageCheck, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { formatDate, formatMoney } from "@/lib/format";
import { type Priority, type WishItem, PRIORITIES, PRIORITY_LABEL, normalizeTitle } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { ConvertDialog, PriceDialog, WishEditor } from "./WishDialogs";
import styles from "./wishlist.module.css";

type Sort = "prioridad" | "anadido" | "titulo" | "objetivo";
const SORT_LABEL: Record<Sort, string> = {
  prioridad: "Prioridad",
  anadido: "Añadidos recientemente",
  titulo: "Título (A–Z)",
  objetivo: "Más cerca del objetivo",
};
const PRIORITY_RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

function latestPrice(w: WishItem) {
  return [...w.prices].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function WishlistView() {
  const { library, actions } = useLibrary();
  const [q, setQ] = useState("");
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<Sort>("prioridad");
  const [dialog, setDialog] = useState<{ kind: "new" } | { kind: "edit" | "price" | "convert"; wish: WishItem } | null>(null);

  const platforms = useMemo(() => [...new Set(library.wishlist.map((w) => w.platform).filter(Boolean) as string[])].sort(), [library.wishlist]);

  const visible = useMemo(() => {
    const n = normalizeTitle(q);
    const list = library.wishlist.filter(
      (w) =>
        (!n || normalizeTitle(w.title).includes(n)) &&
        (!priorities.length || priorities.includes(w.priority)) &&
        (!platform || w.platform === platform),
    );
    const gap = (w: WishItem) => {
      const p = latestPrice(w);
      return p && w.targetPrice != null ? p.amount - w.targetPrice : Number.POSITIVE_INFINITY;
    };
    return list.sort((a, b) => {
      if (sort === "titulo") return a.title.localeCompare(b.title, "es");
      if (sort === "anadido") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "objetivo") return gap(a) - gap(b) || a.title.localeCompare(b.title, "es");
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt);
    });
  }, [library.wishlist, q, priorities, platform, sort]);

  const filtered = q || priorities.length || platform;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Lista de deseos</h1>
        <p className="muted num">
          {library.wishlist.length} {library.wishlist.length === 1 ? "juego" : "juegos"}
        </p>
        <button type="button" className="btn btn-ink" onClick={() => setDialog({ kind: "new" })}>
          <Plus aria-hidden />
          Añadir deseo
        </button>
      </header>

      {library.wishlist.length === 0 ? (
        <div className="empty">
          <h2>Nada en la lista todavía</h2>
          <p>Apunta los juegos que quieres, aunque no los tengas: plataforma, prioridad y el precio al que lo comprarías.</p>
          <button type="button" className="btn btn-sticker" onClick={() => setDialog({ kind: "new" })}>
            Añadir el primer deseo
          </button>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <Search aria-hidden />
              <span className="sr-only">Buscar en la lista de deseos</span>
              <input type="search" placeholder="Buscar por título" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className={styles.chips} role="group" aria-label="Prioridad">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip"
                  aria-pressed={priorities.includes(p)}
                  onClick={() => setPriorities((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
            {platforms.length > 0 && (
              <label className={styles.select}>
                <span className="sr-only">Plataforma</span>
                <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="">Todas las plataformas</option>
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className={styles.select}>
              <span className="sr-only">Ordenar</span>
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            {filtered && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setQ("");
                  setPriorities([]);
                  setPlatform("");
                }}
              >
                Restablecer
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <h2>Ningún deseo coincide</h2>
              <p>Prueba con otro título o quita algún filtro.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {visible.map((w) => {
                const p = latestPrice(w);
                const diff = p && w.targetPrice != null ? p.amount - w.targetPrice : null;
                return (
                  <li key={w.id} className={styles.item}>
                    <Cover src={w.coverUrl} title={w.title} caption={w.platform ?? undefined} className={styles.cover} />
                    <div className={styles.info}>
                      <strong>{w.title}</strong>
                      <span className="muted">
                        {w.platform ?? "Cualquier plataforma"} · prioridad {PRIORITY_LABEL[w.priority].toLowerCase()}
                        {w.demo ? " · demostración" : ""}
                      </span>
                      {w.notes && <p className={styles.notes}>{w.notes}</p>}
                    </div>
                    <dl className={styles.prices}>
                      <div>
                        <dt>Objetivo</dt>
                        <dd className="num">{w.targetPrice != null ? formatMoney(w.targetPrice) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Último visto</dt>
                        <dd className="num">
                          {p ? formatMoney(p.amount) : "—"}
                          {p && (
                            <small>
                              {p.store ? `${p.store}, ` : ""}
                              {formatDate(p.date)}
                            </small>
                          )}
                          {diff != null && (
                            <small className={diff <= 0 ? styles.good : undefined}>
                              {diff <= 0 ? "En tu objetivo" : `${formatMoney(diff)} por encima`}
                            </small>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className={styles.actions}>
                      <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: "convert", wish: w })}>
                        <PackageCheck aria-hidden />
                        Ya lo tengo
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: "price", wish: w })}>
                        <Tag aria-hidden />
                        Precio
                      </button>
                      <button type="button" className="btn btn-sm btn-quiet" aria-label={`Editar ${w.title}`} onClick={() => setDialog({ kind: "edit", wish: w })}>
                        <Pencil aria-hidden />
                      </button>
                      <button type="button" className="btn btn-sm btn-quiet" aria-label={`Quitar ${w.title} de la lista`} onClick={() => actions.deleteWish(w.id)}>
                        <Trash2 aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {dialog?.kind === "new" && <WishEditor onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <WishEditor wish={dialog.wish} onClose={() => setDialog(null)} />}
      {dialog?.kind === "price" && <PriceDialog wish={dialog.wish} onClose={() => setDialog(null)} />}
      {dialog?.kind === "convert" && <ConvertDialog wish={dialog.wish} onClose={() => setDialog(null)} />}
    </div>
  );
}
