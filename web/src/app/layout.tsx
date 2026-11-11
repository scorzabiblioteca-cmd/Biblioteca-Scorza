import "./globals.css";
import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "BiblioScorza",
  description: "Gestión de biblioteca escolar",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/escudo-colegio.png", apple: "/icons/app-192.png" },
  appleWebApp: { capable: true, title: "BiblioScorza", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2a5cb8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="es"><body><PwaRegister />{children}</body></html>);
}
