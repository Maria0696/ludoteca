/*
 * La pantalla de título del inicio sale una vez al día: es la entrada al
 * juego, no un peaje cada vez que vuelves al menú.
 */

export const TITLE_SCREEN_KEY = "ludoteca:titulo-visto";

const todayKey = () => new Intl.DateTimeFormat("sv-SE").format(new Date());

export function titleScreenDue(): boolean {
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
