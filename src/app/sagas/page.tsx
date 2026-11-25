import type { Metadata } from "next";
import { Suspense } from "react";
import { SagasView } from "./SagasView";

export const metadata: Metadata = { title: "Sagas" };

export default function SagasPage() {
  return (
    <Suspense>
      <SagasView />
    </Suspense>
  );
}
