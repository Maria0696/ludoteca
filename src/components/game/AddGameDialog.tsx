"use client";

import { Copy as CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { CatalogGame } from "@/lib/catalog";
import { findSameTitle } from "@/lib/filters";
import { copiesSummary } from "@/lib/format";
import { type Format, type Game, type GameStatus, GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { Cover } from "../ui/Cover";
import { Dialog } from "../ui/Dialog";
import { StatusIcon } from "../ui/StatusMark";
import { TitleWithCatalog } from "./CatalogSearch";
import { PlatformField } from "./PlatformField";
import styles from "./game.module.css";

type Picked = Pick<CatalogGame, "igdbId" | "coverUrl" | "backdropUrl" | "genres" | "modes" | "moods" | "lengthHours">;

export function AddGameDialog({
  open,
  onClose,
  initialGameId,
  initialTitle,
}: {
  open: boolean;
  onClose: () => void;
  initialGameId?: string;
  initialTitle?: string;
}) {
  const router = useRouter();
  const { library, actions } = useLibrary();
  const fixedGame = initialGameId ? library.games.find((g) => g.id === initialGameId) : undefined;

  const [title, setTitle] = useState(initialTitle ?? "");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [platform, setPlatform] = useState("");
  const [format, setFormat] = useState<Format>("fisico");
  const [status, setStatus] = useState<GameStatus>("pendiente");
  const [asCopy, setAsCopy] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const duplicate: Game | undefined = useMemo(() => {
    if (fixedGame) return undefined;
    if (picked?.igdbId) {
      const byId = library.games.find((g) => g.igdbId === picked.igdbId);
      if (byId) return byId;
    }
    return findSameTitle(library, title);
  }, [fixedGame, library, picked, title]);

  const target = fixedGame ?? (duplicate && asCopy ? duplicate : undefined);
  const titleError = !target && !title.trim() ? "Escribe el título del juego." : null;
  const platformError = !platform.trim() ? "Elige una plataforma para guardar la copia." : null;
  const sameCopy =
    target && library.copies.find((c) => c.gameId === target.id && c.platform === platform && c.format === format);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || platformError) return;
    const copy = { platform: platform.trim(), format };
    let game: Game;
    if (target) {
      actions.addCopy(target.id, copy);
      game = target;
      toast(`Nueva copia de «${game.title}» en ${copy.platform}`, {
        action: { label: "Ver ficha", onClick: () => router.push(`/juego/${game.id}`) },
      });
    } else {
      game = actions.addGame(
        {
          title,
          status,
          igdbId: picked?.igdbId ?? null,
          coverUrl: picked?.coverUrl ?? null,
          backdropUrl: picked?.backdropUrl ?? null,
          genres: picked?.genres ?? [],
          modes: picked?.modes ?? [],
          moods: picked?.moods ?? [],
          lengthHours: picked?.lengthHours ?? null,
        },
        copy,
      );
      toast(`«${game.title}» añadido a tu biblioteca`, {
        description: "Completa el resto de datos cuando quieras.",
        action: { label: "Ver ficha", onClick: () => router.push(`/juego/${game.id}`) },
      });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fixedGame ? `Otra copia de «${fixedGame.title}»` : "Añadir juego"}
      initialFocus={fixedGame ? "#add-platform" : "#add-title"}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="add-game" className="btn btn-ink">
            {target ? "Añadir copia" : "Añadir a la biblioteca"}
          </button>
        </>
      }
    >
      <form id="add-game" onSubmit={submit} noValidate className={styles.addForm}>
        {!fixedGame && (
          <div className="field">
            <label htmlFor="add-title">Título</label>
            <div className={styles.titleRow}>
              {picked?.coverUrl && <Cover src={picked.coverUrl} title={title} className={styles.pickedCover} />}
              <TitleWithCatalog
                id="add-title"
                value={title}
                onChange={(v) => {
                  setTitle(v);
                  setPicked(null);
                }}
                onPick={(g) => {
                  setTitle(g.title);
                  setPicked(g);
                  if (!platform && g.platforms.length === 1) setPlatform(g.platforms[0]);
                }}
                invalid={submitted && !!titleError}
                describedBy={submitted && titleError ? "add-title-error" : undefined}
              />
            </div>
            {submitted && titleError && (
              <p className="error" id="add-title-error">
                {titleError}
              </p>
            )}
          </div>
        )}

        {duplicate && (
          <div className={styles.duplicate} role="status">
            <CopyIcon aria-hidden />
            <div>
              <p>
                Ya tienes <strong>«{duplicate.title}»</strong> ({copiesSummary(library.copies.filter((c) => c.gameId === duplicate.id))}).
              </p>
              <div className="segmented" role="radiogroup" aria-label="¿Qué quieres hacer?">
                <button type="button" role="radio" aria-checked={asCopy} onClick={() => setAsCopy(true)}>
                  Añadir otra copia
                </button>
                <button type="button" role="radio" aria-checked={!asCopy} onClick={() => setAsCopy(false)}>
                  Es un juego distinto
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.twoCols}>
          <div className="field">
            <label htmlFor="add-platform">Plataforma</label>
            <PlatformField
              id="add-platform"
              value={platform}
              onChange={setPlatform}
              invalid={submitted && !!platformError}
              describedBy={submitted && platformError ? "add-platform-error" : undefined}
            />
            {submitted && platformError && (
              <p className="error" id="add-platform-error">
                {platformError}
              </p>
            )}
          </div>
          <div className="field">
            <span className="label" id="add-format-label">
              Formato
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="add-format-label">
              {(["fisico", "digital"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)}>
                  {f === "fisico" ? "Físico" : "Digital"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sameCopy && (
          <p className="notice" role="status">
            Ya hay una copia {format === "fisico" ? "física" : "digital"} de este juego en {platform}. Si es otra (por ejemplo, otra edición),
            añádela igualmente y diferencia la edición en la ficha.
          </p>
        )}

        {!target && (
          <div className="field">
            <span className="label" id="add-status-label">
              Estado
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="add-status-label">
              {GAME_STATUSES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
                  <StatusIcon status={s} />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="hint muted" style={{ fontSize: 12 }}>
          Precio, edición, horas, notas y estantería se completan después en la ficha.
        </p>
      </form>
    </Dialog>
  );
}
