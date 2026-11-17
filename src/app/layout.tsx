import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ludoteca", template: "%s · Ludoteca" },
  description: "Tu biblioteca personal de videojuegos.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1a1526",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-ES" className={fontVariables}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
