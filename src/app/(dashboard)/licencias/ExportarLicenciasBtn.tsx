"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, GripVertical, X, ArrowDownWideNarrow } from "lucide-react";
import { TIPO_LICENCIA_LABELS } from "@/types";
import { CAMPOS_NOMINA_META, GRUPOS_NOMINA } from "@/lib/personalLabels";
import { obtenerDatosNomina } from "@/app/actions/nomina";
import { obtenerRangosAgentes } from "@/app/actions/licencias";
import { ButtonSpinner } from "@/components/ui/Spinner";
import { TIPO_PERSONAL_LABEL, fmt, type LicenciaRow } from "./licenciasShared";

const ESTADO_LICENCIA_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
};

// Escalón jerárquico real entre tipos de personal (mayor = más alto):
// Seguridad (Oficiales y Suboficiales) > Técnico > Civil Policial > Civil
// Becario. Usado por "Ordenar por jerarquía" como criterio primario, antes
// del `orden` (por cuerpo) de Rango.
const ESCALON_TIPO_PERSONAL: Record<string, number> = {
  SEGURIDAD: 3,
  TECNICO: 2,
  CIVIL_POLICIAL: 1,
  CIVIL_BECARIO: 0,
};

const COLUMNAS_BASE: { id: string; label: string }[] = [
  { id: "agente", label: "Agente" },
  { id: "tipoPersonal", label: "Tipo de personal" },
  { id: "sector", label: "Sector" },
  { id: "tipo", label: "Tipo" },
  { id: "estado", label: "Estado" },
  { id: "desde", label: "Desde" },
  { id: "hasta", label: "Hasta" },
  { id: "dias", label: "Días" },
  { id: "motivo", label: "Motivo" },
];
const IDS_BASE = COLUMNAS_BASE.map((c) => c.id);

// "tipoPersonal"/"sector"/"estado" ya existen como columna propia de la
// licencia (con otro significado en el caso de "estado": el de la licencia,
// no el del agente) — se sacan del catálogo de campos adicionales para no
// ofrecer dos columnas con el mismo id.
const CAMPOS_AGENTE_EXCLUIR = new Set(["tipoPersonal", "sector", "estado"]);
const CAMPOS_AGENTE_EXTRA = CAMPOS_NOMINA_META.filter((c) => !CAMPOS_AGENTE_EXCLUIR.has(c.id));

const LABEL_POR_ID = new Map<string, string>([
  ...COLUMNAS_BASE.map((c) => [c.id, c.label] as const),
  ...CAMPOS_AGENTE_EXTRA.map((c) => [c.id, c.label] as const),
]);
function labelDe(id: string): string {
  return LABEL_POR_ID.get(id) ?? id;
}

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

type Accion = "excel";

interface Props {
  licencias: LicenciaRow[];
}

export default function ExportarLicenciasBtn({ licencias }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"elegir" | "previsualizar">("elegir");
  const [columnas, setColumnas] = useState<string[]>(IDS_BASE);
  const [filasPreview, setFilasPreview] = useState<Record<string, string>[] | null>(null);
  // agenteIdPreview[i] es el agente detrás de filasPreview[i] (una licencia
  // puede repetir agente) — se reordena en paralelo a las filas, y es lo que
  // permite "Ordenar por jerarquía" sin tener que rearmar toda la vista previa.
  const [agenteIdPreview, setAgenteIdPreview] = useState<string[] | null>(null);
  // tipoPersonalPreview[i] en paralelo también — el orden jerárquico real no
  // es solo el `orden` del rango (ver ordenarPorJerarquia): Seguridad va por
  // encima de Técnico aunque el cuerpo Técnico tenga números de orden más
  // altos, así que hace falta saber a qué tipo de personal pertenece cada
  // fila sin depender de que "Tipo de personal" esté entre las columnas
  // elegidas para exportar.
  const [tipoPersonalPreview, setTipoPersonalPreview] = useState<string[] | null>(null);
  const [filaArrastrada, setFilaArrastrada] = useState<number | null>(null);
  const [filaSobre, setFilaSobre] = useState<number | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [ordenandoJerarquia, setOrdenandoJerarquia] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuContextual, setMenuContextual] = useState<
    { tipo: "fila"; index: number; x: number; y: number } | { tipo: "columna"; id: string; x: number; y: number } | null
  >(null);
  const menuContextualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuContextual) return;
    function cerrar(e: MouseEvent) {
      if (menuContextualRef.current?.contains(e.target as Node)) return;
      setMenuContextual(null);
    }
    function cerrarSiempre() {
      setMenuContextual(null);
    }
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("scroll", cerrarSiempre, true);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("scroll", cerrarSiempre, true);
    };
  }, [menuContextual]);

  function toggleCampo(id: string) {
    setColumnas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function moverColumna(id: string, direccion: -1 | 1) {
    setColumnas((prev) => {
      const i = prev.indexOf(id);
      const j = i + direccion;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function quitarColumna(id: string) {
    setColumnas((prev) => prev.filter((x) => x !== id));
  }

  function moverFila(origen: number, destino: number) {
    if (origen === destino) return;
    function reordenar<T>(arr: T[]): T[] {
      const next = [...arr];
      const [movida] = next.splice(origen, 1);
      next.splice(destino, 0, movida);
      return next;
    }
    setFilasPreview((prev) => (prev ? reordenar(prev) : prev));
    setAgenteIdPreview((prev) => (prev ? reordenar(prev) : prev));
    setTipoPersonalPreview((prev) => (prev ? reordenar(prev) : prev));
  }

  function quitarFila(i: number) {
    setFilasPreview((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
    setAgenteIdPreview((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
    setTipoPersonalPreview((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
  }

  function abrir() {
    setError(null);
    setVista("elegir");
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setFilasPreview(null);
    setAgenteIdPreview(null);
    setTipoPersonalPreview(null);
  }

  function volverAElegir() {
    setVista("elegir");
    setFilasPreview(null);
    setAgenteIdPreview(null);
    setTipoPersonalPreview(null);
  }

  async function previsualizar() {
    if (columnas.length === 0 || licencias.length === 0) return;
    setCargandoPreview(true);
    setError(null);
    try {
      const idsExtra = columnas.filter((id) => !IDS_BASE.includes(id));
      let extraPorAgente = new Map<string, Record<string, string>>();
      if (idsExtra.length > 0) {
        const agenteIdsUnicos = Array.from(new Set(licencias.map((l) => l.agente.id)));
        const datos = await obtenerDatosNomina(agenteIdsUnicos, idsExtra);
        extraPorAgente = new Map(datos.ids.map((id, i) => [id, datos.filas[i]]));
      }

      const filas = licencias.map((l) => {
        const base: Record<string, string> = {
          agente: `${l.agente.apellidos}, ${l.agente.nombres}`,
          tipoPersonal: TIPO_PERSONAL_LABEL[l.agente.tipoPersonal] ?? l.agente.tipoPersonal,
          sector: l.agente.sector ?? "",
          tipo: TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo,
          estado: ESTADO_LICENCIA_LABEL[l.estado] ?? l.estado,
          desde: fmt(l.fechaInicio),
          hasta: fmt(l.fechaFin),
          dias: String(l.diasHabiles),
          motivo: l.motivo ?? "",
        };
        const extra = extraPorAgente.get(l.agente.id);
        const fila: Record<string, string> = {};
        for (const id of columnas) {
          fila[id] = IDS_BASE.includes(id) ? base[id] : extra?.[id] ?? "";
        }
        return fila;
      });

      setFilasPreview(filas);
      setAgenteIdPreview(licencias.map((l) => l.agente.id));
      setTipoPersonalPreview(licencias.map((l) => l.agente.tipoPersonal));
      setVista("previsualizar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la vista previa");
    } finally {
      setCargandoPreview(false);
    }
  }

  async function ordenarPorJerarquia() {
    if (!filasPreview || !agenteIdPreview || !tipoPersonalPreview) return;
    setOrdenandoJerarquia(true);
    setError(null);
    try {
      const filas = filasPreview;
      const agentes = agenteIdPreview;
      const tipos = tipoPersonalPreview;
      const idsUnicos = Array.from(new Set(agentes));
      const rangos = await obtenerRangosAgentes(idsUnicos);
      // El `orden` de Rango es una escala por cuerpo (Suboficial 1-8, Oficial
      // 9-18, Técnico 19-26 — ver prisma/schema.prisma), no comparable cruda
      // entre cuerpos: un Cabo Técnico (orden ~20) no está por encima de un
      // Oficial de Seguridad (orden ~15) en la jerarquía real. Primero se
      // ordena por el escalón de tipo de personal (Seguridad > Técnico >
      // Civil Policial > Civil Becario) y recién dentro de un mismo escalón
      // se desempata por `orden` descendente.
      const indices = filas.map((_, i) => i);
      indices.sort((a, b) => {
        const escalonB = ESCALON_TIPO_PERSONAL[tipos[b]] ?? -1;
        const escalonA = ESCALON_TIPO_PERSONAL[tipos[a]] ?? -1;
        if (escalonB !== escalonA) return escalonB - escalonA;
        return (rangos[agentes[b]]?.orden ?? -1) - (rangos[agentes[a]]?.orden ?? -1);
      });
      setFilasPreview(indices.map((i) => filas[i]));
      setAgenteIdPreview(indices.map((i) => agentes[i]));
      setTipoPersonalPreview(indices.map((i) => tipos[i]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ordenar por jerarquía");
    } finally {
      setOrdenandoJerarquia(false);
    }
  }

  function descargarCsv() {
    if (!filasPreview) return;
    const lineas = [
      columnas.map((id) => csvEscape(labelDe(id))),
      ...filasPreview.map((f) => columnas.map((id) => csvEscape(f[id] ?? ""))),
    ];
    const csv = lineas.map((l) => l.join(",")).join("\r\n");
    // BOM + "sep=,": sin el BOM Excel interpreta el archivo como Latin-1 y
    // rompe tildes/ñ; sin la directiva, la configuración regional argentina
    // (separador de listas ";") abre el .csv sin dividirlo en columnas.
    const blob = new Blob(["﻿sep=,\r\n" + csv], { type: "text/csv;charset=utf-8" });
    descargarBlob(blob, `licencias_${fechaHoy()}.csv`);
  }

  async function descargarExcel() {
    if (!filasPreview) return;
    setAccionEnCurso("excel");
    setError(null);
    try {
      const res = await fetch("/api/licencias/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnas: columnas.map((id) => ({ id, label: labelDe(id) })),
          filas: filasPreview,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "No se pudo generar el Excel");
      descargarBlob(await res.blob(), `licencias_${fechaHoy()}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel");
    } finally {
      setAccionEnCurso(null);
    }
  }

  const hayJerarquia = columnas.includes("rango");

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={licencias.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-1.5 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <Download className="h-4 w-4" />
        Exportar
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={cerrar} />

          <div
            className={`relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-h-[85vh] flex flex-col transition-[max-width] ${
              vista === "previsualizar" ? "max-w-4xl" : "max-w-lg"
            }`}
          >
            <div className="px-6 pt-6 pb-4">
              {vista === "previsualizar" && (
                <button
                  type="button"
                  onClick={volverAElegir}
                  className="inline-flex items-center gap-1 text-xs text-[var(--c-text-muted)] hover:text-[var(--c-text)] mb-2 transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                  Editar columnas
                </button>
              )}
              <h2 className="text-base font-semibold text-[var(--c-text)]">
                {vista === "elegir" ? "Exportar licencias" : "Vista previa"}
              </h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
                {vista === "elegir"
                  ? `Se incluirán las ${licencias.length} ${licencias.length === 1 ? "licencia listada con los filtros actuales" : "licencias listadas con los filtros actuales"}. Elegí las columnas.`
                  : "Usá las flechas para reordenar columnas, arrastrá una fila (desde el ícono ⠿) para reordenar a mano, y click derecho sobre una fila o columna para eliminarla."}
              </p>
              {vista === "previsualizar" && hayJerarquia && (
                <button
                  type="button"
                  onClick={ordenarPorJerarquia}
                  disabled={ordenandoJerarquia}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] hover:bg-[var(--c-line)] px-2.5 py-1 text-xs font-medium text-[var(--c-text-secondary)] transition-colors disabled:opacity-50"
                >
                  {ordenandoJerarquia ? <ButtonSpinner /> : <ArrowDownWideNarrow className="h-3.5 w-3.5" />}
                  Ordenar por jerarquía
                </button>
              )}
            </div>

            {vista === "elegir" ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-1.5">Datos de la licencia</h3>
                  <div className="space-y-0.5">
                    {COLUMNAS_BASE.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--c-bg-elev-2)] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={columnas.includes(c.id)}
                          onChange={() => toggleCampo(c.id)}
                          className="h-4 w-4 rounded border-[var(--c-line-strong)] bg-[var(--c-bg-elev-2)] text-[var(--c-blue)] focus:ring-2 focus:ring-[var(--c-blue)] focus:ring-offset-0"
                        />
                        <span className="text-sm text-[var(--c-text)]">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {GRUPOS_NOMINA.map((g) => {
                  const campos = CAMPOS_AGENTE_EXTRA.filter((c) => c.grupo === g.id);
                  if (campos.length === 0) return null;
                  return (
                    <div key={g.id}>
                      <h3 className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-1.5">{g.titulo}</h3>
                      <div className="space-y-0.5">
                        {campos.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--c-bg-elev-2)] cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={columnas.includes(c.id)}
                              onChange={() => toggleCampo(c.id)}
                              className="h-4 w-4 rounded border-[var(--c-line-strong)] bg-[var(--c-bg-elev-2)] text-[var(--c-blue)] focus:ring-2 focus:ring-[var(--c-blue)] focus:ring-offset-0"
                            />
                            <span className="text-sm text-[var(--c-text)]">{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto px-6">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] w-6" />
                      {columnas.map((id, i) => (
                        <th
                          key={id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setMenuContextual({ tipo: "columna", id, x: e.clientX, y: e.clientY });
                          }}
                          className="border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] px-2 py-1.5 text-left text-[var(--c-text)] whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moverColumna(id, -1)}
                              disabled={i === 0}
                              title="Mover a la izquierda"
                              className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] disabled:opacity-20 disabled:pointer-events-none"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverColumna(id, 1)}
                              disabled={i === columnas.length - 1}
                              title="Mover a la derecha"
                              className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] disabled:opacity-20 disabled:pointer-events-none"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                            <span className="mx-0.5">{labelDe(id)}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasPreview?.map((f, i) => (
                      <tr
                        key={i}
                        draggable
                        onDragStart={() => setFilaArrastrada(i)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (filaSobre !== i) setFilaSobre(i);
                        }}
                        onDragLeave={() => setFilaSobre((cur) => (cur === i ? null : cur))}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (filaArrastrada !== null) moverFila(filaArrastrada, i);
                          setFilaArrastrada(null);
                          setFilaSobre(null);
                        }}
                        onDragEnd={() => {
                          setFilaArrastrada(null);
                          setFilaSobre(null);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMenuContextual({ tipo: "fila", index: i, x: e.clientX, y: e.clientY });
                        }}
                        className={`cursor-grab active:cursor-grabbing odd:bg-[var(--c-bg-elev)] even:bg-[var(--c-bg-elev)]/60 ${
                          filaArrastrada === i ? "opacity-40" : ""
                        } ${filaSobre === i && filaArrastrada !== i ? "outline outline-2 outline-[var(--c-blue)] -outline-offset-2" : ""}`}
                      >
                        <td className="border border-[var(--c-bg-elev-2)] px-1 py-1 text-[var(--c-line-strong)]">
                          <GripVertical className="h-3.5 w-3.5" />
                        </td>
                        {columnas.map((id) => (
                          <td key={id} className="border border-[var(--c-bg-elev-2)] px-2 py-1 text-[var(--c-text-secondary)] whitespace-nowrap">
                            {f[id]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div className="mx-6 mt-3 rounded-lg bg-[var(--c-coral)]/10 border border-[var(--c-coral)]/30 px-3 py-2 text-sm text-[var(--c-coral)]">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-[var(--c-bg-elev-2)] mt-4">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors"
              >
                Cerrar
              </button>
              {vista === "elegir" ? (
                <button
                  type="button"
                  onClick={previsualizar}
                  disabled={columnas.length === 0 || cargandoPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {cargandoPreview && <ButtonSpinner />}
                  Vista previa
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={descargarCsv}
                    disabled={columnas.length === 0}
                    className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={descargarExcel}
                    disabled={columnas.length === 0 || accionEnCurso !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-green-strong)] hover:bg-[var(--c-green-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {accionEnCurso === "excel" && <ButtonSpinner />}
                    Excel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {menuContextual && createPortal(
        <div
          ref={menuContextualRef}
          className="fixed z-[60] rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] py-1 shadow-lg shadow-black/40"
          style={{ left: menuContextual.x, top: menuContextual.y }}
        >
          <button
            type="button"
            onClick={() => {
              if (menuContextual.tipo === "fila") quitarFila(menuContextual.index);
              else quitarColumna(menuContextual.id);
              setMenuContextual(null);
            }}
            className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-sm text-[var(--c-coral)] hover:bg-[var(--c-line)] whitespace-nowrap"
          >
            <X className="h-3 w-3" />
            {menuContextual.tipo === "fila" ? "Eliminar fila" : "Eliminar columna"}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
