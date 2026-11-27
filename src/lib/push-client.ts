"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "./supabase/client";

/*
 * Avisos de ofertas en este dispositivo: activarlos (permiso, suscripción del service worker y guardarla en Supabase),
 * desactivarlos y mandar uno de prueba. Los manda la ruta /api/avisos-ofertas cuando un deseo baja de su objetivo.
 * En el iPhone solo funcionan con la app instalada en la pantalla de inicio.
 */

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushStatus = "unsupported" | "ios-browser" | "denied" | "off" | "on";
type PushEnv = { supported: boolean; ios: boolean; standalone: boolean; permission: NotificationPermission; subscribed: boolean };

/** En qué estado están los avisos, según lo que deja este navegador. */
export function pushStatusFrom(env: PushEnv): PushStatus {
  // En el iPhone, Safari y Chrome solo los dejan a la app abierta desde su icono.
  if (env.ios && !env.standalone) return "ios-browser";
  if (!env.supported) return "unsupported";
  if (env.permission === "denied") return "denied";
  return env.subscribed && env.permission === "granted" ? "on" : "off";
}

function readEnv(subscribed: boolean): PushEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    ios: /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1),
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    permission: "Notification" in window ? Notification.permission : "default",
    subscribed,
  };
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Mira si este dispositivo está suscrito y en qué estado quedan los avisos. */
const look = () => currentSubscription().then((s) => pushStatusFrom(readEnv(s != null)), () => pushStatusFrom(readEnv(false)));

/** El estado de los avisos en este dispositivo (`null` mientras se mira) y cómo volver a mirarlo. */
export function usePushStatus(): { status: PushStatus | null; refresh: () => Promise<void> } {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const refresh = useCallback(async () => setStatus(await look()), []);
  useEffect(() => {
    let alive = true;
    void look().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { status, refresh };
}

/** La clave pública VAPID (base64url) como la pide `pushManager.subscribe`. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Pide permiso, suscribe este dispositivo y lo guarda en Supabase. */
export async function enablePush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Sin permiso, el móvil no puede enseñar los avisos.");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await getBrowserSupabase()
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh: keys?.p256dh, auth: keys?.auth, user_agent: navigator.userAgent.slice(0, 500) }, { onConflict: "endpoint" });
  if (error) {
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error("No se ha podido guardar la suscripción. ¿Está aplicada la migración 0020?");
  }
}

/** Deja de recibir avisos en este dispositivo. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  const { error } = await getBrowserSupabase().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  if (error) throw new Error("No se han podido desactivar los avisos. Prueba otra vez.");
  await subscription.unsubscribe();
}

/** Manda una notificación de prueba a este dispositivo. */
export async function testPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) throw new Error("Este dispositivo no tiene los avisos activados.");
  const res = await fetch("/api/avisos-ofertas/prueba", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
  if (!res.ok || !body.ok) throw new Error(body.message ?? "No se ha podido mandar la prueba.");
}
