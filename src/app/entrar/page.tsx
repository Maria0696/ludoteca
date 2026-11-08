import type { Metadata } from "next";
import { Suspense } from "react";
import { preload } from "react-dom";
import { LoginForm } from "./LoginForm";
import { PROJECTION } from "./projection";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  // La primera obra llega antes que el resto: el proyector se enciende con ella.
  preload(PROJECTION[0].src, { as: "image", fetchPriority: "high" });
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
