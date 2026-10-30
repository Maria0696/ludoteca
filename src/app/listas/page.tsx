import type { Metadata } from "next";
import { Suspense } from "react";
import { ListsView } from "./ListsView";

export const metadata: Metadata = { title: "Mis listas" };

export default function ListasPage() {
  return (
    <Suspense>
      <ListsView />
    </Suspense>
  );
}
