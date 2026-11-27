import "server-only";
import webpush from "web-push";
import { type PushPayload, isGoneStatus } from "./offer-push";

/*
 * Envío de notificaciones web (Web Push), firmadas con las claves VAPID de las variables de Vercel. Sin ellas no se
 * manda nada: las rutas responden 503.
 */

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Si están las tres variables para firmar las notificaciones. */
export const vapidReady = () => Boolean(publicKey && privateKey && subject);

let configured = false;

/** Manda una notificación a un dispositivo. «gone»: la suscripción ya no existe y hay que quitarla. */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    if (!configured) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      configured = true;
    }
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(payload), {
      // Si el móvil está apagado, el aviso espera hasta 12 horas: luego ya llega el de la siguiente vuelta.
      TTL: 12 * 60 * 60,
      urgency: "normal",
    });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 0;
    return isGoneStatus(status) ? "gone" : "error";
  }
}
