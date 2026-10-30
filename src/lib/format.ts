import { type Copy, FORMAT_LABEL } from "./model";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const number1 = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const dateLong = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" });
const dateShort = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });

export const formatMoney = (n: number) => money.format(n);
export const formatNumber = (n: number) => number1.format(n);

export function formatDate(iso: string | null | undefined, style: "long" | "short" = "short"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return (style === "long" ? dateLong : dateShort).format(d);
}

export function relativeDay(iso: string | null | undefined, today = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const days = Math.round((startOfDay(today) - startOfDay(d)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem.`;
  return formatDate(iso);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Resumen corto de las copias para mostrar bajo una carátula. */
export function copiesSummary(copies: Copy[]): string {
  if (copies.length === 0) return "Sin copias";
  if (copies.length === 1) {
    const c = copies[0];
    const parts = [c.platform, c.availability === "suscripcion" ? "Suscripción" : FORMAT_LABEL[c.format]];
    if (c.format === "digital" && c.hasCase) parts.push("caja");
    return parts.join(" · ");
  }
  const platforms = [...new Set(copies.map((c) => c.platform))];
  return `${platforms.join(" + ")} · ${copies.length} copias`;
}

export function parseDecimal(value: string): number | null {
  const v = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
