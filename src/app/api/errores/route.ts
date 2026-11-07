import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Recibe los avisos de errores del navegador (src/lib/error-report.ts) y los
 * escribe como errores en el registro del servidor. En Vercel aparecen en la
 * lista de errores de producción con el prefijo «ErrorDelNavegador».
 * Solo la propietaria puede enviarlos, para que nadie llene el registro.
 */

const Report = z.object({
  kind: z.enum(["pantalla", "pantalla-general", "navegador", "promesa"]),
  name: z.string().max(100),
  message: z.string().max(500),
  stack: z.string().max(2000).optional(),
  digest: z.string().max(100).optional(),
  path: z.string().max(200),
});

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "El aviso no es JSON." }, { status: 400 });
  }
  const parsed = Report.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "El aviso no tiene el formato esperado." }, { status: 400 });

  const r = parsed.data;
  // Se escribe como texto y no como objeto Error: Next.js intenta traducir
  // las pilas de los Error con su mapa de código del servidor, y las líneas
  // del navegador («http://…/_next/static/…») lo hacen fallar.
  const summary = `ErrorDelNavegador: ${r.name}: ${r.message} — en ${r.path} [${r.kind}]${r.digest ? ` (digest ${r.digest})` : ""}`;
  const stack = r.stack ? `\nPila en el navegador:\n${r.stack.replace(/^/gm, "    ")}` : "";
  console.error(summary + stack);
  return new NextResponse(null, { status: 204 });
}
