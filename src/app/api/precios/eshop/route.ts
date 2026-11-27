import { NextResponse } from "next/server";
import { isEshopPlatform } from "@/lib/price-watch";
import { searchEshop } from "@/lib/store-prices";
import { authorizeRequest } from "@/lib/supabase/server";

/** Productos del eShop de Nintendo España que podrían ser un deseo, con su precio: para enlazarlo o elegir. */
export async function GET(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const platform = params.get("plataforma");
  if (q.length < 2 || q.length > 200 || !isEshopPlatform(platform)) {
    return NextResponse.json({ ok: false, reason: "mal-pedido", message: "Hace falta un título y una consola de Nintendo." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, candidates: await searchEshop(q, platform) });
  } catch {
    return NextResponse.json({ ok: false, reason: "sin-respuesta", message: "El eShop no responde ahora." }, { status: 502 });
  }
}
