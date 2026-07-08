"use client";

import { usePersonalNav } from "./PersonalMasterShell";

export default function LimpiarFicheroButton({ href }: { href: string }) {
  const { limpiarFicha } = usePersonalNav();

  return (
    <button
      type="button"
      onClick={() => limpiarFicha(href)}
      className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
    >
      Limpiar fichero ✕
    </button>
  );
}
