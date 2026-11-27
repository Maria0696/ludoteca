import type { Metadata } from "next";
import { AchievementsView } from "./AchievementsView";

export const metadata: Metadata = { title: "Logros" };

export default function LogrosPage() {
  return <AchievementsView />;
}
