"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { formatMoney } from "@/lib/format";
import type { WishItem } from "@/lib/model";
import { chooseEshop, chooseSteam, eshopOptions, steamOptions } from "@/lib/price-sync";
import { rankEshop } from "@/lib/price-watch";
import { useLibrary } from "@/lib/store";
import styles from "./wishlist.module.css";

/** Una opción para elegir: su nombre y, debajo, lo que la distingue (consola, precio). */
type Option = { key: string; title: string; meta: string; choose: () => Promise<void> };

const price = (amount: number | null) => (amount != null ? formatMoney(amount) : "sin precio");

/**
 * Elegir con qué producto de una tienda se vigila un deseo, cuando no hay uno solo con su título (ediciones, paquetes,
 * bandas sonoras…): cada opción con su precio de ahora, para distinguirlas.
 */
function StoreChooser({
  wish,
  store,
  note,
  empty,
  load,
  onClose,
}: {
  wish: WishItem;
  store: string;
  note: string;
  empty: string;
  load: (query: string) => Promise<Option[]>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(wish.title);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Se busca al abrir y al pulsar «Buscar», no a cada letra. Si se busca otra vez antes de que llegue la respuesta, la
  // anterior se descarta.
  const [search, setSearch] = useState(0);
  useEffect(() => {
    let alive = true;
    load(query.trim())
      .then((list) => {
        if (!alive) return;
        setError(null);
        setOptions(list);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : `${store} no responde ahora.`));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setOptions(null);
    setSearch((n) => n + 1);
  };

  const choose = (option: Option) => {
    onClose();
    void option.choose().then(
      () => toast(`«${wish.title}» se vigila en ${store}`),
      () => toast.error(`Enlazado, pero ${store} no ha dado el precio: se mirará la próxima vez.`),
    );
  };

  return (
    <Dialog open onClose={onClose} title={`Elegir «${wish.title}» en ${store}`}>
      <p className={styles.chooserNote}>{note}</p>
      <form className={styles.chooserSearch} onSubmit={submit} role="search">
        <input
          type="search"
          className="input"
          aria-label={`Buscar en ${store}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="btn">
          Buscar
        </button>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : options === null ? (
        <p aria-live="polite">Buscando en {store}…</p>
      ) : options.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <ul className={styles.chooser}>
          {options.map((o) => (
            <li key={o.key}>
              <button type="button" className={styles.option} onClick={() => choose(o)}>
                <span className={styles.optionTitle}>{o.title}</span>
                <span className={`${styles.optionMeta} num`}>{o.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/** En el eShop, cuando hay varias opciones con el mismo nombre: cada una con su consola y su precio. */
export function EshopChooser({ wish, onClose }: { wish: WishItem; onClose: () => void }) {
  const { actions } = useLibrary();
  const load = async (query: string) =>
    rankEshop(query, await eshopOptions({ ...wish, title: query })).map((o) => ({
      key: o.nsuid,
      title: o.title,
      meta: `${o.platform} · ${price(o.amount)}`,
      choose: () => chooseEshop(wish, o.nsuid, actions.updateWish),
    }));
  return (
    <StoreChooser
      wish={wish}
      store="el eShop"
      note="Hay varias opciones con ese nombre. Elige la que quieres (o busca con otras palabras): se vigilará su precio."
      empty="El eShop no encuentra este juego. Prueba con otras palabras, o comprueba la consola del deseo."
      load={load}
      onClose={onClose}
    />
  );
}

/** En Steam, para un deseo de PC que no se ha podido enlazar solo: los juegos que encuentra con ese título y su precio. */
export function SteamChooser({ wish, onClose }: { wish: WishItem; onClose: () => void }) {
  const { actions } = useLibrary();
  const load = async (query: string) =>
    rankEshop(query, await steamOptions({ ...wish, title: query })).map((o) => ({
      key: String(o.appId),
      title: o.title,
      meta: price(o.amount),
      choose: () => chooseSteam(wish, o.appId, actions.updateWish),
    }));
  return (
    <StoreChooser
      wish={wish}
      store="Steam"
      note="No hay un único juego con ese título en Steam. Elige el que quieres (o busca con otras palabras): se vigilará su precio."
      empty="Steam no encuentra este título. Prueba con otras palabras."
      load={load}
      onClose={onClose}
    />
  );
}
