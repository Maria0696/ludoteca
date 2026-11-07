import { Albert_Sans, Bricolage_Grotesque } from "next/font/google";

// Compartidas por el diseño general y la pantalla de error general, que
// dibuja su propio documento.

export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

export const text = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});
