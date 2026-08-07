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
    <aside className="hidden lg:flex w-80 shrink-0 flex-col overflow-y-auto bg-slate-900 border-l border-slate-700">
      {children}
    </aside>
  );
}
