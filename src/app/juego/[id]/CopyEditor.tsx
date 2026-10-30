"use client";

import { useState } from "react";
import { PlatformField } from "@/components/game/PlatformField";
import { Dialog } from "@/components/ui/Dialog";
import { parseDecimal } from "@/lib/format";
import { type Copy, AVAILABILITIES, AVAILABILITY_LABEL } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./detail.module.css";

type Draft = {
  platform: string;
  edition: string;
  format: Copy["format"];
  availability: Copy["availability"];
  subscriptionService: string;
  acquiredAt: string;
  price: string;
  store: string;
  hasCase: boolean;
  hasFullArtwork: boolean;
  artworkPrintPending: boolean;
  artworkUrl: string;
  shelfLocation: string;
  lentTo: string;
  lentAt: string;
};

const toDraft = (c: Copy): Draft => ({
  platform: c.platform,
  edition: c.edition ?? "",
  format: c.format,
  availability: c.availability,
  subscriptionService: c.subscriptionService ?? "",
  acquiredAt: c.acquiredAt ?? "",
  price: c.pricePaid != null ? String(c.pricePaid).replace(".", ",") : "",
  store: c.store ?? "",
  hasCase: c.hasCase ?? false,
  hasFullArtwork: c.hasFullArtwork ?? false,
  artworkPrintPending: c.artworkPrintPending ?? false,
  artworkUrl: c.artworkUrl ?? "",
  shelfLocation: c.shelfLocation ?? "",
  lentTo: c.lentTo ?? "",
  lentAt: c.lentAt ?? "",
});

/** Edición de una copia: datos de compra y estantería, con un solo «Guardar». */
export function CopyEditor({ copy, onClose }: { copy: Copy; onClose: () => void }) {
  const { actions } = useLibrary();
  const [d, setD] = useState<Draft>(() => toDraft(copy));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!d.platform.trim()) errs.platform = "Elige una plataforma.";
    const price = parseDecimal(d.price);
    if (Number.isNaN(price) || (price != null && price < 0)) errs.price = "Escribe un importe, por ejemplo 24,99.";
    if (d.artworkUrl && !/^https?:\/\//i.test(d.artworkUrl.trim())) errs.artworkUrl = "El enlace debe empezar por http:// o https://.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    actions.updateCopy(copy.id, {
      platform: d.platform.trim(),
      edition: d.edition.trim() || null,
      format: d.format,
      availability: d.availability,
      subscriptionService: d.availability === "suscripcion" ? d.subscriptionService.trim() || null : null,
      acquiredAt: d.acquiredAt || null,
      pricePaid: price,
      store: d.store.trim() || null,
      hasCase: d.hasCase,
      hasFullArtwork: d.hasFullArtwork,
      artworkPrintPending: d.artworkPrintPending,
      artworkUrl: d.artworkUrl.trim() || null,
      shelfLocation: d.shelfLocation.trim() || null,
      lentTo: d.lentTo.trim() || null,
      lentAt: d.lentTo.trim() ? d.lentAt || null : null,
    });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Copia de ${copy.platform}`}
      initialFocus="#copy-edition"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="copy-form" className="btn btn-ink">
            Guardar copia
          </button>
        </>
      }
    >
      <form id="copy-form" onSubmit={save} noValidate className={styles.copyForm}>
        <fieldset>
          <legend>Copia</legend>
          <div className={styles.grid2}>
            <div className="field">
              <label htmlFor="copy-platform">Plataforma</label>
              <PlatformField id="copy-platform" value={d.platform} onChange={(v) => set("platform", v)} invalid={!!errors.platform} />
              {errors.platform && <p className="error">{errors.platform}</p>}
            </div>
            <div className="field">
              <label htmlFor="copy-edition">Edición</label>
              <input id="copy-edition" className="input" value={d.edition} placeholder="Estándar, coleccionista…" onChange={(e) => set("edition", e.target.value)} />
            </div>
            <div className="field">
              <span className="label" id="copy-format">Formato</span>
              <div className="segmented" role="radiogroup" aria-labelledby="copy-format">
                {(["fisico", "digital"] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={d.format === f} onClick={() => set("format", f)}>
                    {f === "fisico" ? "Físico" : "Digital"}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="copy-availability">Disponibilidad</label>
              <select id="copy-availability" className="select" value={d.availability} onChange={(e) => set("availability", e.target.value as Copy["availability"])}>
                {AVAILABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {AVAILABILITY_LABEL[a]}
                  </option>
                ))}
              </select>
            </div>
            {d.availability === "suscripcion" && (
              <div className="field">
                <label htmlFor="copy-sub">Servicio</label>
                <input id="copy-sub" className="input" value={d.subscriptionService} placeholder="Game Pass, PlayStation Plus…" onChange={(e) => set("subscriptionService", e.target.value)} />
              </div>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Compra (opcional)</legend>
          <div className={styles.grid3}>
            <div className="field">
              <label htmlFor="copy-acq">Fecha de adquisición</label>
              <input id="copy-acq" className="input" type="date" value={d.acquiredAt} onChange={(e) => set("acquiredAt", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="copy-price">Precio pagado (€)</label>
              <input
                id="copy-price"
                className="input num"
                inputMode="decimal"
                value={d.price}
                aria-invalid={errors.price ? true : undefined}
                onChange={(e) => set("price", e.target.value)}
              />
              {errors.price && <p className="error">{errors.price}</p>}
            </div>
            <div className="field">
              <label htmlFor="copy-store">Tienda</label>
              <input id="copy-store" className="input" value={d.store} onChange={(e) => set("store", e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Estantería</legend>
          {d.format === "digital" && (
            <p className="hint muted" style={{ fontSize: 12 }}>
              Una caja decorativa no cambia el formato: la copia sigue siendo digital.
            </p>
          )}
          <div className={styles.checks}>
            <label className="check">
              <input type="checkbox" checked={d.hasCase} onChange={(e) => set("hasCase", e.target.checked)} />
              Tengo caja{d.format === "digital" ? " (decorativa)" : ""}
            </label>
            <label className="check">
              <input type="checkbox" checked={d.hasFullArtwork} onChange={(e) => set("hasFullArtwork", e.target.checked)} />
              Tiene la carátula completa
            </label>
            <label className="check">
              <input type="checkbox" checked={d.artworkPrintPending} onChange={(e) => set("artworkPrintPending", e.target.checked)} />
              Carátula pendiente de imprimir
            </label>
          </div>
          <div className={styles.grid2}>
            <div className="field">
              <label htmlFor="copy-art">Enlace de la carátula imprimible</label>
              <input
                id="copy-art"
                className="input"
                type="url"
                value={d.artworkUrl}
                placeholder="https://"
                aria-invalid={errors.artworkUrl ? true : undefined}
                onChange={(e) => set("artworkUrl", e.target.value)}
              />
              {errors.artworkUrl && <p className="error">{errors.artworkUrl}</p>}
            </div>
            <div className="field">
              <label htmlFor="copy-shelf">Ubicación</label>
              <input id="copy-shelf" className="input" value={d.shelfLocation} placeholder="Balda 2, izquierda" onChange={(e) => set("shelfLocation", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="copy-lent">Prestada a</label>
              <input id="copy-lent" className="input" value={d.lentTo} placeholder="Nadie" onChange={(e) => set("lentTo", e.target.value)} />
            </div>
            {d.lentTo.trim() && (
              <div className="field">
                <label htmlFor="copy-lent-at">Desde</label>
                <input id="copy-lent-at" className="input" type="date" value={d.lentAt} onChange={(e) => set("lentAt", e.target.value)} />
              </div>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
