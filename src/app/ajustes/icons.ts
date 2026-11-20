import { CHEST_CLOSED_URL, spriteUrl } from "@/components/pixel/sprites";

/*
 * Los iconos de cada apartado de Ajustes, de 12 × 12 píxeles, dibujados como la guardiana.
 * La demostración reutiliza el cofre de añadir un juego.
 */

const PALETTE: Record<string, string> = {
  K: "#1a1426",
  W: "#f3ead2",
  B: "#4d7dff",
  G: "#9a9cc4",
  g: "#5a5a8a",
  Y: "#ffd76a",
  T: "#3ff2ff",
  t: "#1f5d6b",
  P: "#b98cff",
  O: "#ff9f43",
  D: "#8a6ad6",
  N: "#3d2a6b",
};

const ICONS = {
  // Un disquete: la partida guardada.
  partida: ["KKKKKKKKKKK.", "KBBWWWWWWBKK", "KBBWWWWKWBBK", "KBBWWWWKWBBK", "KBBWWWWWWBBK", "KBBBBBBBBBBK", "KBBBBBBBBBBK", "KBWWWWWWWWBK", "KBWGGGGGGWBK", "KBWWWWWWWWBK", "KBWGGGGGGWBK", "KKKKKKKKKKKK"],
  // Un cartucho: traer juegos.
  traer: ["..KKKKKKKK..", ".KGGGGGGGGK.", ".KGPPPPPPGK.", ".KGPWWWWPGK.", ".KGPWYYWPGK.", ".KGPWWWWPGK.", ".KGPPPPPPGK.", ".KGGGGGGGGK.", ".KGGGGGGGGK.", ".KgKgKgKgKK.", ".KYKYKYKYKK.", "..KKKKKKKK.."],
  // Una tele: la pantalla.
  pantalla: ["...K....K...", "....K..K....", ".....KK.....", "KKKKKKKKKKKK", "KggggggggggK", "KgTTTTTTTTgK", "KgTtTTTTTTgK", "KgTTTTTTtTgK", "KgTTTTTTTTgK", "KggggggggYgK", "KKKKKKKKKKKK", "..KK....KK.."],
  // Un libro abierto: la ayuda.
  ayuda: ["............", ".KKKKK.KKKKK", "KOOOOOKOOOOK", "KOWWWOKWWWOK", "KOWWWOKWWWOK", "KOWWWOKWWWOK", "KOWWWOKWWWOK", "KOWWWOKWWWOK", "KOOOOOKOOOOK", ".KKKKKKKKKK.", "............", "............"],
  // Una puerta: la cuenta, por donde se sale y se vuelve a entrar.
  cuenta: ["..KKKKKKKK..", "..KDDDDDDK..", "..KDDDDDDK..", "..KDNNNNDK..", "..KDNNNNDK..", "..KDNNNNDK..", "..KDNNNYDK..", "..KDNNNNDK..", "..KDNNNNDK..", "..KDNNNNDK..", "..KDDDDDDK..", "KKKKKKKKKKKK"],
  // Una calavera: borrar todo.
  borrar: ["...KKKKKK...", "..KWWWWWWK..", ".KWWWWWWWWK.", ".KWKKWWKKWK.", ".KWKKWWKKWK.", ".KWWWWWWWWK.", ".KWWWKKWWWK.", "..KWWWWWWK..", "..KWKWKWKK..", "..KKWKWKWK..", "...KKKKKK...", "............"],
};

export type SettingsIcon = keyof typeof ICONS | "demostracion";

export const SETTINGS_ICON_URL: Record<SettingsIcon, string> = {
  ...(Object.fromEntries(Object.entries(ICONS).map(([k, rows]) => [k, spriteUrl(rows, PALETTE)])) as Record<keyof typeof ICONS, string>),
  demostracion: CHEST_CLOSED_URL,
};
