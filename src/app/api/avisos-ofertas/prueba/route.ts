import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { TEST_PAYLOAD } from "@/lib/offer-push";
import { sendPush, vapidReady } from "@/lib/push";
import { authorizeRequest, getServerSupabase } from "@/lib/supabase/server";

/*
 * «Probar» en Deseos: manda una notificación de prueba al dispositivo que la pide (su suscripción, por `endpoint`).
 * Con la sesión de la propietaria; la suscripción se lee con sus permisos.
 */

const body = z.object({ endpoint: z.string().url().startsWith("https://").max(1000) });

const fail = (status: number, reason: string, message: string) => NextResponse.json({ ok: false, reason, message }, { status });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return fail(404, "no-configurado", "Sin la nube no hay avisos de ofertas.");
  const auth = await authorizeRequest();
  if (!auth.ok) return fail(auth.status, "no-autorizado", auth.message);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "mal-pedido", "Falta la suscripción de este dispositivo.");
  if (!vapidReady()) return fail(503, "sin-claves", "Faltan las claves de los avisos (VAPID) en el servidor.");

  const db = await getServerSupabase();
  const { data, error } = await db.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", parsed.data.endpoint).maybeSingle();
  if (error) return fail(502, "sin-respuesta", error.message);
  if (!data) return fail(404, "sin-suscripcion", "Este dispositivo no tiene los avisos activados.");

  const result = await sendPush(data, TEST_PAYLOAD);
  if (result === "gone") {
    await db.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
    return fail(410, "caducada", "Esta suscripción ha caducado: vuelve a activar los avisos.");
  }
  if (result === "error") return fail(502, "sin-enviar", "El servicio de notificaciones no ha respondido. Prueba otra vez en un rato.");
  return NextResponse.json({ ok: true });
}
