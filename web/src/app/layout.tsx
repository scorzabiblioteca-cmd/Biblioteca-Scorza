import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "BiblioScorza", description: "Gestión de biblioteca escolar" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body>{children}</body></html>);
}
