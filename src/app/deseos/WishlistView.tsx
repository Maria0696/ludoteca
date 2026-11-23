"use client";

import { PackageCheck, Pencil, Plus, Search, SlidersHorizontal, Tag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { type Priority, type WishItem, PRIORITIES, PRIORITY_LABEL, normalizeTitle } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { ConvertDialog, PriceDialog, WishEditor } from "./WishDialogs";
import styles from "./wishlist.module.css";

type Sort = "prioridad" | "anadido" | "titulo" | "objetivo";
// Por defecto, en orden alfabético: la primera opción.
const SORT_LABEL: Record<Sort, string> = {
  titulo: "Título (A–Z)",
  prioridad: "Prioridad",
  anadido: "Añadidos recientemente",
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
  const [sort, setSort] = useState<Sort>("titulo");
  const [sheet, setSheet] = useState(false);
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
  const activeFilters = priorities.length + (platform ? 1 : 0);
  const reset = () => {
    setQ("");
    setPriorities([]);
    setPlatform("");
  };

  // Prioridad, plataforma y orden: en la barra en el ordenador; en el móvil, en la hoja «Filtrar y ordenar», como en la biblioteca.
  const filterControls = (
    <>
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
    </>
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="screen-title">Lista de deseos</h1>
        <p className={`${styles.count} num`}>
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
              <input className="input" type="search" placeholder="Buscar por título" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className={styles.filtersInline}>{filterControls}</div>
            <button type="button" className={`btn ${styles.filterBtn}`} onClick={() => setSheet(true)}>
              <SlidersHorizontal aria-hidden />
              {activeFilters ? `Filtros · ${activeFilters}` : "Filtros"}
            </button>
            {filtered && (
              <button type="button" className="link-btn" onClick={reset}>
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
            <section className="window" aria-label="Deseos">
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
                      {/* El precio, como una etiqueta bajo el título; sin precio ni objetivo, nada. */}
                      {p ? (
                        <div className={styles.priceRow}>
                          <p className={diff != null && diff <= 0 ? `${styles.tag} ${styles.tagGood}` : styles.tag}>
                            <span className="sr-only">Último precio: </span>
                            <span className={`${styles.amount} num`}>{formatMoney(p.amount)}</span>
                            {diff != null && <span className={styles.verdict}>{diff <= 0 ? "En tu objetivo" : `${formatMoney(diff)} por encima`}</span>}
                          </p>
                          <span className={styles.priceMeta}>
                            {[p.store, formatDate(p.date), w.targetPrice != null ? `objetivo ${formatMoney(w.targetPrice)}` : null].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                      ) : (
                        w.targetPrice != null && (
                          <div className={styles.priceRow}>
                            <p className={`${styles.tag} ${styles.tagTarget}`}>
                              <span className={`${styles.verdict} num`}>Objetivo {formatMoney(w.targetPrice)}</span>
                            </p>
                            <span className={styles.priceMeta}>sin precio visto</span>
                          </div>
                        )
                      )}
                      {w.notes && <p className={styles.notes}>{w.notes}</p>}
                    </div>
                    {/* Las calladas, bajo el título (en el móvil, a lo ancho, tras «Ya lo tengo»). */}
                    <div className={styles.secondary}>
                      <button type="button" className="btn btn-sm btn-quiet" onClick={() => setDialog({ kind: "price", wish: w })}>
                        <Tag aria-hidden />
                        Precio
                      </button>
                      <button type="button" className="btn btn-sm btn-quiet" aria-label={`Editar ${w.title}`} onClick={() => setDialog({ kind: "edit", wish: w })}>
                        <Pencil aria-hidden />
                        Editar
                      </button>
                      <button type="button" className="btn btn-sm btn-quiet" aria-label={`Quitar ${w.title} de la lista`} onClick={() => actions.deleteWish(w.id)}>
                        <Trash2 aria-hidden />
                        Quitar
                      </button>
                    </div>
                    {/* La acción principal, enmarcada y sola a la derecha. */}
                    <div className={styles.actions}>
                      <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: "convert", wish: w })}>
                        <PackageCheck aria-hidden />
                        Ya lo tengo
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            </section>
          )}
        </>
      )}

      {dialog?.kind === "new" && <WishEditor onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <WishEditor wish={dialog.wish} onClose={() => setDialog(null)} />}
      {dialog?.kind === "price" && <PriceDialog wish={dialog.wish} onClose={() => setDialog(null)} />}
      {dialog?.kind === "convert" && <ConvertDialog wish={dialog.wish} onClose={() => setDialog(null)} />}

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtrar y ordenar"
        footer={
          <>
            <button type="button" className="btn" onClick={reset}>
              Restablecer
            </button>
            <button type="button" className="btn btn-ink" onClick={() => setSheet(false)}>
              Ver {visible.length} {visible.length === 1 ? "deseo" : "deseos"}
            </button>
          </>
        }
      >
        <div className={styles.sheetFilters}>{filterControls}</div>
      </Dialog>
    </div>
  );
}
