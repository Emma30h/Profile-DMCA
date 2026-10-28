"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiarEstadoAgente, actualizarFechaVigenciaEstado } from "@/app/actions/estado";
import { formatFechaHora } from "@/lib/fecha";
import { COMISION_DESTINO_101 } from "@/types";

const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  ACTIVO: "bg-[var(--c-green)]/15 text-[var(--c-green)]",
  BAJA: "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]",
  PASE: "bg-[var(--c-blue)]/15 text-[var(--c-blue-soft)]",
  EN_COMISION: "bg-[var(--c-amber)]/15 text-[var(--c-amber)]",
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACTIVO: "Activo",
  BAJA: "Baja",
  PASE: "Pase",
  EN_COMISION: "En comisión",
};

const OPCIONES = [
  { value: "ACTIVO", label: "Activo" },
  { value: "BAJA", label: "Baja" },
  { value: "PASE", label: "Pase" },
  { value: "EN_COMISION", label: "En comisión" },
];

const REQUIERE_MOTIVO = ["BAJA", "PASE"];

const TURNOS = ["A", "B", "C", "D", "E", "F", "ADMINISTRATIVO", "FULL TIME", "GUARDIA LARGA", "SUPERIOR DE TURNO", "PERSONAL INGRESANTE"];

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] bg-[var(--c-bg-elev)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent";

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
  // Destino de la comisión: el 101 (dentro del 911) por defecto, u otra
  // dependencia en texto libre.
  const [destinoEs101, setDestinoEs101] = useState(true);
  const [destinoOtro, setDestinoOtro] = useState("");
  // Turno a asignar cuando vuelve de una comisión.
  const [turno, setTurno] = useState("");
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
  const vuelveDeComision = estadoActual === "EN_COMISION" && nuevoEstado === "ACTIVO";

  function handleAbrir() {
    setNuevoEstado(opciones[0]?.value ?? "");
    setMotivo("");
    setFecha(hoyLocalISO());
    setDestinoEs101(true);
    setDestinoOtro("");
    setTurno("");
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
      const res = await actualizarFechaVigenciaEstado(agenteId, nuevaFechaVigencia);
      if (res.ok) {
        // new Date("yyyy-mm-dd") interpreta el string como medianoche UTC,
        // igual que el server action — así el texto queda consistente con
        // lo que va a devolver el próximo fetch.
        setDesdeOverride(new Date(nuevaFechaVigencia).toISOString());
        setEditandoFecha(false);
        router.refresh();
      } else {
        setErrorFecha(res.error);
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
    const esComision = nuevoEstado === "EN_COMISION";
    const destino = destinoEs101 ? COMISION_DESTINO_101 : destinoOtro.trim();
    if (esComision && !destino) {
      setError("Indicá a qué dependencia pasa en comisión.");
      return;
    }
    if (vuelveDeComision && !turno) {
      setError("Elegí un turno, o \"Sin turno\" si todavía no tiene.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoAgente(agenteId, nuevoEstado, motivo.trim() || undefined, fecha, {
        destino: esComision ? destino : undefined,
        turno: vuelveDeComision ? turno : undefined,
      });
      if (res.ok) {
        setAbierto(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${
          ESTADO_BADGE[estadoActual] ?? "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]"
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
          <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--c-text)]">Cambiar estado del legajo</h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
                Estado actual:{" "}
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[estadoActual] ?? "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]"}`}>
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
                        className="rounded-lg border border-[var(--c-line)] px-2 py-1 text-xs text-[var(--c-text)] bg-[var(--c-bg-elev)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent [color-scheme:dark]"
                      />
                      <button
                        type="button"
                        onClick={handleGuardarFecha}
                        disabled={pendingFecha || !nuevaFechaVigencia}
                        className="text-xs font-medium text-[var(--c-blue-text)] hover:text-[var(--c-blue-soft)] disabled:opacity-50"
                      >
                        {pendingFecha ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditandoFecha(false); setErrorFecha(null); }}
                        disabled={pendingFecha}
                        className="text-xs font-medium text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)] disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                    {errorFecha && <p className="text-xs text-[var(--c-coral)]">{errorFecha}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--c-text-faint)] mt-1.5">
                    Vigente desde {formatFechaHora(desdeMostrado, { utc: true, separador: " " })}
                    {motivoVigente && <> — <span className="text-[var(--c-text-muted)]">{motivoVigente}</span></>}{" "}
                    <button
                      type="button"
                      onClick={handleAbrirEditarFecha}
                      className="text-[var(--c-blue-text)] hover:text-[var(--c-blue-soft)] underline underline-offset-2"
                    >
                      editar fecha
                    </button>
                  </p>
                )
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">Nuevo estado</label>
                <select
                  value={nuevoEstado}
                  onChange={(e) => {
                    setNuevoEstado(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] bg-[var(--c-bg-elev)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent"
                >
                  {opciones.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">
                  Fecha efectiva
                  <span className="text-[var(--c-coral)] ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] bg-[var(--c-bg-elev)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent [color-scheme:dark]"
                />
                <p className="text-[11px] text-[var(--c-text-faint)] mt-1">
                  Podés poner una fecha pasada si estás cargando el cambio con demora — el dashboard usa esta fecha, no la de hoy.
                </p>
              </div>

              {nuevoEstado === "EN_COMISION" && (
                <div>
                  <label className="block text-xs text-[var(--c-text-muted)] mb-1">
                    Destino de la comisión
                    <span className="text-[var(--c-coral)] ml-0.5">*</span>
                  </label>
                  <select
                    value={destinoEs101 ? "101" : "OTRO"}
                    onChange={(e) => {
                      setDestinoEs101(e.target.value === "101");
                      setError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="101">{COMISION_DESTINO_101}</option>
                    <option value="OTRO">Otra dependencia…</option>
                  </select>
                  {!destinoEs101 && (
                    <input
                      type="text"
                      value={destinoOtro}
                      onChange={(e) => {
                        setDestinoOtro(e.target.value);
                        setError(null);
                      }}
                      placeholder="Nombre de la dependencia..."
                      className={`${INPUT_CLASS} mt-2`}
                    />
                  )}
                  <p className="text-[11px] text-[var(--c-text-faint)] mt-1">
                    Al pasar en comisión se lo saca del turno.
                  </p>
                </div>
              )}

              {vuelveDeComision && (
                <div>
                  <label className="block text-xs text-[var(--c-text-muted)] mb-1">
                    Turno asignado
                    <span className="text-[var(--c-coral)] ml-0.5">*</span>
                  </label>
                  <select
                    value={turno}
                    onChange={(e) => {
                      setTurno(e.target.value);
                      setError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    <option value="">Elegí un turno…</option>
                    <option value="SIN_TURNO">Sin turno</option>
                    {TURNOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">
                  {nuevoEstado === "EN_COMISION" ? "Detalle (opcional)" : "Motivo"}
                  {REQUIERE_MOTIVO.includes(nuevoEstado) && (
                    <span className="text-[var(--c-coral)] ml-0.5">*</span>
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
                  className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-[var(--c-coral)]">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCerrar}
                disabled={pending}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={pending || !nuevoEstado}
                className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
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
