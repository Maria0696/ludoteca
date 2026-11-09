import type { Metadata } from "next";
import { SteamImport } from "./SteamImport";

export const metadata: Metadata = { title: "Importar de Steam" };

export default function ImportarPage() {
  return <SteamImport />;
}
