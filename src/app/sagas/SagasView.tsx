"use client";

import { ArrowDown, ArrowUp, DownloadCloud, GripVertical, Hash, Heart, Pencil, Plus, Puzzle, Search, SearchCheck, SlidersHorizontal, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { StatusMark } from "@/components/ui/StatusMark";
import type { CatalogGame, SeriesGamesResponse, SeriesResponse } from "@/lib/catalog";
import { useLocalChoice } from "@/lib/local-choice";
import { gameTypeLabel } from "@/lib/game-type";
import type { Game, GameType, SagaExtra, SagaRole } from "@/lib/model";
import { timesFinished } from "@/lib/runs";
import {
  NO_STORY,
  isNoStory,
  type Placement,
  type Proposal,
  type Stop,
  type StopGroup,
  type Story,
  type StoryOrder,
  buildStories,
  findOwned,
  groupByBrand,
  hiddenStories,
  isWished,
  groupDone,
  groupMarks,
  missingFrom,
  moveInStory,
  nextInGroups,
  placeInStory,
  proposeStories,
  storyGroups,
} from "@/lib/sagas";
import { useLibrary } from "@/lib/store";
import { IgdbSearch } from "./IgdbSearch";
import { useSagaCleanup } from "./useSagaCleanup";
import { useVersionLinks } from "./useVersionLinks";
import styles from "./sagas.module.css";

const ORDERS: { value: StoryOrder; label: string }[] = [
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "historia", label: "Cronología" },
];
const BATCH = 50;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const yearOf = (date: string | null | undefined) => date?.slice(0, 4) ?? "—";
/** En el mapa, el tipo de cada juego (si se sabe). */
const kindOf = (type: GameType | null | undefined) => (type ? `${gameTypeLabel(type)} · ` : "");
/** Las marcas de una parada: principal (número), opcional (estrella) o DLC (pieza de puzle). */
const ROLES: { value: SagaRole; label: string; Icon: typeof Star }[] = [
  { value: "main", label: "Principal", Icon: Hash },
  { value: "optional", label: "Opcional", Icon: Star },
  { value: "dlc", label: "DLC", Icon: Puzzle },
];
const superado = (g: Game) => timesFinished(g) > 0 || g.status === "completado";

/**
 * Sagas, como el mapa de niveles de la ficha: a un lado las sagas; al otro, la abierta como un camino de
 * juego en juego, con los que no tienes en su sitio (parada hueca). La cronología la pone la propietaria
 * (arrastrando en el ordenador, con flechas en el móvil); la app no la inventa.
 */
export function SagasView() {
  const { library, actions } = useLibrary();
  useSagaCleanup();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fetching, setFetching] = useState(false);
  const [proposals, setProposals] = useState<(Proposal & { add: boolean })[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [missing, setMissing] = useState<{ story: string; items: (CatalogGame & { add: boolean })[] } | null>(null);
  const [creating, setCreating] = useState<{ name: string; picks: CatalogGame[] } | null>(null);
  const [finding, setFinding] = useState(false);
  const [again, setAgain] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [order, setOrder] = useLocalChoice<StoryOrder>("ludoteca:orden-saga", "lanzamiento", ["lanzamiento", "historia"]);
  const [extrasChoice, setExtrasChoice] = useLocalChoice<"si" | "no">("ludoteca:saga-faltan", "si", ["si", "no"]);
  const showExtras = extrasChoice === "si";

  const stories = useMemo(() => buildStories(library.games, library.extras), [library.games, library.extras]);
  const needle = q.trim().toLowerCase();
  const visible = needle
    ? stories.filter((s) => s.name.toLowerCase().includes(needle) || s.games.some((g) => g.title.toLowerCase().includes(needle)) || s.extras.some((x) => x.title.toLowerCase().includes(needle)))
    : stories;
  const groups = groupByBrand(visible);
  // Sin elegir, la primera: el mapa siempre enseña una saga. Los enlaces de antes decían «historia».
  const asked = params.get("saga") ?? params.get("historia");
  const open = stories.find((s) => s.name === asked) ?? visible[0] ?? null;
  useVersionLinks(open);
  const unsorted = library.games.filter((g) => g.igdbId != null && !g.saga?.trim());
  // Los que se dejaron sin saga a propósito: si no hay nada nuevo, Traer los vuelve a ofrecer.
  const discarded = library.games.filter((g) => g.igdbId != null && isNoStory(g.saga));
  // Las sagas quitadas del apartado: Traer las vuelve a proponer.
  const hidden = useMemo(() => hiddenStories(library.games, library.extras), [library.games, library.extras]);
  const go = (name: string | null) => router.push(name ? `/sagas?saga=${encodeURIComponent(name)}` : "/sagas", { scroll: false });

  const ownedMatch = (c: { igdbId?: number | null; title: string }) => findOwned(library.games, c);
  const wished = (x: SagaExtra) => isWished(library.wishlist, x);

  /**
   * Mete juegos en una saga: si lo tienes, entra como tuyo (y deja su saga anterior); si no, como «no lo
   * tienes». Un juego solo está en una saga: si ya faltaba en otra, se mueve aquí. Lo que estaba quitado del
   * apartado vuelve a verse.
   */
  function placeInSaga(name: string, list: CatalogGame[]) {
    const games: { id: string; patch: Partial<Game> }[] = [];
    const moved: { id: string; patch: Partial<SagaExtra> }[] = [];
    const added: CatalogGame[] = [];
    for (const c of list) {
      const owned = ownedMatch(c);
      const hollow = library.extras.find((x) => x.igdbId === c.igdbId);
      if (owned) games.push({ id: owned.id, patch: { saga: name, sagaHidden: false } });
      else if (hollow) {
        if (hollow.saga !== name) moved.push({ id: hollow.id, patch: { saga: name, sagaOrder: null, hidden: false } });
        else if (hollow.hidden) moved.push({ id: hollow.id, patch: { hidden: false } });
      } else if (!added.some((a) => a.igdbId === c.igdbId)) added.push(c);
    }
    if (games.length) actions.updateGames(games);
    if (moved.length) actions.updateExtras(moved);
    if (added.length)
      actions.addExtras(added.map((c) => ({ saga: name, igdbId: c.igdbId, title: c.title, coverUrl: c.coverUrl, releaseDate: c.releaseDate, gameType: c.gameType ?? null, sagaOrder: null })));
  }

  function addToStory(name: string, c: CatalogGame) {
    placeInSaga(name, [c]);
    toast(`«${c.title}» añadido a «${name}»`);
  }

  /** La saga de IGDB de cada juego, por tandas. Si IGDB falla, lo dice y devuelve null. */
  async function seriesOf(list: Game[]): Promise<Record<string, string | null> | null> {
    const found: Record<string, string | null> = {};
    const ids = list.map((g) => g.igdbId!);
    for (let i = 0; i < ids.length; i += BATCH) {
      const res = await fetch("/api/catalogo/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbIds: ids.slice(i, i + BATCH) }),
      });
      const body = (await res.json()) as SeriesResponse;
      if (!body.ok) {
        toast.error(body.message);
        return null;
      }
      Object.assign(found, body.sagas);
    }
    return found;
  }

  async function fetchSeries() {
    setFetching(true);
    try {
      const found = unsorted.length ? await seriesOf(unsorted) : {};
      if (!found) return;
      // Lo nuevo de IGDB y las sagas quitadas del apartado, todas marcadas.
      const list: Proposal[] = proposeStories(library.games, found);
      for (const h of hidden) {
        const same = list.find((p) => p.name === h.name);
        if (same) Object.assign(same, { games: [...same.games, ...h.games], extras: h.extras });
        else list.push(h);
      }
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
      if (list.length) {
        setProposals(list.map((p) => ({ ...p, add: true })));
        setAgain(false);
        return;
      }
      // Nada nuevo: lo descartado, sin marcar, por si cambias de idea.
      const before = discarded.length ? await seriesOf(discarded) : {};
      if (!before) return;
      const old = proposeStories(library.games, before, { discarded: true });
      if (old.length) {
        setProposals(old.map((p) => ({ ...p, add: false })));
        setAgain(true);
      } else toast("IGDB no tiene sagas nuevas para tus juegos.");
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    } finally {
      setFetching(false);
    }
  }

  function applyProposals() {
    if (!proposals) return;
    // Lo nuevo que no se añade se queda en «Sin saga»: así no se vuelve a proponer. Lo ya descartado y las sagas
    // quitadas que no se añaden, ni se tocan.
    actions.updateGames(
      proposals.flatMap((p) =>
        p.games.flatMap((g) => (p.add ? [{ id: g.id, patch: { saga: p.name, sagaHidden: false } }] : again || g.sagaHidden ? [] : [{ id: g.id, patch: { saga: NO_STORY } }])),
      ),
    );
    actions.updateExtras(proposals.filter((p) => p.add).flatMap((p) => (p.extras ?? []).map((x) => ({ id: x.id, patch: { hidden: false } }))));
    const added = proposals.filter((p) => p.add).length;
    toast(added ? count(added, "saga añadida", "sagas añadidas") : "No se ha añadido ninguna saga.");
    setProposals(null);
  }

  async function findMissing(story: Story) {
    setFinding(true);
    try {
      const res = await fetch("/api/catalogo/serie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: story.name }) });
      const body = (await res.json()) as SeriesGamesResponse;
      if (!body.ok) return void toast.error(body.message);
      const items = missingFrom(story, body.games, library.games);
      if (items.length) setMissing({ story: story.name, items: items.map((i) => ({ ...i, add: true })) });
      else toast(`IGDB no conoce más juegos de «${story.name}» que te falten.`);
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    } finally {
      setFinding(false);
    }
  }

  /**
   * Quita sagas del apartado, no de las fichas: sus juegos (y los que no tienes) se ocultan aquí y conservan su
   * saga. Traer las vuelve a proponer.
   */
  function hideStories(list: Story[], hide: boolean) {
    actions.updateGames(list.flatMap((s) => s.games.map((g) => ({ id: g.id, patch: { sagaHidden: hide } }))));
    actions.updateExtras(list.flatMap((s) => s.extras.map((x) => ({ id: x.id, patch: { hidden: hide } }))));
  }

  function removeStory(story: Story) {
    hideStories([story], true);
    go(null);
    toast(`Saga «${story.name}» quitada`, {
      action: {
        label: "Deshacer",
        onClick: () => {
          hideStories([story], false);
          go(story.name);
        },
      },
    });
  }

  function removeAll() {
    const all = stories;
    hideStories(all, true);
    setClearing(false);
    go(null);
    toast(`${count(all.length, "saga quitada", "sagas quitadas")} del apartado`, { action: { label: "Deshacer", onClick: () => hideStories(all, false) } });
  }

  /** Quita un juego tuyo del mapa de su saga; su ficha la conserva. */
  function dropGame(g: Game) {
    actions.updateGames([{ id: g.id, patch: { sagaHidden: true } }]);
    toast(`«${g.title}» quitado de la saga`, { action: { label: "Deshacer", onClick: () => actions.updateGames([{ id: g.id, patch: { sagaHidden: false } }]) } });
  }

  function savePlacements(placements: Placement[]) {
    actions.updateGames(placements.filter((p) => p.kind === "juego").map((p) => ({ id: p.id, patch: { sagaOrder: p.sagaOrder } })));
    actions.updateExtras(placements.filter((p) => p.kind === "falta").map((p) => ({ id: p.id, patch: { sagaOrder: p.sagaOrder } })));
  }

  const fetchButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? "btn-ink" : ""}`} disabled={fetching || unsorted.length + discarded.length + hidden.length === 0} onClick={() => void fetchSeries()}>
      <DownloadCloud aria-hidden />
      {fetching ? "Trayendo…" : "Traer sagas de IGDB"}
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
        <p className={styles.lead}>Tus juegos por saga, en orden de lanzamiento o en su cronología.</p>
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
            <p>Junta los juegos de una misma saga (Resident Evil, Half-Life…) y decide en qué orden jugarlos: por lanzamiento o por su cronología.</p>
            <div className={styles.blankActions}>
              {fetchButton(true)}
              {newSagaButton}
            </div>
            <p className={styles.hint}>
              {hidden.length
                ? `${count(hidden.length, "saga quitada", "sagas quitadas")}: Traer te ${hidden.length === 1 ? "la" : "las"} vuelve a proponer.`
                : unsorted.length
                  ? `${count(unsorted.length, "juego tuyo está enlazado", "juegos tuyos están enlazados")} con IGDB. Tú eliges qué sagas añadir.`
                  : discarded.length
                  ? `${count(discarded.length, "juego lo dejaste", "juegos los dejaste")} sin saga: Traer te ofrece recuperarlos.`
                  : "Ninguno de tus juegos espera saga de IGDB."}
            </p>
          </div>
        </section>
      ) : (
        <div className={styles.layout}>
          <section className={`window ${styles.list}`} aria-label="Sagas">
            <div className={styles.tools}>
              <label className={styles.search}>
                <Search aria-hidden />
                <span className="sr-only">Buscar saga o juego</span>
                <input className="input" type="search" placeholder="Buscar saga o juego" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <div className={styles.toolButtons}>
                {fetchButton(false)}
                {newSagaButton}
                <button type="button" className="btn btn-quiet" onClick={() => setClearing(true)}>
                  <Trash2 aria-hidden />
                  Borrar todas las sagas
                </button>
              </div>
              {clearing && (
                <div className={styles.confirm} role="alert">
                  <p>
                    ¿Borrar {stories.length === 1 ? "la saga" : `las ${stories.length} sagas`} de este apartado? Tus juegos conservan su saga en la ficha y los
                    que no tienes se guardan. Traer sagas de IGDB te {stories.length === 1 ? "la" : "las"} vuelve a proponer.
                  </p>
                  <div className={styles.confirmActions}>
                    <button type="button" className="btn btn-sm btn-danger" onClick={removeAll}>
                      Borrar todas
                    </button>
                    <button type="button" className="btn btn-sm btn-quiet" onClick={() => setClearing(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
            {groups.length === 0 && <p className={styles.none}>Nada con «{q.trim()}».</p>}
            <div className={styles.groups}>
              {groups.map((group) => (
                <div key={group.brand ?? group.stories[0].name} className={styles.group}>
                  {group.brand && <h2 className={styles.brand}>{group.brand}</h2>}
                  <ul className={styles.stories}>
                    {group.stories.map((story) => (
                      <li key={story.name}>
                        <Link href={`/sagas?saga=${encodeURIComponent(story.name)}`} scroll={false} className={styles.row} aria-current={open?.name === story.name ? "true" : undefined}>
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
              finding={finding}
              onWish={(x) => {
                actions.addWish({ title: x.title, coverUrl: x.coverUrl ?? null, igdbId: x.igdbId ?? null });
                toast(`«${x.title}» añadido a tu lista de deseos`);
              }}
              onDropGame={dropGame}
              onDropExtra={(x) => actions.deleteExtra(x.id)}
              onPatch={(stop, patch) =>
                stop.kind === "juego" ? actions.updateGames([{ id: stop.id, patch }]) : actions.updateExtras([{ id: stop.id, patch }])
              }
              onRename={(name) => {
                // Si ya hay una saga con ese nombre, se unen: sus órdenes no casan, así que vuelven al de lanzamiento.
                // Los de la otra que estaban quitados del apartado vuelven a verse.
                const others = library.games.filter((g) => g.saga?.trim() === name && !open.games.includes(g));
                const merging = others.length > 0 || library.extras.some((x) => x.saga === name);
                actions.updateGames([
                  ...open.games.map((g) => ({ id: g.id, patch: { saga: name, sagaOrder: merging ? null : (g.sagaOrder ?? null) } })),
                  ...others.map((g) => ({ id: g.id, patch: { sagaOrder: null, sagaHidden: false } })),
                ]);
                actions.updateExtras([
                  ...open.extras.map((x) => ({ id: x.id, patch: { saga: name, sagaOrder: merging ? null : (x.sagaOrder ?? null) } })),
                  ...library.extras.filter((x) => x.saga === name).map((x) => ({ id: x.id, patch: { sagaOrder: null, hidden: false } })),
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
        title={again ? "Sagas que descartaste" : `IGDB propone ${count(proposals?.length ?? 0, "saga", "sagas")}`}
        footer={
          proposals && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => setProposals(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-ink" disabled={!proposals.some((p) => p.add)} onClick={applyProposals}>
                Añadir {count(proposals.filter((p) => p.add).length, "saga", "sagas")}
              </button>
            </>
          )
        }
      >
        {proposals && (
          <div className={styles.review}>
            <p className={styles.hint}>
              {again
                ? "IGDB no tiene sagas nuevas para tus juegos. Estas las descartaste: marca las que quieras recuperar."
                : "Marca las que quieras añadir. Las demás no se añaden y no te las vuelve a proponer; siempre puedes ponerlas a mano en la ficha."}
            </p>
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
                  placeInSaga(missing.story, chosen);
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
                  placeInSaga(name, creating.picks);
                  toast(`Saga «${name}» creada`);
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

/** La saga abierta como un camino: una parada por juego (los que no tienes, huecas), lo superado encendido y el siguiente marcado. */
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
  finding,
  onWish,
  onDropGame,
  onDropExtra,
  onPatch,
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
  finding: boolean;
  onWish: (x: SagaExtra) => void;
  onDropGame: (g: Game) => void;
  onDropExtra: (x: SagaExtra) => void;
  /** Su marca o de qué juego es versión. */
  onPatch: (stop: Stop, patch: { sagaRole?: SagaRole; versionOf?: number }) => void;
}) {
  const groups = storyGroups(story, order, showExtras);
  const marks = groupMarks(groups);
  const next = nextInGroups(storyGroups(story, order));
  const [options, setOptions] = useState<string | null>(null);
  // A qué parada se puede unir una como versión: las que tienen número de IGDB.
  const leads = storyGroups(story, order).flatMap((g) => {
    const lead = infoOf(g.lead);
    return lead.igdbId != null ? [{ id: g.lead.id, igdbId: lead.igdbId, title: lead.title }] : [];
  });
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const editable = order === "historia";

  const metaOf = (s: Stop) =>
    s.kind === "juego" ? (
      <>
        {yearOf(s.game.releaseDate)} · {kindOf(s.game.gameType)}
        <StatusMark status={s.game.status} />
      </>
    ) : (
      <span className={styles.missingTag}>
        {yearOf(s.extra.releaseDate)} · {kindOf(s.extra.gameType)}No lo tienes
      </span>
    );

  const toggleOptions = (id: string) => setOptions((o) => (o === id ? null : id));
  const optionsButton = (s: Stop) => (
    <button
      type="button"
      className="btn btn-quiet btn-icon"
      aria-label={`Opciones de «${infoOf(s).title}»`}
      aria-expanded={options === s.id}
      onClick={() => toggleOptions(s.id)}
    >
      <SlidersHorizontal aria-hidden />
    </button>
  );
  const dropButton = (s: Stop) => (
    <button
      type="button"
      className="btn btn-quiet btn-icon"
      aria-label={`Quitar «${infoOf(s).title}» de la saga`}
      onClick={() => (s.kind === "juego" ? onDropGame(s.game) : onDropExtra(s.extra))}
    >
      <X aria-hidden />
    </button>
  );
  /** Su marca (solo la parada) y de qué juego es versión. */
  const optionsPanel = (s: Stop, group: StopGroup) => {
    const title = infoOf(s).title;
    const isLead = group.lead.id === s.id;
    return (
      <div className={styles.stopOptions}>
        {isLead && (
          <div className={styles.orders} role="radiogroup" aria-label={`Marca de «${title}»`}>
            {ROLES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={group.role === value}
                className="chip"
                onClick={() => {
                  onPatch(s, { sagaRole: value });
                  setOptions(null);
                }}
              >
                <Icon aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}
        <label className={styles.versionOf}>
          <span>Es versión de</span>
          <select
            className={styles.versionSelect}
            aria-label="Es versión de"
            value={String(isLead ? 0 : (infoOf(group.lead).igdbId ?? 0))}
            onChange={(e) => {
              onPatch(s, { versionOf: Number(e.target.value) });
              setOptions(null);
            }}
          >
            <option value="0">Parada propia</option>
            {leads
              .filter((l) => l.id !== s.id)
              .map((l) => (
                <option key={l.id} value={l.igdbId}>
                  {l.title}
                </option>
              ))}
          </select>
        </label>
      </div>
    );
  };

  return (
    <section className={`window ${styles.story}`} aria-labelledby="saga-abierta">
      <div className={styles.titleLine}>
        <h2 id="saga-abierta">{story.name}</h2>
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
          <input className="input" name="nombre" aria-label="Nombre de la saga" defaultValue={story.name} maxLength={200} autoFocus onKeyDown={(e) => e.key === "Escape" && setRenaming(false)} />
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

      <ol className={styles.map} aria-label="Juegos de la saga">
        {groups.map((group, i) => {
          const lead = group.lead;
          const isGame = lead.kind === "juego";
          const title = infoOf(lead).title;
          const members = [lead, ...group.versions];
          const owned = members.some((m) => m.kind === "juego");
          const done = groupDone(group);
          const isNext = next != null && members.some((m) => m.id === next.id);
          const mark = marks[i];
          return (
            <li
              key={lead.id}
              className={styles.stop}
              data-hueca={owned ? undefined : ""}
              data-superado={done || undefined}
              data-siguiente={isNext || undefined}
              data-arrastrando={dragging === lead.id || undefined}
              data-encima={over === i && dragging !== lead.id ? "" : undefined}
              draggable={editable}
              onDragStart={(e) => {
                setDragging(lead.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", lead.id);
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
                if (id && id !== lead.id) onPlace(id, i);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <span className={styles.pin} data-marca={mark === "optional" ? "opcional" : mark === "dlc" ? "dlc" : "principal"} aria-hidden>
                {mark === "optional" ? <Star /> : mark === "dlc" ? <Puzzle /> : mark}
              </span>
              <Cover src={infoOf(lead).coverUrl} title={title} caption="" className={styles.thumb} />
              <span className={styles.stopText}>
                <span className="sr-only">{typeof mark === "number" ? `Parada ${mark}:` : mark === "optional" ? "Opcional:" : "DLC:"}</span>
                {isGame ? (
                  <Link href={`/juego/${lead.id}`} draggable={false}>
                    {title}
                  </Link>
                ) : (
                  <strong>{title}</strong>
                )}
                <span className={styles.stopMeta}>{metaOf(lead)}</span>
                {isNext && <span className={styles.nextTag}>▶ Siguiente{next && next.id !== lead.id ? `: ${next.title}` : ""}</span>}
                {lead.kind === "falta" &&
                  (wished(lead.extra) ? (
                    <span className={styles.inWish}>
                      <Heart aria-hidden /> En deseos
                    </span>
                  ) : (
                    <button type="button" className={`btn btn-sm ${styles.wishBtn}`} aria-label={`Añadir «${title}» a deseos`} onClick={() => onWish(lead.extra)}>
                      <Heart aria-hidden /> Añadir a deseos
                    </button>
                  ))}
              </span>
              <span className={styles.arrows}>
                {editable && (
                  <>
                    <GripVertical aria-hidden className={styles.grip} />
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Subir «${title}»`} disabled={i === 0} onClick={() => onMove(lead.id, -1)}>
                      <ArrowUp aria-hidden />
                    </button>
                    <button type="button" className="btn btn-quiet btn-icon" aria-label={`Bajar «${title}»`} disabled={i === groups.length - 1} onClick={() => onMove(lead.id, 1)}>
                      <ArrowDown aria-hidden />
                    </button>
                  </>
                )}
                {optionsButton(lead)}
                {dropButton(lead)}
              </span>
              {(options === lead.id || group.versions.length > 0) && (
                <div className={styles.below}>
                {options === lead.id && optionsPanel(lead, group)}
                {group.versions.length > 0 && (
                  <span role="group" aria-label={`Versiones de «${title}»`} className={styles.versions}>
                    {group.versions.map((v) => {
                      const vTitle = infoOf(v).title;
                      return (
                        <span key={v.id} className={styles.version}>
                          <span className={styles.versionLine}>
                            <span aria-hidden>→</span>
                            {v.kind === "juego" ? (
                              <Link href={`/juego/${v.id}`} draggable={false}>
                                {vTitle}
                              </Link>
                            ) : (
                              <strong>{vTitle}</strong>
                            )}
                            <span className={styles.stopMeta}>{metaOf(v)}</span>
                            <span className={styles.versionActions}>
                              {v.kind === "falta" && !wished(v.extra) && (
                                <button type="button" className="btn btn-quiet btn-icon" aria-label={`Añadir «${vTitle}» a deseos`} onClick={() => onWish(v.extra)}>
                                  <Heart aria-hidden />
                                </button>
                              )}
                              {optionsButton(v)}
                              {dropButton(v)}
                            </span>
                          </span>
                          {options === v.id && optionsPanel(v, group)}
                        </span>
                      );
                    })}
                  </span>
                )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.foot}>
        <span className={styles.verdict}>
          {next ? `Siguiente: ${next.title}` : story.games.length === 0 ? "Aún no tienes ninguno" : story.extras.length ? "Superados los que tienes" : "Saga completada"}
        </span>
        <div className={styles.footActions}>
          <button type="button" className="btn btn-sm" onClick={onAdd}>
            <Plus aria-hidden />
            Añadir a la saga
          </button>
          <button type="button" className="btn btn-sm btn-quiet" disabled={finding} onClick={onFindMissing}>
            <SearchCheck aria-hidden />
            {finding ? "Buscando…" : "Buscar los que faltan"}
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
            ¿Quitar la saga «{story.name}» de este apartado?
            {story.games.length > 0 &&
              (story.games.length === 1 ? " Su juego la conserva en su ficha." : ` Sus ${story.games.length} juegos la conservan en su ficha.`)}
            {story.extras.length > 0 && (story.extras.length === 1 ? " El que no tienes se guarda." : ` Los ${story.extras.length} que no tienes se guardan.`)}{" "}
            Traer sagas de IGDB te la vuelve a proponer.
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

const infoOf = (s: Stop) => (s.kind === "juego" ? s.game : s.extra);
