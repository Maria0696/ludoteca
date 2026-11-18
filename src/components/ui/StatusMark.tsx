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
 * Cada estado, dicho como en una máquina recreativa (en español), con su color: el mismo en toda la app.
 * «Nueva partida» es lo mismo que la opción del inicio que enseña los pendientes.
 * Los colores viven una sola vez, en las variables `--st-*` de globals.css.
 */
export const ARCADE_STATUS: Record<GameStatus, { label: string; color: string }> = {
  pendiente: { label: "NUEVA PARTIDA", color: "var(--st-pendiente)" },
  jugando: { label: "EN PARTIDA", color: "var(--st-jugando)" },
  pausado: { label: "PAUSA", color: "var(--st-pausado)" },
  completado: { label: "¡SUPERADO!", color: "var(--st-completado)" },
  abandonado: { label: "FIN DEL JUEGO", color: "var(--st-abandonado)" },
};

/** Icono del estado, para los selectores donde se elige. */
export function StatusIcon({ status, size = 15 }: { status: GameStatus; size?: number }) {
  const Icon = ICONS[status];
  return <Icon width={size} height={size} strokeWidth={2.25} aria-hidden />;
}

/**
 * Marca de estado de la carcasa: rombo de color, etiqueta arcade y nombre normal
 * (`◆ NUEVA PARTIDA · Pendiente`). Los lectores de pantalla oyen solo el nombre normal.
 */
export function StatusMark({ status, stampKey }: { status: GameStatus; stampKey?: string }) {
  return (
    <span className={stampKey ? "state stamp" : "state"} data-status={status} key={stampKey}>
      <b aria-hidden>{ARCADE_STATUS[status].label} ·</b>
      {STATUS_LABEL[status]}
    </span>
  );
}
