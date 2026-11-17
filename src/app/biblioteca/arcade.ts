import { PLATFORM_FAMILIES } from "@/lib/model";

// El estado en idioma arcade es de toda la app: vive en @/components/ui/StatusMark.

const FAMILY_COLOR: Record<string, string> = {
  PlayStation: "#4d7dff",
  Xbox: "#3ddc6b",
  Nintendo: "#ff4d4d",
};

/** Color del botón de cada plataforma: el de su familia, o rosa si es otra. */
export function platformColor(platform: string): string {
  if (platform === "PC") return "#c8c8d4";
  const family = PLATFORM_FAMILIES.find((f) => f.platforms.includes(platform));
  return (family && FAMILY_COLOR[family.name]) ?? "#ff3fa4";
}
