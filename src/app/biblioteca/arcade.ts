import { type GameStatus, PLATFORM_FAMILIES } from "@/lib/model";

/** Cada estado, dicho como en una máquina recreativa, con su color de neón. */
export const ARCADE_STATUS: Record<GameStatus, { label: string; color: string }> = {
  pendiente: { label: "PRESS START", color: "#ffe94d" },
  jugando: { label: "EN PARTIDA", color: "#5dff8b" },
  pausado: { label: "PAUSA", color: "#ffb13d" },
  completado: { label: "CLEAR!", color: "#3ff2ff" },
  abandonado: { label: "GAME OVER", color: "#ff4d6d" },
};

const FAMILY_COLOR: Record<string, string> = {
  PlayStation: "#4d7dff",
  Xbox: "#3ddc6b",
  Nintendo: "#ff4d4d",
};

/** Color del botón de cada plataforma: el de su familia, o rosa si es otra. */
export function platformColor(platform: string): string {
  if (platform === "PC") return "#c8c8d4";
  const family = PLATFORM_FAMILIES.find((f) => f.platforms.includes(platform));
  return (family && FAMILY_COLOR[family.name]) ?? "#ff3fa4";
}
