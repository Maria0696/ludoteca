"use client";

import { ArrowDown, ArrowLeft, ArrowUp, DownloadCloud, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/ui/Cover";
import { StatusMark } from "@/components/ui/StatusMark";
import type { SeriesResponse } from "@/lib/catalog";
import { useLocalChoice } from "@/lib/local-choice";
import type { Game } from "@/lib/model";
import { timesFinished } from "@/lib/runs";
import { type Story, type StoryOrder, buildStories, groupByBrand, moveInStory, nextInStory, orderStory } from "@/lib/sagas";
import { useLibrary } from "@/lib/store";
import styles from "./sagas.module.css";

const ORDERS: { value: StoryOrder; label: string }[] = [
  { value: "lanzamiento", label: "Lanzamiento" },
  { value: "historia", label: "Historia" },
];
const BATCH = 50;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const year = (g: Game) => g.releaseDate?.slice(0, 4) ?? "—";

/**
 * Sagas: los juegos de cada historia, bajo su marca. El orden de la historia lo pone la propietaria
 * partiendo del de lanzamiento; la app no inventa cronologías.
 */
export function SagasView() {
  const { library, actions } = useLibrary();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [fetching, setFetching] = useState(false);
  const [order, setOrder] = useLocalChoice<StoryOrder>("ludoteca:orden-saga", "lanzamiento", ["lanzamiento", "historia"]);

  const stories = useMemo(() => buildStories(library.games), [library.games]);
  const needle = q.trim().toLowerCase();
  const visible = needle ? stories.filter((s) => s.name.toLowerCase().includes(needle) || s.games.some((g) => g.title.toLowerCase().includes(needle))) : stories;
  const groups = groupByBrand(visible);
  const open = stories.find((s) => s.name === params.get("historia")) ?? null;
  const missing = library.games.filter((g) => g.igdbId != null && !g.series?.trim());

  async function fetchSeries() {
    setFetching(true);
    let filled = 0;
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
        filled += actions.fillSeries(body.series);
      }
      toast(filled ? `${count(filled, "juego", "juegos")} con historia nueva` : "IGDB no tiene historias nuevas para tus juegos.");
    } catch {
      toast.error("No se pudo consultar el catálogo.");
    } finally {
      setFetching(false);
    }
  }

  const fetchButton = (primary: boolean) => (
    <button type="button" className={`btn ${primary ? "btn-ink" : ""}`} disabled={fetching || missing.length === 0} onClick={() => void fetchSeries()}>
      <DownloadCloud aria-hidden />
      {fetching ? "Trayendo…" : "Traer historias de IGDB"}
    </button>
  );

  return (
    <div className={styles.page} data-abierta={open ? "" : undefined}>
      <header className={styles.head}>
        <h1 className="screen-title">Sagas</h1>
        <p className={styles.lead}>Tus juegos por historia, en orden de lanzamiento o en el de la historia.</p>
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
            {groups.map((group) => (
              <div key={group.brand ?? group.stories[0].name} className={styles.group}>
                {group.brand && <h2 className={styles.brand}>{group.brand}</h2>}
                <ul className={styles.stories}>
                  {group.stories.map((story) => (
                    <li key={story.name}>
                      <StoryRow story={story} order={order} current={open?.name === story.name} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          {open && (
            <StoryPanel
              key={open.name}
              story={open}
              order={order}
              setOrder={setOrder}
              onClose={() => router.push("/sagas", { scroll: false })}
              onMove={(id, dir) => actions.updateGames(moveInStory(open, id, dir).map((m) => ({ id: m.id, patch: { seriesOrder: m.seriesOrder } })))}
              onRename={(name) => {
                // Si ya hay una historia con ese nombre, se unen: sus órdenes no casan, así que vuelven al de lanzamiento.
                const others = library.games.filter((g) => g.series?.trim() === name && !open.games.includes(g));
                const merging = others.length > 0;
                // Sin unir, cada juego conserva su puesto; al unir, todos vuelven al orden de lanzamiento.
                actions.updateGames([
                  ...open.games.map((g) => ({ id: g.id, patch: { series: name, seriesOrder: merging ? null : (g.seriesOrder ?? null) } })),
                  ...others.map((g) => ({ id: g.id, patch: { seriesOrder: null } })),
                ]);
                router.push(`/sagas?historia=${encodeURIComponent(name)}`, { scroll: false });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Una historia en la lista: nombre, juegos, superados y el siguiente que toca. */
function StoryRow({ story, order, current }: { story: Story; order: StoryOrder; current: boolean }) {
  const ordered = orderStory(story, order);
  const done = story.games.filter((g) => timesFinished(g) > 0 || g.status === "completado").length;
  const next = nextInStory(ordered);
  return (
    <Link href={`/sagas?historia=${encodeURIComponent(story.name)}`} scroll={false} className={styles.row} aria-current={current ? "true" : undefined}>
      <strong>{story.name}</strong>
      <span className={styles.meta}>
        {count(story.games.length, "juego", "juegos")} · {done} de {story.games.length} superados
      </span>
      <span className={styles.next}>{next ? `Siguiente: ${next.title}` : "Saga completada"}</span>
    </Link>
  );
}

/** La historia abierta: el orden que se elige, sus juegos y, en «Historia», las flechas para cambiarlo. */
function StoryPanel({
  story,
  order,
  setOrder,
  onClose,
  onMove,
  onRename,
}: {
  story: Story;
  order: StoryOrder;
  setOrder: (o: StoryOrder) => void;
  onClose: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRename: (name: string) => void;
}) {
  const ordered = orderStory(story, order);
  const next = nextInStory(ordered);
  const [renaming, setRenaming] = useState(false);
  return (
    <section className={`window ${styles.story}`} aria-labelledby="historia-abierta">
      <button type="button" className={`btn btn-quiet btn-sm ${styles.back}`} onClick={onClose}>
        <ArrowLeft aria-hidden />
        Todas las sagas
      </button>
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
        {order === "lanzamiento" ? "Por fecha de salida." : "Parte del de lanzamiento: mueve con las flechas lo que vaya antes o después en la historia."}
      </p>
      <ol className={styles.games} aria-label="Juegos de la historia">
        {ordered.map((g, i) => (
          <li key={g.id} className={styles.game} data-siguiente={next?.id === g.id || undefined}>
            <span className={styles.pos}>{i + 1}.</span>
            <Cover src={g.coverUrl} title={g.title} caption="" className={styles.thumb} />
            <span className={styles.gameText}>
              <Link href={`/juego/${g.id}`}>{g.title}</Link>
              <span className={styles.gameMeta}>
                {year(g)} · <StatusMark status={g.status} />
              </span>
            </span>
            {order === "historia" && (
              <span className={styles.arrows}>
                <button type="button" className="btn btn-quiet btn-icon" aria-label={`Subir «${g.title}»`} disabled={i === 0} onClick={() => onMove(g.id, -1)}>
                  <ArrowUp aria-hidden />
                </button>
                <button type="button" className="btn btn-quiet btn-icon" aria-label={`Bajar «${g.title}»`} disabled={i === ordered.length - 1} onClick={() => onMove(g.id, 1)}>
                  <ArrowDown aria-hidden />
                </button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className={styles.verdict}>{next ? `Siguiente: ${next.title}` : "Saga completada"}</p>
    </section>
  );
}
