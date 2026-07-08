"use client";

import { useState, useTransition } from "react";
import { aprobarLegajo, rechazarLegajo } from "@/app/actions/legajo";

interface Props {
  agenteId: string;
}

export default function ValidarLegajoBtn({ agenteId }: Props) {
  const [modo, setModo] = useState<"idle" | "rechazar">("idle");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAprobar() {
    startTransition(async () => {
      setError("");
      try {
        await aprobarLegajo(agenteId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al aprobar");
      }
    });
  }

  function handleRechazar() {
    if (!motivo.trim()) { setError("Escribí el motivo de rechazo"); return; }
    startTransition(async () => {
      setError("");
      try {
        await rechazarLegajo(agenteId, motivo);
        setModo("idle");
        setMotivo("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al rechazar");
      }
    });
  }

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-yellow-400 text-lg">⏳</span>
        <p className="text-sm font-semibold text-yellow-300">Legajo pendiente de validación</p>
      </div>
      <p className="text-xs text-yellow-400">
        Este legajo fue cargado por el agente y requiere tu aprobación antes de activarse.
      </p>

      {modo === "idle" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleAprobar}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isPending ? "Procesando..." : "✅ Aprobar legajo"}
          </button>
          <button
            onClick={() => { setModo("rechazar"); setError(""); }}
            disabled={isPending}
            className="flex-1 py-2 text-sm font-semibold bg-slate-900 hover:bg-red-500/10 text-red-400 border border-red-300 rounded-lg disabled:opacity-50 transition-colors"
          >
            ❌ Rechazar
          </button>
        </div>
      )}

      {modo === "rechazar" && (
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-medium text-slate-300">
            Motivo de rechazo (le llegará al agente)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej: Faltan datos en la sección médica. Por favor completá el grupo sanguíneo."
            className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRechazar}
              disabled={isPending}
              className="flex-1 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {isPending ? "Enviando..." : "Confirmar rechazo"}
            </button>
            <button
              onClick={() => { setModo("idle"); setError(""); setMotivo(""); }}
              disabled={isPending}
              className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
