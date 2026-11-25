"use client";

import { ArrowDown, ArrowUp, DownloadCloud, GripVertical, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { StatusMark } from "@/components/ui/StatusMark";
import type { SeriesResponse } from "@/lib/catalog";
import { useLocalChoice } from "@/lib/local-choice";
import type { Game } from "@/lib/model";
import { timesFinished } from "@/lib/runs";
import {
  NO_STORY,
  type Proposal,
  type Story,
  type StoryOrder,
  buildStories,
  groupByBrand,
  moveInStory,
  nextInStory,
  orderStory,
  placeInStory,
  proposeStories,
} from "@/lib/sagas";
import { useLibrary } from "@/lib/store";
import styles from "./sagas.module.css";

const ORDERS: { value: StoryOrder; label: string }[] = [
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "historia", label: "Cronología" },
];
const BATCH = 50;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const year = (g: Game) => g.releaseDate?.slice(0, 4) ?? "—";
const superado = (g: Game) => timesFinished(g) > 0 || g.status === "completado";

/**
 * Sagas, como el mapa de niveles de la ficha: a un lado las historias; al otro, la abierta como un camino de
 * juego en juego. La cronología la pone la propietaria (arrastrando en el ordenador, con flechas en el móvil);
 * la app no la inventa.
 */
export function SagasView() {
  const { library, actions } = useLibrary();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fetching, setFetching] = useState(false);
  const [proposals, setProposals] = useState<(Proposal & { add: boolean })[] | null>(null);
  const [order, setOrder] = useLocalChoice<StoryOrder>("ludoteca:orden-saga", "lanzamiento", ["lanzamiento", "historia"]);

  const stories = useMemo(() => buildStories(library.games), [library.games]);
  const needle = q.trim().toLowerCase();
  const visible = needle ? stories.filter((s) => s.name.toLowerCase().includes(needle) || s.games.some((g) => g.title.toLowerCase().includes(needle))) : stories;
  const groups = groupByBrand(visible);
  // Sin elegir, la primera: el mapa siempre enseña una historia.
  const open = stories.find((s) => s.name === params.get("historia")) ?? visible[0] ?? null;
  const missing = library.games.filter((g) => g.igdbId != null && !g.series?.trim());
  const go = (name: string | null) => router.push(name ? `/sagas?historia=${encodeURIComponent(name)}` : "/sagas", { scroll: false });

  async function fetchSeries() {
    setFetching(true);
    const found: Record<string, string | null> = {};
    try {
      const ids = missing.map((g) => g.igdbId!);
      for (let i = 0; i < ids.length; i += BATCH) {
        const res = await fetch("/api/catalogo/series", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ igdbIds: ids.slice(i, i + BATCH) }),
        });
        const body = (await res.json()) as SeriesResponse;
        if (!body.ok) {
          toast.error(body.message);
          return;
        }
        Object.assign(found, body.series);
      }
      const list = proposeStories(library.games, found);
      if (list.length) setProposals(list.map((p) => ({ ...p, add: true })));
      else toast("IGDB no tiene historias nuevas para tus juegos.");
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    } finally {
      setFetching(false);
    }
  }

  function applyProposals() {
    if (!proposals) return;
    // Lo que no se añade se queda en «Sin historia»: así no se vuelve a proponer.
    actions.updateGames(proposals.flatMap((p) => p.games.map((g) => ({ id: g.id, patch: { series: p.add ? p.name : NO_STORY } }))));
    const added = proposals.filter((p) => p.add).length;
    toast(added ? count(added, "historia añadida", "historias añadidas") : "No se ha añadido ninguna historia.");
    setProposals(null);
  }

  function removeStory(story: Story) {
    const before = story.games.map((g) => ({ id: g.id, patch: { series: g.series ?? null, seriesOrder: g.seriesOrder ?? null } }));
    actions.updateGames(story.games.map((g) => ({ id: g.id, patch: { series: NO_STORY, seriesOrder: null } })));
    go(null);
    toast(`Saga «${story.name}» quitada`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          actions.updateGames(before);
          go(story.name);
        },
      },
    });
  }

  const fetchButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? "btn-ink" : ""}`} disabled={fetching || missing.length === 0} onClick={() => void fetchSeries()}>
      <DownloadCloud aria-hidden />
      {fetching ? "Trayendo…" : "Traer historias de IGDB"}
    </button>
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="screen-title">Sagas</h1>
        <p className={styles.lead}>Tus juegos por historia, en orden de lanzamiento o en su cronología.</p>
      </header>

      {stories.length === 0 ? (
        <section className={`window ${styles.empty}`} aria-label="Sagas">
          <h2>Aún no hay historias</h2>
          <p>Una historia junta dos o más de tus juegos (Star Wars Jedi, Half-Life…). Tráelas de IGDB o ponlas en la ficha de cada juego.</p>
          {fetchButton(true)}
        </section>
      ) : (
        <div className={styles.layout}>
          <section className={`window ${styles.list}`} aria-label="Sagas">
            <div className={styles.tools}>
              <label className={styles.search}>
                <Search aria-hidden />
                <span className="sr-only">Buscar historia o juego</span>
                <input className="input" type="search" placeholder="Buscar historia o juego" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              {fetchButton(false)}
            </div>
            {groups.length === 0 && <p className={styles.none}>Nada con «{q.trim()}».</p>}
            <div className={styles.groups}>
              {groups.map((group) => (
                <div key={group.brand ?? group.stories[0].name} className={styles.group}>
                  {group.brand && <h2 className={styles.brand}>{group.brand}</h2>}
                  <ul className={styles.stories}>
                    {group.stories.map((story) => (
                      <li key={story.name}>
                        <Link href={`/sagas?historia=${encodeURIComponent(story.name)}`} scroll={false} className={styles.row} aria-current={open?.name === story.name ? "true" : undefined}>
                          <strong>{story.name}</strong>
                          <span className={styles.meta}>
                            {count(story.games.length, "juego", "juegos")} · {story.games.filter(superado).length} superados
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {open && (
            <StoryMap
              key={open.name}
              story={open}
              order={order}
              setOrder={setOrder}
              onPlace={(id, to) => actions.updateGames(placeInStory(open, id, to).map((m) => ({ id: m.id, patch: { seriesOrder: m.seriesOrder } })))}
              onMove={(id, dir) => actions.updateGames(moveInStory(open, id, dir).map((m) => ({ id: m.id, patch: { seriesOrder: m.seriesOrder } })))}
              onRemove={() => removeStory(open)}
              onRename={(name) => {
                // Si ya hay una historia con ese nombre, se unen: sus órdenes no casan, así que vuelven al de lanzamiento.
                const others = library.games.filter((g) => g.series?.trim() === name && !open.games.includes(g));
                const merging = others.length > 0;
                actions.updateGames([
                  ...open.games.map((g) => ({ id: g.id, patch: { series: name, seriesOrder: merging ? null : (g.seriesOrder ?? null) } })),
                  ...others.map((g) => ({ id: g.id, patch: { seriesOrder: null } })),
                ]);
                go(name);
              }}
            />
          )}
        </div>
      )}

      <Dialog
        open={proposals !== null}
        onClose={() => setProposals(null)}
        title={`IGDB propone ${count(proposals?.length ?? 0, "historia", "historias")}`}
        footer={
          proposals && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => setProposals(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-ink" disabled={!proposals.some((p) => p.add)} onClick={applyProposals}>
                Añadir {count(proposals.filter((p) => p.add).length, "historia", "historias")}
              </button>
            </>
          )
        }
      >
        {proposals && (
          <div className={styles.review}>
            <p className={styles.hint}>Marca las que quieras añadir. Las demás no se añaden y no te las vuelve a proponer; siempre puedes ponerlas a mano en la ficha.</p>
            <div className={styles.reviewAll}>
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => setProposals(proposals.map((p) => ({ ...p, add: true })))}>
                Marcar todas
              </button>
              <button type="button" className="btn btn-sm btn-quiet" onClick={() => setProposals(proposals.map((p) => ({ ...p, add: false })))}>
                Ninguna
              </button>
            </div>
            <ul className={styles.proposals}>
              {proposals.map((p, i) => (
                <li key={p.name} className={styles.proposal} data-fuera={p.add ? undefined : ""}>
                  <span className={styles.proposalCovers} aria-hidden>
                    {p.games.slice(0, 4).map((g) => (
                      <Cover key={g.id} src={g.coverUrl} title={g.title} caption="" className={styles.miniCover} />
                    ))}
                  </span>
                  <span className={styles.proposalText}>
                    <strong>{p.name}</strong>
                    <span>{p.games.map((g) => g.title).join(", ")}</span>
                  </span>
                  <span className={styles.orders} role="radiogroup" aria-label={p.name}>
                    {[true, false].map((add) => (
                      <button
                        key={String(add)}
                        type="button"
                        role="radio"
                        aria-checked={p.add === add}
                        className="chip"
                        onClick={() => setProposals(proposals.map((x, j) => (j === i ? { ...x, add } : x)))}
                      >
                        {add ? "Añadir" : "No"}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** La historia abierta como un camino: una parada por juego, lo superado encendido y el siguiente marcado. */
function StoryMap({
  story,
  order,
  setOrder,
  onPlace,
  onMove,
  onRemove,
  onRename,
}: {
  story: Story;
  order: StoryOrder;
  setOrder: (o: StoryOrder) => void;
  onPlace: (id: string, toIndex: number) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const ordered = orderStory(story, order);
  const next = nextInStory(ordered);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const editable = order === "historia";

  return (
    <section className={`window ${styles.story}`} aria-labelledby="historia-abierta">
      <div className={styles.titleLine}>
        <h2 id="historia-abierta">{story.name}</h2>
        {!renaming && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setRenaming(true)}>
            <Pencil aria-hidden />
            Cambiar nombre
          </button>
        )}
      </div>
      {renaming && (
        <form
          className={styles.rename}
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("nombre") ?? "").trim();
            setRenaming(false);
            if (name && name !== story.name) onRename(name);
          }}
        >
          <input className="input" name="nombre" aria-label="Nombre de la historia" defaultValue={story.name} maxLength={200} autoFocus onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} />
          <button type="submit" className="btn btn-sm">
            Guardar
          </button>
        </form>
      )}
      {story.brand && <p className={styles.storyBrand}>{story.brand}</p>}
      <div className={styles.orders} role="radiogroup" aria-label="Orden">
        {ORDERS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={order === o.value} className="chip" onClick={() => setOrder(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        {editable ? (
          <>
            Parte del de lanzamiento. <span className={styles.pcOnly}>Arrastra cada parada a su sitio (o usa las flechas).</span>
            <span className={styles.touchOnly}>Mueve cada parada con las flechas.</span>
          </>
        ) : (
          "Por fecha de salida."
        )}
      </p>

      <ol className={styles.map} aria-label="Juegos de la historia">
        {ordered.map((g, i) => {
          const done = superado(g);
          const isNext = next?.id === g.id;
          return (
            <li
              key={g.id}
              className={styles.stop}
              data-superado={done || undefined}
              data-siguiente={isNext || undefined}
              data-arrastrando={dragging === g.id || undefined}
              data-encima={over === i && dragging !== g.id ? "" : undefined}
              draggable={editable}
              onDragStart={(e) => {
                setDragging(g.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", g.id);
              }}
              onDragOver={(e) => {
                if (!editable) return;
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragging;
                setDragging(null);
                setOver(null);
                if (id && id !== g.id) onPlace(id, i);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <span className={styles.pin} aria-hidden>
                {done ? "✓" : i + 1}
              </span>
              <Cover src={g.coverUrl} title={g.title} caption="" className={styles.thumb} />
              <span className={styles.stopText}>
                <Link href={`/juego/${g.id}`} draggable={false}>
                  {g.title}
                </Link>
                <span className={styles.stopMeta}>
                  {year(g)} · <StatusMark status={g.status} />
                </span>
                {isNext && <span className={styles.nextTag}>▶ Siguiente</span>}
              </span>
              {editable && (
                <span className={styles.arrows}>
                  <GripVertical aria-hidden className={styles.grip} />
                  <button type="button" className="btn btn-quiet btn-icon" aria-label={`Subir «${g.title}»`} disabled={i === 0} onClick={() => onMove(g.id, -1)}>
                    <ArrowUp aria-hidden />
                  </button>
                  <button type="button" className="btn btn-quiet btn-icon" aria-label={`Bajar «${g.title}»`} disabled={i === ordered.length - 1} onClick={() => onMove(g.id, 1)}>
                    <ArrowDown aria-hidden />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.foot}>
        <span className={styles.verdict}>{next ? `Siguiente: ${next.title}` : "Saga completada"}</span>
        {!confirming && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Quitar saga
          </button>
        )}
      </div>
      {confirming && (
        <div className={styles.confirm} role="alert">
          <p>
            ¿Quitar la saga «{story.name}»? Sus {story.games.length} juegos se quedan en tu biblioteca; solo dejan de estar en una historia, y Traer de IGDB no la vuelve a proponer.
          </p>
          <div className={styles.confirmActions}>
            <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>
              Quitar saga
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
