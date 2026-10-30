import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/supabase/server";

/** Indica si la búsqueda en el catálogo tiene claves, sin consultar IGDB. */
export async function GET() {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ configured: false, message: auth.message }, { status: auth.status });
  return NextResponse.json({ configured: Boolean(process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) });
}
