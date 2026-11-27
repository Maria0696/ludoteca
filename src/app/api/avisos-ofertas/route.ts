import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/config";
import { newId, todayIso } from "@/lib/model";
import { type StorePrices, notificationFor, planAlerts } from "@/lib/offer-push";
import { type PushTarget, sendPush, vapidReady } from "@/lib/push";
import { libraryFromRows } from "@/lib/repo/supabase";
import { fetchEshopPrices, fetchSteamPrices } from "@/lib/store-prices";

/*
 * Avisos de ofertas: la llama dos veces al día una tarea de GitHub con `Authorization: Bearer <clave>`. Lee de Supabase
 * los deseos con objetivo enlazados a una tienda (la clave la comprueba la función, que guarda solo su huella), mira
 * sus precios, manda una notificación a cada dispositivo si alguno ha bajado a su objetivo y apunta los precios nuevos.
 * No usa la sesión: en el control de acceso, las rutas de /api se protegen solas.
 */

export const maxDuration = 60;

const BEARER = /^Bearer ([A-Za-z0-9_-]{40,200})$/;

const fail = (status: number, reason: string, message: string) => NextResponse.json({ ok: false, reason, message }, { status });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return fail(404, "no-configurado", "Sin la nube no hay avisos de ofertas: los datos viven en el navegador.");
  const clave = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!clave) return fail(401, "no-autorizado", "Falta la clave de los avisos de ofertas.");
  if (!vapidReady()) return fail(503, "sin-claves", "Faltan las claves de los avisos (VAPID) en el servidor.");

  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message: string } | null }> => {
    try {
      return await db.rpc(fn, args);
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Supabase no responde." } };
    }
  };

  const watched = await rpc("deseos_vigilados", { clave });
  if (watched.error) {
    // La función responde «clave no válida» con el código 28000.
    if (watched.error.code === "28000") return fail(401, "no-autorizado", "La clave de los avisos de ofertas no es válida.");
    return fail(502, "sin-respuesta", watched.error.message || "Supabase no responde.");
  }
  const data = (watched.data ?? {}) as { wishes?: Record<string, unknown>[]; subscriptions?: PushTarget[] };
  const wishes = libraryFromRows({ wishlist: data.wishes ?? [] }).wishlist;
  const subscriptions = data.subscriptions ?? [];

  // Los precios de ahora. Si una tienda no responde, sus deseos se quedan como estaban hasta la próxima vuelta.
  const eshopIds = [...new Set(wishes.flatMap((w) => w.eshopNsuid ?? []))];
  const steamIds = [...new Set(wishes.flatMap((w) => w.steamAppId ?? []))];
  const [eshop, steam] = await Promise.allSettled([
    eshopIds.length ? fetchEshopPrices(eshopIds) : Promise.resolve({}),
    steamIds.length ? fetchSteamPrices(steamIds) : Promise.resolve({}),
  ]);
  const prices: StorePrices = {};
  const failed: string[] = [];
  if (eshop.status === "fulfilled") prices.eshop = eshop.value;
  else failed.push("eshop");
  if (steam.status === "fulfilled") prices.steam = steam.value;
  else failed.push("steam");

  const { changes, notify } = planAlerts(wishes, prices, todayIso(), newId);
  const payload = notificationFor(notify, new Date());
  let sent = 0;
  let removed = 0;
  if (payload) {
    const results = await Promise.all(subscriptions.map(async (s) => ({ s, result: await sendPush(s, payload) })));
    for (const { s, result } of results) {
      if (result === "ok") sent++;
      if (result === "gone" && !(await rpc("quitar_suscripcion", { clave, endpoint: s.endpoint })).error) removed++;
    }
  }

  if (changes.length) {
    const saved = await rpc("apuntar_precios", { clave, cambios: changes });
    if (saved.error) return fail(502, "sin-guardar", `Se avisó, pero no se pudieron apuntar los precios: ${saved.error.message}`);
  }

  return NextResponse.json(
    { ok: true, watched: wishes.length, newPrices: changes.length, notified: notify.length, sent, removed, failed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
