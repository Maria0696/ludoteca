import type { Metadata } from "next";
import { GameDetail } from "./GameDetail";

export const metadata: Metadata = { title: "Ficha del juego" };

export default async function JuegoPage({ params }: PageProps<"/juego/[id]">) {
  const { id } = await params;
  return <GameDetail id={id} />;
}
