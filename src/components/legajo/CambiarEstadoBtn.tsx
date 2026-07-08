"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoAgente } from "@/app/actions/estado";

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

const OPCIONES = [
  { value: "ACTIVO", label: "Activo" },
  { value: "BAJA", label: "Baja" },
  { value: "PASE", label: "Pase" },
];

const REQUIERE_MOTIVO = ["BAJA", "PASE"];

interface Props {
  agenteId: string;
  estadoActual: string;
}

export default function CambiarEstadoBtn({ agenteId, estadoActual }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const opciones = OPCIONES.filter((o) => o.value !== estadoActual);

  function handleAbrir() {
    setNuevoEstado(opciones[0]?.value ?? "");
    setMotivo("");
    setError(null);
    setAbierto(true);
  }

  function handleCerrar() {
    if (pending) return;
    setAbierto(false);
    setError(null);
  }

  function handleConfirmar() {
    if (!nuevoEstado) return;
    if (REQUIERE_MOTIVO.includes(nuevoEstado) && !motivo.trim()) {
      setError("El motivo es obligatorio para este cambio de estado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await cambiarEstadoAgente(agenteId, nuevoEstado, motivo.trim() || undefined);
        setAbierto(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cambiar el estado.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
          ESTADO_BADGE[estadoActual] ?? "bg-slate-800 text-slate-400"
        }`}
      >
        {ESTADO_LABELS[estadoActual] ?? estadoActual}
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={handleCerrar}
          />

          {/* Modal */}
          <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Cambiar estado del legajo</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Estado actual:{" "}
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[estadoActual] ?? "bg-slate-800 text-slate-400"}`}>
                  {ESTADO_LABELS[estadoActual] ?? estadoActual}
                </span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nuevo estado</label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => {
                    setNuevoEstado(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {opciones.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Motivo
                  {REQUIERE_MOTIVO.includes(nuevoEstado) && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    setError(null);
                  }}
                  rows={3}
                  placeholder={
                    REQUIERE_MOTIVO.includes(nuevoEstado)
                      ? "Motivo obligatorio para este cambio..."
                      : "Motivo (opcional)..."
                  }
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
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
                disabled={pending || !nuevoEstado}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
