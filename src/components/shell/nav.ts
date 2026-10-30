import { BarChart3, CirclePlay, Heart, House, Library } from "lucide-react";

export const NAV = [
  { href: "/", label: "Inicio", short: "Inicio", icon: House },
  { href: "/biblioteca", label: "Biblioteca", short: "Biblioteca", icon: Library },
  { href: "/deseos", label: "Deseos", short: "Deseos", icon: Heart },
  { href: "/que-juego", label: "¿A qué juego?", short: "Jugar", icon: CirclePlay },
  { href: "/estadisticas", label: "Estadísticas", short: "Resumen", icon: BarChart3 },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/biblioteca") return pathname.startsWith("/biblioteca") || pathname.startsWith("/juego") || pathname.startsWith("/listas");
  return pathname.startsWith(href);
}
