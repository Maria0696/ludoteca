import { ViewTransition } from "react";

/**
 * Se vuelve a montar al cambiar de pantalla: la vieja se va con un fundido rápido y la nueva entra con uno breve
 * (ver «Cambiar de pantalla» en globals.css). Lo demás (filtros, otra saga…) no anima.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="pantalla-entra" exit="pantalla-sale" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
