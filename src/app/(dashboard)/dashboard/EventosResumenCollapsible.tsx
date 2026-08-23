"use client";

import { useState } from "react";

// Mismo patrón de plegado que AlertsPanel ("Atención requerida"): grid-rows
// animado vía la clase .dashboard-collapse (globals.css), cerrado por
// defecto para no empujar el resto del contenido en mobile. Solo mobile
// (lg:hidden) — en desktop esta misma info ya vive en el aside fijo de
// EventosAsideShell.
export default function EventosResumenCollapsible({
  resumenCerrado,
  children,
}: {
  resumenCerrado: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="lg:hidden bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="w-full flex items-center justify-between gap-3 px-4.5 py-3.5 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--c-text)]">Turno y novedades de hoy</h3>
          {!abierto && <p className="text-[11px] text-[var(--c-text-faint)] mt-0.5 truncate">{resumenCerrado}</p>}
        </div>
        <span
          className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[var(--c-text-faint)] transition-transform duration-300 ${
            abierto ? "" : "-rotate-90"
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </span>
      </button>

      <div className={`dashboard-collapse ${abierto ? "abierto" : ""}`}>
        <div className="divide-y divide-[var(--c-bg-elev-2)] border-t border-[var(--c-bg-elev-2)]">
          {children}
        </div>
      </div>
    </div>
  );
}
