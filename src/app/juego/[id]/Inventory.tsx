"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { usePlatformOptions } from "@/components/game/PlatformField";
import { CARTRIDGE_URL, DIGITAL_URL } from "@/components/pixel/sprites";
import { formatDate, formatMoney } from "@/lib/format";
import { type Copy, type PriceKind, AVAILABILITIES, AVAILABILITY_LABEL, FORMAT_LABEL, PRICE_KIND_LABEL, PRICE_KINDS } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import styles from "./adventure.module.css";
import { Editable } from "./Editable";

const MIN_SLOTS = 9;
const OTHER = "__otra__";

type TextField = "edition" | "subscriptionService" | "store" | "shelfLocation" | "bundleWith";

const iconFor = (copy: Copy) => (copy.format === "fisico" ? CARTRIDGE_URL : DIGITAL_URL);

const linkHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Enlace guardado";
  }
};

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.statRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function PlatformPick({ value, onChange }: { value: string; onChange: (platform: string) => void }) {
  const options = usePlatformOptions([value]);
  const [custom, setCustom] = useState(false);
  const cancelled = useRef(false);

  if (custom) {
    return (
      <span className={styles.editWrap}>
        <input
          className={styles.edit}
          aria-label="Nombre de la plataforma"
          placeholder="Nombre de la plataforma"
          maxLength={40}
          autoFocus
          onBlur={(e) => {
            if (cancelled.current) return;
            const name = e.target.value.trim();
            if (name) onChange(name);
            setCustom(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelled.current = true;
              setCustom(false);
            }
          }}
        />
      </span>
    );
  }

  return (
    <select
      className={styles.statSelect}
      aria-label="Plataforma"
      value={value}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          cancelled.current = false;
          setCustom(true);
        } else onChange(e.target.value);
      }}
    >
      {options.map((platform) => (
        <option key={platform} value={platform}>
          {platform}
        </option>
      ))}
      <option value={OTHER}>Otra…</option>
    </select>
  );
}

/** Todos los datos de una copia a la vista; cada uno se cambia al tocarlo y se guarda solo. */
function ItemSheet({ copy, onDelete }: { copy: Copy; onDelete: () => void }) {
  const { actions } = useLibrary();
  const save = (patch: Partial<Copy>) => actions.updateCopy(copy.id, patch);

  const text = (label: string, field: TextField) => (
    <Editable
      kind="text"
      quiet
      label={label}
      value={copy[field]}
      display={copy[field] ?? null}
      empty="Añadir"
      maxLength={200}
      onSave={(v) => save({ [field]: v } as Partial<Copy>)}
    />
  );

  const check = (field: "hasCase" | "hasFullArtwork", label: string) => (
    <label className={styles.toggle}>
      <input type="checkbox" checked={Boolean(copy[field])} onChange={(e) => save({ [field]: e.target.checked } as Partial<Copy>)} />
      {label}
    </label>
  );

  const digital = copy.format === "digital";

  return (
    <div>
      <div className={styles.itemHead}>
        {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
        <img src={iconFor(copy)} alt="" />
        <h3 className={styles.itemName}>{copy.platform}</h3>
        <div className={styles.picks} role="radiogroup" aria-label="Formato">
          {(["fisico", "digital"] as const).map((format) => (
            <button key={format} type="button" className={styles.pick} role="radio" aria-checked={copy.format === format} onClick={() => save({ format })}>
              {FORMAT_LABEL[format]}
            </button>
          ))}
        </div>
        <button type="button" className={`${styles.action} ${styles.danger} ${styles.itemDelete}`} onClick={onDelete} aria-label={`Eliminar la copia de ${copy.platform}`}>
          <Trash2 aria-hidden />
        </button>
      </div>

      <div className={styles.sheet}>
        <div className={styles.statColumn}>
          <div>
            <h4 className={styles.statName}>Copia</h4>
            <dl className={styles.stats}>
              <Row label="Plataforma">
                <PlatformPick value={copy.platform} onChange={(platform) => save({ platform })} />
              </Row>
              <Row label="Edición">{text("Edición", "edition")}</Row>
              <Row label="Disponibilidad">
                <select
                  className={styles.statSelect}
                  aria-label="Disponibilidad"
                  value={copy.availability}
                  onChange={(e) => {
                    const availability = e.target.value as Copy["availability"];
                    save({ availability, subscriptionService: availability === "suscripcion" ? copy.subscriptionService : null });
                  }}
                >
                  {AVAILABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {AVAILABILITY_LABEL[a]}
                    </option>
                  ))}
                </select>
              </Row>
              {copy.availability === "suscripcion" && <Row label="Servicio">{text("Servicio", "subscriptionService")}</Row>}
            </dl>
          </div>
          <div>
            <h4 className={styles.statName}>Compra</h4>
            <dl className={styles.stats}>
              <Row label="Fecha">
                <Editable kind="date" quiet label="Fecha de adquisición" value={copy.acquiredAt} display={copy.acquiredAt ? formatDate(copy.acquiredAt) : null} empty="Añadir" onSave={(acquiredAt) => save({ acquiredAt })} />
              </Row>
              {/* El precio es un importe o el motivo de no tenerlo: un regalo, gratis, en un pack o «no lo sé». */}
              <Row label="Precio">
                <span className={styles.priceLine}>
                  {!copy.priceKind && (
                    <Editable kind="number" quiet label="Precio" value={copy.pricePaid} display={copy.pricePaid != null ? formatMoney(copy.pricePaid) : null} empty="Añadir" max={100000} onSave={(pricePaid) => save({ pricePaid })} />
                  )}
                  <select
                    className={styles.statSelect}
                    aria-label="Cómo lo conseguiste"
                    value={copy.priceKind ?? "pagado"}
                    onChange={(e) => {
                      const kind = e.target.value === "pagado" ? null : (e.target.value as PriceKind);
                      save({ priceKind: kind, pricePaid: kind ? null : copy.pricePaid, bundleWith: kind === "pack" ? copy.bundleWith : null });
                    }}
                  >
                    <option value="pagado">Pagado</option>
                    {PRICE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {PRICE_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </span>
              </Row>
              {copy.priceKind === "pack" && <Row label="En un pack con">{text("En un pack con", "bundleWith")}</Row>}
              <Row label="Tienda">{text("Tienda", "store")}</Row>
            </dl>
          </div>
        </div>

        <div className={styles.statColumn}>
          <div>
            <h4 className={styles.statName}>Estantería</h4>
            <dl className={styles.stats}>
              <Row label="Ubicación">{text("Ubicación", "shelfLocation")}</Row>
              <Row label="Prestada a">
                <Editable kind="text" quiet label="Prestada a" value={copy.lentTo} display={copy.lentTo ?? null} empty="Nadie" maxLength={200} onSave={(lentTo) => save({ lentTo, lentAt: lentTo ? copy.lentAt : null })} />
              </Row>
              {copy.lentTo && (
                <Row label="Desde">
                  <Editable kind="date" quiet label="Prestada desde" value={copy.lentAt} display={copy.lentAt ? formatDate(copy.lentAt) : null} empty="Añadir" onSave={(lentAt) => save({ lentAt })} />
                </Row>
              )}
              {/* La carátula imprimible es para la caja decorativa de una copia digital: una física ya trae la suya. */}
              {digital && (
                <Row label="Carátula imprimible">
                  <Editable
                    kind="text"
                    quiet
                    label="Enlace de la carátula imprimible"
                    value={copy.artworkUrl}
                    display={copy.artworkUrl ? linkHost(copy.artworkUrl) : null}
                    empty="Añadir enlace"
                    maxLength={2000}
                    validate={(url) => (/^https?:\/\//i.test(url) ? null : "El enlace debe empezar por http:// o https://.")}
                    onSave={(artworkUrl) => save({ artworkUrl })}
                  />
                </Row>
              )}
            </dl>
            {/* Una copia física ya trae su caja y su carátula: solo se pregunta por la caja decorativa de una digital. */}
            {digital && (
              <div className={styles.toggles}>
                {check("hasCase", "Tengo caja (decorativa)")}
                {check("hasFullArtwork", "Tiene la carátula completa")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Inventory({ gameId, copies, onAdd }: { gameId: string; copies: Copy[]; onAdd: () => void }) {
  const { actions } = useLibrary();
  const { details, detailsShown } = useAddGame();
  const arrived = details.gameId === gameId;
  const [selectedId, setSelectedId] = useState(arrived ? details.copyId : null);
  const sectionRef = useRef<HTMLElement>(null);
  const current = copies.find((c) => c.id === selectedId) ?? copies[0];

  // Al llegar desde el cofre, el inventario se presenta solo y queda listo para rellenar.
  useEffect(() => {
    if (!arrived) return;
    const section = sectionRef.current;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      section?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
      section?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
      section?.classList.add(styles.arrived);
      detailsShown();
    });
    return () => cancelAnimationFrame(frame);
  }, [arrived, detailsShown]);

  return (
    <section ref={sectionRef} className={`${styles.window} ${styles.panel} ${styles.inventory}`} aria-labelledby="inventario">
      <div className={styles.panelTop}>
        <h2 id="inventario" className={`${styles.panelHead} ${styles.inventoryHead}`}>
          Inventario
        </h2>
        <span className={styles.statNote}>
          {copies.length} {copies.length === 1 ? "copia" : "copias"}
        </span>
      </div>
      <div className={styles.inventoryBody}>
        <div className={styles.slots} role="group" aria-label="Tus copias">
          {copies.map((copy) => (
            <button
              key={copy.id}
              type="button"
              className={styles.slot}
              aria-pressed={copy.id === current?.id}
              aria-label={`${copy.platform}, ${FORMAT_LABEL[copy.format]}`}
              onClick={() => setSelectedId(copy.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
              <img src={iconFor(copy)} alt="" />
              <span>{copy.platform}</span>
            </button>
          ))}
          <button type="button" className={`${styles.slot} ${styles.slotAdd}`} onClick={onAdd} aria-label="Añadir copia">
            <Plus aria-hidden />
          </button>
          {Array.from({ length: Math.max(0, MIN_SLOTS - copies.length - 1) }, (_, i) => (
            <span key={i} className={styles.slot} />
          ))}
        </div>
        {current ? (
          <ItemSheet key={current.id} copy={current} onDelete={() => actions.deleteCopy(current.id)} />
        ) : (
          <p>Este juego no tiene copias. Añade una para indicar plataforma y formato.</p>
        )}
      </div>
    </section>
  );
}
