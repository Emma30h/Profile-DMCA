import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
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
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado ANTES del primer paint — si no, el área
            de contenido (la única parte de la app que responde al tema;
            sidebar/header/pantallas de auth quedan siempre oscuros)
            parpadearía en oscuro un instante al cargar en claro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("tema")==="light"){document.documentElement.setAttribute("data-theme","light");}}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full overflow-x-hidden bg-slate-950 font-sans antialiased">{children}</body>
    </html>
  );
}
