import { Press_Start_2P, VT323 } from "next/font/google";

// Letras de píxel, solo para la pantalla de «Entrar».

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
