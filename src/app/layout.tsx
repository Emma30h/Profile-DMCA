import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import Script from "next/script";
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
      <body className="h-full overflow-x-hidden bg-slate-950 font-sans antialiased">
        {children}
        {/* Aplica el tema guardado ANTES del primer paint — si no, el área
            de contenido (la única parte de la app que responde al tema;
            sidebar/header/pantallas de auth quedan siempre oscuros)
            parpadearía en oscuro un instante al cargar en claro. Next.js
            siempre inyecta los scripts beforeInteractive dentro de <head>
            sin importar dónde se escriban en el árbol — pero en Next 16 con
            React 19 colocar el <Script> DENTRO de <head> dispara el warning
            "Encountered a script tag while rendering React component"
            (RootLayout completeWork), porque React ahora reconcilia <head>
            como parte normal del árbol. La doc oficial de next/script lo
            coloca junto a {"{children}"} dentro de <body>; ahí React no lo ve
            como un <script> renderizado y Next lo sigue hoisteando a <head>. */}
        <Script
          id="tema-inicial"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("tema")==="light"){document.documentElement.setAttribute("data-theme","light");}}catch(e){}`,
          }}
        />
        {/* Mismo mecanismo que "tema-inicial" de arriba, pero para el sistema
            Industry de la landing/Acceso (atributo data-tema, clave
            "dmca-tema") — independiente uno del otro a propósito, ver
            useTemaIndustry.ts. */}
        <Script
          id="tema-industry-inicial"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("dmca-tema")==="claro"){document.documentElement.setAttribute("data-tema","claro");}}catch(e){}`,
          }}
        />
      </body>
    </html>
  );
}
