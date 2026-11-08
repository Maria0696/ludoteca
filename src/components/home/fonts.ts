import { Anton, Chakra_Petch } from "next/font/google";

// Letras del menú principal, solo para el inicio.

export const heavy = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-heavy",
  display: "swap",
});

export const hud = Chakra_Petch({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-hud",
  display: "swap",
});
