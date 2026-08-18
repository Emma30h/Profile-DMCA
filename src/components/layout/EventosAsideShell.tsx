"use client";

import { usePathname } from "next/navigation";

// El aside "Turno de hoy / Eventos" vive acá, como hermano de flex del
// Sidebar y de la columna de contenido dentro de (dashboard)/layout.tsx —
// NO como position:fixed. Así su alto sale gratis del propio flujo del
// layout (align-items:stretch en la fila con min-h-screen), exactamente
// igual que el Sidebar izquierdo, en vez de depender de que top-0/bottom-0
// en un elemento fixed coincida con el alto real del viewport, que no
// siempre estaba dando el alto completo hasta el borde de la ventana.
// Como consecuencia, el Header (que vive en la columna de al lado) ya no
// necesita ningún margen especial para no pasar por detrás: al ser
// columnas de flex separadas, estructuralmente no pueden superponerse.
const RUTAS_CON_ASIDE = new Set(["/dashboard", "/perfil"]);

export default function EventosAsideShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!RUTAS_CON_ASIDE.has(pathname)) return null;

  return (
    // scrollbar-gutter:stable le reserva su propio carril a la scrollbar
    // nativa (color-scheme:dark en globals.css la pinta como una franja
    // redondeada semi-transparente) — sin esto, en vez de correr al costado
    // se dibuja flotando ENCIMA del borde derecho de cada tarjeta, tapando
    // texto como las letras A/C/E de "Turno de hoy".
    <aside className="hidden lg:flex w-80 shrink-0 flex-col overflow-y-auto bg-slate-900 border-l border-slate-700 [scrollbar-gutter:stable]">
      {children}
    </aside>
  );
}
