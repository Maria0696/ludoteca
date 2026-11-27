import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { backupFileName, createBackup } from "@/lib/backup";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/config";
import { type LibraryRows, libraryFromRows } from "@/lib/repo/supabase";

/*
 * Copia automática: la pide cada noche una tarea de GitHub con `Authorization: Bearer <clave>`. La clave la comprueba
 * Supabase (la función `copia_de_seguridad` guarda solo su huella) y, si es buena, devuelve las filas de la
 * propietaria; aquí se convierten con el mismo código que la app y salen en el formato de la copia manual.
 * No usa la sesión: en el control de acceso, las rutas de /api se protegen solas.
 */

const BEARER = /^Bearer ([A-Za-z0-9_-]{40,200})$/;

const fail = (status: number, reason: string, message: string) => NextResponse.json({ ok: false, reason, message }, { status });

export async function POST(request: Request) {
  if (!isSupabaseConfigured) return fail(404, "no-configurado", "Sin la nube no hay copias automáticas: los datos viven en el navegador.");
  const clave = BEARER.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!clave) return fail(401, "no-autorizado", "Falta la clave de las copias automáticas.");

  const db = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let result: Awaited<ReturnType<typeof db.rpc>>;
  try {
    result = await db.rpc("copia_de_seguridad", { clave });
  } catch (e) {
    return fail(502, "sin-respuesta", e instanceof Error ? e.message : "Supabase no responde.");
  }
  if (result.error) {
    // La función responde «clave no válida» con el código 28000.
    if (result.error.code === "28000") return fail(401, "no-autorizado", "La clave de las copias automáticas no es válida.");
    return fail(502, "sin-respuesta", result.error.message || "Supabase no responde.");
  }

  const backup = createBackup(libraryFromRows((result.data ?? {}) as LibraryRows));
  return NextResponse.json(backup, {
    headers: { "Content-Disposition": `attachment; filename="${backupFileName()}"`, "Cache-Control": "no-store" },
  });
}
