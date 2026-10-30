import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, localModeAllowed, supabaseKey, supabaseUrl } from "../config";

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy las renueva.
        }
      },
    },
  });
}

export function isOwnerEmail(email: string | undefined | null): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && email && email.trim().toLowerCase() === owner);
}

/**
 * Autorización en el servidor para las rutas de API.
 * Con Supabase: sesión válida y correo de la propietaria.
 * Sin Supabase: solo si el modo local está permitido (desarrollo o pruebas).
 */
export async function authorizeRequest(): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!isSupabaseConfigured) {
    return localModeAllowed
      ? { ok: true }
      : { ok: false, status: 503, message: "La app no está configurada para este entorno." };
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, message: "Inicia sesión para continuar." };
  if (!isOwnerEmail(data.user.email)) return { ok: false, status: 403, message: "Esta cuenta no tiene acceso." };
  return { ok: true };
}
