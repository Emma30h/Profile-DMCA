"use client";

import { useState, useTransition } from "react";
import { aprobarSolicitud, rechazarSolicitud } from "@/app/actions/solicitudes";
import { formatFechaHora } from "@/lib/fecha";

interface SolicitudItem {
  id: string;
  estado: string;
  motivo: string | null;
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
  APROBADA: "bg-[var(--c-green)]/15 text-[var(--c-green)]",
  RECHAZADA: "bg-[var(--c-coral)]/15 text-[var(--c-coral)]",
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
  return formatFechaHora(iso);
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
      const res = await aprobarSolicitud(solicitud.id);
      if (!res.ok) setError(res.error);
    });
  }

  function handleRechazar() {
    setError(null);
    startTransition(async () => {
      const res = await rechazarSolicitud(solicitud.id, motivo);
      if (res.ok) setModalRechazo(false);
      else setError(res.error);
    });
  }

  return (
    <>
      <tr className={`transition-colors ${pending ? "opacity-50" : "hover:bg-[var(--c-bg-elev-2)]"}`}>
        <td className="px-4 py-3">
          <p className="font-medium text-[var(--c-text)]">{nombreSolicitud(solicitud)}</p>
          <p className="text-xs text-[var(--c-text-faint)]">{solicitud.usuario.email}</p>
          {solicitud.motivo && (
            <p className="text-xs text-[var(--c-text-muted)] italic mt-1">&ldquo;{solicitud.motivo}&rdquo;</p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--c-text-muted)]">{formatFecha(solicitud.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAprobar}
              disabled={pending}
              className="rounded-lg bg-[var(--c-green-strong)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--c-green-strong)] transition-colors disabled:opacity-50"
            >
              Aprobar
            </button>
            <button
              type="button"
              onClick={() => setModalRechazo(true)}
              disabled={pending}
              className="rounded-lg border border-[var(--c-coral)] px-3 py-1.5 text-xs font-medium text-[var(--c-coral)] hover:bg-[var(--c-coral)]/10 transition-colors disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-[var(--c-coral)]">{error}</p>}
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
              <div className="relative bg-[var(--c-bg-elev)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-base font-semibold text-[var(--c-text)]">Rechazar solicitud</h3>
                <p className="text-sm text-[var(--c-text-muted)]">
                  Solicitud de <strong>{nombreSolicitud(solicitud)}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-[var(--c-text-secondary)] mb-1">
                    Motivo del rechazo <span className="text-[var(--c-text-faint)] font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    placeholder="Explicá brevemente el motivo..."
                    className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--c-coral)] resize-none"
                  />
                </div>
                {error && <p className="text-sm text-[var(--c-coral)]">{error}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalRechazo(false)}
                    disabled={pending}
                    className="rounded-lg border border-[var(--c-line)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleRechazar}
                    disabled={pending}
                    className="rounded-lg bg-[var(--c-coral-strong)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--c-coral-strong)] transition-colors disabled:opacity-50"
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
          className="rounded-lg border border-[var(--c-line)] px-3 py-1.5 text-sm text-[var(--c-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] w-56"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-[var(--c-line)] px-3 py-1.5 text-sm text-[var(--c-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
        >
          <option value="">Todos los estados</option>
          <option value="APROBADA">Aprobadas</option>
          <option value="RECHAZADA">Rechazadas</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div className="px-6 py-12 text-center text-[var(--c-text-faint)] text-sm">
          No hay solicitudes que coincidan con los filtros.
        </div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--c-bg)] border-b border-[var(--c-line)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Personal</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Fecha solicitud</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--c-bg-elev-2)]">
            {filtradas.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--c-bg-elev-2)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--c-text)]">{nombreSolicitud(s)}</p>
                  <p className="text-xs text-[var(--c-text-faint)]">{s.usuario.email}</p>
                  {s.motivo && (
                    <p className="text-xs text-[var(--c-text-muted)] italic mt-1">&ldquo;{s.motivo}&rdquo;</p>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--c-text-muted)]">{formatFecha(s.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[s.estado] ?? "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]"}`}>
                    {ESTADO_LABELS[s.estado] ?? s.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--c-text-muted)]">
                  {s.estado === "APROBADA" && s.permisoHasta && (
                    <span>Vence: {formatFecha(s.permisoHasta)}</span>
                  )}
                  {s.estado === "RECHAZADA" && s.motivoRechazo && (
                    <span className="text-[var(--c-coral)]">{s.motivoRechazo}</span>
                  )}
                  {s.estado === "RECHAZADA" && !s.motivoRechazo && (
                    <span className="text-[var(--c-line-strong)]">Sin motivo</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GestorSolicitudes({ pendientes, historial }: Props) {
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] overflow-hidden">
      {/* Pestañas */}
      <div className="flex border-b border-[var(--c-line)]">
        <button
          type="button"
          onClick={() => setTab("pendientes")}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "pendientes"
              ? "border-[var(--c-blue)] text-[var(--c-blue-text)]"
              : "border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)]"
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
              ? "border-[var(--c-blue)] text-[var(--c-blue-text)]"
              : "border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text-secondary)]"
          }`}
        >
          Historial
          <span className="ml-2 inline-flex items-center rounded-full bg-[var(--c-bg-elev-2)] px-2 py-0.5 text-xs font-medium text-[var(--c-text-muted)]">
            {historial.length}
          </span>
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4">
        {tab === "pendientes" && (
          <>
            {pendientes.length === 0 ? (
              <div className="px-6 py-12 text-center text-[var(--c-text-faint)] text-sm">
                No hay solicitudes pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--c-bg)] border-b border-[var(--c-line)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Personal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Fecha</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--c-bg-elev-2)]">
                  {pendientes.map((s) => (
                    <FilaPendiente key={s.id} solicitud={s} />
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </>
        )}

        {tab === "historial" && <TablaHistorial solicitudes={historial} />}
      </div>
    </div>
  );
}
