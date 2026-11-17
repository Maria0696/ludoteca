import { Albert_Sans, Bricolage_Grotesque, Press_Start_2P, VT323 } from "next/font/google";

// Compartidas por el diseño general y la pantalla de error general, que
// dibuja su propio documento.

// Letras de la carcasa común: píxeles para títulos, terminal para leer.
export const arcade = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-arcade",
  display: "swap",
});

export const terminal = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-terminal",
  display: "swap",
});

// Letras anteriores: siguen en el texto de las pantallas aún sin pasar a la carcasa.
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

/** Todas las variables de letra, para el `<html>` del documento. */
export const fontVariables = [arcade, terminal, display, text].map((f) => f.variable).join(" ");
