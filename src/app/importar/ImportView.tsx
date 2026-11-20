"use client";

import { useSearchParams } from "next/navigation";
import { BackupImport } from "./BackupImport";
import { GameTrackerImport } from "./GameTrackerImport";
import { SteamImport } from "./SteamImport";

export function ImportView() {
  const origin = useSearchParams().get("origen");
  if (origin === "gametracker") return <GameTrackerImport />;
  if (origin === "copia") return <BackupImport />;
  return <SteamImport />;
}
