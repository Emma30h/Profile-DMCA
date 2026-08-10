"use client";

import { useEffect, useRef, useState } from "react";
import { formatFechaHora } from "@/lib/fecha";

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  ACTIVO: "bg-green-500/15 text-green-400",
  BAJA: "bg-slate-800 text-slate-400",
  PASE: "bg-blue-500/15 text-blue-300",
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACTIVO: "Activo",
  BAJA: "Baja",
  PASE: "Pase",
};

interface Props {
  estado: string;
  /** ISO del último cambio hacia este estado, o null si no hay registro. */
  desde: string | null;
  motivo: string | null;
}

/** Versión de solo lectura del badge de estado: al hacer click muestra desde
 *  cuándo rige (y el motivo, si lo hay), sin permitir editarlo. */
export default function EstadoBadgeInfo({ estado, desde, motivo }: Props) {
  const [abierto, setAbierto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        title="Ver desde cuándo rige"
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
          ESTADO_BADGE[estado] ?? "bg-slate-800 text-slate-400"
        }`}
      >
        {ESTADO_LABELS[estado] ?? estado}
      </button>

      {abierto && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 w-56 rounded-lg border border-slate-700 bg-slate-800 p-3 shadow-lg shadow-black/40 text-left">
          {desde ? (
            <>
              <p className="text-[11px] text-slate-400">Vigente desde</p>
              <p className="text-sm text-slate-100 font-medium">{formatFechaHora(desde, { utc: true, separador: " " })}</p>
              {motivo && (
                <p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">{motivo}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">Sin registro de cambios de estado.</p>
          )}
        </div>
      )}
    </div>
  );
}
