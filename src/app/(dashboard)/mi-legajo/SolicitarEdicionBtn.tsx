"use client";

import { useState, useTransition } from "react";
import { crearSolicitudEdicion } from "@/app/actions/solicitudes";

interface Props {
  tienePendiente: boolean;
  tienePermisoActivo: boolean;
  permisoHasta: string | null;
}

export default function SolicitarEdicionBtn({ tienePendiente, tienePermisoActivo, permisoHasta }: Props) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      try {
        await crearSolicitudEdicion();
        setEnviado(true);
        setModalAbierto(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ocurrió un error");
      }
    });
  }

  if (tienePermisoActivo && permisoHasta) {
    const fecha = new Date(permisoHasta).toLocaleDateString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/25 px-3 py-1.5 text-sm text-green-400">
        <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
        Edición habilitada hasta {fecha}
      </div>
    );
  }

  if (tienePendiente || enviado) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/25 px-3 py-1.5 text-sm text-yellow-400">
        <span className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
        Solicitud enviada — pendiente de aprobación
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAbierto(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300 hover:bg-blue-500/15 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-1.414A2 2 0 019.586 13z" />
        </svg>
        Solicitar actualización de datos
      </button>

      {/* Modal de confirmación */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && setModalAbierto(false)}
          />

          {/* Panel */}
          <div className="relative bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/15">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Solicitar actualización de datos</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Vas a enviar una solicitud a los administradores para que te habiliten la edición de tu legajo por <strong>48 horas</strong>.
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Una vez aprobada, recibirás una notificación y un email con la confirmación.
                </p>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                disabled={pending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={pending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {pending ? "Enviando..." : "Confirmar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
