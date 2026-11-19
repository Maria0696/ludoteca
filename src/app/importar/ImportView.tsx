"use client";

import { useSearchParams } from "next/navigation";
import { GameTrackerImport } from "./GameTrackerImport";
import { SteamImport } from "./SteamImport";

export function ImportView() {
  const origin = useSearchParams().get("origen");
  return origin === "gametracker" ? <GameTrackerImport /> : <SteamImport />;
}
