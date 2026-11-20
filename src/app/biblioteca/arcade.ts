import { PLATFORM_FAMILIES } from "@/lib/model";

// El estado en idioma arcade es de toda la app: vive en @/components/ui/StatusMark.

const FAMILY_COLOR: Record<string, string> = {
  PlayStation: "#4d7dff",
  Xbox: "#3ddc6b",
  Nintendo: "#ff4d4d",
};

/**
 * Las plataformas de la biblioteca, por familias: PC primero, luego PlayStation,
 * Xbox, Nintendo y las demás. Dentro de cada familia, de la más nueva a la más antigua;
 * las que no conocemos van al final de «Otras».
 */
export function platformFamilies<T extends { value: string }>(platforms: readonly T[]): { name: string; items: T[] }[] {
  const order = [{ name: "PC", platforms: ["PC"] }, ...PLATFORM_FAMILIES.map((f) => ({ ...f, platforms: f.platforms.filter((p) => p !== "PC") }))];
  const known = new Set(order.flatMap((f) => f.platforms));
  return order
    .map((f) => {
      const items = f.platforms.flatMap((name) => platforms.filter((p) => p.value === name));
      if (f.name === "Otras") items.push(...platforms.filter((p) => !known.has(p.value)));
      return { name: f.name, items };
    })
    .filter((f) => f.items.length > 0);
}

/** Color del botón de cada plataforma: el de su familia, o rosa si es otra. */
export function platformColor(platform: string): string {
  if (platform === "PC") return "#c8c8d4";
  const family = PLATFORM_FAMILIES.find((f) => f.platforms.includes(platform));
  return (family && FAMILY_COLOR[family.name]) ?? "#ff3fa4";
}
