import { NextResponse } from "next/server";
import { z } from "zod";
import type { Quote } from "@/lib/price-watch";
import { fetchEshopPrices, fetchSteamPrices } from "@/lib/store-prices";
import { authorizeRequest } from "@/lib/supabase/server";

/*
 * Precios de ahora de los deseos enlazados: `{ eshop: códigos, steam: números }` → lo que cuesta cada uno en el eShop
 * de Nintendo España y en Steam. Si una tienda no responde, vuelve sin ella y lo dice en `failed`.
 */

const body = z.object({
  eshop: z.array(z.string().regex(/^\d{14}$/)).max(500).default([]),
  steam: z.array(z.number().int().positive()).max(500).default([]),
});

export async function POST(request: Request) {
  const auth = await authorizeRequest();
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "no-autorizado", message: auth.message }, { status: auth.status });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "mal-pedido", message: "La lista de juegos no es válida." }, { status: 400 });

  const { eshop, steam } = parsed.data;
  const failed: string[] = [];
  const ask = async (store: string, ids: unknown[], fetcher: () => Promise<Record<string, Quote>>) => {
    if (!ids.length) return {};
    try {
      return await fetcher();
    } catch {
      failed.push(store);
      return {};
    }
  };
  const [eshopPrices, steamPrices] = await Promise.all([ask("eshop", eshop, () => fetchEshopPrices(eshop)), ask("steam", steam, () => fetchSteamPrices(steam))]);
  return NextResponse.json({ ok: true, eshop: eshopPrices, steam: steamPrices, failed });
}
