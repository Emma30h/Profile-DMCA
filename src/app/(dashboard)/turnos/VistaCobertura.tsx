"use client";

import { useState } from "react";
import {
  obtenerCoberturas,
  crearCobertura,
  actualizarCobertura,
  eliminarCobertura,
  type TipoCobertura,
  type CoberturaTurnoInfo,
  type AgenteElegibleCobertura,
} from "@/app/actions/coberturas";
import { ZONAS_CORDOBA_CAPITAL } from "@/lib/coberturaZonas";
import { fmtMes, SelectorAgenteModal } from "./VistaTurnos";
import { Spinner } from "@/components/ui/Spinner";

interface Props {
  tipo: TipoCobertura;
  campoLabel: string; // "Dependencia" | "Avenida"
  campoPlaceholder: string;
  labelElegibles: string; // "Directores y Jefes" | "Personal habilitado"
  elegibles: AgenteElegibleCobertura[];
  anioInicial: number;
  mesInicial: number;
  datosIniciales: CoberturaTurnoInfo[];
  canEdit: boolean;
}

interface FormState {
  fecha: string;
  horarioDesde: string;
  horarioHasta: string;
  agenteId: string;
  nombreManual: string | null;
  lugar: string;
  zona: string;
  telefono: string;
  observacion: string;
}

// Si el mes que se está mirando es el actual, arranca en el día de hoy;
// si no, en el 1° del mes — siempre un valor válido dentro del período visible.
function fechaPorDefecto(anio: number, mes: number): string {
  const hoy = new Date();
  if (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) return hoy.toISOString().slice(0, 10);
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

function formVacio(anio: number, mes: number): FormState {
  return {
    fecha: fechaPorDefecto(anio, mes),
    horarioDesde: "",
    horarioHasta: "",
    agenteId: "",
    nombreManual: null,
    lugar: "",
    zona: "",
    telefono: "",
    observacion: "",
  };
}

function fmtFechaCorta(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

export default function VistaCobertura({
  tipo,
  campoLabel,
  campoPlaceholder,
  labelElegibles,
  elegibles,
  anioInicial,
  mesInicial,
  datosIniciales,
  canEdit,
}: Props) {
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState(mesInicial);
  const [datos, setDatos] = useState<CoberturaTurnoInfo[]>(datosIniciales);
  const [cargando, setCargando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => formVacio(anioInicial, mesInicial));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cambiarMes(direccion: -1 | 1) {
    setCargando(true);
    let nuevoAnio = anio;
    let nuevoMes = mes + direccion;
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio -= 1; }
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio += 1; }
    const fresh = await obtenerCoberturas(tipo, nuevoAnio, nuevoMes);
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    setDatos(fresh);
    setCargando(false);
  }

  // Si el modal se cierra sin guardar (overlay, Cancelar, gesto accidental en
  // mobile), el borrador queda en el estado `form` y `editandoId` — solo se
  // pisa acá cuando el contexto cambia (pasar de editar a "nuevo", o editar
  // un ítem distinto al que ya se estaba editando), para no perder lo cargado.
  function abrirNuevo() {
    if (editandoId !== null) {
      setForm(formVacio(anio, mes));
      setEditandoId(null);
    }
    setError(null);
    setMostrarForm(true);
  }

  function abrirEditar(item: CoberturaTurnoInfo) {
    if (editandoId !== item.id) {
      setForm({
        fecha: item.fecha,
        horarioDesde: item.horarioDesde,
        horarioHasta: item.horarioHasta,
        agenteId: item.agente?.id ?? "",
        nombreManual: item.nombreManual,
        lugar: item.lugar,
        zona: item.zona ?? "",
        telefono: item.telefono ?? "",
        observacion: item.observacion ?? "",
      });
      setEditandoId(item.id);
    }
    setError(null);
    setMostrarForm(true);
  }

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = editandoId
        ? await actualizarCobertura(editandoId, form)
        : await crearCobertura({ ...form, tipo });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const fresh = await obtenerCoberturas(tipo, anio, mes);
      setDatos(fresh);
      setMostrarForm(false);
      setForm(formVacio(anio, mes));
      setEditandoId(null);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id: string) {
    setError(null);
    setGuardando(true);
    try {
      const res = await eliminarCobertura(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const fresh = await obtenerCoberturas(tipo, anio, mes);
      setDatos(fresh);
      setConfirmarEliminarId(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-3 lg:p-5">
      {/* Navegación mes + agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            disabled={cargando}
            className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-[var(--c-text)] capitalize w-40 text-center">{fmtMes(anio, mes)}</h3>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            disabled={cargando}
            className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={abrirNuevo}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] text-white text-xs font-semibold px-3 py-1.5 transition-colors w-full sm:w-auto whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar
          </button>
        )}
      </div>

      {/* Lista del mes */}
      <div className="relative space-y-2">
        {datos.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)] text-center py-8">Sin registros cargados para {fmtMes(anio, mes)}.</p>
        ) : (
          datos.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--c-bg-elev-2)] p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tabular-nums">{fmtFechaCorta(item.fecha)}</span>
                  <span className="text-xs text-[var(--c-text-faint)] tabular-nums">{item.horarioDesde} a {item.horarioHasta} hs</span>
                </div>
                <p className="text-sm font-medium text-[var(--c-text)] truncate mt-1">
                  {item.agente?.nombreCompleto ?? item.nombreManual}
                </p>
                <p className="text-xs text-[var(--c-blue-soft)] mt-0.5">
                  {item.lugar}
                  {item.zona && <span className="text-[var(--c-text-faint)]"> · Zona {item.zona}</span>}
                </p>
                {item.telefono && <p className="text-xs text-[var(--c-text-faint)] mt-0.5">📞 {item.telefono}</p>}
                {item.observacion && <p className="text-xs text-[var(--c-text-faint)] mt-1">{item.observacion}</p>}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEditar(item)}
                    aria-label="Editar"
                    className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarEliminarId(item.id)}
                    aria-label="Eliminar"
                    className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-coral)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.867 12.142A2 2 0 0115.138 21H8.862a2 2 0 01-1.995-1.858L6 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
        {cargando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[var(--c-bg-elev)]/70">
            <Spinner size={24} className="text-[var(--c-blue)]" />
          </div>
        )}
      </div>

      {/* Modal agregar/editar */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => !guardando && setMostrarForm(false)}>
          <form
            onSubmit={handleGuardar}
            className="w-full max-w-sm rounded-xl border border-[var(--c-line)] bg-[var(--c-bg-elev)] p-5 space-y-3 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-[var(--c-text)] mb-1">
              {editandoId ? "Editar" : "Agregar"} registro
            </h4>

            <div>
              <label className="block text-xs text-[var(--c-text-muted)] mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                required
                disabled={guardando}
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">Horario desde</label>
                <input
                  type="time"
                  value={form.horarioDesde}
                  onChange={(e) => setForm((f) => ({ ...f, horarioDesde: e.target.value }))}
                  required
                  disabled={guardando}
                  className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">Horario hasta</label>
                <input
                  type="time"
                  value={form.horarioHasta}
                  onChange={(e) => setForm((f) => ({ ...f, horarioHasta: e.target.value }))}
                  required
                  disabled={guardando}
                  className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--c-text-muted)] mb-1">Personal</label>
              <SelectorAgenteModal
                value={form.agenteId}
                valorManual={form.nombreManual}
                placeholder={`Elegir de ${labelElegibles.toLowerCase()}`}
                principal={elegibles}
                labelPrincipal={labelElegibles}
                otros={[]}
                onChange={(v) => setForm((f) => ({ ...f, agenteId: v, nombreManual: v ? null : f.nombreManual }))}
                onChangeManual={(nombre) => setForm((f) => ({ ...f, agenteId: "", nombreManual: nombre }))}
                disabled={guardando}
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--c-text-muted)] mb-1">{campoLabel}</label>
              <input
                type="text"
                value={form.lugar}
                onChange={(e) => setForm((f) => ({ ...f, lugar: e.target.value }))}
                placeholder={campoPlaceholder}
                required
                disabled={guardando}
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
              />
            </div>

            {tipo === "LINEAL" && (
              <div>
                <label className="block text-xs text-[var(--c-text-muted)] mb-1">Zona (opcional)</label>
                <select
                  value={form.zona}
                  onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))}
                  disabled={guardando}
                  className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
                >
                  <option value="">Sin especificar</option>
                  {ZONAS_CORDOBA_CAPITAL.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-[var(--c-text-muted)] mb-1">Teléfono (opcional)</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="Ej. 351-6549382"
                disabled={guardando}
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--c-text-muted)] mb-1">Observación (opcional)</label>
              <input
                type="text"
                value={form.observacion}
                onChange={(e) => setForm((f) => ({ ...f, observacion: e.target.value }))}
                disabled={guardando}
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] disabled:opacity-60"
              />
            </div>

            {error && <p className="text-sm text-[var(--c-coral)]">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMostrarForm(false)}
                disabled={guardando}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmar eliminar */}
      {confirmarEliminarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarId(null)} />
          <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-[var(--c-text)]">Eliminar registro</h2>
            <p className="text-sm text-[var(--c-text-muted)]">¿Eliminás este registro? No se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmarEliminarId(null)} disabled={guardando} className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => handleEliminar(confirmarEliminarId)} disabled={guardando} className="rounded-lg bg-[var(--c-coral-strong)] hover:bg-[var(--c-coral-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{guardando ? "Eliminando..." : "Sí, eliminar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
