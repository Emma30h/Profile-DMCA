"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RolUsuario } from "@/types";
import type { AgenteResumen } from "@/app/(dashboard)/personal/lib";
import { CAMPOS_NOMINA_META, GRUPOS_NOMINA, CAMPOS_NOMINA_DEFAULT } from "@/lib/personalLabels";
import { obtenerDatosNomina } from "@/app/actions/nomina";
import { ButtonSpinner } from "@/components/ui/Spinner";

// Limpieza de una versión anterior de este componente, que usaba una clase
// en <body> para colapsar el resto de la app durante la impresión — se
// descartó ese enfoque (rompía otras impresiones de la app, ver historial),
// pero por las dudas se saca cualquier rastro que haya quedado pegado.
if (typeof window !== "undefined") {
  document.body.classList.remove("imprimiendo-nomina");
}

function IconChevronLeft() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconTabla() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M9 10v10" />
    </svg>
  );
}

function IconGrip() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

const METADATA_POR_ID = new Map(CAMPOS_NOMINA_META.map((c) => [c.id, c]));
function labelDe(id: string): string {
  return METADATA_POR_ID.get(id)?.label ?? id;
}

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function construirCsv(columnas: string[], filas: Record<string, string>[]): string {
  const lineas = [
    columnas.map((id) => csvEscape(labelDe(id))),
    ...filas.map((f) => columnas.map((id) => csvEscape(f[id] ?? ""))),
  ];
  return lineas.map((l) => l.join(",")).join("\r\n");
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
  agentes: AgenteResumen[];
  rol: RolUsuario;
}

export default function NominaBuilderBtn({ agentes, rol }: Props) {
  const esOperador = rol === "OPERADOR";
  const camposVisibles = CAMPOS_NOMINA_META.filter((c) => !(esOperador && c.grupo === "armamento"));
  const gruposVisibles = GRUPOS_NOMINA.filter((g) => !(esOperador && g.id === "armamento"));

  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"elegir" | "previsualizar">("elegir");
  // Array (no Set): el orden importa — es el orden en que se exportan las
  // columnas, y el usuario lo puede cambiar en la vista previa.
  const [columnas, setColumnas] = useState<string[]>(CAMPOS_NOMINA_DEFAULT);
  const [filasPreview, setFilasPreview] = useState<Record<string, string>[] | null>(null);
  // idsPreview[i] es el agente detrás de filasPreview[i] — se reordena en
  // paralelo al arrastrar filas, para que el Excel (que se regenera aparte
  // en el servidor) también respete el orden a mano, no solo CSV/imprimir
  // que ya usan filasPreview directamente.
  const [idsPreview, setIdsPreview] = useState<string[] | null>(null);
  const [filaArrastrada, setFilaArrastrada] = useState<number | null>(null);
  const [filaSobre, setFilaSobre] = useState<number | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imprimirPendiente, setImprimirPendiente] = useState(false);
  const [printContainer, setPrintContainer] = useState<HTMLDivElement | null>(null);
  // Click derecho sobre una fila o columna de la vista previa — reemplaza
  // los botones ✕ sueltos (quedaban muy cerca de las flechas de reordenar,
  // fáciles de tocar sin querer).
  const [menuContextual, setMenuContextual] = useState<
    { tipo: "fila"; index: number; x: number; y: number } | { tipo: "columna"; id: string; x: number; y: number } | null
  >(null);

  const hayPreview = filasPreview !== null;

  useEffect(() => {
    // Solo existe en el DOM mientras hay una vista previa activa (no todo
    // el ciclo de vida del componente, que persiste mientras se navega
    // dentro de /personal): la regla CSS que colapsa "todo lo demás" al
    // imprimir (ver .print-nomina en globals.css) se activa apenas existe
    // un nodo con esta clase en la página, sin importar qué se esté
    // imprimiendo — si quedara montado después de cerrar el modal,
    // secuestraría cualquier otra impresión de la app (ej. el informe de
    // ausentismo) mostrando la nómina vieja en vez de nada.
    if (!hayPreview) return;
    // Se inserta a mano como PRIMER hijo de body (no al final, que es donde
    // createPortal apendearía por defecto): visibility:hidden en @media
    // print no libera el espacio que ocupa el resto de la app, así que si
    // esta tabla queda después de todo lo demás en el DOM, la vista previa
    // de impresión arranca con varias páginas en blanco antes de mostrar
    // contenido. Yendo primera, no hay nada invisible antes empujándola.
    const el = document.createElement("div");
    el.className = "print-nomina p-6";
    document.body.insertBefore(el, document.body.firstChild);
    setPrintContainer(el);
    return () => {
      document.body.removeChild(el);
      setPrintContainer(null);
    };
  }, [hayPreview]);

  useEffect(() => {
    if (!menuContextual) return;
    function cerrar() {
      setMenuContextual(null);
    }
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("scroll", cerrar, true);
    };
  }, [menuContextual]);

  useEffect(() => {
    if (!imprimirPendiente) return;
    setImprimirPendiente(false);
    // Los datos ya están en el estado (vista previa), pero igual hay que
    // esperar el commit+paint de React antes de abrir el diálogo, o se
    // imprime la tabla en blanco.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [imprimirPendiente]);

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
    setIdsPreview((prev) => (prev ? reordenar(prev) : prev));
  }

  function quitarFila(i: number) {
    setFilasPreview((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
    setIdsPreview((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
  }

  function abrir() {
    setError(null);
    setVista("elegir");
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    setFilasPreview(null);
    setIdsPreview(null);
  }

  function volverAElegir() {
    setVista("elegir");
    setFilasPreview(null);
    setIdsPreview(null);
  }

  const idsFiltrados = agentes.map((a) => a.id);

  async function previsualizar() {
    if (columnas.length === 0) return;
    setCargandoPreview(true);
    setError(null);
    try {
      const datos = await obtenerDatosNomina(idsFiltrados, columnas);
      setFilasPreview(datos.filas);
      setIdsPreview(datos.ids);
      setVista("previsualizar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la vista previa");
    } finally {
      setCargandoPreview(false);
    }
  }

  async function descargarExcel() {
    if (!idsPreview) return;
    setAccionEnCurso("excel");
    setError(null);
    try {
      const res = await fetch("/api/personal/nomina/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // idsPreview, no idsFiltrados: respeta el orden de filas que armó
        // el usuario a mano en la vista previa (o el alfabético si no tocó
        // nada), no el orden crudo del listado filtrado.
        body: JSON.stringify({ ids: idsPreview, campos: columnas }),
      });
      if (!res.ok) throw new Error((await res.text()) || "No se pudo generar el Excel");
      descargarBlob(await res.blob(), `nomina_${fechaHoy()}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el Excel");
    } finally {
      setAccionEnCurso(null);
    }
  }

  function descargarCsv() {
    if (!filasPreview) return;
    const blob = new Blob(["﻿" + construirCsv(columnas, filasPreview)], { type: "text/csv;charset=utf-8" });
    descargarBlob(blob, `nomina_${fechaHoy()}.csv`);
  }

  function imprimir() {
    if (!filasPreview) return;
    setImprimirPendiente(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={agentes.length === 0}
        className="shrink-0 inline-flex items-center gap-1.5 text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] border border-[var(--c-line)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        <IconTabla />
        Armar nómina
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
                  <IconChevronLeft />
                  Editar columnas
                </button>
              )}
              <h2 className="text-base font-semibold text-[var(--c-text)]">
                {vista === "elegir" ? "Armar nómina" : "Vista previa"}
              </h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
                {vista === "elegir"
                  ? `Se incluirán los ${agentes.length} ${agentes.length === 1 ? "agente actualmente listado" : "agentes actualmente listados"}. Elegí las columnas.`
                  : "Usá las flechas para reordenar columnas, arrastrá una fila (desde el ícono ⠿) para reordenar personal, y click derecho sobre una fila o columna para eliminarla."}
              </p>
            </div>

            {vista === "elegir" ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-4">
                {gruposVisibles.map((g) => (
                  <div key={g.id}>
                    <h3 className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-1.5">{g.titulo}</h3>
                    <div className="space-y-0.5">
                      {camposVisibles.filter((c) => c.grupo === g.id).map((c) => (
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
                ))}
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
                              <IconChevronLeft />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverColumna(id, 1)}
                              disabled={i === columnas.length - 1}
                              title="Mover a la derecha"
                              className="text-[var(--c-text-faint)] hover:text-[var(--c-text)] disabled:opacity-20 disabled:pointer-events-none"
                            >
                              <IconChevronRight />
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
                          <IconGrip />
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
                    onClick={imprimir}
                    disabled={columnas.length === 0}
                    className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors disabled:opacity-50"
                  >
                    Imprimir
                  </button>
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
            <IconX />
            {menuContextual.tipo === "fila" ? "Eliminar fila" : "Eliminar columna"}
          </button>
        </div>,
        document.body
      )}

      {printContainer && filasPreview && createPortal(
        <>
          <h1 className="text-lg font-bold mb-4">Nómina de personal — {fechaHoy()}</h1>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {columnas.map((id) => (
                  <th key={id} className="border border-[var(--c-text-secondary)] px-2 py-1 text-left bg-[var(--c-text)]">
                    {labelDe(id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasPreview.map((f, i) => (
                <tr key={i}>
                  {columnas.map((id) => (
                    <td key={id} className="border border-[var(--c-text-secondary)] px-2 py-1">
                      {f[id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>,
        printContainer
      )}
    </>
  );
}
