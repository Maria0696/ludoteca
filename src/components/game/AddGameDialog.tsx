"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { heavy, hud } from "@/components/home/fonts";
import { CHEST_CLOSED_URL, CHEST_OPEN_URL } from "@/components/pixel/sprites";
import { ARCADE_STATUS } from "@/components/ui/StatusMark";
import type { CatalogGame } from "@/lib/catalog";
import { findSameTitle } from "@/lib/filters";
import { copiesSummary } from "@/lib/format";
import { type Format, type Game, type GameStatus, GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { Cover } from "../ui/Cover";
import { Dialog } from "../ui/Dialog";
import { TitleWithCatalog } from "./CatalogSearch";
import { PlatformTiles } from "./PlatformTiles";
import styles from "./loot.module.css";

type Picked = Pick<CatalogGame, "igdbId" | "coverUrl" | "backdropUrl" | "genres" | "modes" | "moods" | "lengthHours" | "criticRating" | "summary" | "developer" | "franchise" | "saga" | "gameType" | "baseGame" | "releaseDate" | "ageRating">;
type Phase = "form" | "shake" | "open";
type Won = { id: string; copyId: string | null; title: string; coverUrl?: string | null; line: string; copy: boolean };

const SHAKE_MS = 680;
const LONG_TITLE = 28;

const formatName = (format: Format) => (format === "fisico" ? "Físico" : "Digital");

export function AddGameDialog({
  open,
  onClose,
  onDetails,
  initialGameId,
  initialTitle,
}: {
  open: boolean;
  onClose: () => void;
  onDetails: (gameId: string, copyId: string | null) => void;
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
  const [phase, setPhase] = useState<Phase>("form");
  const [won, setWon] = useState<Won | null>(null);
  const [round, setRound] = useState(0);
  const roomRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (phase === "open") detailsRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Una vez guardado el juego, ya no cuenta como repetido del propio formulario.
  const duplicate: Game | undefined = useMemo(() => {
    if (fixedGame || won) return undefined;
    if (picked?.igdbId) {
      const byId = library.games.find((g) => g.igdbId === picked.igdbId);
      if (byId) return byId;
    }
    return findSameTitle(library, title);
  }, [fixedGame, library, picked, title, won]);

  const target = fixedGame ?? (duplicate && asCopy ? duplicate : undefined);
  const titleError = !target && !title.trim() ? "Escribe el título del juego." : null;
  const platformError = !platform.trim() ? "Elige una plataforma para guardar la copia." : null;
  const sameCopy =
    !won && target && library.copies.find((c) => c.gameId === target.id && c.platform === platform && c.format === format);
  const previewCover = picked?.coverUrl ?? fixedGame?.coverUrl ?? duplicate?.coverUrl ?? null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (titleError || platformError) return;
    const copy = { platform: platform.trim(), format };
    const place = `${copy.platform} · ${formatName(format)}`;
    if (target) {
      const added = actions.addCopy(target.id, copy);
      setWon({ id: target.id, copyId: added.id, title: target.title, coverUrl: target.coverUrl, line: `${place} · Otra copia`, copy: true });
    } else {
      const game = actions.addGame(
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
          criticRating: picked?.criticRating ?? null,
          summary: picked?.summary ?? null,
          developer: picked?.developer ?? null,
          franchise: picked?.franchise ?? null,
          saga: picked?.saga ?? null,
          gameType: picked?.gameType ?? null,
          baseGame: picked?.baseGame ?? null,
          releaseDate: picked?.releaseDate ?? null,
          ageRating: picked?.ageRating ?? null,
        },
        copy,
      );
      setWon({ id: game.id, copyId: null, title: game.title, coverUrl: game.coverUrl, line: `${place} · ${STATUS_LABEL[status]}`, copy: false });
    }
    roomRef.current?.closest("dialog")?.scrollTo({ top: 0 });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("open");
    } else {
      setPhase("shake");
      timer.current = window.setTimeout(() => setPhase("open"), SHAKE_MS);
    }
  }

  function addAnother() {
    window.clearTimeout(timer.current);
    setTitle("");
    setPicked(null);
    setPlatform("");
    setFormat("fisico");
    setStatus("pendiente");
    setAsCopy(true);
    setSubmitted(false);
    setWon(null);
    setPhase("form");
    setRound((r) => r + 1);
    requestAnimationFrame(() => roomRef.current?.querySelector<HTMLElement>(fixedGame ? "#add-platform" : "#add-title")?.focus());
  }

  const heading = fixedGame ? `Otra copia de «${fixedGame.title}»` : "¿Qué has encontrado?";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fixedGame ? heading : "Añadir juego"}
      initialFocus={fixedGame ? "#add-platform" : "#add-title"}
      bareClassName={`${styles.dialog} ${heavy.variable} ${hud.variable}`}
    >
      <div ref={roomRef} className={styles.room} data-fase={phase}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
          <X aria-hidden />
        </button>
        <div className={styles.scene}>
          <div className={styles.rays} />
          {phase === "form" && previewCover && (
            // eslint-disable-next-line @next/next/no-img-element -- carátula externa
            <img key={previewCover} src={previewCover} alt="" className={styles.peek} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- dibujo propio en SVG */}
          <img src={phase === "open" ? CHEST_OPEN_URL : CHEST_CLOSED_URL} alt="" className={styles.chest} />
          {phase === "open" && won && (
            <>
              <Cover src={won.coverUrl} title={won.title} caption="" priority className={styles.prize} />
              <div className={styles.win} role="status">
                <h2 className={won.title.length > LONG_TITLE ? styles.winLong : undefined}>
                  {won.copy ? `¡Otra copia de ${won.title}!` : `¡Has conseguido ${won.title}!`}
                </h2>
                <p>{won.line}</p>
                <div className={styles.winActions}>
                  <button
                    ref={detailsRef}
                    type="button"
                    className={styles.go}
                    onClick={() => {
                      onDetails(won.id, won.copyId);
                      router.push(`/juego/${won.id}`);
                      onClose();
                    }}
                  >
                    Apuntar detalles
                  </button>
                  <button type="button" className={`${styles.go} ${styles.goAlt}`} onClick={addAnother}>
                    Añadir otro
                  </button>
                  <button
                    type="button"
                    className={`${styles.go} ${styles.goAlt}`}
                    onClick={() => {
                      router.push(`/juego/${won.id}`);
                      onClose();
                    }}
                  >
                    Ver ficha
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <form id="add-game" onSubmit={submit} noValidate className={styles.form} inert={Boolean(won)}>
          <div className={styles.head}>
            <h2>{heading}</h2>
          </div>

          {!fixedGame && (
            <div className={styles.field}>
              <label htmlFor="add-title" className={styles.label}>
                Título
              </label>
              <div className={styles.titleField}>
                <TitleWithCatalog
                  key={round}
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
                <p className={styles.error} id="add-title-error">
                  {titleError}
                </p>
              )}
            </div>
          )}

          {duplicate && (
            <div className={styles.duplicate} role="status">
              <p>
                Ya tienes <strong>«{duplicate.title}»</strong> ({copiesSummary(library.copies.filter((c) => c.gameId === duplicate.id))}).
              </p>
              <div className={styles.tiles} role="radiogroup" aria-label="¿Qué quieres hacer?">
                <button type="button" className={styles.tile} role="radio" aria-checked={asCopy} onClick={() => setAsCopy(true)}>
                  Añadir otra copia
                </button>
                <button type="button" className={styles.tile} role="radio" aria-checked={!asCopy} onClick={() => setAsCopy(false)}>
                  Es un juego distinto
                </button>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label} id="add-platform-label">
              Plataforma
            </span>
            <PlatformTiles
              key={round}
              id="add-platform"
              value={platform}
              onChange={setPlatform}
              labelledBy="add-platform-label"
              describedBy={submitted && platformError ? "add-platform-error" : undefined}
            />
            {submitted && platformError && (
              <p className={styles.error} id="add-platform-error">
                {platformError}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="add-format-label">
              Formato
            </span>
            <div className={styles.tiles} role="radiogroup" aria-labelledby="add-format-label">
              {(["fisico", "digital"] as const).map((f) => (
                <button key={f} type="button" className={styles.tile} role="radio" aria-checked={format === f} onClick={() => setFormat(f)}>
                  {formatName(f)}
                </button>
              ))}
            </div>
          </div>

          {sameCopy && (
            <p className={styles.hint} role="status">
              Ya hay una copia {format === "fisico" ? "física" : "digital"} de este juego en {platform}. Si es otra (por ejemplo, otra edición),
              añádela igualmente y diferencia la edición en la ficha.
            </p>
          )}

          {!target && (
            <div className={styles.field}>
              <span className={styles.label} id="add-status-label">
                Estado
              </span>
              <div className={styles.tiles} role="radiogroup" aria-labelledby="add-status-label">
                {GAME_STATUSES.map((s) => (
                  <button key={s} type="button" className={styles.tile} role="radio" aria-checked={status === s} onClick={() => setStatus(s)}>
                    <i className={styles.dot} style={{ background: ARCADE_STATUS[s].color }} />
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <button type="submit" className={styles.go}>
              {target ? "Añadir copia" : "Añadir a la biblioteca"}
            </button>
          </div>
          <p className={styles.hint}>Precio, edición, horas, notas y estantería se completan después en la ficha.</p>
        </form>
      </div>
    </Dialog>
  );
}
