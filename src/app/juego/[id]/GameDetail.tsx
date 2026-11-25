"use client";

import { RotateCcw, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { arcade, terminal } from "@/app/entrar/fonts";
import { useAddGame } from "@/components/game/AddGameProvider";
import { TROPHY_URL } from "@/components/pixel/sprites";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { ARCADE_STATUS } from "@/components/ui/StatusMark";
import { GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { PISTAS, PISTA_PAGINA, type PistaId, marcarPista, pistasVistas } from "@/lib/pistas";
import { runNumber } from "@/lib/runs";
import { useLibrary } from "@/lib/store";
import styles from "./adventure.module.css";
import { AdventureMap } from "./AdventureMap";
import { Celebration } from "./Celebration";
import { CoverDialog } from "./CoverDialog";
import { Inventory } from "./Inventory";
import { MorePanel, PlayOptions, Quests, Records, TechSheet } from "./panels";
import { TROPHY_STAGE, keeperLine, reachedStages, stagesFor } from "./progress";

/** El nombre va en una sola línea: si no cabe, la letra se reduce hasta que quepa. */
function GameTitle({ title }: { title: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      el.style.whiteSpace = "";
      const size = parseFloat(getComputedStyle(el).fontSize);
      const room = el.clientWidth;
      const need = el.scrollWidth;
      if (need <= room) return;
      const fitted = Math.floor((size * room) / need);
      el.style.fontSize = `${Math.max(fitted, 12)}px`;
      if (fitted < 12) el.style.whiteSpace = "normal";
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    void document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [title]);
  return (
    <h1 ref={ref} className={styles.title}>
      {title}
    </h1>
  );
}

export function GameDetail({ id }: { id: string }) {
  const router = useRouter();
  const { library, actions } = useLibrary();
  const { open: openAdd, details } = useAddGame();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [coverDialog, setCoverDialog] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [hopSignal, setHopSignal] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  // La pista de esta visita: el mapa la primera vez, los datos la siguiente; luego, ninguna.
  const [pista, setPista] = useState<PistaId | null>(() => {
    if (typeof window === "undefined") return null;
    const vistas = pistasVistas();
    return !vistas.has("mapa") ? "mapa" : !vistas.has("datos") ? "datos" : null;
  });
  // Solo se gasta si la ficha existe: un enlace roto no se come la pista.
  const hasGame = library.games.some((g) => g.id === id);
  useEffect(() => {
    if (pista && hasGame) marcarPista(pista);
  }, [pista, hasGame]);
  const columnsRef = useRef<HTMLDivElement>(null);

  const game = library.games.find((g) => g.id === id);
  const copies = library.copies.filter((c) => c.gameId === id);
  const reachedKey = game ? reachedStages(game, copies).join() : "";

  // Cada objetivo cumplido es un nivel superado en el mapa.
  const seen = useRef<{ id: string; key: string } | null>(null);
  useEffect(() => {
    if (!reachedKey) return;
    const before = seen.current;
    seen.current = { id, key: reachedKey };
    if (before?.id !== id) return;
    const was = before.key.split(",");
    const won = reachedKey.split(",").findIndex((done, i) => done === "true" && was[i] !== "true");
    if (won >= 0 && won !== TROPHY_STAGE && game) toast(`¡Nivel superado: ${stagesFor(game)[won]}!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo avisa cuando cambian los niveles conseguidos
  }, [id, reachedKey]);

  if (!game) {
    return (
      <div style={{ padding: "32px var(--gutter)" }}>
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

  const reached = reachedStages(game, copies);
  const update = (patch: Parameters<typeof actions.updateGame>[1]) => actions.updateGame(game.id, patch);

  const toggle100 = () => {
    if (!game.completed100) setCelebrating(true);
    actions.setCompleted100(game.id, !game.completed100);
  };

  const selectStage = (stage: number) => {
    setSelected(stage);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    columnsRef.current?.querySelector(`[data-stage="${stage}"]`)?.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
  };

  return (
    <div className={`${styles.page} ${arcade.variable} ${terminal.variable}`} data-trofeo={game.completed100 || undefined}>
      <AdventureMap
        stages={stagesFor(game)}
        reached={reached}
        selected={selected}
        onSelect={selectStage}
        line={keeperLine(game)}
        hint={pista ? { text: PISTAS[pista], page: PISTA_PAGINA[pista] ?? 1 } : null}
        onCloseHint={() => setPista(null)}
        hopSignal={hopSignal}
      />

      <div className={styles.body}>
        <header className={styles.head}>
          <div className={styles.coverWrap}>
            <Cover src={game.coverUrl} title={game.title} caption={copies[0]?.platform} priority className={styles.cover} />
            {game.completed100 && (
              // eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio
              <img className={styles.badge} src={TROPHY_URL} alt="Trofeo del 100 %" />
            )}
          </div>
          <div className={styles.identity}>
            <GameTitle title={game.title} />
            <div className={styles.statusRow} role="radiogroup" aria-label="Estado">
              {/* Un juego sin final no se completa; si ya estaba completado, se ve para poder cambiarlo. */}
              {GAME_STATUSES.filter((s) => !game.endless || s !== "completado" || game.status === "completado").map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={game.status === s}
                  className={styles.status}
                  onClick={() => actions.setStatus(game.id, s)}
                >
                  <span className={styles.dot} style={{ background: ARCADE_STATUS[s].color }} />
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className={styles.extras}>
              {/* Solo mientras se rejuega: terminada, la vuelta queda en la lista de «Tus récords». */}
              {runNumber(game) >= 2 && !game.finishedAt && <span className={styles.lap}>Vuelta {runNumber(game)}</span>}
              <button type="button" className={styles.action} aria-pressed={game.favorite} onClick={() => update({ favorite: !game.favorite })}>
                <Star aria-hidden fill={game.favorite ? "currentColor" : "none"} />
                {game.favorite ? "En favoritos" : "Favorito"}
              </button>
              <button type="button" className={styles.action} aria-pressed={game.completed100} onClick={toggle100}>
                <Trophy aria-hidden fill={game.completed100 ? "currentColor" : "none"} />
                {game.completed100 ? "Al 100 %" : "100 %"}
              </button>
              {/* Rejugar es otra vuelta de un juego ya superado; uno sin final no se supera. */}
              {game.finishedAt && !game.endless && (
                <button type="button" className={styles.action} onClick={() => actions.replay(game.id)}>
                  <RotateCcw aria-hidden />
                  Rejugar
                </button>
              )}
              {game.demo && <span className={styles.demoTag}>Juego de demostración</span>}
            </div>
            <button
              type="button"
              className={styles.coin}
              onClick={(e) => {
                actions.markPlayedToday(game.id);
                if (!pistasVistas().has("moneda")) setPista("moneda");
                setHopSignal((n) => n + 1);
                const coin = e.currentTarget;
                coin.classList.remove(styles.coinHit);
                void coin.offsetWidth;
                coin.classList.add(styles.coinHit);
              }}
            >
              Inserta moneda
              <small>He jugado hoy</small>
            </button>
          </div>
        </header>

        {/* El cofre puede mandar aquí: `round` lo vuelve a montar con esa copia elegida. */}
        <Inventory key={details.round} gameId={game.id} copies={copies} onAdd={() => openAdd({ gameId: game.id })} />

        <div ref={columnsRef} className={styles.columns}>
          <section className={`${styles.window} ${styles.panel}`} aria-label="Misiones">
            <Quests game={game} copies={copies} selected={selected} update={update} onAddCopy={() => openAdd({ gameId: game.id })} onToggle100={toggle100} onFinish={(date) => actions.setFinishedAt(game.id, date)} onStart={(date) => actions.setStartedAt(game.id, date)} onPlayToday={() => actions.markPlayedToday(game.id)} />
          </section>
          <div className={styles.side}>
            <section className={`${styles.window} ${styles.panel}`} aria-label="Tus récords">
              <Records game={game} copies={copies} update={update} />
            </section>
            <section className={`${styles.window} ${styles.panel}`} aria-labelledby="para-elegir">
              <PlayOptions game={game} update={update} />
            </section>
          </div>
        </div>

        <div className={styles.lower}>
          <Foldable label="Ficha técnica" labelledBy="ficha-tecnica">
            <TechSheet game={game} update={update} />
          </Foldable>
          <Foldable label="Más datos" labelledBy="mas-datos">
            <MorePanel
              game={game}
              update={update}
              onChangeCover={() => setCoverDialog(true)}
              onDelete={() => setConfirmDelete(true)}
            />
          </Foldable>
        </div>
      </div>

      {celebrating && <Celebration title={game.title} onClose={() => setCelebrating(false)} />}

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

/** En el móvil, una ventana larga empieza plegada con su título a la vista; en el ordenador, siempre abierta. */
function Foldable({ label, labelledBy, children }: { label: string; labelledBy: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 899px)").matches);
  return (
    <section className={`${styles.window} ${styles.panel} ${styles.foldable}`} aria-labelledby={labelledBy} data-plegado={open ? undefined : ""}>
      <button type="button" className={styles.foldToggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="sr-only">{open ? "Ocultar" : "Mostrar"} {label}</span>
        <span aria-hidden>{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      {children}
    </section>
  );
}
