"use client";

import { useState, useTransition } from "react";
import { crearFeriado, actualizarFeriado, eliminarFeriado } from "@/app/actions/feriados";

interface Feriado {
  id: string;
  fecha: Date;
  nombre: string;
  aplica: boolean;
}

function formatFecha(fecha: Date) {
  return new Date(fecha).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function GestorFeriados({ feriados: inicial }: { feriados: Feriado[] }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Agrupar por año
  const porAnio = inicial.reduce<Record<number, Feriado[]>>((acc, f) => {
    const anio = new Date(f.fecha).getUTCFullYear();
    if (!acc[anio]) acc[anio] = [];
    acc[anio].push(f);
    return acc;
  }, {});
  const anios = Object.keys(porAnio).map(Number).sort((a, b) => b - a);

  function handleCrear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await crearFeriado({
        fecha: fd.get("fecha") as string,
        nombre: fd.get("nombre") as string,
        aplica: fd.get("aplica") === "true",
      });
      if (res.ok) setMostrarForm(false);
      else setError(res.error);
    });
  }

  function handleEditar(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await actualizarFeriado(id, {
        fecha: fd.get("fecha") as string,
        nombre: fd.get("nombre") as string,
        aplica: fd.get("aplica") === "true",
      });
      if (res.ok) setEditandoId(null);
      else setError(res.error);
    });
  }

  function handleEliminar(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await eliminarFeriado(id);
      if (res.ok) setConfirmarEliminarId(null);
      else setError(res.error);
    });
  }

  return (
    <div>
      {/* Aviso de funcionamiento */}
      <div className="mx-6 mt-4 rounded-lg bg-[var(--c-amber)]/10 border border-[var(--c-amber)]/20 px-4 py-3 text-sm text-[var(--c-amber)]">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <p className="text-xs text-[var(--c-amber)]">
          Los feriados marcados como <strong>&quot;Aplica&quot;</strong> se excluyen al calcular días hábiles en licencias.
          Los marcados como <strong>&quot;No aplica&quot;</strong> se trabajan como día normal y no descuentan días.
        </p>
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--c-bg-elev-2)] flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--c-text-secondary)]">
          {inicial.length} {inicial.length === 1 ? "feriado" : "feriados"} registrados
        </span>
        <button
          type="button"
          onClick={() => { setMostrarForm(true); setEditandoId(null); setError(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-3 py-1.5 text-sm font-medium text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar feriado
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-[var(--c-coral)]/10 border border-[var(--c-coral)]/25 px-4 py-3 text-sm text-[var(--c-coral)]">
          {error}
        </div>
      )}

      {/* Formulario nuevo feriado */}
      {mostrarForm && (
        <form onSubmit={handleCrear} className="px-6 py-4 border-b border-[var(--c-bg-elev-2)] bg-[var(--c-blue)]/10 space-y-3">
          <p className="text-sm font-medium text-[var(--c-text-secondary)]">Nuevo feriado</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">Fecha</label>
              <input
                type="date"
                name="fecha"
                required
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">Nombre</label>
              <input
                type="text"
                name="nombre"
                required
                placeholder="Ej: 25 de Mayo"
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">¿Descuenta días hábiles?</label>
              <select
                name="aplica"
                className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
              >
                <option value="true">Sí, aplica</option>
                <option value="false">No, se trabaja normal</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setMostrarForm(false); setError(null); }}
              disabled={pending}
              className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {pending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* Lista agrupada por año */}
      {inicial.length === 0 ? (
        <div className="px-6 py-12 text-center text-[var(--c-text-faint)] text-sm">
          No hay feriados registrados. Agregá el primero.
        </div>
      ) : (
        <div className="divide-y divide-[var(--c-bg-elev-2)]">
          {anios.map((anio) => (
            <div key={anio}>
              <div className="px-6 py-2 bg-[var(--c-bg)] border-b border-[var(--c-bg-elev-2)]">
                <span className="text-xs font-semibold text-[var(--c-text-muted)] uppercase tracking-wide">{anio}</span>
              </div>
              {porAnio[anio].map((f) => (
                <div key={f.id}>
                  {/* Modal confirmar eliminación */}
                  {confirmarEliminarId === f.id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarId(null)} />
                      <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                        <h2 className="text-base font-semibold text-[var(--c-text)]">Eliminar feriado</h2>
                        <p className="text-sm text-[var(--c-text-muted)]">
                          ¿Eliminás <span className="font-medium text-[var(--c-text)]">{f.nombre}</span>?
                          Esto puede afectar los cálculos de días hábiles de licencias existentes.
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmarEliminarId(null)}
                            disabled={pending}
                            className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(f.id)}
                            disabled={pending}
                            className="rounded-lg bg-[var(--c-coral-strong)] hover:bg-[var(--c-coral-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                          >
                            {pending ? "Eliminando..." : "Sí, eliminar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {editandoId === f.id ? (
                    <form
                      onSubmit={(e) => handleEditar(e, f.id)}
                      className="px-6 py-3 bg-yellow-500/10 border-b border-yellow-500/20 flex flex-wrap items-end gap-3"
                    >
                      <div>
                        <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">Fecha</label>
                        <input
                          type="date"
                          name="fecha"
                          defaultValue={f.fecha.toISOString().slice(0, 10)}
                          required
                          className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">Nombre</label>
                        <input
                          type="text"
                          name="nombre"
                          defaultValue={f.nombre}
                          required
                          className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--c-text-muted)] mb-1">¿Aplica?</label>
                        <select
                          name="aplica"
                          defaultValue={f.aplica ? "true" : "false"}
                          className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
                        >
                          <option value="true">Sí, aplica</option>
                          <option value="false">No aplica</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditandoId(null)}
                          disabled={pending}
                          className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-1.5 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                        >
                          {pending ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className={`px-6 py-3 flex items-center justify-between gap-4 hover:bg-[var(--c-bg-elev-2)] transition-colors ${pending ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${f.aplica ? "bg-[var(--c-coral)]/15 text-[var(--c-coral)]" : "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]"}`}>
                          {f.aplica ? "Aplica" : "No aplica"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--c-text)] truncate">{f.nombre}</p>
                          <p className="text-xs text-[var(--c-text-muted)] capitalize">{formatFecha(f.fecha)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setEditandoId(f.id); setMostrarForm(false); setError(null); }}
                          className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-text-muted)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmarEliminarId(f.id)}
                          className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-coral)] hover:bg-[var(--c-coral)]/10 transition-colors"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
