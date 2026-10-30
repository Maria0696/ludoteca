import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "./LibraryView";

export const metadata: Metadata = { title: "Biblioteca" };

export default function BibliotecaPage() {
  return (
    <Suspense>
      <LibraryView />
    </Suspense>
  );
}
