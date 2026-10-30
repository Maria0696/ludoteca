import { Check, Circle, CircleDot, Minus, Pause } from "lucide-react";
import { type GameStatus, STATUS_LABEL } from "@/lib/model";

const ICONS = {
  pendiente: Circle,
  jugando: CircleDot,
  pausado: Pause,
  completado: Check,
  abandonado: Minus,
} satisfies Record<GameStatus, unknown>;

/** Icono del estado, para los selectores donde se elige. */
export function StatusIcon({ status, size = 15 }: { status: GameStatus; size?: number }) {
  const Icon = ICONS[status];
  return <Icon width={size} height={size} strokeWidth={2.25} aria-hidden />;
}

/** Marca de estado: un punto con el color del estado y su nombre. */
export function StatusMark({ status, stampKey }: { status: GameStatus; stampKey?: string }) {
  return (
    <span className={stampKey ? "state stamp" : "state"} data-status={status} key={stampKey}>
      {STATUS_LABEL[status]}
    </span>
  );
}
