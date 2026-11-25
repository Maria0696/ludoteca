import { BarChart3, CirclePlay, Heart, House, Library, ListOrdered } from "lucide-react";

export const NAV = [
  { href: "/", label: "Inicio", short: "Inicio", icon: House },
  { href: "/biblioteca", label: "Biblioteca", short: "Biblioteca", icon: Library },
  { href: "/sagas", label: "Sagas", short: "Sagas", icon: ListOrdered },
  { href: "/deseos", label: "Deseos", short: "Deseos", icon: Heart },
  { href: "/que-juego", label: "¿A qué juego?", short: "Jugar", icon: CirclePlay },
  { href: "/estadisticas", label: "Estadísticas", short: "Resumen", icon: BarChart3 },
] as const;

/** En el móvil, la barra de abajo se queda con cinco: a Sagas se llega desde la Biblioteca. */
export const BOTTOM_NAV = NAV.filter((item) => item.href !== "/sagas");

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/biblioteca") return pathname.startsWith("/biblioteca") || pathname.startsWith("/juego");
  return pathname.startsWith(href);
}
