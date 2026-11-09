import { Oxanium, Share_Tech_Mono } from "next/font/google";

// Letras de la pantalla de copia de datos desde Steam.

export const screenTitle = Oxanium({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-copia-titulo",
  display: "swap",
});

export const screenData = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-copia-datos",
  display: "swap",
});
