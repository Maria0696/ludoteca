import type { Metadata } from "next";
import { Suspense } from "react";
import { ManualView } from "./ManualView";

export const metadata: Metadata = { title: "Manual de instrucciones" };

export default function ManualPage() {
  return (
    <Suspense>
      <ManualView />
    </Suspense>
  );
}
