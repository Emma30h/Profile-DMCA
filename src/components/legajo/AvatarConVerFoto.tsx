"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AgenteAvatar from "@/components/AgenteAvatar";
import PreviewFoto from "@/components/PreviewFoto";

interface Props {
  fotoUrl: string | null;
  sexo?: string | null;
  /** Iniciales de respaldo cuando ni siquiera hay legajo (no hay AgenteAvatar posible). */
  inicial?: string;
  nombreCompleto: string;
}

export default function AvatarConVerFoto({ fotoUrl, sexo, inicial, nombreCompleto }: Props) {
  const [popoverAbierto, setPopoverAbierto] = useState(false);
  const [previewAbierto, setPreviewAbierto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverAbierto) return;
    function onClickFuera(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPopoverAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [popoverAbierto]);

  function handleClickAvatar() {
    if (!fotoUrl) return; // sin foto propia no hay nada que ver en detalle
    setPopoverAbierto((v) => !v);
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Respaldo opaco: el ícono por defecto de AgenteAvatar (sin foto) usa
          un fondo semitransparente, pensado para asentarse sobre una tarjeta
          bg-slate-900 — acá se superpone al banner con degradé, y sin esto
          el degradé se filtraba de forma irregular detrás del ícono. */}
      <div className="absolute inset-0 rounded-full bg-slate-900" />
      <div className="relative">
        <button
          type="button"
          onClick={handleClickAvatar}
          title={fotoUrl ? "Ver foto" : undefined}
          className={`block rounded-full ${fotoUrl ? "cursor-pointer" : "cursor-default"}`}
        >
          {inicial && !fotoUrl ? (
            <div className="w-20 h-20 rounded-full bg-blue-700 border-4 border-slate-900 flex items-center justify-center text-white text-2xl font-bold shadow">
              {inicial}
            </div>
          ) : (
            <AgenteAvatar
              fotoUrl={fotoUrl}
              sexo={sexo}
              sizeClassName="w-20 h-20 rounded-full border-4 border-slate-900 shadow"
              iconSizeClassName="h-8 w-8"
            />
          )}
        </button>

        {popoverAbierto && fotoUrl && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 whitespace-nowrap">
            <button
              type="button"
              onClick={() => { setPreviewAbierto(true); setPopoverAbierto(false); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg shadow-black/40 hover:bg-slate-700 transition-colors"
            >
              👁️ Ver foto
            </button>
          </div>
        )}
      </div>

      {previewAbierto && fotoUrl && createPortal(
        <PreviewFoto src={fotoUrl} label={nombreCompleto} onCerrar={() => setPreviewAbierto(false)} />,
        document.body
      )}
    </div>
  );
}
