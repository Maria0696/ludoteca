import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportView } from "./ImportView";

export const metadata: Metadata = { title: "Importar" };

export default function ImportarPage() {
  return (
    <Suspense>
      <ImportView />
    </Suspense>
  );
}
