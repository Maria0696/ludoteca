"use client";

import { ArrowLeft, CalendarCheck, ImageUp, Pencil, Plus, Star, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAddGame } from "@/components/game/AddGameProvider";
import { TitleWithCatalog } from "@/components/game/CatalogSearch";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { DateField, NumberField, TagsField, TextField, ToggleChips } from "@/components/ui/fields";
import { StatusIcon, StatusMark } from "@/components/ui/StatusMark";
import { formatDate, formatMoney, relativeDay } from "@/lib/format";
import { fileToCoverDataUrl } from "@/lib/image";
import {
  type Copy,
  AVAILABILITY_LABEL,
  FORMAT_LABEL,
  GAME_STATUSES,
  MODE_LABEL,
  MOOD_LABEL,
  STATUS_LABEL,
} from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { CopyEditor } from "./CopyEditor";
import styles from "./detail.module.css";

export function GameDetail({ id }: { id: string }) {
  const router = useRouter();
  const { library, actions } = useLibrary();
  const { open: openAdd } = useAddGame();
  const [editing, setEditing] = useState<Copy | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverDialog, setCoverDialog] = useState(false);
  const game = library.games.find((g) => g.id === id);

  if (!game) {
    return (
      <div className={styles.page}>
        <div className="empty">
          <h1>Este juego no está en tu biblioteca</h1>
          <p>Puede que lo hayas eliminado o que el enlace sea de otra biblioteca.</p>
          <Link href="/biblioteca" className="btn btn-ink">
            Volver a la biblioteca
          </Link>
        </div>
      </div>
    );
  }

  const copies = library.copies.filter((c) => c.gameId === game.id);
  const update = (patch: Parameters<typeof actions.updateGame>[1]) => actions.updateGame(game.id, patch);

  const art = game.backdropUrl ?? game.coverUrl;

  return (
    <div className={styles.page}>
      {art && (
        <div className={`${styles.backdrop} ${game.backdropUrl ? "" : styles.backdropFromCover}`} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- arte de fondo de la ficha */}
          <img src={art} alt="" />
        </div>
      )}
      <Link href="/biblioteca" className={styles.back}>
        <ArrowLeft aria-hidden />
        Biblioteca
      </Link>

      <div className={styles.layout}>
        <aside className={styles.aside}>
          <Cover src={game.coverUrl} title={game.title} caption={copies[0]?.platform} priority />
          <button type="button" className="btn btn-sm" onClick={() => setCoverDialog(true)}>
            <ImageUp aria-hidden />
            Cambiar carátula
          </button>
          {game.demo && <p className={styles.demoNote}>Juego de demostración</p>}
        </aside>

        <div className={styles.main}>
          <header className={styles.header}>
            <h1>{game.title}</h1>
            <p className="muted">
              <StatusMark status={game.status} stampKey={game.status} />
              {game.completed100 && (
                <span className={styles.trophy}>
                  <Trophy aria-hidden /> 100 %
                </span>
              )}
              {[...new Set(copies.map((c) => c.platform))].map((p) => (
                <span key={p} className="tag">
                  {p}
                </span>
              ))}
              {game.lastPlayedAt && <span>Última partida {relativeDay(game.lastPlayedAt)}</span>}
            </p>
          </header>

          <section className={styles.section} aria-labelledby="sec-estado">
            <h2 id="sec-estado">Estado</h2>
            <div className="segmented" role="radiogroup" aria-labelledby="sec-estado">
              {GAME_STATUSES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={game.status === s} onClick={() => actions.setStatus(game.id, s)}>
                  <StatusIcon status={s} />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className={styles.quick}>
              <button type="button" className="btn" onClick={() => actions.markPlayedToday(game.id)}>
                <CalendarCheck aria-hidden />
                He jugado hoy
              </button>
              <button type="button" className="btn" aria-pressed={game.favorite} onClick={() => update({ favorite: !game.favorite })}>
                <Star aria-hidden fill={game.favorite ? "currentColor" : "none"} />
                {game.favorite ? "En favoritos" : "Añadir a favoritos"}
              </button>
              <button type="button" className="btn" aria-pressed={game.completed100} onClick={() => update({ completed100: !game.completed100 })}>
                <Trophy aria-hidden />
                {game.completed100 ? "Completado al 100 %" : "Marcar 100 %"}
              </button>
            </div>
            <div className={styles.grid3}>
              <NumberField label="Tu valoración" value={game.rating} onSave={(v) => update({ rating: v })} max={10} step={0.5} unit="/ 10" />
              <NumberField label="Horas jugadas" value={game.hoursPlayed} onSave={(v) => update({ hoursPlayed: v })} max={100000} step={0.5} unit="h" />
              <DateField label="Última partida" value={game.lastPlayedAt} onSave={(v) => update({ lastPlayedAt: v })} />
              <DateField label="Empezado" value={game.startedAt} onSave={(v) => update({ startedAt: v })} />
              <DateField label="Terminado" value={game.finishedAt} onSave={(v) => update({ finishedAt: v })} />
            </div>
          </section>

          <section className={styles.section} aria-labelledby="sec-copias">
            <div className={styles.sectionHead}>
              <h2 id="sec-copias">
                Copias <span className="muted num">{copies.length}</span>
              </h2>
              <button type="button" className="btn btn-sm" onClick={() => openAdd({ gameId: game.id })}>
                <Plus aria-hidden />
                Añadir copia
              </button>
            </div>
            {copies.length === 0 ? (
              <p className="notice">Este juego no tiene copias. Añade una para indicar plataforma y formato.</p>
            ) : (
              <ul className={styles.copies}>
                {copies.map((c) => (
                  <li key={c.id} className={styles.copy}>
                    <div className={styles.copyHead}>
                      <strong>{c.platform}</strong>
                      <span>
                        {FORMAT_LABEL[c.format]}
                        {c.edition ? ` · ${c.edition}` : ""}
                      </span>
                      <span className={styles.copyActions}>
                        <button type="button" className="btn btn-sm btn-quiet" onClick={() => setEditing(c)} aria-label={`Editar la copia de ${c.platform}`}>
                          <Pencil aria-hidden />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-quiet"
                          onClick={() => actions.deleteCopy(c.id)}
                          aria-label={`Eliminar la copia de ${c.platform}`}
                        >
                          <Trash2 aria-hidden />
                        </button>
                      </span>
                    </div>
                    <dl className={styles.facts}>
                      <div>
                        <dt>Disponibilidad</dt>
                        <dd>
                          {c.lentTo ? `Prestada a ${c.lentTo}${c.lentAt ? ` desde ${formatDate(c.lentAt)}` : ""}` : AVAILABILITY_LABEL[c.availability]}
                          {c.availability === "suscripcion" && c.subscriptionService ? ` · ${c.subscriptionService}` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>Adquirida</dt>
                        <dd>{formatDate(c.acquiredAt)}</dd>
                      </div>
                      <div>
                        <dt>Precio</dt>
                        <dd className="num">{c.pricePaid != null ? formatMoney(c.pricePaid) : "—"}</dd>
                      </div>
                      <div>
                        <dt>Tienda</dt>
                        <dd>{c.store ?? "—"}</dd>
                      </div>
                      <div>
                        <dt>Estantería</dt>
                        <dd>{shelfSummary(c)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="sec-jugar">
            <h2 id="sec-jugar">Para elegir a qué jugar</h2>
            <p className="muted" style={{ fontSize: 13, maxWidth: "60ch" }}>
              La recomendación compara tu tiempo libre con lo que dura una sesión, no con lo que dura el juego entero.
            </p>
            <div className={styles.grid3}>
              <NumberField
                label="Una sesión dura unos"
                value={game.sessionMinutes}
                onSave={(v) => update({ sessionMinutes: v })}
                min={1}
                max={1440}
                integer
                unit="min"
              />
              <NumberField label="Duración total" value={game.lengthHours} onSave={(v) => update({ lengthHours: v })} max={100000} step={0.5} unit="h" hint="Historia principal" />
            </div>
            <ToggleChips label="Cómo se juega" options={MODE_LABEL} value={game.modes} onChange={(v) => update({ modes: v })} />
            <ToggleChips label="Tipo de experiencia" options={MOOD_LABEL} value={game.moods} onChange={(v) => update({ moods: v })} />
          </section>

          <section className={styles.section} aria-labelledby="sec-notas">
            <h2 id="sec-notas">Notas y etiquetas</h2>
            <div className={styles.grid2}>
              <TagsField label="Géneros" value={game.genres} onSave={(v) => update({ genres: v })} placeholder="Aventura, Plataformas" />
              <TagsField label="Etiquetas personales" value={game.tags} onSave={(v) => update({ tags: v })} placeholder="regalo, pendiente de platino" />
            </div>
            <TextField label="Notas" value={game.notes} onSave={(v) => update({ notes: v })} multiline />
            <TextField label="Título" value={game.title} onSave={(v) => v && update({ title: v })} maxLength={200} />
          </section>

          {library.lists.length > 0 && (
            <section className={styles.section} aria-labelledby="sec-listas">
              <h2 id="sec-listas">Listas</h2>
              <div className="segmented">
                {library.lists.map((l) => (
                  <button key={l.id} type="button" aria-pressed={l.gameIds.includes(game.id)} onClick={() => actions.toggleInList(l.id, game.id)}>
                    {l.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.section} aria-labelledby="sec-borrar">
            <h2 id="sec-borrar">Eliminar</h2>
            <p className="muted" style={{ fontSize: 13 }}>
              Quita el juego, {copies.length === 1 ? "su copia" : copies.length === 0 ? "" : `sus ${copies.length} copias`}
              {copies.length ? " y " : ""}su presencia en tus listas. Podrás deshacerlo durante unos segundos.
            </p>
            <button type="button" className="btn btn-danger" style={{ justifySelf: "start" }} onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              Eliminar «{game.title}»
            </button>
          </section>
        </div>
      </div>

      {editing && <CopyEditor key={editing.id} copy={editing} onClose={() => setEditing(null)} />}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`¿Eliminar «${game.title}»?`}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirmDelete(false);
                actions.deleteGame(game.id);
                router.push("/biblioteca");
              }}
            >
              Eliminar juego
            </button>
          </>
        }
      >
        <p>Se eliminarán también sus copias ({copies.length}). Tendrás unos segundos para deshacerlo.</p>
      </Dialog>

      {coverDialog && (
        <CoverDialog
          title={game.title}
          current={game.coverUrl}
          onClose={() => setCoverDialog(false)}
          onSave={(coverUrl) => {
            update({ coverUrl });
            setCoverDialog(false);
          }}
        />
      )}
    </div>
  );
}

function shelfSummary(c: Copy): string {
  const parts: string[] = [];
  if (c.hasCase) parts.push(c.format === "digital" ? "Caja decorativa" : "Con caja");
  if (c.hasFullArtwork) parts.push("carátula completa");
  if (c.artworkPrintPending) parts.push("carátula por imprimir");
  if (c.shelfLocation) parts.push(c.shelfLocation);
  return parts.length ? parts.join(" · ") : "—";
}

function CoverDialog({
  title,
  current,
  onClose,
  onSave,
}: {
  title: string;
  current: string | null | undefined;
  onClose: () => void;
  onSave: (url: string | null) => void;
}) {
  const [url, setUrl] = useState(current?.startsWith("data:") ? "" : current ?? "");
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [search, setSearch] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Cambiar carátula"
      footer={
        <>
          {current && (
            <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => onSave(null)}>
              Quitar carátula
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-ink" disabled={!preview || preview === current} onClick={() => onSave(preview)}>
            Guardar carátula
          </button>
        </>
      }
    >
      <div className={styles.coverEdit}>
        <Cover src={preview} title={title} className={styles.coverPreview} />
        <div className={styles.coverFields}>
          <div className="field">
            <label htmlFor="cover-search">Buscar en el catálogo</label>
            <TitleWithCatalog
              id="cover-search"
              value={search}
              onChange={setSearch}
              onPick={(g) => {
                if (g.coverUrl) setPreview(g.coverUrl);
                else toast("Ese resultado no tiene carátula en el catálogo.");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="cover-url">O pega un enlace a una imagen</label>
            <input
              id="cover-url"
              className="input"
              type="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                if (!url.trim()) return;
                if (!/^https?:\/\//i.test(url.trim())) return setError("El enlace debe empezar por http:// o https://.");
                setError(null);
                setPreview(url.trim());
              }}
            />
          </div>
          <div className="field">
            <span className="label">O sube un archivo</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              id="cover-file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setPreview(await fileToCoverDataUrl(file));
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo leer la imagen.");
                }
              }}
            />
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={() => fileRef.current?.click()}>
              <ImageUp aria-hidden />
              Elegir imagen
            </button>
            <p className="hint">Se guarda reducida a 600 px de ancho.</p>
          </div>
          {error && (
            <p className="notice is-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
