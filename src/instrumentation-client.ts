import { sendErrorReport } from "@/lib/error-report";

/*
 * Se ejecuta en el navegador antes de que la app arranque (convención de
 * Next.js). Escucha los fallos que no recoge ninguna pantalla de error: los
 * de botones y tareas en segundo plano, y las promesas rechazadas sin control.
 */
try {
  window.addEventListener("error", (event) => sendErrorReport("navegador", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => sendErrorReport("promesa", event.reason));
} catch {
  // Si no se puede escuchar, la app sigue igual.
}
