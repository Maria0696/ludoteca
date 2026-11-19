import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Ajustes" };

export default function AjustesPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
