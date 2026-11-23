"use client";

import { useSearchParams } from "next/navigation";
import { BackupImport } from "./BackupImport";
import { SteamImport } from "./SteamImport";

/** Sin origen (o con uno que ya no existe, como Game Tracker), se abre la copia de seguridad: va la primera. */
export function ImportView() {
  const origin = useSearchParams().get("origen");
  return origin === "steam" ? <SteamImport /> : <BackupImport />;
}
