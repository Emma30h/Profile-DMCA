import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "D.M.C.A",
  description: "Sistema de gestión de personal de la Dirección Monitoreo Cordobeses en Alerta, Policía de Córdoba",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="h-full bg-slate-950 font-sans antialiased">{children}</body>
    </html>
  );
}
