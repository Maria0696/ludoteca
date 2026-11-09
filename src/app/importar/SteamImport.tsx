"use client";

import { ChevronsRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogGame } from "@/lib/catalog";
import type { SteamGame, SteamLibraryResponse, SteamSheetsResponse } from "@/lib/steam";
import { type SteamImportCounts, type SteamState, steamStates } from "@/lib/steam-import";
import { useLibrary } from "@/lib/store";
import { screenData, screenTitle } from "./fonts";
import styles from "./importar.module.css";

type Phase = "inicio" | "leyendo" | "eleccion" | "copiando" | "hecho";
type Sort = "horas" | "nombre";

/** Grupos pequeños: la barra avanza de verdad y un fallo no pierde lo ya guardado. */
const BATCH = 50;
/** Más casillas no se distinguen: el resto se resume con un número. */
const MAX_CELLS = 77;
const EMPTY_CELLS = 44;
const PROFILE_KEY = "ludoteca:perfil-steam";

const NOTE: Record<SteamState, string | null> = {
  nuevo: null,
  copia: "Ya la tienes: se añade tu copia de Steam",
  horas: "Ya la tienes: solo se actualizan las horas",
};

const hoursLabel = (minutes: number) => {
  if (!minutes) return "Sin jugar";
  const hours = minutes / 60;
  return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} h`.replace(".", ",");
};

const games = (n: number) => `${n} ${n === 1 ? "juego" : "juegos"}`;

async function readSheets(appIds: number[]): Promise<Record<number, CatalogGame>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("/api/steam/fichas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appIds }),
      });
      const data = (await res.json()) as SteamSheetsResponse;
      if (data.ok) return data.matches;
      if (data.reason !== "error") return {};
    } catch {
      // Un corte de red se reintenta una vez; después, el juego entra solo con su nombre.
    }
  }
  return {};
}

function GameIcon({ game, className }: { game: SteamGame; className?: string }) {
  if (!game.icon) {
    return (
      <span className={`${styles.noIcon} ${className ?? ""}`} aria-hidden>
        {game.name[0]}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- icono de 32 píxeles servido por Steam
  return <img className={className} src={game.icon} alt="" width={32} height={32} loading="lazy" />;
}

export function SteamImport() {
  const { library, actions } = useLibrary();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [problem, setProblem] = useState<string | null>(null);
  const [list, setList] = useState<SteamGame[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("horas");
  const [copied, setCopied] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<SteamImportCounts | null>(null);
  // Mientras se copia, cada juego seguiría diciendo lo que iba a pasarle, no lo que acaba de pasar.
  const [frozen, setFrozen] = useState<Map<number, SteamState> | null>(null);
  const profileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      if (saved && profileRef.current && !profileRef.current.value) profileRef.current.value = saved;
    } catch {
      // Sin acceso al almacenamiento, simplemente no se recuerda el perfil.
    }
  }, []);

  const states = useMemo(() => steamStates(library, list), [library, list]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((g) => g.name.toLowerCase().includes(q))
      .sort((a, b) => (sort === "horas" ? b.minutes - a.minutes : 0) || a.name.localeCompare(b.name, "es"));
  }, [list, query, sort]);
  const queue = useMemo(() => list.filter((g) => selected.has(g.appId)), [list, selected]);

  const copying = phase === "copiando";
  const hasList = phase === "eleccion" || copying;
  const progress = queue.length ? copied.size / queue.length : 0;

  async function search(profile: string) {
    setProblem(null);
    setResult(null);
    setPhase("leyendo");
    try {
      const res = await fetch("/api/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: profile }),
      });
      const data = (await res.json()) as SteamLibraryResponse;
      if (!data.ok) {
        setProblem(data.message);
        setPhase("inicio");
        return;
      }
      try {
        localStorage.setItem(PROFILE_KEY, profile);
      } catch {
        // Sin acceso al almacenamiento, simplemente no se recuerda el perfil.
      }
      setList(data.games);
      // Los de la familia no son tuyos: quedan a un clic, pero sin marcar.
      setSelected(new Set(data.games.filter((g) => !g.family).map((g) => g.appId)));
      setCopied(new Set());
      setPhase("eleccion");
    } catch {
      setProblem("No se ha podido conectar. Comprueba tu conexión y vuelve a buscar.");
      setPhase("inicio");
    }
  }

  async function copyGames() {
    if (!queue.length) return;
    setProblem(null);
    setCopied(new Set());
    setFrozen(states);
    setPhase("copiando");
    const totals: SteamImportCounts = { nuevos: 0, actualizados: 0, sinCaratula: 0 };
    let saved = 0;
    for (let i = 0; i < queue.length; i += BATCH) {
      const chunk = queue.slice(i, i + BATCH);
      const matches = await readSheets(chunk.map((g) => g.appId));
      try {
        const counts = await actions.importSteam(chunk.map((game) => ({ game, catalog: matches[game.appId] })));
        totals.nuevos += counts.nuevos;
        totals.actualizados += counts.actualizados;
        totals.sinCaratula += counts.sinCaratula;
      } catch (e) {
        const reason = e instanceof Error ? ` (${e.message})` : "";
        setProblem(`Se ha parado tras guardar ${games(saved)}${reason}. Vuelve a copiar: lo ya guardado no se duplica.`);
        setFrozen(null);
        setPhase("eleccion");
        return;
      }
      saved += chunk.length;
      setCopied((done) => new Set([...done, ...chunk.map((g) => g.appId)]));
    }
    setResult(totals);
    setFrozen(null);
    setCopied(new Set());
    setPhase("hecho");
  }

  const toggle = (appId: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(appId)) next.add(appId);
      return next;
    });
  const setVisible = (on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const g of visible) {
        if (on) next.add(g.appId);
        else next.delete(g.appId);
      }
      return next;
    });

  return (
    <div className={`${styles.page} ${screenTitle.variable} ${screenData.variable}`} data-fase={phase}>
      <header className={styles.top}>
        <h1>Copiar desde Steam</h1>
        <form
          className={styles.profile}
          onSubmit={(e) => {
            e.preventDefault();
            const profile = profileRef.current?.value.trim();
            if (profile && !copying) void search(profile);
          }}
        >
          <label htmlFor="perfil-steam">Tu perfil de Steam</label>
          <div>
            <input id="perfil-steam" ref={profileRef} placeholder="steamcommunity.com/id/tu-nombre" autoComplete="off" spellCheck={false} required />
            <button type="submit" disabled={copying || phase === "leyendo"}>
              Buscar
            </button>
          </div>
        </form>
      </header>

      {problem && (
        <p className={styles.problem} role="alert">
          {problem}
        </p>
      )}

      {phase !== "hecho" && (
        <div className={styles.bays}>
          <section className={styles.card} aria-labelledby="bahia-steam">
            <h2 id="bahia-steam">
              Steam {hasList && <small>{games(list.length)}</small>}
            </h2>
            {phase === "inicio" && (
              <div className={styles.intro}>
                <p>Pega el enlace de tu perfil de Steam y pulsa Buscar. Verás todos tus juegos y elegirás cuáles copiar.</p>
                <p>Para que Steam los enseñe, «Detalles de los juegos» tiene que estar en público en la privacidad de tu perfil.</p>
              </div>
            )}
            {phase === "leyendo" && (
              <p className={styles.intro} role="status">
                Leyendo datos de Steam…
              </p>
            )}
            {hasList && (
              <>
                <div className={styles.tools}>
                  <input type="search" aria-label="Buscar en la lista" placeholder="Buscar juego" value={query} onChange={(e) => setQuery(e.target.value)} />
                  <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                    <option value="horas">Más horas primero</option>
                    <option value="nombre">Por nombre</option>
                  </select>
                  <button type="button" disabled={copying} onClick={() => setVisible(true)}>
                    Todos
                  </button>
                  <button type="button" disabled={copying} onClick={() => setVisible(false)}>
                    Ninguno
                  </button>
                </div>
                <div className={styles.list}>
                  {visible.length === 0 && <p className={styles.none}>Ningún juego con ese nombre.</p>}
                  {visible.map((game) => {
                    const note = NOTE[(frozen ?? states).get(game.appId) ?? "nuevo"] ?? (game.family ? "De tu familia de Steam: entraría como prestado" : null);
                    return (
                      <button
                        key={game.appId}
                        type="button"
                        className={styles.row}
                        aria-pressed={selected.has(game.appId)}
                        disabled={copying}
                        onClick={() => toggle(game.appId)}
                      >
                        <GameIcon game={game} className={styles.rowIcon} />
                        <span className={styles.rowName}>
                          {game.name}
                          {note && <small>{note}</small>}
                        </span>
                        <span className={styles.rowHours}>{hoursLabel(game.minutes)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <div className={styles.arrow} aria-hidden>
            <ChevronsRight />
          </div>

          <section className={styles.card} aria-labelledby="bahia-ludoteca">
            <h2 id="bahia-ludoteca">Ludoteca</h2>
            <div className={styles.cells} aria-hidden>
              {queue.length === 0 && Array.from({ length: EMPTY_CELLS }, (_, i) => <span key={i} className={styles.slot} />)}
              {queue.slice(0, MAX_CELLS).map((game) => (
                <span key={game.appId} className={copied.has(game.appId) ? styles.cellDone : styles.cell}>
                  <GameIcon game={game} />
                </span>
              ))}
              {queue.length > MAX_CELLS && <span className={styles.more}>+{queue.length - MAX_CELLS}</span>}
            </div>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label="Progreso de la copia"
              aria-valuemin={0}
              aria-valuemax={queue.length}
              aria-valuenow={copied.size}
            >
              <i style={{ transform: `scaleX(${progress})` }} />
            </div>
            <p className={styles.status} aria-live="polite">
              {copying ? `Copiando ${copied.size} de ${queue.length}. No cierres esta pantalla.` : `${games(queue.length)} para copiar`}
            </p>
            {!copying && <p className={styles.fine}>Los nuevos entran como Pendiente, con una copia digital de PC en la tienda Steam.</p>}
            <button type="button" className={styles.go} disabled={copying || queue.length === 0} onClick={() => void copyGames()}>
              {copying ? "Copiando…" : "Copiar a la ludoteca"}
            </button>
          </section>
        </div>
      )}

      {phase === "hecho" && result && (
        <section className={styles.done} role="status">
          <h2>Copia terminada</h2>
          <ul>
            <li>{result.nuevos === 1 ? "1 juego nuevo en tu ludoteca" : `${result.nuevos} juegos nuevos en tu ludoteca`}</li>
            {result.actualizados > 0 && <li>{result.actualizados === 1 ? "1 ya lo tenías: datos actualizados" : `${result.actualizados} ya los tenías: datos actualizados`}</li>}
            {result.sinCaratula > 0 && <li>{result.sinCaratula === 1 ? "1 sin carátula, para completar a mano" : `${result.sinCaratula} sin carátula, para completar a mano`}</li>}
          </ul>
          <div className={styles.doneActions}>
            <Link href="/biblioteca" className={styles.go}>
              Ver mi biblioteca
            </Link>
            <button type="button" onClick={() => setPhase("eleccion")}>
              Volver a la lista
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
