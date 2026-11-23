import { type Copy, FORMAT_LABEL, PRICE_KIND_LABEL } from "./model";

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

/** «2025-10-03» → «03/10/2025»: así se escriben las fechas en los campos. */
export function isoToDmy(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export type ParsedDate = { ok: true; iso: string | null } | { ok: false; error: string };

/**
 * Lee una fecha escrita como día/mes/año: «3/10/2025», «03-10-2025», «3.10.2025»
 * o «03102025». Vacía es «sin fecha».
 */
export function parseDmy(text: string): ParsedDate {
  const t = text.trim();
  if (!t) return { ok: true, iso: null };
  const m = /^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d+)$/.exec(t) ?? /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(t);
  if (!m) return { ok: false, error: "Escribe la fecha como día/mes/año, por ejemplo 03/10/2025." };
  if (m[3].length !== 4) return { ok: false, error: "Escribe el año con cuatro cifras, por ejemplo 2025." };
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1950) return { ok: false, error: "Revisa el año: tiene que ser de 1950 en adelante." };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: "Esa fecha no existe. Revisa el día y el mes." };
  }
  return { ok: true, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
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

/** El precio de una copia en una palabra: el importe, o por qué no lo tiene. */
export function priceText(c: Copy): string | null {
  if (c.priceKind) return PRICE_KIND_LABEL[c.priceKind];
  return c.pricePaid != null ? formatMoney(c.pricePaid) : null;
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
