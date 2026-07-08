"use client";

import Link from "next/link";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

// Acceso rápido al legajo del agente anclado desde la lista de Personal,
// visible en cualquier página del panel (el Header se renderiza siempre)
// para no tener que volver a buscarlo.
export default function AgenteAncladoChip() {
  const { anclado, desanclar } = useAgenteAnclado();

  if (!anclado) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-blue-500/40 bg-blue-500/10 py-1 pl-1 pr-1 text-xs font-medium text-blue-300">
      <Link
        href={`/personal/${anclado.id}`}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-blue-500/20 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
        <span className="max-w-[10rem] truncate">{anclado.apellidos}, {anclado.nombres}</span>
      </Link>
      <button
        type="button"
        onClick={desanclar}
        title="Desanclar"
        className="rounded p-1 text-blue-400/70 hover:text-blue-200 hover:bg-blue-500/20 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
