"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { actualizarTipoPersonal } from "@/app/actions/agentes";
import type { TipoPersonal } from "@/types";

const TIPO_LABEL: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

const OPCIONES: TipoPersonal[] = ["SEGURIDAD", "TECNICO", "CIVIL_BECARIO", "CIVIL_POLICIAL"];

const PIERDE_DATOS: Partial<Record<TipoPersonal, string>> = {
  CIVIL_BECARIO: "Se van a borrar la jerarquía/rango, el E.T.A.C. y (si tenía) armamento, chaleco y TNO cargados.",
  CIVIL_POLICIAL: "Se van a borrar la jerarquía/rango, el E.T.A.C. y (si tenía) armamento, chaleco y TNO cargados.",
  TECNICO: "Se van a borrar el armamento, chaleco y TNO cargados (Técnico no los usa).",
};

interface Props {
  agenteId: string;
  tipoActual: TipoPersonal;
}

export default function TipoPersonalBtn({ agenteId, tipoActual }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<TipoPersonal>(tipoActual);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAbrir() {
    setNuevoTipo(tipoActual);
    setError(null);
    setAbierto(true);
  }

  function handleCerrar() {
    if (pending) return;
    setAbierto(false);
    setError(null);
  }

  function handleConfirmar() {
    if (nuevoTipo === tipoActual) {
      setAbierto(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await actualizarTipoPersonal(agenteId, nuevoTipo);
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cambiar el tipo de personal.");
      }
    });
  }

  const advertencia = nuevoTipo !== tipoActual ? PIERDE_DATOS[nuevoTipo] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        className="inline-flex items-center gap-1 hover:text-blue-300 transition-colors"
        title="Corregir tipo de personal"
      >
        {TIPO_LABEL[tipoActual] ?? tipoActual}
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCerrar} />

          <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Corregir tipo de personal</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Usar solo para corregir un error de carga — no es un cambio de situación laboral.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo de personal</label>
              <select
                value={nuevoTipo}
                onChange={(e) => {
                  setNuevoTipo(e.target.value as TipoPersonal);
                  setError(null);
                }}
                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {OPCIONES.map((o) => (
                  <option key={o} value={o}>{TIPO_LABEL[o]}</option>
                ))}
              </select>
              {advertencia && (
                <p className="text-xs text-amber-400 mt-2">{advertencia}</p>
              )}
              {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCerrar}
                disabled={pending}
                className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={pending}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
