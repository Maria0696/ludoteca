import type { Metadata } from "next";
import { WishlistView } from "./WishlistView";

export const metadata: Metadata = { title: "Lista de deseos" };

export default function DeseosPage() {
  return <WishlistView />;
}
