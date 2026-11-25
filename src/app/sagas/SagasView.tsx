"use client";

import { ArrowDown, ArrowUp, DownloadCloud, GripVertical, Heart, Pencil, Plus, Search, SearchCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { StatusMark } from "@/components/ui/StatusMark";
import type { CatalogGame, SeriesGamesResponse, SeriesResponse } from "@/lib/catalog";
import { useLocalChoice } from "@/lib/local-choice";
import type { Game, SagaExtra } from "@/lib/model";
import { timesFinished } from "@/lib/runs";
import {
  NO_STORY,
  type Placement,
  type Proposal,
  type Story,
  type StoryOrder,
  buildStories,
  findOwned,
  groupByBrand,
  isWished,
  missingFrom,
  moveInStory,
  nextInStory,
  orderStory,
  placeInStory,
  proposeStories,
  storyStops,
} from "@/lib/sagas";
import { useLibrary } from "@/lib/store";
import { IgdbSearch } from "./IgdbSearch";
import styles from "./sagas.module.css";

const ORDERS: { value: StoryOrder; label: string }[] = [
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "historia", label: "Cronología" },
];
const BATCH = 50;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const yearOf = (date: string | null | undefined) => date?.slice(0, 4) ?? "—";
const superado = (g: Game) => timesFinished(g) > 0 || g.status === "completado";

/**
 * Sagas, como el mapa de niveles de la ficha: a un lado las historias; al otro, la abierta como un camino de
 * juego en juego, con los que no tienes en su sitio (parada hueca). La cronología la pone la propietaria
 * (arrastrando en el ordenador, con flechas en el móvil); la app no la inventa.
 */
export function SagasView() {
  const { library, actions } = useLibrary();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fetching, setFetching] = useState(false);
  const [proposals, setProposals] = useState<(Proposal & { add: boolean })[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ story: string; items: (CatalogGame & { add: boolean })[] } | null>(null);
  const [creating, setCreating] = useState<{ name: string; picks: CatalogGame[] } | null>(null);
  const [order, setOrder] = useLocalChoice<StoryOrder>("ludoteca:orden-saga", "lanzamiento", ["lanzamiento", "historia"]);
  const [extrasChoice, setExtrasChoice] = useLocalChoice<"si" | "no">("ludoteca:saga-faltan", "si", ["si", "no"]);
  const showExtras = extrasChoice === "si";

  const stories = useMemo(() => buildStories(library.games, library.extras), [library.games, library.extras]);
  const needle = q.trim().toLowerCase();
  const visible = needle
    ? stories.filter((s) => s.name.toLowerCase().includes(needle) || s.games.some((g) => g.title.toLowerCase().includes(needle)) || s.extras.some((x) => x.title.toLowerCase().includes(needle)))
    : stories;
  const groups = groupByBrand(visible);
  // Sin elegir, la primera: el mapa siempre enseña una historia.
  const open = stories.find((s) => s.name === params.get("historia")) ?? visible[0] ?? null;
  const unsorted = library.games.filter((g) => g.igdbId != null && !g.series?.trim());
  const go = (name: string | null) => router.push(name ? `/sagas?historia=${encodeURIComponent(name)}` : "/sagas", { scroll: false });

  const ownedMatch = (c: { igdbId?: number | null; title: string }) => findOwned(library.games, c);
  const wished = (x: SagaExtra) => isWished(library.wishlist, x);

  /** Mete un juego en una historia: si lo tienes, entra como tuyo (y deja su historia anterior); si no, como «no lo tienes». */
  function addToStory(name: string, c: CatalogGame) {
    const owned = ownedMatch(c);
    if (owned) {
      actions.updateGames([{ id: owned.id, patch: { series: name } }]);
    } else if (!library.extras.some((x) => x.series === name && x.igdbId === c.igdbId)) {
      actions.addExtras([{ series: name, igdbId: c.igdbId, title: c.title, coverUrl: c.coverUrl, releaseDate: c.releaseDate, seriesOrder: null }]);
    }
    toast(`«${c.title}» añadido a «${name}»`);
  }

  async function fetchSeries() {
    setFetching(true);
    const found: Record<string, string | null> = {};
    try {
      const ids = unsorted.map((g) => g.igdbId!);
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

  async function findMissing(story: Story) {
    try {
      const res = await fetch("/api/catalogo/serie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: story.name }) });
      const body = (await res.json()) as SeriesGamesResponse;
      if (!body.ok) return void toast.error(body.message);
      const items = missingFrom(story, body.games, library.games);
      if (items.length) setMissing({ story: story.name, items: items.map((i) => ({ ...i, add: true })) });
      else toast(`IGDB no conoce más juegos de «${story.name}» que te falten.`);
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    }
  }

  function removeStory(story: Story) {
    const before = story.games.map((g) => ({ id: g.id, patch: { series: g.series ?? null, seriesOrder: g.seriesOrder ?? null } }));
    actions.updateGames(story.games.map((g) => ({ id: g.id, patch: { series: NO_STORY, seriesOrder: null } })));
    // Los que no tienes se van con la saga.
    const removed = actions.removeExtras(story.extras.map((x) => x.id));
    go(null);
    toast(`Saga «${story.name}» quitada`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          actions.updateGames(before);
          actions.restoreExtras(removed);
          go(story.name);
        },
      },
    });
  }

  function dropGame(g: Game) {
    const before = { series: g.series ?? null, seriesOrder: g.seriesOrder ?? null };
    actions.updateGames([{ id: g.id, patch: { series: NO_STORY, seriesOrder: null } }]);
    toast(`«${g.title}» quitado de la saga`, { action: { label: "Deshacer", onClick: () => actions.updateGames([{ id: g.id, patch: before }]) } });
  }

  function savePlacements(placements: Placement[]) {
    actions.updateGames(placements.filter((p) => p.kind === "juego").map((p) => ({ id: p.id, patch: { seriesOrder: p.seriesOrder } })));
    actions.updateExtras(placements.filter((p) => p.kind === "falta").map((p) => ({ id: p.id, patch: { seriesOrder: p.seriesOrder } })));
  }

  const fetchButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? "btn-ink" : ""}`} disabled={fetching || unsorted.length === 0} onClick={() => void fetchSeries()}>
      <DownloadCloud aria-hidden />
      {fetching ? "Trayendo…" : "Traer historias de IGDB"}
    </button>
  );
  const newSagaButton = (
    <button type="button" className="btn" onClick={() => setCreating({ name: "", picks: [] })}>
      <Plus aria-hidden />
      Nueva saga
    </button>
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className="screen-title">Sagas</h1>
        <p className={styles.lead}>Tus juegos por historia, en orden de lanzamiento o en su cronología.</p>
      </header>

      {stories.length === 0 ? (
        <section className={`window ${styles.blank}`} aria-label="Sagas">
          <div className={styles.blankMap} aria-hidden>
            {[1, 2, 3].map((n) => (
              <div key={n} className={styles.stop} data-hueca="">
                <span className={styles.pin}>{n}</span>
                <span className={styles.ghostCover} />
                <span className={styles.stopText}>
                  <span className={styles.ghostRow} />
                  <span className={`${styles.ghostRow} ${styles.short}`} />
                </span>
              </div>
            ))}
          </div>
          <div className={styles.blankText}>
            <h2>Tu primer mapa está por dibujar</h2>
            <p>Junta en una historia los juegos de una misma saga (Resident Evil, Half-Life…) y decide en qué orden jugarlos: por lanzamiento o por su cronología.</p>
            <div className={styles.blankActions}>
              {fetchButton(true)}
              {newSagaButton}
            </div>
            <p className={styles.hint}>
              {unsorted.length ? `${count(unsorted.length, "juego tuyo está enlazado", "juegos tuyos están enlazados")} con IGDB. Tú eliges qué historias añadir.` : "Ninguno de tus juegos espera historia de IGDB."}
            </p>
          </div>
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
              <div className={styles.toolButtons}>
                {fetchButton(false)}
                {newSagaButton}
              </div>
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
                            {story.extras.length ? ` · ${story.extras.length} te faltan` : ""}
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
              showExtras={showExtras}
              setShowExtras={(v) => setExtrasChoice(v ? "si" : "no")}
              wished={wished}
              onPlace={(id, to) => savePlacements(placeInStory(open, id, to, showExtras))}
              onMove={(id, dir) => savePlacements(moveInStory(open, id, dir, showExtras))}
              onRemove={() => removeStory(open)}
              onAdd={() => setAdding(open.name)}
              onFindMissing={() => void findMissing(open)}
              onWish={(x) => {
                actions.addWish({ title: x.title, coverUrl: x.coverUrl ?? null, igdbId: x.igdbId ?? null });
                toast(`«${x.title}» añadido a tu lista de deseos`);
              }}
              onDropGame={dropGame}
              onDropExtra={(x) => actions.deleteExtra(x.id)}
              onRename={(name) => {
                // Si ya hay una historia con ese nombre, se unen: sus órdenes no casan, así que vuelven al de lanzamiento.
                const others = library.games.filter((g) => g.series?.trim() === name && !open.games.includes(g));
                const merging = others.length > 0 || library.extras.some((x) => x.series === name);
                actions.updateGames([
                  ...open.games.map((g) => ({ id: g.id, patch: { series: name, seriesOrder: merging ? null : (g.seriesOrder ?? null) } })),
                  ...others.map((g) => ({ id: g.id, patch: { seriesOrder: null } })),
                ]);
                actions.updateExtras(open.extras.map((x) => ({ id: x.id, patch: { series: name, seriesOrder: merging ? null : (x.seriesOrder ?? null) } })));
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
            <AllOrNone onAll={(add) => setProposals(proposals.map((p) => ({ ...p, add })))} />
            <ul className={styles.proposals}>
              {proposals.map((p, i) => (
                <ProposalRow
                  key={p.name}
                  name={p.name}
                  covers={p.games.map((g) => ({ id: g.id, src: g.coverUrl, title: g.title }))}
                  detail={p.games.map((g) => g.title).join(", ")}
                  add={p.add}
                  onChange={(add) => setProposals(proposals.map((x, j) => (j === i ? { ...x, add } : x)))}
                />
              ))}
            </ul>
          </div>
        )}
      </Dialog>

      <Dialog
        open={missing !== null}
        onClose={() => setMissing(null)}
        title={`IGDB conoce ${missing?.items.length ?? 0} que te ${missing?.items.length === 1 ? "falta" : "faltan"}`}
        footer={
          missing && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => setMissing(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-ink"
                disabled={!missing.items.some((i) => i.add)}
                onClick={() => {
                  const chosen = missing.items.filter((i) => i.add);
                  actions.addExtras(chosen.map((c) => ({ series: missing.story, igdbId: c.igdbId, title: c.title, coverUrl: c.coverUrl, releaseDate: c.releaseDate, seriesOrder: null })));
                  toast(`${count(chosen.length, "juego añadido", "juegos añadidos")} a «${missing.story}»`);
                  setMissing(null);
                }}
              >
                Añadir {missing.items.filter((i) => i.add).length}
              </button>
            </>
          )
        }
      >
        {missing && (
          <div className={styles.review}>
            <p className={styles.hint}>Juegos de «{missing.story}» que no tienes. Los que añadas salen en el mapa como paradas huecas.</p>
            <AllOrNone onAll={(add) => setMissing({ ...missing, items: missing.items.map((i) => ({ ...i, add })) })} />
            <ul className={styles.proposals}>
              {missing.items.map((item, i) => (
                <ProposalRow
                  key={item.igdbId}
                  name={item.title}
                  covers={[{ id: String(item.igdbId), src: item.coverUrl, title: item.title }]}
                  detail={item.year ? String(item.year) : "Sin fecha"}
                  add={item.add}
                  onChange={(add) => setMissing({ ...missing, items: missing.items.map((x, j) => (j === i ? { ...x, add } : x)) })}
                />
              ))}
            </ul>
          </div>
        )}
      </Dialog>

      <Dialog open={adding !== null} onClose={() => setAdding(null)} title={`Añadir a «${adding ?? ""}»`}>
        {adding && (
          <div className={styles.review}>
            <p className={styles.hint}>Si lo tienes, entra como tuyo; si no, como parada hueca, con la información de IGDB.</p>
            <IgdbSearch
              owned={(c) => Boolean(ownedMatch(c))}
              onPick={(c) => {
                addToStory(adding, c);
                setAdding(null);
              }}
            />
          </div>
        )}
      </Dialog>

      <Dialog
        open={creating !== null}
        onClose={() => setCreating(null)}
        title="Nueva saga"
        footer={
          creating && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => setCreating(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-ink"
                disabled={!creating.name.trim() || creating.picks.length < 2}
                onClick={() => {
                  const name = creating.name.trim();
                  for (const c of creating.picks) addToStory(name, c);
                  setCreating(null);
                  go(name);
                }}
              >
                Crear saga
              </button>
            </>
          )
        }
      >
        {creating && (
          <div className={styles.review}>
            <label className={styles.field}>
              <span>Nombre de la saga</span>
              <input className="input" aria-label="Nombre de la saga" value={creating.name} maxLength={200} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
            </label>
            <p className={styles.hint}>Añade al menos dos juegos, tuyos o que no tengas.</p>
            {creating.picks.length > 0 && (
              <ul className={styles.picks}>
                {creating.picks.map((c) => (
                  <li key={c.igdbId}>
                    <span>
                      {c.title}
                      {ownedMatch(c) ? "" : " · No lo tienes"}
                    </span>
                    <button
                      type="button"
                      className="btn btn-quiet btn-icon"
                      aria-label={`Quitar «${c.title}»`}
                      onClick={() => setCreating({ ...creating, picks: creating.picks.filter((p) => p.igdbId !== c.igdbId) })}
                    >
                      <X aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <IgdbSearch owned={(c) => Boolean(ownedMatch(c))} chosen={creating.picks.map((p) => p.igdbId)} onPick={(c) => setCreating({ ...creating, picks: [...creating.picks, c] })} />
          </div>
        )}
      </Dialog>
    </div>
  );
}

function AllOrNone({ onAll }: { onAll: (add: boolean) => void }) {
  return (
    <div className={styles.reviewAll}>
      <button type="button" className="btn btn-sm btn-quiet" onClick={() => onAll(true)}>
        Marcar todas
      </button>
      <button type="button" className="btn btn-sm btn-quiet" onClick={() => onAll(false)}>
        Ninguna
      </button>
    </div>
  );
}

function ProposalRow({
  name,
  covers,
  detail,
  add,
  onChange,
}: {
  name: string;
  covers: { id: string; src: string | null | undefined; title: string }[];
  detail: string;
  add: boolean;
  onChange: (add: boolean) => void;
}) {
  return (
    <li className={styles.proposal} data-fuera={add ? undefined : ""}>
      <span className={styles.proposalCovers} aria-hidden>
        {covers.slice(0, 4).map((c) => (
          <Cover key={c.id} src={c.src} title={c.title} caption="" className={styles.miniCover} />
        ))}
      </span>
      <span className={styles.proposalText}>
        <strong>{name}</strong>
        <span>{detail}</span>
      </span>
      <span className={styles.orders} role="radiogroup" aria-label={name}>
        {[true, false].map((value) => (
          <button key={String(value)} type="button" role="radio" aria-checked={add === value} className="chip" onClick={() => onChange(value)}>
            {value ? "Añadir" : "No"}
          </button>
        ))}
      </span>
    </li>
  );
}

/** La historia abierta como un camino: una parada por juego (los que no tienes, huecas), lo superado encendido y el siguiente marcado. */
function StoryMap({
  story,
  order,
  setOrder,
  showExtras,
  setShowExtras,
  wished,
  onPlace,
  onMove,
  onRemove,
  onRename,
  onAdd,
  onFindMissing,
  onWish,
  onDropGame,
  onDropExtra,
}: {
  story: Story;
  order: StoryOrder;
  setOrder: (o: StoryOrder) => void;
  showExtras: boolean;
  setShowExtras: (v: boolean) => void;
  wished: (x: SagaExtra) => boolean;
  onPlace: (id: string, toIndex: number) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onAdd: () => void;
  onFindMissing: () => void;
  onWish: (x: SagaExtra) => void;
  onDropGame: (g: Game) => void;
  onDropExtra: (x: SagaExtra) => void;
}) {
  const stops = storyStops(story, order, showExtras);
  const next = nextInStory(orderStory(story, order));
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const editable = order === "historia";
  let ownPosition = 0;

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
      <div className={styles.controls}>
        <div className={styles.orders} role="radiogroup" aria-label="Orden">
          {ORDERS.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={order === o.value} className="chip" onClick={() => setOrder(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <label className={styles.switch}>
          Los que me faltan
          <button type="button" role="switch" aria-checked={showExtras} aria-label="Los que me faltan" onClick={() => setShowExtras(!showExtras)} />
        </label>
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
        {stops.map((stop, i) => {
          const isGame = stop.kind === "juego";
          const title = isGame ? stop.game.title : stop.extra.title;
          const done = isGame && superado(stop.game);
          const isNext = isGame && next?.id === stop.id;
          if (isGame) ownPosition++;
          return (
            <li
              key={stop.id}
              className={styles.stop}
              data-hueca={isGame ? undefined : ""}
              data-superado={done || undefined}
              data-siguiente={isNext || undefined}
              data-arrastrando={dragging === stop.id || undefined}
              data-encima={over === i && dragging !== stop.id ? "" : undefined}
              draggable={editable}
              onDragStart={(e) => {
                setDragging(stop.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", stop.id);
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
                if (id && id !== stop.id) onPlace(id, i);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <span className={styles.pin} aria-hidden>
                {isGame ? (done ? "✓" : ownPosition) : "?"}
              </span>
              <Cover src={isGame ? stop.game.coverUrl : stop.extra.coverUrl} title={title} caption="" className={styles.thumb} />
              <span className={styles.stopText}>
                {isGame ? (
                  <Link href={`/juego/${stop.id}`} draggable={false}>
                    {title}
                  </Link>
                ) : (
                  <strong>{title}</strong>
                )}
                <span className={styles.stopMeta}>
                  {isGame ? (
                    <>
                      {yearOf(stop.game.releaseDate)} · <StatusMark status={stop.game.status} />
                    </>
                  ) : (
                    <span className={styles.missingTag}>{yearOf(stop.extra.releaseDate)} · No lo tienes</span>
                  )}
                </span>
                {isNext && <span className={styles.nextTag}>▶ Siguiente</span>}
                {!isGame &&
                  (wished(stop.extra) ? (
                    <span className={styles.inWish}>
                      <Heart aria-hidden /> En deseos
                    </span>
                  ) : (
                    <button type="button" className={`btn btn-sm ${styles.wishBtn}`} aria-label={`Añadir «${title}» a deseos`} onClick={() => onWish(stop.extra)}>
                      <Heart aria-hidden /> Añadir a deseos
                    </button>
                  ))}
              </span>
              <span className={styles.arrows}>
                {editable && (
                  <>
                    <GripVertical aria-hidden className={styles.grip} />
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Subir «${title}»`} disabled={i === 0} onClick={() => onMove(stop.id, -1)}>
                      <ArrowUp aria-hidden />
                    </button>
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Bajar «${title}»`} disabled={i === stops.length - 1} onClick={() => onMove(stop.id, 1)}>
                      <ArrowDown aria-hidden />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn btn-quiet btn-icon"
                  aria-label={`Quitar «${title}» de la saga`}
                  onClick={() => (isGame ? onDropGame(stop.game) : onDropExtra(stop.extra))}
                >
                  <X aria-hidden />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className={styles.foot}>
        <span className={styles.verdict}>{next ? `Siguiente: ${next.title}` : "Saga completada"}</span>
        <div className={styles.footActions}>
          <button type="button" className="btn btn-sm" onClick={onAdd}>
            <Plus aria-hidden />
            Añadir a la saga
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={onFindMissing}>
            <SearchCheck aria-hidden />
            Buscar los que faltan
          </button>
          {!confirming && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden />
              Quitar saga
            </button>
          )}
        </div>
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
