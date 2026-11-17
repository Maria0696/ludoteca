import { Check, Circle, CircleDot, Minus, Pause } from "lucide-react";
import { type GameStatus, STATUS_LABEL } from "@/lib/model";

const ICONS = {
  pendiente: Circle,
  jugando: CircleDot,
  pausado: Pause,
  completado: Check,
  abandonado: Minus,
} satisfies Record<GameStatus, unknown>;

/**
 * Cada estado, dicho como en una máquina recreativa, con su color: el mismo en toda la app.
 * Los colores viven una sola vez, en las variables `--st-*` de globals.css.
 */
export const ARCADE_STATUS: Record<GameStatus, { label: string; color: string }> = {
  pendiente: { label: "PRESS START", color: "var(--st-pendiente)" },
  jugando: { label: "EN PARTIDA", color: "var(--st-jugando)" },
  pausado: { label: "PAUSA", color: "var(--st-pausado)" },
  completado: { label: "CLEAR!", color: "var(--st-completado)" },
  abandonado: { label: "GAME OVER", color: "var(--st-abandonado)" },
};

/** Icono del estado, para los selectores donde se elige. */
export function StatusIcon({ status, size = 15 }: { status: GameStatus; size?: number }) {
  const Icon = ICONS[status];
  return <Icon width={size} height={size} strokeWidth={2.25} aria-hidden />;
}

/**
 * Marca de estado de la carcasa: rombo de color, etiqueta arcade y nombre normal
 * (`◆ PRESS START · Pendiente`). Los lectores de pantalla oyen solo el nombre normal.
 */
export function StatusMark({ status, stampKey }: { status: GameStatus; stampKey?: string }) {
  return (
    <span className={stampKey ? "state stamp" : "state"} data-status={status} key={stampKey}>
      <b aria-hidden>{ARCADE_STATUS[status].label} ·</b>
      {STATUS_LABEL[status]}
    </span>
  );
}
