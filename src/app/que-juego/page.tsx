import type { Metadata } from "next";
import { Suspense } from "react";
import { PickerView } from "./PickerView";

export const metadata: Metadata = { title: "¿A qué juego?" };

export default function QueJuegoPage() {
  return (
    <Suspense>
      <PickerView />
    </Suspense>
  );
}
