"use client";

import { useState, useTransition } from "react";
import { aprobarLegajo, rechazarLegajo, deshacerRechazoLegajo } from "@/app/actions/legajo";

interface Props {
  agenteId: string;
  motivoRechazo?: string | null;
}

export default function ValidarLegajoBtn({ agenteId, motivoRechazo }: Props) {
  const [modo, setModo] = useState<"idle" | "rechazar">("idle");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const yaRechazado = Boolean(motivoRechazo);

  function handleAprobar() {
    startTransition(async () => {
      setError("");
      const res = await aprobarLegajo(agenteId);
      if (!res.ok) setError(res.error);
    });
  }

  function handleRechazar() {
    if (!motivo.trim()) { setError("Escribí el motivo de rechazo"); return; }
    startTransition(async () => {
      setError("");
      const res = await rechazarLegajo(agenteId, motivo);
      if (res.ok) {
        setModo("idle");
        setMotivo("");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDeshacerRechazo() {
    startTransition(async () => {
      setError("");
      const res = await deshacerRechazoLegajo(agenteId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div
      className={`rounded-xl p-4 space-y-3 border ${
        yaRechazado ? "bg-red-500/10 border-red-500/25" : "bg-yellow-500/10 border-yellow-500/25"
      }`}
    >
      {yaRechazado ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">❌</span>
            <p className="text-sm font-semibold text-red-300">Este legajo fue rechazado</p>
          </div>
          <p className="text-xs text-red-400">
            Motivo: {motivoRechazo}
          </p>
          <p className="text-xs text-red-500/80">
            No se puede aprobar mientras el rechazo esté vigente. Deshacelo cuando quieras volver a
            revisar el legajo — ya sea porque fue un error tuyo o porque el agente ya lo corrigió.
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg hourglass-flip">⏳</span>
          <p className="text-sm font-semibold text-yellow-300">Legajo pendiente de validación</p>
        </div>
      )}

      {!yaRechazado && (
        <p className="text-xs text-yellow-400">
          Este legajo fue cargado por el agente y requiere tu aprobación antes de activarse.
        </p>
      )}

      {modo === "idle" && (
        <div className="flex flex-wrap gap-2 pt-1">
          {yaRechazado ? (
            <>
              <button
                disabled
                title="Deshacé el rechazo para volver a habilitar la aprobación"
                className="flex-1 py-2 text-sm font-semibold bg-slate-800 text-slate-500 rounded-lg cursor-not-allowed"
              >
                ✅ Aprobar legajo
              </button>
              <button
                onClick={handleDeshacerRechazo}
                disabled={isPending}
                className="flex-1 py-2 text-sm font-medium text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {isPending && <Spinner />}
                {isPending ? <TextoCargando>Deshaciendo</TextoCargando> : "↩️ Deshacer rechazo (fue un error)"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAprobar}
                disabled={isPending}
                className="flex-1 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                {isPending && <Spinner />}
                {isPending ? <TextoCargando>Procesando</TextoCargando> : "✅ Aprobar legajo"}
              </button>
              <button
                onClick={() => { setModo("rechazar"); setError(""); }}
                disabled={isPending}
                className="flex-1 py-2 text-sm font-semibold bg-slate-900 hover:bg-red-500/10 text-red-400 border border-red-300 rounded-lg disabled:opacity-50 transition-colors"
              >
                ❌ Rechazar
              </button>
            </>
          )}
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
              className="flex-1 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              {isPending && <Spinner />}
              {isPending ? <TextoCargando>Enviando</TextoCargando> : "Confirmar rechazo"}
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

function TextoCargando({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center">
      {children}
      <span className="loading-dots inline-flex" aria-hidden="true">
        <span>.</span><span>.</span><span>.</span>
      </span>
    </span>
  );
}

function Spinner() {
  return (
    <svg className="spinner h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
