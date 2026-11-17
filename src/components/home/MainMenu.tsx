"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { progressPercent } from "@/app/juego/[id]/progress";
import type { LibraryEntry } from "@/lib/filters";
import { relativeDay } from "@/lib/format";
import { formatHours } from "@/lib/recommend";
import { useLibrary } from "@/lib/store";
import { markTitleScreenSeen, titleScreenDue } from "@/lib/title-screen";
import { Embers } from "./Embers";
import { heavy, hud } from "./fonts";
import styles from "./menu.module.css";
import { TitleScreen } from "./TitleScreen";

const MODES = [
  { name: "Modo rápido", label: "Tengo 30 minutos", href: "/que-juego?min=30" },
  { name: "Modo historia", label: "Tengo una hora", href: "/que-juego?min=60" },
  { name: "Cooperativo", label: "Juego acompañada", href: "/que-juego?con=acompanado" },
  { name: "Modo relax", label: "Algo tranquilo", href: "/que-juego?tipo=tranquila" },
];

const ITEMS = [
  { id: "continuar", label: "Continuar" },
  { id: "nueva", label: "Nueva partida" },
  { id: "elegir", label: "Elegir modo" },
  { id: "novedades", label: "Novedades" },
  { id: "records", label: "Récords" },
] as const;

type ItemId = (typeof ITEMS)[number]["id"];
type Art = { url: string; soft: boolean } | null;

const MAX_SAVES = 4;
const MAX_COVERS = 8;
const HOVER_INTENT_MS = 80;
const NEW_FOR_DAYS = 30;
const TITLE_EXIT_MS = 300;

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const artOf = (entry?: LibraryEntry): Art => {
  const url = entry?.game.backdropUrl ?? entry?.game.coverUrl;
  return url ? { url, soft: !entry?.game.backdropUrl } : null;
};

export type MenuStats = { titles: number; copies: number; playing: number; pending: number; finished: number };

/** El arte de fondo funde al cambiar: el anterior se queda debajo hasta el siguiente cambio. */
function Backdrop({ art }: { art: Art }) {
  const [layers, setLayers] = useState([{ art, n: 0 }]);
  const top = layers[layers.length - 1];
  if (top.art?.url !== art?.url) setLayers([top, { art, n: top.n + 1 }]);
  return (
    <div className={styles.backdrop} aria-hidden>
      {layers.map(
        ({ art: layer, n }) =>
          layer && (
            // eslint-disable-next-line @next/next/no-img-element -- arte externo, sin optimización de imágenes
            <img key={n} src={layer.url} alt="" className={layer.soft ? styles.soft : ""} decoding="async" />
          ),
      )}
    </div>
  );
}

function Cover({ entry, isNew, onPreview }: { entry: LibraryEntry; isNew?: boolean; onPreview: (art: Art) => void }) {
  const { game } = entry;
  return (
    <Link href={`/juego/${game.id}`} className={styles.cover} aria-label={game.title} onPointerEnter={() => onPreview(artOf(entry))} onFocus={() => onPreview(artOf(entry))}>
      {game.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- carátula externa
        <img src={game.coverUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className={styles.noCover}>{game.title}</span>
      )}
      {isNew && <span className={styles.tag}>Nuevo</span>}
    </Link>
  );
}

function Saves({ saves, selected, onSelect, total, onNew }: { saves: LibraryEntry[]; selected?: LibraryEntry; onSelect: (id: string) => void; total: number; onNew: () => void }) {
  const { actions } = useLibrary();
  const listRef = useRef<HTMLDivElement>(null);

  if (!selected) {
    return (
      <>
        <h2 className={styles.panelTitle}>Partidas guardadas</h2>
        <p className={styles.empty}>No tienes ninguna partida en marcha. Empieza una y aparecerá aquí.</p>
        <div className={styles.panelActions}>
          <button type="button" className={styles.act} onClick={onNew}>
            Nueva partida
          </button>
        </div>
      </>
    );
  }

  const { game } = selected;
  const move = (delta: number) => {
    const next = (saves.findIndex((s) => s.game.id === game.id) + delta + saves.length) % saves.length;
    onSelect(saves[next].game.id);
    listRef.current?.querySelectorAll("button")[next]?.focus();
  };

  return (
    <>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Partidas guardadas</h2>
        <Link href="/biblioteca?estado=jugando,pausado&agrupar=ninguno" className={styles.more}>
          Ver todo{total > saves.length ? ` (${total})` : ""}
        </Link>
      </div>
      <div
        ref={listRef}
        className={styles.slots}
        role="group"
        aria-label="Partidas guardadas"
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          e.stopPropagation();
          move(e.key === "ArrowDown" ? 1 : -1);
        }}
      >
        {saves.map((entry) => {
          const g = entry.game;
          const on = g.id === game.id;
          const pct = progressPercent(g);
          const place = [...new Set(entry.copies.map((c) => c.platform))].join(" + ");
          const detail = [place, g.status === "pausado" ? "En pausa" : null, g.lastPlayedAt ? `Última partida ${relativeDay(g.lastPlayedAt)}` : "Sin partidas anotadas"]
            .filter(Boolean)
            .join(" · ");
          return (
            <button key={g.id} type="button" className={`${styles.slot} ${on ? styles.slotOn : ""}`} aria-pressed={on} tabIndex={on ? 0 : -1} onClick={() => onSelect(g.id)}>
              {g.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura de carátula
                <img src={g.coverUrl} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className={styles.noThumb} />
              )}
              <span className={styles.slotText}>
                <b>{g.title}</b>
                <small>{detail}</small>
              </span>
              <span className={styles.slotHours}>{g.hoursPlayed ? formatHours(g.hoursPlayed) : ""}</span>
              {pct !== null && (
                <>
                  <span className={styles.slotBar} aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span className="sr-only">{pct} % jugado</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className={styles.panelActions}>
        {game.status === "jugando" ? (
          <button type="button" className={styles.act} onClick={() => actions.markPlayedToday(game.id)}>
            He jugado hoy
          </button>
        ) : (
          <button type="button" className={styles.act} onClick={() => actions.setStatus(game.id, "jugando")}>
            Retomar
          </button>
        )}
        <Link href={`/juego/${game.id}`} className={`${styles.act} ${styles.actAlt}`}>
          Ver ficha
        </Link>
      </div>
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}

export function MainMenu({
  saves,
  waiting,
  recent,
  champion,
  stats,
  notices,
}: {
  saves: LibraryEntry[];
  waiting: LibraryEntry[];
  recent: LibraryEntry[];
  champion?: LibraryEntry;
  stats: MenuStats;
  notices: React.ReactNode;
}) {
  const [item, setItem] = useState<ItemId>(saves.length > 0 ? "continuar" : waiting.length > 0 ? "nueva" : "novedades");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Art>(null);
  const [title, setTitle] = useState<"on" | "leaving" | "off">(() => (titleScreenDue() ? "on" : "off"));
  const [animateIn, setAnimateIn] = useState(false);
  const [now] = useState(() => new Date());
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef(0);

  const shownSaves = useMemo(() => saves.slice(0, MAX_SAVES), [saves]);
  const selected = shownSaves.find((s) => s.game.id === slotId) ?? shownSaves[0];

  useEffect(() => {
    if (title === "on") markTitleScreenSeen();
  }, [title]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const focusItem = useCallback((id: ItemId) => {
    const index = ITEMS.findIndex((i) => i.id === id);
    const button = listRef.current?.querySelectorAll("button")[index];
    button?.focus({ preventScroll: true });
    const list = listRef.current;
    if (list && button && list.scrollWidth > list.clientWidth) {
      list.scrollTo({ left: button.offsetLeft - (list.clientWidth - button.offsetWidth) / 2, behavior: calm() ? "auto" : "smooth" });
    }
  }, []);

  const choose = useCallback((id: ItemId) => {
    setItem(id);
    setPreview(null);
  }, []);

  const start = useCallback(() => {
    setAnimateIn(true);
    if (calm()) {
      setTitle("off");
    } else {
      setTitle("leaving");
      window.setTimeout(() => setTitle("off"), TITLE_EXIT_MS);
    }
    window.setTimeout(() => focusItem(item), 0);
  }, [focusItem, item]);

  const step = useCallback(
    (delta: number) => {
      const next = ITEMS[(ITEMS.findIndex((i) => i.id === item) + delta + ITEMS.length) % ITEMS.length].id;
      choose(next);
      focusItem(next);
    },
    [choose, focusItem, item],
  );

  // Como en un juego: las flechas mueven el menú aunque nada tenga el foco todavía.
  useEffect(() => {
    if (title === "on") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const active = document.activeElement;
      if (document.querySelector("dialog[open]") || (active && active !== document.body && active.id !== "contenido")) return;
      e.preventDefault();
      step(e.key === "ArrowDown" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, title]);

  const defaultArt = (): Art => {
    if (item === "continuar") return artOf(selected) ?? artOf(recent[0]);
    if (item === "nueva") return artOf(waiting[0]) ?? artOf(recent[0]);
    if (item === "records") return artOf(champion) ?? artOf(recent[0]);
    if (item === "elegir") return artOf(recent[2]) ?? artOf(recent[0]);
    return artOf(recent[0]);
  };

  const isNew = (entry: LibraryEntry) => now.getTime() - Date.parse(entry.game.createdAt) < NEW_FOR_DAYS * 86_400_000;
  const hidden = title === "on";
  const records: [string, number][] = [
    ["Títulos", stats.titles],
    ["Copias", stats.copies],
    ["Jugando", stats.playing],
    ["Pendientes", stats.pending],
    [`Terminados en ${now.getFullYear()}`, stats.finished],
  ];

  return (
    <section className={`${styles.stage} ${heavy.variable} ${hud.variable} ${animateIn ? styles.animateIn : ""}`} aria-label="Menú de inicio">
      <Backdrop art={preview ?? defaultArt()} />
      <div className={styles.shade} />
      <Embers className={styles.embers} />

      <div className={styles.notices} inert={hidden} style={{ visibility: hidden ? "hidden" : undefined }}>
        {notices}
      </div>

      <div className={styles.body} inert={hidden} style={{ visibility: hidden ? "hidden" : undefined }}>
        <div
          ref={listRef}
          className={styles.list}
          role="group"
          aria-label="Menú principal"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              step(e.key === "ArrowDown" ? 1 : -1);
            } else if (e.key === "ArrowRight") {
              const panel = panelRef.current;
              const target = panel?.querySelector<HTMLElement>('[tabindex="0"]') ?? panel?.querySelector<HTMLElement>("a, button");
              if (target) {
                e.preventDefault();
                target.focus();
              }
            }
          }}
        >
          {ITEMS.map(({ id, label }, i) => (
            <button
              key={id}
              type="button"
              className={`${styles.item} ${item === id ? styles.itemOn : ""}`}
              style={{ "--i": i } as React.CSSProperties}
              aria-pressed={item === id}
              tabIndex={item === id ? 0 : -1}
              onClick={() => choose(id)}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                window.clearTimeout(hoverTimer.current);
                hoverTimer.current = window.setTimeout(() => choose(id), HOVER_INTENT_MS);
              }}
              onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          ref={panelRef}
          key={item}
          className={styles.panel}
          onPointerLeave={() => setPreview(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              focusItem(item);
            }
          }}
        >
          {item === "continuar" && <Saves saves={shownSaves} selected={selected} onSelect={setSlotId} total={saves.length} onNew={() => choose("nueva")} />}

          {item === "nueva" && (
            <>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Te están esperando</h2>
                <Link href="/biblioteca?estado=pendiente&agrupar=ninguno" className={styles.more}>
                  Ver todo ({stats.pending})
                </Link>
              </div>
              {waiting.length > 0 ? (
                <div className={styles.covers}>
                  {waiting.slice(0, MAX_COVERS).map((e) => (
                    <Cover key={e.game.id} entry={e} onPreview={setPreview} />
                  ))}
                </div>
              ) : (
                <Empty text="No tienes juegos pendientes. Cuando añadas uno sin empezar, te esperará aquí." />
              )}
            </>
          )}

          {item === "elegir" && (
            <>
              <h2 className={styles.panelTitle}>¿A qué jugamos hoy?</h2>
              <div className={styles.modes}>
                {MODES.map((m) => (
                  <Link key={m.href} href={m.href} className={styles.mode}>
                    <b>{m.name}</b>
                    <span>{m.label}</span>
                  </Link>
                ))}
              </div>
              <div className={styles.panelActions}>
                <Link href="/que-juego" className={`${styles.act} ${styles.actAlt}`}>
                  Elegir con calma
                </Link>
              </div>
            </>
          )}

          {item === "novedades" && (
            <>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>Añadidos recientemente</h2>
                <Link href="/biblioteca?agrupar=ninguno" className={styles.more}>
                  Ver todo ({stats.titles})
                </Link>
              </div>
              <div className={styles.covers}>
                {recent.slice(0, MAX_COVERS).map((e) => (
                  <Cover key={e.game.id} entry={e} isNew={isNew(e)} onPreview={setPreview} />
                ))}
              </div>
            </>
          )}

          {item === "records" && (
            <>
              <h2 className={styles.panelTitle}>Tu colección</h2>
              <dl className={styles.records}>
                {records.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{String(value).padStart(2, "0")}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.panelActions}>
                <Link href="/estadisticas" className={`${styles.act} ${styles.actAlt}`}>
                  Ver estadísticas
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.foot} inert={hidden} aria-hidden style={{ visibility: hidden ? "hidden" : undefined }}>
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>Mover
        </span>
        <span>
          <kbd>→</kbd>Entrar
        </span>
        <span>
          <kbd>←</kbd>Volver
        </span>
      </div>

      {title !== "off" && <TitleScreen leaving={title === "leaving"} onStart={start} />}
    </section>
  );
}
