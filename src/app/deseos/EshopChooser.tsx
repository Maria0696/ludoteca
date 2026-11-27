"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { formatMoney } from "@/lib/format";
import type { WishItem } from "@/lib/model";
import { chooseEshop, eshopOptions } from "@/lib/price-sync";
import { type EshopCandidate, rankEshop } from "@/lib/price-watch";
import { useLibrary } from "@/lib/store";
import styles from "./wishlist.module.css";

/**
 * Elegir con qué producto del eShop se vigila un deseo, cuando hay varias opciones (ediciones, paquetes de mejora):
 * cada una con su consola y su precio de ahora, para distinguirlas.
 */
export function EshopChooser({ wish, onClose }: { wish: WishItem; onClose: () => void }) {
  const { actions } = useLibrary();
  const [options, setOptions] = useState<EshopCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    eshopOptions(wish)
      .then((list) => alive && setOptions(rankEshop(wish.title, list)))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "El eShop no responde ahora."));
    return () => {
      alive = false;
    };
  }, [wish]);

  const choose = (option: EshopCandidate) => {
    onClose();
    void chooseEshop(wish, option.nsuid, actions.updateWish).then(
      () => toast(`«${wish.title}» se vigila en el eShop`),
      () => toast.error("Enlazado, pero el eShop no ha dado el precio: se mirará la próxima vez."),
    );
  };

  return (
    <Dialog open onClose={onClose} title={`Elegir «${wish.title}» en el eShop`}>
      <p className={styles.chooserNote}>Hay varias opciones con ese nombre. Elige la que quieres: se vigilará su precio.</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : options === null ? (
        <p aria-live="polite">Buscando en el eShop…</p>
      ) : options.length === 0 ? (
        <p>El eShop ya no encuentra este juego. Comprueba el título o la consola del deseo.</p>
      ) : (
        <ul className={styles.chooser}>
          {options.map((o) => (
            <li key={o.nsuid}>
              <button type="button" className={styles.option} onClick={() => choose(o)}>
                <span className={styles.optionTitle}>{o.title}</span>
                <span className={styles.optionMeta}>
                  {o.platform} · <span className="num">{o.amount != null ? formatMoney(o.amount) : "sin precio"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
