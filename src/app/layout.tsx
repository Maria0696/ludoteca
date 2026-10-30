import type { Metadata, Viewport } from "next";
import { Albert_Sans, Bricolage_Grotesque } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

const text = Albert_Sans({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Sala de los Menesteres", template: "%s · Sala de los Menesteres" },
  description: "Tu biblioteca personal de videojuegos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-ES" className={`${display.variable} ${text.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
