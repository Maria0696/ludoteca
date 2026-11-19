"use client";

import { LayoutGrid, List, Search, SlidersHorizontal, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { arcade, terminal } from "@/app/entrar/fonts";
import { useAddGame } from "@/components/game/AddGameProvider";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import {
  type LibraryEntry,
  type LibraryFilters,
  type SortKey,
  SORTS,
  SORT_LABEL,
  activeFilterCount,
  buildEntries,
  facetValues,
  filterEntries,
  sortEntries,
} from "@/lib/filters";
import { copiesSummary, formatNumber, relativeDay } from "@/lib/format";
import { type Format, type GameStatus, GAME_STATUSES, STATUS_LABEL } from "@/lib/model";
import { formatHours } from "@/lib/recommend";
import { isDirection, nearest } from "@/lib/spatial-nav";
import { useLibrary } from "@/lib/store";
import { ARCADE_STATUS } from "@/components/ui/StatusMark";
import { platformColor } from "./arcade";
import { Cabinet } from "./Cabinet";
import styles from "./library.module.css";
import { Chosen, HiScore } from "./Scoreboard";

type Group = "plataforma" | "estado" | "ninguno";

function readList(params: URLSearchParams, key: string): string[] {
  return params.get(key)?.split(",").filter(Boolean) ?? [];
}

const led = (color: string) => ({ "--k": color }) as React.CSSProperties;

export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { library, actions } = useLibrary();
  const { open: openAdd } = useAddGame();
  const [sheet, setSheet] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const urlQ = params.get("q") ?? "";
  const [qInput, setQInput] = useState(urlQ);
  // Si la búsqueda cambia desde fuera (Restablecer, búsqueda rápida), el campo la sigue.
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    if (urlQ !== qInput) setQInput(urlQ);
  }

  const tab = params.get("plataforma") ?? "";
  const sort = (SORTS as readonly string[]).includes(params.get("orden") ?? "") ? (params.get("orden") as SortKey) : "anadido";
  const view = params.get("vista") === "lista" ? "lista" : "caratulas";
  const group: Group = (params.get("agrupar") as Group) || (tab ? "ninguno" : "plataforma");
  const filters: LibraryFilters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      platforms: tab ? [tab] : [],
      formats: readList(params, "formato") as Format[],
      genres: readList(params, "genero"),
      statuses: readList(params, "estado") as GameStatus[],
      favorites: params.get("favoritos") === "1",
    }),
    [params, tab],
  );

  // La URL tarda un instante en actualizarse; dos pulsaciones seguidas deben
  // partir del último cambio pedido, no de la URL anterior.
  const pending = useRef<string | null>(null);
  useEffect(() => {
    if (pending.current === params.toString()) pending.current = null;
  }, [params]);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(pending.current ?? params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("buscar");
    const qs = next.toString();
    pending.current = qs;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const toggleIn = (key: string, value: string) => {
    const current = readList(new URLSearchParams(pending.current ?? params.toString()), key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setParams({ [key]: next.join(",") || null });
  };
  const resetFilters = () => setParams({ formato: null, genero: null, estado: null, favoritos: null, q: null });

  const entries = useMemo(() => buildEntries(library), [library]);
  const facets = useMemo(() => facetValues(entries), [entries]);
  const visible = useMemo(() => sortEntries(filterEntries(entries, filters), sort), [entries, filters, sort]);

  // Cambio en grupo en la tabla: solo cuentan los elegidos que se ven; un filtro que oculta uno lo saca.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // El estado elegido en la barra solo se aplica con «Cambiar»: con el teclado, moverse por la lista no cambia nada.
  const [bulkStatus, setBulkStatus] = useState<GameStatus | "">("");
  const visibleKey = visible.map((e) => e.game.id).join();
  const [pickedFor, setPickedFor] = useState(visibleKey);
  if (pickedFor !== visibleKey) {
    setPickedFor(visibleKey);
    const ids = new Set(visible.map((e) => e.game.id));
    setPicked((prev) => new Set([...prev].filter((id) => ids.has(id))));
  }
  const allPicked = visible.length > 0 && visible.every((e) => picked.has(e.game.id));
  const togglePick = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  useEffect(() => {
    if (picked.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setPicked(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked.size]);
  const activeCount = activeFilterCount({ ...filters, platforms: [] }) + (filters.q ? 1 : 0);
  const chosen = visible.find((e) => e.game.id === chosenId) ?? visible[0];

  const groups = useMemo(() => {
    // Cada cabina entra un instante después de la anterior, también entre grupos.
    const list = groupEntries(visible, group, tab);
    const starts = list.reduce<number[]>((acc, g, i) => [...acc, i === 0 ? 0 : acc[i - 1] + list[i - 1].entries.length], []);
    return list.map((g, i) => ({ ...g, offset: starts[i] }));
  }, [visible, group, tab]);

  if (library.games.length === 0) return <FirstRun />;

  const filterControls = (
    <>
      <div className={styles.filterGroup} role="group" aria-label="Estado">
        {GAME_STATUSES.map((s) => (
          <button key={s} type="button" className={styles.chip} aria-pressed={filters.statuses.includes(s)} onClick={() => toggleIn("estado", s)}>
            <i className={styles.led} style={led(ARCADE_STATUS[s].color)} aria-hidden />
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className={styles.filterGroup} role="group" aria-label="Formato">
        {(["fisico", "digital"] as const).map((f) => (
          <button key={f} type="button" className={styles.chip} aria-pressed={filters.formats.includes(f)} onClick={() => toggleIn("formato", f)}>
            {f === "fisico" ? "Físico" : "Digital"}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={filters.favorites} onClick={() => setParams({ favoritos: filters.favorites ? null : "1" })}>
          <Star aria-hidden />
          Favoritos
        </button>
      </div>
      {facets.genres.length > 0 && (
        <label className={styles.genre}>
          <span className="sr-only">Género</span>
          <select
            className="select"
            value=""
            onChange={(e) => e.target.value && toggleIn("genero", e.target.value)}
          >
            <option value="">{filters.genres.length ? `Género · ${filters.genres.length}` : "Género"}</option>
            {facets.genres
              .filter((g) => !filters.genres.includes(g.value))
              .map((g) => (
                <option key={g.value} value={g.value}>
                  {g.value} ({g.count})
                </option>
              ))}
          </select>
        </label>
      )}
    </>
  );

  const orderControls = (
    <>
      <label className={styles.sort}>
        <span className="sr-only">Ordenar</span>
        <select className="select" value={sort} onChange={(e) => setParams({ orden: e.target.value === "anadido" ? null : e.target.value })}>
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {!tab && (
        <label className={styles.sort}>
          <span className="sr-only">Agrupar</span>
          <select className="select" value={group} onChange={(e) => setParams({ agrupar: e.target.value === "plataforma" ? null : e.target.value })}>
            <option value="plataforma">Por plataforma</option>
            <option value="estado">Por estado</option>
            <option value="ninguno">Sin agrupar</option>
          </select>
        </label>
      )}
    </>
  );

  return (
    <div className={`${styles.page} ${arcade.variable} ${terminal.variable}`}>
      <header className={styles.head}>
        <h1>Biblioteca</h1>
        <p className={styles.credits}>
          {library.games.length} {library.games.length === 1 ? "título" : "títulos"} · {library.copies.length}{" "}
          {library.copies.length === 1 ? "copia" : "copias"}
        </p>
        <div className={styles.headActions}>
          <Link href="/importar" className={styles.chip}>
            Importar de Steam
          </Link>
          <div className={styles.viewToggle} role="group" aria-label="Vista">
            <button type="button" className={styles.chip} aria-pressed={view === "caratulas"} onClick={() => setParams({ vista: null })}>
              <LayoutGrid aria-hidden />
              <span>Cabinas</span>
            </button>
            <button type="button" className={styles.chip} aria-pressed={view === "lista"} onClick={() => setParams({ vista: "lista" })}>
              <List aria-hidden />
              <span>Tabla</span>
            </button>
          </div>
        </div>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search aria-hidden />
          <span className="sr-only">Buscar por título</span>
          <input
            type="search"
            placeholder="Buscar por título"
            value={qInput}
            autoFocus={params.get("buscar") === "1"}
            onChange={(e) => {
              setQInput(e.target.value);
              setParams({ q: e.target.value.trim() ? e.target.value : null });
            }}
          />
        </label>
        <div className={styles.orderControls}>{orderControls}</div>
        <button type="button" className={`${styles.chip} ${styles.filterBtn}`} aria-pressed={activeCount > 0} onClick={() => setSheet(true)}>
          <SlidersHorizontal aria-hidden />
          Filtros{activeCount > 0 ? ` · ${activeCount}` : ""}
        </button>
      </div>

      <div className={styles.plats}>
        <div role="tablist" aria-label="Plataforma" style={{ display: "contents" }}>
          <button type="button" role="tab" className={styles.plat} style={led("#ffffff")} aria-selected={!tab} onClick={() => setParams({ plataforma: null })}>
            <i aria-hidden />
            Todas <small>{entries.length}</small>
          </button>
          {facets.platforms.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              className={styles.plat}
              style={led(platformColor(p.value))}
              aria-selected={tab === p.value}
              onClick={() => setParams({ plataforma: p.value })}
            >
              <i aria-hidden />
              {p.value} <small>{p.count}</small>
            </button>
          ))}
        </div>
        <Link href="/listas" className={styles.plat} style={led("#ffe94d")}>
          <i aria-hidden />
          Mis listas <small>{library.lists.length}</small>
        </Link>
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersInline}>{filterControls}</div>
        {filters.genres.map((g) => (
          <button key={g} type="button" className={`${styles.chip} is-on`} aria-pressed onClick={() => toggleIn("genero", g)} aria-label={`Quitar el filtro de género ${g}`}>
            {g} ×
          </button>
        ))}
        {activeCount > 0 && (
          <button type="button" className={styles.reset} onClick={resetFilters}>
            Restablecer
          </button>
        )}
        <span className={styles.count} aria-live="polite">
          {visible.length === entries.length ? `${visible.length} títulos` : `${visible.length} de ${entries.length} títulos`}
        </span>
      </div>

      <div className={styles.arena}>
        <div className={styles.main}>
          {visible.length === 0 ? (
            <div className={styles.gameOver}>
              <p className={styles.gameOverTitle} aria-hidden>
                Game over
              </p>
              <h2>Ningún juego coincide</h2>
              <p>
                {filters.q ? `No hay nada con «${filters.q}»` : "No hay juegos"}
                {activeCount > (filters.q ? 1 : 0) || tab ? " con estos filtros." : "."}
              </p>
              <div className={styles.gameOverActions}>
                <button type="button" className={`${styles.chip} ${styles.chipStrong}`} onClick={() => setParams({ formato: null, genero: null, estado: null, favoritos: null, q: null, plataforma: null })}>
                  Restablecer filtros
                </button>
                {filters.q && (
                  <button type="button" className={styles.chip} onClick={() => openAdd({ title: filters.q })}>
                    Añadir «{filters.q}»
                  </button>
                )}
              </div>
            </div>
          ) : view === "caratulas" ? (
            <ul
              className={styles.grid}
              aria-label="Juegos"
              onKeyDown={(e) => {
                // Como en la recreativa: las flechas mueven el cursor entre cabinas.
                if (!isDirection(e.key)) return;
                const next = nearest(e.currentTarget, e.target as HTMLElement, e.key);
                if (next) {
                  e.preventDefault();
                  next.focus();
                }
              }}
            >
              {groups.map((g, gi) => (
                <Fragment key={g.key}>
                  {g.label && (
                    <li className={styles.groupHeading} aria-hidden style={g.color ? led(g.color) : undefined}>
                      <strong>{g.title}</strong>
                      <span>{g.detail}</span>
                    </li>
                  )}
                  {g.entries.map((e, i) => (
                    <Cabinet key={`${g.key}-${e.game.id}`} entry={e} priority={gi === 0 && i < 6} index={g.offset + i} onChoose={setChosenId} />
                  ))}
                </Fragment>
              ))}
            </ul>
          ) : (
            <>
              {picked.size > 0 && (
                <section className={`window ${styles.bulk}`} aria-label="Cambio en grupo">
                  <p>
                    {picked.size} {picked.size === 1 ? "elegido" : "elegidos"}
                  </p>
                  <select className="select" aria-label="Cambiar estado a…" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as GameStatus)}>
                    <option value="" disabled>
                      Cambiar estado a…
                    </option>
                    {GAME_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ink"
                    disabled={!bulkStatus}
                    onClick={() => {
                      if (!bulkStatus) return;
                      actions.setStatusMany([...picked], bulkStatus);
                      setPicked(new Set());
                      setBulkStatus("");
                    }}
                  >
                    Cambiar
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => setPicked(new Set())}>
                    <X aria-hidden />
                    Quitar la selección
                  </button>
                </section>
              )}
              <div className={styles.table} role="table" aria-label="Juegos">
                <div className={styles.rowHead} role="row">
                  <span role="columnheader">
                    <label className={styles.pick}>
                      <input
                        type="checkbox"
                        aria-label="Elegir todos los que se ven"
                        checked={allPicked}
                        ref={(el) => {
                          if (el) el.indeterminate = picked.size > 0 && !allPicked;
                        }}
                        onChange={(e) => setPicked(e.target.checked ? new Set(visible.map((v) => v.game.id)) : new Set())}
                      />
                    </label>
                  </span>
                  <span role="columnheader" />
                  <span role="columnheader">Título</span>
                  <span role="columnheader" className={styles.hideNarrow}>
                    Copias
                  </span>
                  <span role="columnheader">Estado</span>
                  <span role="columnheader" className={`${styles.hideNarrow} ${styles.num}`}>
                    Horas
                  </span>
                  <span role="columnheader" className={`${styles.hideNarrow} ${styles.num}`}>
                    Nota
                  </span>
                  <span role="columnheader" className={`${styles.hideNarrow} ${styles.num}`}>
                    Última partida
                  </span>
                </div>
                {visible.map(({ game, copies }) => (
                  <div key={game.id} className={styles.row} role="row" style={led(ARCADE_STATUS[game.status].color)} data-picked={picked.has(game.id) || undefined}>
                    <span role="cell">
                      <label className={styles.pick}>
                        <input
                          type="checkbox"
                          aria-label={`Elegir «${game.title}»`}
                          checked={picked.has(game.id)}
                          onChange={(e) => togglePick(game.id, e.target.checked)}
                        />
                      </label>
                    </span>
                    <span role="cell">
                      <Cover src={game.coverUrl} title={game.title} caption="" className={styles.thumb} />
                    </span>
                    <span role="cell" className={styles.rowTitle}>
                      <Link href={`/juego/${game.id}`}>{game.title}</Link>
                      <small>{game.genres.slice(0, 2).join(", ") || " "}</small>
                    </span>
                    <span role="cell" className={styles.hideNarrow}>
                      {copiesSummary(copies)}
                    </span>
                    <span role="cell">
                      <select
                        className={`select ${styles.statusSelect}`}
                        aria-label={`Estado de ${game.title}`}
                        value={game.status}
                        onChange={(e) => actions.setStatus(game.id, e.target.value as GameStatus)}
                      >
                        {GAME_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span role="cell" className={`${styles.hideNarrow} ${styles.num}`}>
                      {game.hoursPlayed ? formatHours(game.hoursPlayed) : "—"}
                    </span>
                    <span role="cell" className={`${styles.hideNarrow} ${styles.num}`}>
                      {game.rating != null ? formatNumber(game.rating) : "—"}
                    </span>
                    <span role="cell" className={`${styles.hideNarrow} ${styles.num}`}>
                      {relativeDay(game.lastPlayedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className={styles.side}>
          <Chosen entry={chosen} />
          <HiScore entries={entries} />
        </aside>
      </div>

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        title="Ordenar y filtrar"
        footer={
          <>
            <button type="button" className="btn" onClick={resetFilters}>
              Restablecer
            </button>
            <button type="button" className="btn btn-ink" onClick={() => setSheet(false)}>
              Ver {visible.length} {visible.length === 1 ? "juego" : "juegos"}
            </button>
          </>
        }
      >
        <div className={styles.sheetFilters}>
          <div className={styles.sheetOrder}>{orderControls}</div>
          {filterControls}
        </div>
      </Dialog>
    </div>
  );
}

interface EntryGroup {
  key: string;
  label: string;
  title: string;
  detail: string;
  /** Color de neón del rótulo del grupo. */
  color?: string;
  entries: LibraryEntry[];
}

const PLATFORM_LONG: Record<string, string> = {
  PS5: "PlayStation 5",
  PS4: "PlayStation 4",
  PS3: "PlayStation 3",
  PS2: "PlayStation 2",
  PS1: "PlayStation",
  "Xbox Series": "Xbox Series",
};

function groupEntries(entries: LibraryEntry[], group: Group, tab: string): EntryGroup[] {
  if (group === "ninguno" || tab) return [{ key: "todo", label: "", title: "", detail: "", entries }];
  const map = new Map<string, LibraryEntry[]>();
  if (group === "estado") {
    for (const s of GAME_STATUSES) map.set(s, []);
    for (const e of entries) map.get(e.game.status)!.push(e);
    return [...map.entries()]
      .filter(([, list]) => list.length)
      .map(([s, list]) => ({
        key: s,
        label: STATUS_LABEL[s as GameStatus],
        title: STATUS_LABEL[s as GameStatus],
        detail: `${list.length} ${list.length === 1 ? "juego" : "juegos"}`,
        color: ARCADE_STATUS[s as GameStatus].color,
        entries: list,
      }));
  }
  for (const e of entries) {
    const platforms = e.copies.length ? [...new Set(e.copies.map((c) => c.platform))] : ["Sin copia"];
    for (const p of platforms) map.set(p, [...(map.get(p) ?? []), e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"))
    .map(([p, list]) => {
      const playing = list.filter((e) => e.game.status === "jugando").length;
      return {
        key: p,
        label: p,
        title: PLATFORM_LONG[p] ?? p,
        detail: `${list.length} ${list.length === 1 ? "juego" : "juegos"}${playing ? ` · ${playing} jugando` : ""}`,
        color: p === "Sin copia" ? undefined : platformColor(p),
        entries: list,
      };
    });
}

function FirstRun() {
  const { open } = useAddGame();
  const { actions, mode } = useLibrary();
  const [loading, setLoading] = useState(false);
  return (
    <div className={`${styles.page} ${arcade.variable} ${terminal.variable}`}>
      <header className={styles.head}>
        <h1>
          <span aria-hidden>Insert coin</span>
          <span className="sr-only">Biblioteca</span>
        </h1>
      </header>
      <div className={styles.firstRun}>
        <h2>Tu biblioteca está vacía</h2>
        <p>
          Añade tu primer juego: basta con el título, la plataforma y si es físico o digital. Lo demás puede esperar.
          {mode === "local" && " Estás en modo local: se guardará solo en este navegador."}
        </p>
        <div className={styles.gameOverActions}>
          <button type="button" className={`${styles.chip} ${styles.chipStrong}`} onClick={() => open()}>
            Añadir el primer juego
          </button>
          <Link href="/importar" className={styles.chip}>
            Importar de Steam
          </Link>
          {mode === "local" && (
            <button
              type="button"
              className={styles.chip}
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await actions.loadDemo();
                setLoading(false);
              }}
            >
              {loading ? "Cargando…" : "Probar con datos de demostración"}
            </button>
          )}
        </div>
        {mode === "local" && <p className={styles.small}>Los datos de demostración se retiran de una vez desde Ajustes.</p>}
      </div>
    </div>
  );
}
