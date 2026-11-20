import { readChoice } from "./local-choice";

/*
 * La pantalla de título del inicio sale una vez al día: es la entrada al
 * juego, no un peaje cada vez que vuelves al menú. En Ajustes se puede pedir
 * que salga siempre o que no salga nunca.
 */

export const TITLE_SCREEN_KEY = "ludoteca:titulo-visto";
export const TITLE_MODE_KEY = "ludoteca:pantalla-titulo";
export const TITLE_MODES = ["siempre", "diaria", "nunca"] as const;
export type TitleMode = (typeof TITLE_MODES)[number];

const todayKey = () => new Intl.DateTimeFormat("sv-SE").format(new Date());

export function titleScreenDue(): boolean {
  const mode = readChoice<TitleMode>(TITLE_MODE_KEY, "diaria", TITLE_MODES);
  if (mode !== "diaria") return mode === "siempre";
  try {
    return localStorage.getItem(TITLE_SCREEN_KEY) !== todayKey();
  } catch {
    return false;
  }
}

export function markTitleScreenSeen(): void {
  try {
    localStorage.setItem(TITLE_SCREEN_KEY, todayKey());
  } catch {
    // Sin almacenamiento disponible, simplemente volverá a salir.
  }
}
