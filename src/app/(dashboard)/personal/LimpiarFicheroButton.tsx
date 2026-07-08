"use client";

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
    <button
      type="button"
      onClick={handleClick}
      className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
    >
      Limpiar fichero ✕
    </button>
  );
}
