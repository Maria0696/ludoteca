"use client";

import { ImageUp, Plus, Trash2, Trophy } from "lucide-react";
import { TROPHY_URL } from "@/components/pixel/sprites";
import { formatDate, formatMoney, formatNumber, relativeDay } from "@/lib/format";
import {
  type Copy,
  type Game,
  type GameList,
  type GameStatus,
  FORMAT_LABEL,
  MODE_LABEL,
  MOOD_LABEL,
} from "@/lib/model";
import styles from "./adventure.module.css";
import { Editable } from "./Editable";
import { progressPercent } from "./progress";

type Update = (patch: Partial<Game>) => void;

export const STATUS_COLOR: Record<GameStatus, string> = {
  pendiente: "#a1a1aa",
  jugando: "#4ade80",
  pausado: "#fbbf24",
  completado: "#60a5fa",
  abandonado: "#71717a",
};

const RECORD_COLORS = ["#ff6b6b", "#ffb13d", "#ffe45c", "#5dff8b", "#57e6ff", "#a79bff", "#ff7ad9", "#f4f4f5"];

const copyLine = (c: Copy) =>
  [FORMAT_LABEL[c.format], c.edition, c.pricePaid != null ? formatMoney(c.pricePaid) : null, c.store, c.acquiredAt ? formatDate(c.acquiredAt) : null]
    .filter(Boolean)
    .join(" · ");

function Meter({ percent, cells }: { percent: number; cells: number }) {
  return (
    <span className={styles.meter} role="img" aria-label={`${percent} % de la duración`}>
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} data-on={((i + 0.5) / cells) * 100 <= percent || undefined} />
      ))}
    </span>
  );
}

function Ticks({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className={styles.ticks} role="group" aria-label="Nota del 1 al 10">
      {Array.from({ length: 10 }, (_, i) => (
        <button
          key={i}
          type="button"
          data-on={(value ?? 0) > i || undefined}
          aria-label={`${i + 1} de 10`}
          onClick={() => onChange(value === i + 1 ? null : i + 1)}
        />
      ))}
    </div>
  );
}

function Objective({
  done,
  stage,
  selected,
  title,
  children,
}: {
  done: boolean;
  stage: number;
  selected: number | null;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className={styles.objective} data-done={done || undefined} data-selected={selected === stage || undefined} data-stage={stage}>
      <span className={styles.check} role="img" aria-label={done ? "Conseguido" : "Pendiente"} />
      <div>
        <b>{title}</b>
        {children}
      </div>
    </li>
  );
}

export function Quests({
  game,
  copies,
  selected,
  update,
  onAddCopy,
  onToggle100,
}: {
  game: Game;
  copies: Copy[];
  selected: number | null;
  update: Update;
  onAddCopy: () => void;
  onToggle100: () => void;
}) {
  const percent = progressPercent(game);
  const platforms = [...new Set(copies.map((c) => c.platform))];
  const hours = game.hoursPlayed != null ? `${formatNumber(game.hoursPlayed)} h` : null;
  const shared = { selected };
  return (
    <div className={styles.quests}>
      <div>
        <h2 className={styles.questHead}>Misión principal</h2>
        <ol>
          <Objective {...shared} stage={1} done={copies.length > 0} title={platforms.length ? `Consigue tu copia de ${platforms.join(" y ")}` : "Consigue tu copia"}>
            {copies.length === 0 && (
              <button type="button" className={styles.add} onClick={onAddCopy}>
                <Plus aria-hidden />
                Añadir copia
              </button>
            )}
            {copies.map((c) => (
              <p key={c.id}>{copyLine(c)}</p>
            ))}
          </Objective>
          <Objective {...shared} stage={2} done={Boolean(game.startedAt)} title="Empieza la aventura">
            <Editable kind="date" label="Empezado" value={game.startedAt} display={game.startedAt ? formatDate(game.startedAt) : null} empty="Anotar fecha" onSave={(v) => update({ startedAt: v })} />
          </Objective>
          <Objective
            {...shared}
            stage={3}
            done={percent === 100 || Boolean(game.finishedAt)}
            title={game.lengthHours ? `Juega ${formatNumber(game.lengthHours)} horas` : "Juega hasta el final"}
          >
            <div className={styles.experience}>
              <Editable kind="number" label="Horas jugadas" value={game.hoursPlayed} display={hours} empty="Anotar horas" max={100000} step={0.5} onSave={(v) => update({ hoursPlayed: v })} />
              {percent != null && <Meter percent={percent} cells={14} />}
              {!game.lengthHours && (
                <Editable kind="number" label="Duración del juego" value={game.lengthHours} display={null} empty="Anotar duración" max={100000} step={0.5} onSave={(v) => update({ lengthHours: v })} />
              )}
            </div>
          </Objective>
          <Objective {...shared} stage={5} done={Boolean(game.finishedAt)} title="Termina la historia">
            <Editable kind="date" label="Terminado" value={game.finishedAt} display={game.finishedAt ? formatDate(game.finishedAt) : null} empty="Anotar fecha" onSave={(v) => update({ finishedAt: v })} />
          </Objective>
        </ol>
      </div>
      <div>
        <h2 className={styles.questHead}>Misiones secundarias</h2>
        <ol>
          <Objective
            {...shared}
            stage={4}
            done={game.rating != null}
            title={
              game.rating != null ? (
                <>
                  Dale nota: <Editable kind="number" label="Tu valoración" value={game.rating} display={formatNumber(game.rating)} empty="" max={10} step={0.5} onSave={(v) => update({ rating: v })} />
                </>
              ) : (
                "Dale nota"
              )
            }
          >
            <Ticks value={game.rating} onChange={(v) => update({ rating: v })} />
          </Objective>
          <Objective {...shared} stage={-1} done={Boolean(game.notes)} title="Escribe en tu diario">
            <Editable kind="multiline" label="Notas" value={game.notes} display={game.notes ?? null} empty="Escribir" onSave={(v) => update({ notes: v })} />
          </Objective>
          <Objective {...shared} stage={6} done={game.completed100} title="Consíguelo al 100 %">
            {game.completed100 ? (
              <div className={styles.trophyRow}>
                {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
                <img src={TROPHY_URL} alt="" />
                <button type="button" className={styles.action} aria-pressed="true" onClick={onToggle100}>
                  Conseguido
                </button>
              </div>
            ) : (
              <button type="button" className={styles.action} aria-pressed="false" onClick={onToggle100}>
                <Trophy aria-hidden />
                Marcar
              </button>
            )}
          </Objective>
        </ol>
      </div>
    </div>
  );
}

export function Records({ game, copies, update }: { game: Game; copies: Copy[]; update: Update }) {
  const percent = progressPercent(game);
  // El día que lo conseguiste, según lo que has apuntado; no cuándo lo metiste en la app.
  const firstOwned = copies.flatMap((c) => c.acquiredAt ?? []).sort()[0];
  const rows: { name: string; value: React.ReactNode; stage?: number }[] = [
    {
      name: "Última partida",
      value: <Editable kind="date" label="Última partida" value={game.lastPlayedAt} display={game.lastPlayedAt ? relativeDay(game.lastPlayedAt) : null} empty="Añadir" onSave={(v) => update({ lastPlayedAt: v })} />,
    },
    { name: "Tiempo", value: game.hoursPlayed != null ? `${formatNumber(game.hoursPlayed)} h` : "---" },
    {
      name: "Progreso",
      value:
        percent != null ? (
          <>
            {percent} % <Meter percent={percent} cells={8} />
          </>
        ) : (
          "---"
        ),
    },
    { name: "Tu nota", value: game.rating != null ? `${formatNumber(game.rating)} / 10` : "---" },
    {
      name: "Metacritic",
      value: (
        <Editable
          kind="number"
          label="Nota de Metacritic"
          value={game.metacritic}
          display={game.metacritic != null ? `${game.metacritic} / 100` : null}
          empty="Añadir"
          max={100}
          integer
          onSave={(v) => update({ metacritic: v })}
        />
      ),
    },
    ...copies.map((c) => ({ name: c.platform, value: [FORMAT_LABEL[c.format], c.pricePaid != null ? formatMoney(c.pricePaid) : null].filter(Boolean).join(" · ") })),
    { name: "En tu ludoteca", value: firstOwned ? formatDate(firstOwned) : "---", stage: 0 },
  ];
  return (
    <>
      <h2 className={styles.recordsHead}>Tus récords</h2>
      <ol className={styles.records}>
        {game.completed100 && (
          <li className={styles.record} data-gold style={{ color: "#ffd76a" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- dibujo de píxeles propio */}
            <img src={TROPHY_URL} alt="" />
            <span>Trofeo</span>
            <span className={styles.recordValue}>Al 100 %</span>
          </li>
        )}
        {rows.map((row, i) => (
          <li key={i} className={styles.record} style={{ color: RECORD_COLORS[i % RECORD_COLORS.length], animationDelay: `${i * 70}ms` }} data-stage={row.stage}>
            <span>{i + 1}º</span>
            <span>{row.name}</span>
            <span className={styles.recordValue}>{row.value}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: Record<T, string>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.chips} role="group" aria-label={label}>
        {(Object.keys(options) as T[]).map((key) => (
          <button
            key={key}
            type="button"
            className={styles.chip}
            aria-pressed={value.includes(key)}
            onClick={() => onChange(value.includes(key) ? value.filter((x) => x !== key) : [...value, key])}
          >
            {options[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlayOptions({ game, update }: { game: Game; update: Update }) {
  return (
    <>
      <h2 id="para-elegir" className={styles.panelHead}>
        Para elegir a qué jugar
      </h2>
      <div className={styles.pair}>
        <div className={styles.field}>
          <span className={styles.label}>Una sesión dura unos</span>
          <span>
            <Editable kind="number" label="Minutos por sesión" value={game.sessionMinutes} display={game.sessionMinutes != null ? `${game.sessionMinutes} min` : null} empty="Añadir" min={1} max={1440} integer onSave={(v) => update({ sessionMinutes: v })} />
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Duración total</span>
          <span>
            <Editable kind="number" label="Duración total" value={game.lengthHours} display={game.lengthHours != null ? `${formatNumber(game.lengthHours)} h` : null} empty="Añadir" max={100000} step={0.5} onSave={(v) => update({ lengthHours: v })} />
          </span>
        </div>
      </div>
      <Chips label="Cómo se juega" options={MODE_LABEL} value={game.modes} onChange={(v) => update({ modes: v })} />
      <Chips label="Tipo de experiencia" options={MOOD_LABEL} value={game.moods} onChange={(v) => update({ moods: v })} />
    </>
  );
}

const splitList = (v: string | null) => [...new Set((v ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 30);

export function MorePanel({
  game,
  lists,
  update,
  onToggleList,
  onChangeCover,
  onDelete,
}: {
  game: Game;
  lists: GameList[];
  update: Update;
  onToggleList: (listId: string) => void;
  onChangeCover: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <h2 id="mas-datos" className={styles.panelHead}>
        Más datos
      </h2>
      <div className={styles.field}>
        <span className={styles.label}>Título</span>
        <span>
          <Editable kind="text" label="Título" value={game.title} display={game.title} empty="" maxLength={200} onSave={(v) => v && update({ title: v })} />
        </span>
      </div>
      <div className={styles.pair}>
        <div className={styles.field}>
          <span className={styles.label}>Géneros</span>
          <span>
            <Editable kind="text" label="Géneros" value={game.genres.join(", ")} display={game.genres.join(", ") || null} empty="Añadir" onSave={(v) => update({ genres: splitList(v) })} />
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Etiquetas</span>
          <span>
            <Editable kind="text" label="Etiquetas personales" value={game.tags.join(", ")} display={game.tags.join(", ") || null} empty="Añadir" onSave={(v) => update({ tags: splitList(v) })} />
          </span>
        </div>
      </div>
      {lists.length > 0 && (
        <div className={styles.field}>
          <span className={styles.label}>Listas</span>
          <div className={styles.chips} role="group" aria-label="Listas">
            {lists.map((l) => (
              <button key={l.id} type="button" className={styles.chip} aria-pressed={l.gameIds.includes(game.id)} onClick={() => onToggleList(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={styles.moreActions}>
        <button type="button" className={styles.action} onClick={onChangeCover}>
          <ImageUp aria-hidden />
          Cambiar carátula
        </button>
        <button type="button" className={`${styles.action} ${styles.danger}`} onClick={onDelete}>
          <Trash2 aria-hidden />
          Eliminar «{game.title}»
        </button>
      </div>
    </>
  );
}
