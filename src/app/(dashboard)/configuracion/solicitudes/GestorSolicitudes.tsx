"use client";

import { useState, useTransition } from "react";
import { aprobarSolicitud, rechazarSolicitud } from "@/app/actions/solicitudes";

interface SolicitudItem {
  id: string;
  estado: string;
  motivoRechazo: string | null;
  permisoHasta: string | null;
  createdAt: string;
  usuario: {
    id: string;
    email: string;
    nombre: string | null;
    apellido: string | null;
    agente: { nombres: string; apellidos: string } | null;
  };
}

interface Props {
  pendientes: SolicitudItem[];
  historial: SolicitudItem[];
}

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  APROBADA: "bg-green-500/15 text-green-400",
  RECHAZADA: "bg-red-500/15 text-red-400",
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

function nombreSolicitud(s: SolicitudItem) {
  if (s.usuario.agente) {
    return `${s.usuario.agente.apellidos}, ${s.usuario.agente.nombres}`;
  }
  return [s.usuario.apellido, s.usuario.nombre].filter(Boolean).join(", ") || s.usuario.email;
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Fila pendiente ───────────────────────────────────────────────────────────

function FilaPendiente({ solicitud }: { solicitud: SolicitudItem }) {
  const [pending, startTransition] = useTransition();
  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAprobar() {
    setError(null);
    startTransition(async () => {
      try {
        await aprobarSolicitud(solicitud.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al aprobar");
      }
    });
  }

  function handleRechazar() {
    setError(null);
    startTransition(async () => {
      try {
        await rechazarSolicitud(solicitud.id, motivo);
        setModalRechazo(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al rechazar");
      }
    });
  }

  return (
    <>
      <tr className={`transition-colors ${pending ? "opacity-50" : "hover:bg-slate-800"}`}>
        <td className="px-4 py-3">
          <p className="font-medium text-slate-100">{nombreSolicitud(solicitud)}</p>
          <p className="text-xs text-slate-500">{solicitud.usuario.email}</p>
        </td>
        <td className="px-4 py-3 text-sm text-slate-400">{formatFecha(solicitud.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAprobar}
              disabled={pending}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => setModalRechazo(true)}
              disabled={pending}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </td>
      </tr>

      {/* Modal rechazo */}
      {modalRechazo && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => !pending && setModalRechazo(false)}
              />
              <div className="relative bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-100">Rechazar solicitud</h3>
                <p className="text-sm text-slate-400">
                  Solicitud de <strong>{nombreSolicitud(solicitud)}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Motivo del rechazo <span className="text-slate-500 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Explicá brevemente el motivo..."
                    className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalRechazo(false)}
                    disabled={pending}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRechazar}
                    disabled={pending}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {pending ? "Rechazando..." : "Confirmar rechazo"}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────

function TablaHistorial({ solicitudes }: { solicitudes: SolicitudItem[] }) {
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const filtradas = solicitudes.filter((s) => {
    const nombre = nombreSolicitud(s).toLowerCase();
    const matchNombre = filtroNombre === "" || nombre.includes(filtroNombre.toLowerCase());
    const matchEstado = filtroEstado === "" || s.estado === filtroEstado;
    return matchNombre && matchEstado;
  });

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los estados</option>
          <option value="APROBADA">Aprobadas</option>
          <option value="RECHAZADA">Rechazadas</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="px-6 py-12 text-center text-slate-500 text-sm">
          No hay solicitudes que coincidan con los filtros.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha solicitud</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtradas.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-100">{nombreSolicitud(s)}</p>
                  <p className="text-xs text-slate-500">{s.usuario.email}</p>
                </td>
                <td className="px-4 py-3 text-slate-400">{formatFecha(s.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[s.estado] ?? "bg-slate-800 text-slate-400"}`}>
                    {ESTADO_LABELS[s.estado] ?? s.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  {s.estado === "APROBADA" && s.permisoHasta && (
                    <span>Vence: {formatFecha(s.permisoHasta)}</span>
                  )}
                  {s.estado === "RECHAZADA" && s.motivoRechazo && (
                    <span className="text-red-500">{s.motivoRechazo}</span>
                  )}
                  {s.estado === "RECHAZADA" && !s.motivoRechazo && (
                    <span className="text-slate-600">Sin motivo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GestorSolicitudes({ pendientes, historial }: Props) {
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Pestañas */}
      <div className="flex border-b border-slate-700">
        <button
          type="button"
          onClick={() => setTab("pendientes")}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "pendientes"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          Pendientes
          {pendientes.length > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-medium text-yellow-400">
              {pendientes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("historial")}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "historial"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          Historial
          <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
            {historial.length}
          </span>
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {tab === "pendientes" && (
          <>
            {pendientes.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500 text-sm">
                No hay solicitudes pendientes.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendientes.map((s) => (
                    <FilaPendiente key={s.id} solicitud={s} />
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "historial" && <TablaHistorial solicitudes={historial} />}
      </div>
    </div>
  );
}
