"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TitleWithCatalog } from "@/components/game/CatalogSearch";
import { PlatformField } from "@/components/game/PlatformField";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import type { CatalogGame } from "@/lib/catalog";
import { findSameTitle } from "@/lib/filters";
import { formatDate, formatMoney, parseDecimal } from "@/lib/format";
import { type Format, type Priority, type WishItem, PRIORITIES, PRIORITY_LABEL, newId, todayIso } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./wishlist.module.css";

/** Alta o edición de un deseo. */
export function WishEditor({ wish, onClose }: { wish?: WishItem; onClose: () => void }) {
  const { library, actions } = useLibrary();
  const [title, setTitle] = useState(wish?.title ?? "");
  const [picked, setPicked] = useState<CatalogGame | null>(null);
  const [platform, setPlatform] = useState(wish?.platform ?? "");
  const [priority, setPriority] = useState<Priority>(wish?.priority ?? "media");
  const [target, setTarget] = useState(wish?.targetPrice != null ? String(wish.targetPrice).replace(".", ",") : "");
  const [notes, setNotes] = useState(wish?.notes ?? "");
  const [prices, setPrices] = useState(wish?.prices ?? []);
  const [submitted, setSubmitted] = useState(false);

  const targetValue = parseDecimal(target);
  const titleError = !title.trim() ? "Escribe el título." : null;
  const targetError = Number.isNaN(targetValue) || (targetValue != null && targetValue < 0) ? "Escribe un importe, por ejemplo 19,99." : null;
  const owned = findSameTitle(library, title);
  const alreadyWished = !wish && library.wishlist.find((w) => w.title.trim().toLowerCase() === title.trim().toLowerCase());

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || targetError) return;
    const data = {
      title: title.trim(),
      platform: platform.trim() || null,
      priority,
      targetPrice: targetValue,
      notes: notes.trim() || null,
      prices,
      ...(picked ? { coverUrl: picked.coverUrl, igdbId: picked.igdbId, genres: picked.genres } : {}),
    };
    if (wish) actions.updateWish(wish.id, data);
    else {
      actions.addWish(data);
      toast(`«${data.title}» añadido a tu lista de deseos`);
    }
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={wish ? `Editar «${wish.title}»` : "Añadir a la lista de deseos"}
      initialFocus="#wish-title"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="wish-form" className="btn btn-ink">
            {wish ? "Guardar" : "Añadir deseo"}
          </button>
        </>
      }
    >
      <form id="wish-form" onSubmit={save} noValidate className={styles.form}>
        <div className="field">
          <label htmlFor="wish-title">Título</label>
          <TitleWithCatalog
            id="wish-title"
            value={title}
            onChange={(v) => {
              setTitle(v);
              setPicked(null);
            }}
            onPick={(g) => {
              setTitle(g.title);
              setPicked(g);
            }}
            invalid={submitted && !!titleError}
          />
          {submitted && titleError && <p className="error">{titleError}</p>}
          {owned && <p className="hint">Ya tienes «{owned.title}» en tu biblioteca; puedes desearlo igualmente para otra plataforma.</p>}
          {alreadyWished && <p className="hint">Ya está en tu lista de deseos.</p>}
        </div>
        <div className={styles.cols}>
          <div className="field">
            <label htmlFor="wish-platform">Plataforma deseada</label>
            <PlatformField id="wish-platform" value={platform} onChange={setPlatform} allowEmpty emptyLabel="Cualquiera" />
          </div>
          <div className="field">
            <label htmlFor="wish-target">Precio objetivo (€)</label>
            <input
              id="wish-target"
              className="input num"
              inputMode="decimal"
              value={target}
              aria-invalid={submitted && targetError ? true : undefined}
              onChange={(e) => setTarget(e.target.value)}
            />
            {submitted && targetError && <p className="error">{targetError}</p>}
          </div>
        </div>
        <div className="field">
          <span className="label" id="wish-priority">
            Prioridad
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="wish-priority">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="wish-notes">Notas</label>
          <textarea id="wish-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {wish && prices.length > 0 && (
          <div className="field">
            <span className="label">Precios registrados</span>
            <ul className={styles.priceList}>
              {[...prices]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((p) => (
                  <li key={p.id}>
                    <span className="num">{formatMoney(p.amount)}</span>
                    <span className="muted">
                      {p.store ?? "Sin tienda"} · {formatDate(p.date)}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      aria-label={`Quitar el precio de ${formatMoney(p.amount)} del ${formatDate(p.date)}`}
                      onClick={() => setPrices((list) => list.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </form>
    </Dialog>
  );
}

/** Registrar un precio visto a mano, con su fecha. */
export function PriceDialog({ wish, onClose }: { wish: WishItem; onClose: () => void }) {
  const { actions } = useLibrary();
  const [amount, setAmount] = useState("");
  const [store, setStore] = useState("");
  const [date, setDate] = useState(todayIso());
  const [submitted, setSubmitted] = useState(false);
  const value = parseDecimal(amount);
  const error = value == null ? "Escribe el precio." : Number.isNaN(value) || value < 0 ? "Escribe un importe, por ejemplo 19,99." : null;
  const dateError = !date ? "Indica la fecha." : date > todayIso() ? "La fecha no puede ser futura." : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Precio de «${wish.title}»`}
      initialFocus="#price-amount"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="price-form" className="btn btn-ink">
            Registrar precio
          </button>
        </>
      }
    >
      <form
        id="price-form"
        noValidate
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (error || dateError || value == null) return;
          actions.updateWish(wish.id, {
            prices: [...wish.prices, { id: newId(), amount: value, store: store.trim() || null, date }],
          });
          if (wish.targetPrice != null && value <= wish.targetPrice) toast(`«${wish.title}» está en tu precio objetivo o por debajo`);
          onClose();
        }}
      >
        <div className={styles.cols}>
          <div className="field">
            <label htmlFor="price-amount">Precio (€)</label>
            <input
              id="price-amount"
              className="input num"
              inputMode="decimal"
              value={amount}
              aria-invalid={submitted && error ? true : undefined}
              onChange={(e) => setAmount(e.target.value)}
            />
            {submitted && error && <p className="error">{error}</p>}
          </div>
          <div className="field">
            <label htmlFor="price-date">Fecha</label>
            <input id="price-date" className="input" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            {submitted && dateError && <p className="error">{dateError}</p>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="price-store">Tienda</label>
          <input id="price-store" className="input" value={store} onChange={(e) => setStore(e.target.value)} />
        </div>
        <p className="hint muted" style={{ fontSize: 12 }}>
          Por ahora los precios se anotan a mano. El seguimiento automático queda para una versión posterior.
        </p>
      </form>
    </Dialog>
  );
}

/** «Ya lo tengo»: pasa el deseo a la biblioteca conservando sus datos. */
export function ConvertDialog({ wish, onClose }: { wish: WishItem; onClose: () => void }) {
  const router = useRouter();
  const { library, actions } = useLibrary();
  const latest = useMemo(() => [...wish.prices].sort((a, b) => b.date.localeCompare(a.date))[0], [wish.prices]);
  const [platform, setPlatform] = useState(wish.platform ?? "");
  const [format, setFormat] = useState<Format>("fisico");
  const [price, setPrice] = useState(latest ? String(latest.amount).replace(".", ",") : "");
  const [store, setStore] = useState(latest?.store ?? "");
  const [date, setDate] = useState(todayIso());
  const existing = findSameTitle(library, wish.title);
  const [asCopy, setAsCopy] = useState(Boolean(existing));
  const [submitted, setSubmitted] = useState(false);
  const priceValue = parseDecimal(price);
  const platformError = !platform.trim() ? "Elige la plataforma de tu copia." : null;
  const priceError = Number.isNaN(priceValue) || (priceValue != null && priceValue < 0) ? "Escribe un importe, por ejemplo 19,99." : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Pasar «${wish.title}» a la biblioteca`}
      initialFocus="#conv-platform"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="convert-form" className="btn btn-ink">
            Pasar a la biblioteca
          </button>
        </>
      }
    >
      <form
        id="convert-form"
        noValidate
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (platformError || priceError) return;
          const game = actions.convertWish(
            wish.id,
            { platform: platform.trim(), format, pricePaid: priceValue, store: store.trim() || null, acquiredAt: date || null },
            asCopy ? existing?.id : undefined,
          );
          toast(`«${game.title}» ya está en tu biblioteca`, {
            description: "Notas, géneros, carátula y precio se han conservado.",
            action: { label: "Ver ficha", onClick: () => router.push(`/juego/${game.id}`) },
          });
          onClose();
        }}
      >
        <div className={styles.convertHead}>
          <Cover src={wish.coverUrl} title={wish.title} className={styles.convertCover} />
          <p className="muted">
            Se conservan la carátula, los géneros y las notas
            {wish.targetPrice != null ? ", y el precio objetivo se guarda en las notas" : ""}. El deseo sale de la lista.
          </p>
        </div>
        {existing && (
          <div className="field">
            <span className="label" id="conv-existing">
              Ya tienes «{existing.title}»
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="conv-existing">
              <button type="button" role="radio" aria-checked={asCopy} onClick={() => setAsCopy(true)}>
                Añadir como otra copia
              </button>
              <button type="button" role="radio" aria-checked={!asCopy} onClick={() => setAsCopy(false)}>
                Crear un juego aparte
              </button>
            </div>
          </div>
        )}
        <div className={styles.cols}>
          <div className="field">
            <label htmlFor="conv-platform">Plataforma</label>
            <PlatformField id="conv-platform" value={platform} onChange={setPlatform} invalid={submitted && !!platformError} />
            {submitted && platformError && <p className="error">{platformError}</p>}
          </div>
          <div className="field">
            <span className="label" id="conv-format">
              Formato
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="conv-format">
              {(["fisico", "digital"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}>
                  {f === "fisico" ? "Físico" : "Digital"}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="conv-price">Precio pagado (€)</label>
            <input
              id="conv-price"
              className="input num"
              inputMode="decimal"
              value={price}
              aria-invalid={submitted && priceError ? true : undefined}
              onChange={(e) => setPrice(e.target.value)}
            />
            {submitted && priceError && <p className="error">{priceError}</p>}
          </div>
          <div className="field">
            <label htmlFor="conv-store">Tienda</label>
            <input id="conv-store" className="input" value={store} onChange={(e) => setStore(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="conv-date">Fecha de compra</label>
            <input id="conv-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
