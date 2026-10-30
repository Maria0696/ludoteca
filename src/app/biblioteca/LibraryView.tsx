"use client";

import { LayoutGrid, List, Search, SlidersHorizontal, Star } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useAddGame } from "@/components/game/AddGameProvider";
import { GameCard, GroupHeading } from "@/components/game/GameCard";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { StatusIcon } from "@/components/ui/StatusMark";
import gameStyles from "@/components/game/game.module.css";
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
import { useLibrary } from "@/lib/store";
import styles from "./library.module.css";

type Group = "plataforma" | "estado" | "ninguno";

function readList(params: URLSearchParams, key: string): string[] {
  return params.get(key)?.split(",").filter(Boolean) ?? [];
}

export function LibraryView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { library, actions } = useLibrary();
  const { open: openAdd } = useAddGame();
  const [sheet, setSheet] = useState(false);
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
  const activeCount = activeFilterCount({ ...filters, platforms: [] }) + (filters.q ? 1 : 0);

  const groups = useMemo(() => {
    // Cada póster entra un instante después del anterior, también entre grupos.
    const list = groupEntries(visible, group, tab);
    const starts = list.reduce<number[]>((acc, g, i) => [...acc, i === 0 ? 0 : acc[i - 1] + list[i - 1].entries.length], []);
    return list.map((g, i) => ({ ...g, offset: starts[i] }));
  }, [visible, group, tab]);

  if (library.games.length === 0) return <FirstRun />;

  const filterControls = (
    <>
      <div className={styles.filterGroup} role="group" aria-label="Estado">
        {GAME_STATUSES.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={filters.statuses.includes(s)} onClick={() => toggleIn("estado", s)}>
            <StatusIcon status={s} />
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className={styles.filterGroup} role="group" aria-label="Formato">
        {(["fisico", "digital"] as const).map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={filters.formats.includes(f)} onClick={() => toggleIn("formato", f)}>
            {f === "fisico" ? "Físico" : "Digital"}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={filters.favorites} onClick={() => setParams({ favoritos: filters.favorites ? null : "1" })}>
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
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Biblioteca</h1>
        <p className="muted num">
          {library.games.length} {library.games.length === 1 ? "título" : "títulos"} · {library.copies.length}{" "}
          {library.copies.length === 1 ? "copia" : "copias"}
        </p>
        <div className={styles.headActions}>
          <div className={styles.viewToggle} role="group" aria-label="Vista">
            <button type="button" className="btn btn-sm" aria-pressed={view === "caratulas"} onClick={() => setParams({ vista: null })}>
              <LayoutGrid aria-hidden />
              <span>Carátulas</span>
            </button>
            <button type="button" className="btn btn-sm" aria-pressed={view === "lista"} onClick={() => setParams({ vista: "lista" })}>
              <List aria-hidden />
              <span>Lista</span>
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
        <button type="button" className={`btn ${styles.filterBtn}`} aria-pressed={activeCount > 0} onClick={() => setSheet(true)}>
          <SlidersHorizontal aria-hidden />
          Filtros{activeCount > 0 ? ` · ${activeCount}` : ""}
        </button>
      </div>

      <div className="tabs">
        <div role="tablist" aria-label="Plataforma" style={{ display: "contents" }}>
          <button type="button" role="tab" className="tab" aria-selected={!tab} onClick={() => setParams({ plataforma: null })}>
            Todas <small>{entries.length}</small>
          </button>
          {facets.platforms.map((p) => (
            <button key={p.value} type="button" role="tab" className="tab" aria-selected={tab === p.value} onClick={() => setParams({ plataforma: p.value })}>
              {p.value} <small>{p.count}</small>
            </button>
          ))}
        </div>
        <Link href="/listas" className="tab">
          Mis listas <small>{library.lists.length}</small>
        </Link>
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersInline}>{filterControls}</div>
        {filters.genres.map((g) => (
          <button key={g} type="button" className="chip is-on" onClick={() => toggleIn("genero", g)} aria-label={`Quitar el filtro de género ${g}`}>
            {g} ×
          </button>
        ))}
        {activeCount > 0 && (
          <button type="button" className="link-btn" onClick={resetFilters}>
            Restablecer
          </button>
        )}
        <span className={`${styles.count} muted num`} aria-live="polite">
          {visible.length === entries.length ? `${visible.length} títulos` : `${visible.length} de ${entries.length} títulos`}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className={styles.body}>
          <div className="empty">
            <h2>Ningún juego coincide</h2>
            <p>
              {filters.q ? `No hay nada con «${filters.q}»` : "No hay juegos"}
              {activeCount > (filters.q ? 1 : 0) || tab ? " con estos filtros." : "."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-ink" onClick={() => setParams({ formato: null, genero: null, estado: null, favoritos: null, q: null, plataforma: null })}>
                Restablecer filtros
              </button>
              {filters.q && (
                <button type="button" className="btn" onClick={() => openAdd({ title: filters.q })}>
                  Añadir «{filters.q}»
                </button>
              )}
            </div>
          </div>
        </div>
      ) : view === "caratulas" ? (
        <ul className={`${gameStyles.grid} ${styles.body}`} aria-label="Juegos">
          {groups.map((g, gi) => (
            <Fragment key={g.key}>
              {g.label && <GroupHeading title={g.title} detail={g.detail} />}
              {g.entries.map((e, i) => (
                <GameCard key={`${g.key}-${e.game.id}`} entry={e} priority={gi === 0 && i < 6} index={g.offset + i} />
              ))}
            </Fragment>
          ))}
        </ul>
      ) : (
        <div className={`${gameStyles.list} ${styles.body}`} role="table" aria-label="Juegos">
          <div className={gameStyles.rowHead} role="row">
            <span role="columnheader" />
            <span role="columnheader">Título</span>
            <span role="columnheader" className={gameStyles.hideNarrow}>Copias</span>
            <span role="columnheader">Estado</span>
            <span role="columnheader" className={`${gameStyles.hideNarrow} ${gameStyles.rowNum}`}>Valoración</span>
            <span role="columnheader" className={`${gameStyles.hideNarrow} ${gameStyles.rowNum}`}>Última partida</span>
          </div>
          {visible.map(({ game, copies }) => (
            <div key={game.id} className={gameStyles.row} role="row">
              <span role="cell">
                <Cover src={game.coverUrl} title={game.title} caption="" className={styles.thumb} />
              </span>
              <span role="cell" className={gameStyles.rowTitle}>
                <Link href={`/juego/${game.id}`}>{game.title}</Link>
                <small>{game.genres.slice(0, 2).join(", ") || " "}</small>
              </span>
              <span role="cell" className={`${gameStyles.rowCell} ${gameStyles.hideNarrow}`}>
                {copiesSummary(copies)}
              </span>
              <span role="cell">
                <select
                  className={`select ${gameStyles.statusSelect}`}
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
              <span role="cell" className={`${gameStyles.rowCell} ${gameStyles.rowNum} ${gameStyles.hideNarrow}`}>
                {game.rating != null ? formatNumber(game.rating) : "—"}
              </span>
              <span role="cell" className={`${gameStyles.rowCell} ${gameStyles.rowNum} ${gameStyles.hideNarrow}`}>
                {relativeDay(game.lastPlayedAt)}
              </span>
            </div>
          ))}
        </div>
      )}

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
  entries: LibraryEntry[];
}

const PLATFORM_LONG: Record<string, string> = {
  PS5: "PlayStation 5",
  PS4: "PlayStation 4",
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
        entries: list,
      };
    });
}

function FirstRun() {
  const { open } = useAddGame();
  const { actions, mode } = useLibrary();
  const [loading, setLoading] = useState(false);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Biblioteca</h1>
      </header>
      <div className={styles.body}>
        <div className="empty">
          <h2>Tu biblioteca está vacía</h2>
          <p>
            Añade tu primer juego: basta con el título, la plataforma y si es físico o digital. Lo demás puede esperar.
            {mode === "local" && " Estás en modo local: se guardará solo en este navegador."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-sticker" onClick={() => open()}>
              Añadir el primer juego
            </button>
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await actions.loadDemo();
                setLoading(false);
              }}
            >
              {loading ? "Cargando…" : "Probar con datos de demostración"}
            </button>
          </div>
          <p style={{ fontSize: 12 }}>Los datos de demostración se retiran de una vez desde Ajustes.</p>
        </div>
      </div>
    </div>
  );
}
