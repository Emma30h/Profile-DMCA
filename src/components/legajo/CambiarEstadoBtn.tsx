"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoAgente, actualizarFechaVigenciaEstado } from "@/app/actions/estado";
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

const OPCIONES = [
  { value: "ACTIVO", label: "Activo" },
  { value: "BAJA", label: "Baja" },
  { value: "PASE", label: "Pase" },
];

const REQUIERE_MOTIVO = ["BAJA", "PASE"];

// Fecha local (no UTC) en formato yyyy-mm-dd, para precargar el input date
// con el día de hoy tal como lo ve el usuario.
function hoyLocalISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

interface Props {
  agenteId: string;
  estadoActual: string;
  /** ISO del último cambio hacia el estado actual, o null si no hay registro. */
  desde?: string | null;
  motivo?: string | null;
}

export default function CambiarEstadoBtn({ agenteId, estadoActual, desde, motivo: motivoVigente }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [editandoFecha, setEditandoFecha] = useState(false);
  const [nuevaFechaVigencia, setNuevaFechaVigencia] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [pendingFecha, startTransitionFecha] = useTransition();
  // Se pisa apenas se confirma el guardado, para que el texto se actualice
  // al instante sin esperar el round-trip de router.refresh() al servidor.
  const [desdeOverride, setDesdeOverride] = useState<string | null>(null);
  const desdeMostrado = desdeOverride ?? desde ?? null;

  const opciones = OPCIONES.filter((o) => o.value !== estadoActual);

  function handleAbrir() {
    setNuevoEstado(opciones[0]?.value ?? "");
    setMotivo("");
    setFecha(hoyLocalISO());
    setError(null);
    setEditandoFecha(false);
    setAbierto(true);
  }

  function handleCerrar() {
    if (pending) return;
    setAbierto(false);
    setError(null);
  }

  function handleAbrirEditarFecha() {
    // desdeMostrado está en formato ISO de medianoche UTC (viene de un input
    // date sin hora), así que tomar los primeros 10 caracteres reproduce
    // exactamente el yyyy-mm-dd que se cargó originalmente.
    setNuevaFechaVigencia(desdeMostrado ? desdeMostrado.slice(0, 10) : "");
    setErrorFecha(null);
    setEditandoFecha(true);
  }

  function handleGuardarFecha() {
    if (!nuevaFechaVigencia) return;
    setErrorFecha(null);
    startTransitionFecha(async () => {
      try {
        await actualizarFechaVigenciaEstado(agenteId, nuevaFechaVigencia);
        // new Date("yyyy-mm-dd") interpreta el string como medianoche UTC,
        // igual que el server action — así el texto queda consistente con
        // lo que va a devolver el próximo fetch.
        setDesdeOverride(new Date(nuevaFechaVigencia).toISOString());
        setEditandoFecha(false);
        router.refresh();
      } catch (e) {
        setErrorFecha(e instanceof Error ? e.message : "Error al actualizar la fecha.");
      }
    });
  }

  function handleConfirmar() {
    if (!nuevoEstado) return;
    if (REQUIERE_MOTIVO.includes(nuevoEstado) && !motivo.trim()) {
      setError("El motivo es obligatorio para este cambio de estado.");
      return;
    }
    if (!fecha) {
      setError("La fecha es obligatoria.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await cambiarEstadoAgente(agenteId, nuevoEstado, motivo.trim() || undefined, fecha);
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
              {desdeMostrado && (
                editandoFecha ? (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={nuevaFechaVigencia}
                        onChange={(e) => {
                          setNuevaFechaVigencia(e.target.value);
                          setErrorFecha(null);
                        }}
                        className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={handleGuardarFecha}
                        disabled={pendingFecha || !nuevaFechaVigencia}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {pendingFecha ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditandoFecha(false); setErrorFecha(null); }}
                        disabled={pendingFecha}
                        className="text-xs font-medium text-slate-500 hover:text-slate-300 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                    {errorFecha && <p className="text-xs text-red-400">{errorFecha}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Vigente desde {formatFechaHora(desdeMostrado, { utc: true, separador: " " })}
                    {motivoVigente && <> — <span className="text-slate-400">{motivoVigente}</span></>}{" "}
                    <button
                      type="button"
                      onClick={handleAbrirEditarFecha}
                      className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                    >
                      editar fecha
                    </button>
                  </p>
                )
              )}
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
                  Fecha efectiva
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Podés poner una fecha pasada si estás cargando el cambio con demora — el dashboard usa esta fecha, no la de hoy.
                </p>
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
