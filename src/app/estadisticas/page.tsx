import type { Metadata } from "next";
import { StatsView } from "./StatsView";

export const metadata: Metadata = { title: "Estadísticas" };

export default function EstadisticasPage() {
  return <StatsView />;
}
