"use client";

import { useState, useTransition } from "react";
import { crearSolicitudEdicion } from "@/app/actions/solicitudes";
import { formatFechaHora } from "@/lib/fecha";

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
  // Confirmar la solicitud pide la contraseña — mismo criterio que activar/
  // desactivar usuarios: dos pasos (confirmar → contraseña), sin código por
  // mail para no trabar la dinámica de algo que el propio agente pide sobre
  // su propio legajo.
  const [paso, setPaso] = useState<"confirmar" | "password">("confirmar");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [escribirMotivo, setEscribirMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");

  function handleAbrir() {
    setError(null);
    setPassword("");
    setMostrarPassword(false);
    setEscribirMotivo(false);
    setMotivo("");
    setPaso("confirmar");
    setModalAbierto(true);
  }

  function handleAvanzar() {
    setError(null);
    setPaso("password");
  }

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      const res = await crearSolicitudEdicion(password, escribirMotivo ? motivo : undefined);
      if (res.ok) {
        setEnviado(true);
        setModalAbierto(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (tienePermisoActivo && permisoHasta) {
    const fecha = formatFechaHora(permisoHasta);
    return (
      <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-green)]/10 border border-[var(--c-green)]/25 px-3 py-1.5 text-sm text-[var(--c-green)]">
        <span className="h-2 w-2 rounded-full bg-[var(--c-green)] shrink-0" />
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
        onClick={handleAbrir}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--c-blue-soft)] bg-[var(--c-blue)]/10 px-3 py-1.5 text-sm font-medium text-[var(--c-blue-soft)] hover:bg-[var(--c-blue)]/15 transition-colors"
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
          <div className="relative bg-[var(--c-bg-elev)] rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-blue)]/15">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--c-blue-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--c-text)]">Solicitar actualización de datos</h3>
                  <span className="text-xs text-[var(--c-text-faint)] shrink-0">Paso {paso === "confirmar" ? 1 : 2} de 2</span>
                </div>
                {paso === "confirmar" ? (
                  <>
                    <p className="mt-1 text-sm text-[var(--c-text-muted)]">
                      Vas a enviar una solicitud a los administradores para que te habiliten la edición de tu legajo por <strong>48 horas</strong>.
                    </p>
                    <p className="mt-2 text-sm text-[var(--c-text-muted)]">
                      Una vez aprobada, recibirás una notificación y un email con la confirmación.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--c-text-muted)]">
                    Confirmá tu contraseña para enviar la solicitud.
                  </p>
                )}
              </div>
            </div>

            {paso === "confirmar" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="toggle-motivo-edicion" className="text-sm text-[var(--c-text-secondary)]">
                    Escribir motivo de edición <span className="text-[var(--c-text-faint)] font-normal">(opcional)</span>
                  </label>
                  <button
                    id="toggle-motivo-edicion"
                    type="button"
                    role="switch"
                    aria-checked={escribirMotivo}
                    onClick={() => setEscribirMotivo((v) => !v)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:ring-offset-1 cursor-pointer ${
                      escribirMotivo ? "bg-[var(--c-blue)]" : "bg-[var(--c-line-strong)]"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        escribirMotivo ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {escribirMotivo && (
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                    autoFocus
                    placeholder="Ej: Me mudé y necesito actualizar mi domicilio."
                    className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] resize-none"
                  />
                )}
              </div>
            )}

            {paso === "password" && (
              <div>
                <label htmlFor="password-solicitud-edicion" className="block text-xs font-medium text-[var(--c-text-secondary)] mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password-solicitud-edicion"
                    type={mostrarPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                    className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2.5 pr-10 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--c-text-faint)] hover:text-[var(--c-text-muted)]"
                    tabIndex={-1}
                  >
                    {mostrarPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-[var(--c-coral)]/10 border border-[var(--c-coral)]/25 px-3 py-2 text-sm text-[var(--c-coral)]">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                disabled={pending}
                className="rounded-lg border border-[var(--c-line)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              {paso === "confirmar" ? (
                <button
                  type="button"
                  onClick={handleAvanzar}
                  className="rounded-lg bg-[var(--c-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--c-blue-strong)] transition-colors"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={pending || password.length === 0}
                  className="rounded-lg bg-[var(--c-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--c-blue-strong)] transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {pending && <Spinner />}
                  {pending ? "Enviando..." : "Confirmar solicitud"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
