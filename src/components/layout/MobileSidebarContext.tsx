"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface MobileSidebarState {
  abierto: boolean;
  toggle: () => void;
  cerrar: () => void;
}

const MobileSidebarCtx = createContext<MobileSidebarState | null>(null);

// El sidebar es fixed/off-canvas en mobile y el botón que lo abre vive en el
// Header — dos componentes hermanos bajo el layout del dashboard (que es un
// Server Component, no puede tener su propio useState) — así que comparten
// el estado "abierto" a través de este contexto en vez de levantarlo ahí.
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const toggle = useCallback(() => setAbierto((v) => !v), []);
  const cerrar = useCallback(() => setAbierto(false), []);

  return (
    <MobileSidebarCtx.Provider value={{ abierto, toggle, cerrar }}>
      {children}
    </MobileSidebarCtx.Provider>
  );
}

export function useMobileSidebar(): MobileSidebarState {
  const ctx = useContext(MobileSidebarCtx);
  if (!ctx) throw new Error("useMobileSidebar debe usarse dentro de MobileSidebarProvider");
  return ctx;
}
