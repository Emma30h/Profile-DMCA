"use client";

import { ArrowLeft } from "lucide-react";
import { usePersonalNav } from "./PersonalMasterShell";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

export default function LimpiarFicheroButton({ href, agenteId }: { href: string; agenteId: string }) {
  const { limpiarFicha } = usePersonalNav();
  const { anclado, desanclar } = useAgenteAnclado();

  function handleClick() {
    if (anclado?.id === agenteId) desanclar();
    limpiarFicha(href);
  }

  return (
    <button type="button" onClick={handleClick} className="text-slate-400 hover:text-white transition-colors">
      {/* En mobile, este botón es la única forma de volver (la lista de
          Personal, o la sección de origen si se llegó desde otro lado, ej.
          el calendario de Licencias — ver "volver" en personal/[id]/page.tsx),
          así que ahí necesita leerse como "volver" genérico y no como el
          "limpiar/deseleccionar" que es en desktop (donde la lista de
          Personal sigue visible al lado, sin ambigüedad de origen). */}
      <span className="lg:hidden inline-flex items-center gap-1 text-sm font-medium">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Volver
      </span>
      <span className="hidden lg:inline text-xs font-medium">Limpiar fichero ✕</span>
    </button>
  );
}
