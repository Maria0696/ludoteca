/**
 * El color de cada año en el Anuario: el mismo en su cartucho, en sus barras y en la banda de Estadísticas. Van en
 * rueda (2026 rosa, 2025 cian, 2024 morado…), así un año guarda siempre su color.
 */
const YEAR_COLORS = [
  { bg: "#ff3d8b", ink: "#1a0610" },
  { bg: "#3d7bff", ink: "#ffffff" },
  { bg: "#ff9f1c", ink: "#1f0e00" },
  { bg: "#5dff8b", ink: "#03170a" },
  { bg: "#7b5cff", ink: "#ffffff" },
  { bg: "#29e3ff", ink: "#04161b" },
];

export function yearColor(year: number): { bg: string; ink: string } {
  const n = YEAR_COLORS.length;
  return YEAR_COLORS[(((year - 2026) % n) + n) % n];
}
