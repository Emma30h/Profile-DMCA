"use client";

import { ArrowLeft } from "lucide-react";
import { usePersonalNav } from "@/app/(dashboard)/personal/PersonalMasterShell";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

interface Props {
  href: string;
  agenteId: string;
}

// En mobile, este botón es la única forma de volver (la lista de Personal
// no queda visible al lado como en desktop), así que se muestra siempre
// como "Volver" en su propia fila arriba del todo. En desktop esta misma
// acción ("Limpiar fichero") vive dentro de OpcionesLegajoMenu, junto con
// "Exportar para WhatsApp" — separado en su propio componente para no
// duplicar esa fila en desktop y así ganar altura en la cabecera del legajo.
export default function VolverMovilBtn({ href, agenteId }: Props) {
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
      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--c-text-muted)] hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
      Volver
    </button>
  );
}
