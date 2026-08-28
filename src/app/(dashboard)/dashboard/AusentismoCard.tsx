"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calcularAusentismoMensual,
  CAUSA_COLOR,
  labelDeCausa,
  type AusentismoMensual,
  type CausaAusentismo,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import InformeAusentismo from "./InformeAusentismo";
import { ButtonSpinner } from "@/components/ui/Spinner";
import { useEntrada } from "@/lib/useEntrada";
import { useCountUp } from "@/lib/useCountUp";

interface Tooltip {
  x: number;
  y: number;
  mes: AusentismoMensual;
  index: number;
}

const ALTURA_BARRAS = 200;
const ANCHO_COL = 40;
const GAP_COL = 2; // gap-0.5 entre columnas
const PITCH_COL = ANCHO_COL + GAP_COL;
const VENTANA_TENDENCIA = 3; // promedio móvil de 3 meses
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)

type ModoPeriodo = "todo" | "anio" | "rango";

function primerDiaMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

// Promedio móvil de ventana fija sobre el total mensual (no por causa):
// sigue de cerca los últimos meses en vez de una recta de regresión sobre
// todo el historial, que quedaría aplastada por los primeros meses (con muy
// pocos casos cargados) y diría poco sobre la tendencia reciente.
function calcularPromedioMovil(valores: number[], ventana: number): number[] {
  return valores.map((_, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const tramo = valores.slice(desde, i + 1);
    return tramo.reduce((suma, v) => suma + v, 0) / tramo.length;
  });
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
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

export default function AusentismoCard({ licencias, hoy }: { licencias: LicenciaAusentismoRow[]; hoy: string }) {
  const router = useRouter();
  // "hoy" viene del servidor (mismo snapshot que usó el resto del dashboard
  // para armar las stats), no de un `new Date()` acá — evita que el rango
  // "Todo el historial" difiera entre el render de servidor y la
  // hidratación si el reloj cruza medianoche justo en el medio.
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);

  const anios = useMemo(() => {
    const set = new Set(licencias.map((l) => new Date(l.fechaInicio).getUTCFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [licencias]);

  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [anio, setAnio] = useState<number | null>(null);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const anioActivo = anio ?? anios[0] ?? hoyDate.getUTCFullYear();

  function elegirPeriodo(valor: string) {
    if (valor === "todo") {
      setModo("todo");
      return;
    }
    if (valor === "rango") {
      setModo("rango");
      // Precarga el rango con el historial completo, para no arrancar con
      // los dos campos vacíos (y el gráfico vacío) hasta que el usuario
      // toque algo — mismo criterio que EstadisticasLicencias.tsx.
      if (!rangoDesde && !rangoHasta && licencias.length > 0) {
        const fechas = licencias.map((l) => l.fechaInicio.slice(0, 10)).sort();
        setRangoDesde(fechas[0]);
        setRangoHasta(fechas[fechas.length - 1]);
      }
      return;
    }
    setModo("anio");
    setAnio(Number(valor));
  }

  const { desde, hasta } = useMemo(() => {
    if (modo === "anio") {
      return { desde: new Date(Date.UTC(anioActivo, 0, 1)), hasta: new Date(Date.UTC(anioActivo, 11, 1)) };
    }
    if (modo === "rango") {
      // Rango incompleto (los dos campos todavía vacíos): desde > hasta a
      // propósito, calcularAusentismoMensual lo resuelve como "sin meses".
      if (!rangoDesde || !rangoHasta) return { desde: new Date(1), hasta: new Date(0) };
      return { desde: primerDiaMes(new Date(rangoDesde)), hasta: primerDiaMes(new Date(rangoHasta)) };
    }
    // "todo": desde el mes de la licencia más antigua hasta el mes de hoy.
    if (licencias.length === 0) return { desde: hoyDate, hasta: hoyDate };
    const minFecha = licencias.reduce(
      (min, l) => (l.fechaInicio < min ? l.fechaInicio : min),
      licencias[0].fechaInicio
    );
    return { desde: primerDiaMes(new Date(minFecha)), hasta: primerDiaMes(hoyDate) };
  }, [modo, anioActivo, rangoDesde, rangoHasta, licencias, hoyDate]);

  // Memoizado (no recalculado en cada render): onPointerMove del tooltip
  // dispara un setState por cada movimiento del mouse sobre el gráfico, y
  // calcularAusentismoMensual recorre todas las licencias — sin esto se
  // repetiría ese recorrido en cada píxel de movimiento.
  const ausentismo = useMemo(() => calcularAusentismoMensual(desde, hasta, licencias), [desde, hasta, licencias]);

  const [comoTabla, setComoTabla] = useState(false);
  const [mostrarTendencia, setMostrarTendencia] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [exportAbierto, setExportAbierto] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [errorExport, setErrorExport] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportAbierto) return;
    // Chequeo de contención (no un simple listener global): sin esto, el
    // mousedown sobre un ítem del propio menú lo cierra antes de que llegue
    // a dispararse su click — mismo bug ya resuelto en NominaBuilderBtn.tsx.
    function cerrar(e: MouseEvent) {
      if (exportMenuRef.current?.contains(e.target as Node)) return;
      setExportAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [exportAbierto]);

  const { meses, escalaMax, causasPresentes, totalCantidad } = ausentismo;
  // Solo se monta cuando RevealOnScroll lo revela: no hace falta delayMs,
  // el propio montaje ya es el disparador de "empezar a tomar vida".
  const listo = useEntrada();
  const totalCantidadAnimado = useCountUp(totalCantidad);

  const totalPorCausa = new Map<CausaAusentismo, number>();
  for (const m of meses) {
    for (const c of causasPresentes) {
      totalPorCausa.set(c, (totalPorCausa.get(c) ?? 0) + m.porCausa[c]);
    }
  }

  const promedioMovil = calcularPromedioMovil(meses.map((m) => m.cantidad), VENTANA_TENDENCIA);

  // Líneas de referencia horizontales del eje Y, para que se pueda leer de
  // qué valores estamos hablando a simple vista, sin depender del hover.
  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });

  // Etiquetas directas (sin depender del hover): mes más reciente y pico —
  // mismo criterio que ya usa "Ingresos y bajas de personal", nunca un
  // número sobre cada barra.
  const ultimoIndex = meses.length - 1;
  let picoIndex = 0;
  for (let i = 1; i < meses.length; i++) {
    if (meses[i].cantidad > meses[picoIndex].cantidad) picoIndex = i;
  }

  // Misma forma que la vista "Ver como tabla": una fila por mes, una columna
  // por causa presente + total. Se arma una sola vez y la reusan CSV, Excel
  // e Imprimir en vez de recorrer meses/causasPresentes en cada handler.
  const columnasExport = [
    { id: "mes", label: "Mes" },
    ...causasPresentes.map((c) => ({ id: c, label: labelDeCausa(c) })),
    { id: "total", label: "Total" },
  ];
  const filasExport: Record<string, string>[] = meses.map((m) => ({
    mes: m.mesLargo,
    ...Object.fromEntries(causasPresentes.map((c) => [c, String(m.porCausa[c] || "")])),
    total: String(m.cantidad),
  }));

  function descargarCsv() {
    setExportAbierto(false);
    const lineas = [
      columnasExport.map((c) => csvEscape(c.label)),
      ...filasExport.map((f) => columnasExport.map((c) => csvEscape(f[c.id] ?? ""))),
    ];
    const csv = lineas.map((l) => l.join(",")).join("\r\n");
    // BOM al inicio: sin esto Excel interpreta el archivo como Latin-1 y
    // rompe tildes/ñ (mismo motivo que en NominaBuilderBtn.tsx). Directiva
    // "sep=,": sin esto, Excel con configuración regional argentina (usa
    // "," como separador decimal y ";" como separador de listas) abre el
    // .csv sin dividirlo en columnas — toda la fila queda pegada en A. La
    // directiva le fuerza el separador real del archivo sin importar la
    // configuración regional de quien lo abre.
    const blob = new Blob(["﻿sep=,\r\n" + csv], { type: "text/csv;charset=utf-8" });
    descargarBlob(blob, `ausentismo_por_causa_${fechaHoy()}.csv`);
  }

  async function descargarExcel() {
    setExportAbierto(false);
    setDescargandoExcel(true);
    setErrorExport(null);
    try {
      const res = await fetch("/api/dashboard/ausentismo/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnas: columnasExport, filas: filasExport }),
      });
      if (!res.ok) throw new Error((await res.text()) || "No se pudo generar el Excel");
      descargarBlob(await res.blob(), `ausentismo_por_causa_${fechaHoy()}.xlsx`);
    } catch (e) {
      setErrorExport(e instanceof Error ? e.message : "No se pudo generar el Excel");
    } finally {
      setDescargandoExcel(false);
    }
  }

  function imprimir() {
    setExportAbierto(false);
    window.print();
  }

  // Distinto de "sin datos en el período elegido" (ver más abajo): acá no
  // hay NADA cargado en todo el sistema, así que ni el selector de período
  // tiene sentido (no hay años entre los que elegir).
  if (licencias.length === 0) {
    return (
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Ausentismo por causa</h3>
        <p className="text-[12.5px] text-[var(--c-text-faint)]">Todavía no hay licencias aprobadas cargadas.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Ausentismo por causa</h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative">
            <select
              value={modo === "anio" ? String(anioActivo) : modo}
              onChange={(e) => elegirPeriodo(e.target.value)}
              className="text-[11px] font-semibold text-[var(--c-text-muted)] bg-[var(--c-bg-elev)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
            >
              <option value="todo">Todo el historial</option>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              <option value="rango">Seleccionar período…</option>
            </select>
            {modo === "rango" && (
              <div className="absolute left-0 top-full mt-1 z-30 flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40 whitespace-nowrap">
                <input
                  type="date"
                  value={rangoDesde}
                  onChange={(e) => setRangoDesde(e.target.value)}
                  className="rounded-md border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2 py-1 text-[11px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
                />
                <span className="text-[var(--c-text-faint)] text-[11px]">→</span>
                <input
                  type="date"
                  value={rangoHasta}
                  onChange={(e) => setRangoHasta(e.target.value)}
                  className="rounded-md border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2 py-1 text-[11px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
                />
              </div>
            )}
          </div>
          {!comoTabla && (
            <button
              type="button"
              onClick={() => setMostrarTendencia((v) => !v)}
              aria-pressed={mostrarTendencia}
              className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                mostrarTendencia
                  ? "bg-[var(--c-blue)] text-white border-[var(--c-blue)]"
                  : "text-[var(--c-text-muted)] border-[var(--c-line)] hover:text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
              }`}
            >
              Tendencia
            </button>
          )}
          <button
            type="button"
            onClick={() => setComoTabla((v) => !v)}
            className="text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
          >
            {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportAbierto((v) => !v)}
              disabled={descargandoExcel}
              aria-expanded={exportAbierto}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors disabled:opacity-50"
            >
              {descargandoExcel && <ButtonSpinner />}
              Exportar
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {exportAbierto && (
              <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] py-1 shadow-lg shadow-black/40">
                <button
                  type="button"
                  onClick={imprimir}
                  title='Antes de imprimir, desmarcá "Encabezados y pies de página" en el diálogo del navegador. Para PDF, elegí "Guardar como PDF" como destino.'
                  className="block w-full text-left px-3 py-1.5 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-[var(--c-text)]"
                >
                  🖨️ Imprimir / PDF
                </button>
                <button
                  type="button"
                  onClick={descargarCsv}
                  className="block w-full text-left px-3 py-1.5 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-[var(--c-text)]"
                >
                  Descargar CSV
                </button>
                <button
                  type="button"
                  onClick={descargarExcel}
                  className="block w-full text-left px-3 py-1.5 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-[var(--c-text)]"
                >
                  Descargar Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {errorExport && (
        <div className="mb-3.5 rounded-lg bg-[var(--c-coral)]/10 border border-[var(--c-coral)]/30 px-3 py-2 text-[11.5px] text-[var(--c-coral)]">
          {errorExport}
        </div>
      )}
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Cantidad de licencias por mes, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total. &quot;Otros&quot; agrupa matrimonio, estímulo, antigüedad policial, examen en cursos no policiales, retiro voluntario, excepcional remunerada, adscripción y sanción.
      </p>

      {meses.length === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin licencias en el período elegido.</p>
      ) : (
        <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {causasPresentes.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAUSA_COLOR[c] }} />
            {labelDeCausa(c)}
            <b className="text-[var(--c-text)] font-bold tabular-nums">{totalPorCausa.get(c) ?? 0}</b>
          </span>
        ))}
      </div>

      <div className="overflow-hidden" style={{ height: 260 }}>
        <div className={`dashboard-slide-track h-full ${comoTabla ? "mostrar-detalle" : ""}`}>
          <div className="dashboard-slide-pane">
            <div className="flex items-start gap-2.5">
              <div
                className="relative shrink-0 w-7 text-right text-[10px] text-[var(--c-text-faint)]"
                style={{ height: ALTURA_BARRAS }}
              >
                {lineasGrilla.map(({ frac, valor }) => (
                  <span
                    key={frac}
                    className="absolute right-0 tabular-nums whitespace-nowrap"
                    style={{
                      top: `${(1 - frac) * ALTURA_BARRAS}px`,
                      transform: frac === 1 ? "translateY(0)" : frac === 0 ? "translateY(-100%)" : "translateY(-50%)",
                    }}
                  >
                    {valor}
                  </span>
                ))}
              </div>

              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <div className="relative" style={{ width: "max-content", height: ALTURA_BARRAS }}>
                <div
                  className="absolute left-0 top-0 pointer-events-none"
                  style={{ width: meses.length * PITCH_COL, height: ALTURA_BARRAS }}
                >
                  {lineasGrilla.map(({ frac }) => (
                    <div
                      key={frac}
                      className="absolute left-0 right-0 border-t border-[var(--c-line)]"
                      style={{ top: `${(1 - frac) * ALTURA_BARRAS}px`, opacity: 0.5 }}
                    />
                  ))}
                </div>
                <div className="relative flex items-end gap-0.5 h-full">
                  {meses.map((m, i) => {
                    const clickable = m.ids.length > 0;
                    const destacado = i === picoIndex || i === ultimoIndex;
                    return (
                      <div
                        key={m.key}
                        className={`flex flex-col items-center justify-end h-full rounded-t-[4px] transition-colors ${
                          hoverKey === m.key ? "bg-[var(--c-bg-elev-2)]/70" : ""
                        } ${clickable ? "cursor-pointer" : ""}`}
                        style={{ flex: `0 0 ${ANCHO_COL}px`, width: ANCHO_COL }}
                        onPointerEnter={(e) => {
                          setHoverKey(m.key);
                          setTooltip({ x: e.clientX, y: e.clientY, mes: m, index: i });
                        }}
                        onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, mes: m, index: i })}
                        onPointerLeave={() => {
                          setHoverKey(null);
                          setTooltip(null);
                        }}
                        onDoubleClick={() => {
                          if (clickable) router.push(`/personal?${buildQueryString({ ids: m.ids.join(",") })}`);
                        }}
                      >
                        {destacado && m.cantidad > 0 && (
                          <span className="text-[10px] font-bold text-[var(--c-text)] mb-1 whitespace-nowrap">{m.cantidad}</span>
                        )}
                        <div
                          className="flex flex-col-reverse items-center overflow-hidden rounded-t-[3px]"
                          style={{ width: "min(22px, 100%)" }}
                        >
                          {causasPresentes.map((c) => {
                            const cantidad = m.porCausa[c];
                            if (cantidad <= 0) return null;
                            return (
                              <div
                                key={c}
                                className="w-full"
                                style={{
                                  height: listo ? `${(cantidad / escalaMax) * ALTURA_BARRAS}px` : 0,
                                  background: CAUSA_COLOR[c],
                                  filter: hoverKey === m.key ? "brightness(1.2)" : undefined,
                                  transition: `filter 150ms, height 550ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 24) * 20}ms`,
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {mostrarTendencia && (
                  <svg
                    className="absolute left-0 top-0 pointer-events-none"
                    width={meses.length * PITCH_COL}
                    height={ALTURA_BARRAS}
                    style={{ overflow: "visible" }}
                  >
                    <polyline
                      points={promedioMovil
                        .map((v, i) => `${i * PITCH_COL + ANCHO_COL / 2},${ALTURA_BARRAS - (v / escalaMax) * ALTURA_BARRAS}`)
                        .join(" ")}
                      fill="none"
                      stroke="var(--c-text)"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {promedioMovil.map((v, i) => (
                      <circle
                        key={meses[i].key}
                        cx={i * PITCH_COL + ANCHO_COL / 2}
                        cy={ALTURA_BARRAS - (v / escalaMax) * ALTURA_BARRAS}
                        r={2.5}
                        fill="var(--c-text)"
                      />
                    ))}
                  </svg>
                )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 mt-1.5">
              <div className="shrink-0 w-7" />
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <div className="flex gap-0.5" style={{ width: "max-content" }}>
                  {meses.map((m) => (
                    <span
                      key={m.key}
                      className="text-[10.5px] text-[var(--c-text-faint)] text-center whitespace-nowrap"
                      style={{ flex: `0 0 ${ANCHO_COL}px`, width: ANCHO_COL }}
                    >
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-slide-pane h-full overflow-y-auto pr-3">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] sticky top-0 bg-[var(--c-bg-elev)]">
                    Mes
                  </th>
                  {causasPresentes.map((c) => (
                    <th
                      key={c}
                      className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums sticky top-0 bg-[var(--c-bg-elev)] whitespace-nowrap"
                    >
                      {labelDeCausa(c)}
                    </th>
                  ))}
                  <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums sticky top-0 bg-[var(--c-bg-elev)]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => {
                  const clickable = m.ids.length > 0;
                  return (
                    <tr
                      key={m.key}
                      onDoubleClick={() => {
                        if (clickable) router.push(`/personal?${buildQueryString({ ids: m.ids.join(",") })}`);
                      }}
                      className={clickable ? "cursor-pointer hover:bg-[var(--c-bg-elev-2)]/40" : ""}
                    >
                      <td className="py-2 border-b border-[var(--c-bg-elev-2)] text-[var(--c-text)]">{m.mesLargo}</td>
                      {causasPresentes.map((c) => (
                        <td key={c} className="py-2 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text-secondary)] tabular-nums">
                          {m.porCausa[c] || "—"}
                        </td>
                      ))}
                      <td className="py-2 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text)] font-medium tabular-nums">
                        {m.cantidad}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{tooltip.mes.mesLargo}</div>
          {causasPresentes.map((c) => {
            const cantidad = tooltip.mes.porCausa[c];
            if (cantidad <= 0) return null;
            return (
              <div key={c} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAUSA_COLOR[c] }} />
                <span className="font-bold tabular-nums">{cantidad}</span>
                <span className="text-[var(--c-text-faint)]">{labelDeCausa(c)}</span>
              </div>
            );
          })}
          <div className="mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">
            <span className="font-bold tabular-nums">{tooltip.mes.cantidad}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">Total del mes</span>
          </div>
          {mostrarTendencia && (
            <div>
              <span className="font-bold tabular-nums">{promedioMovil[tooltip.index].toFixed(1)}</span>
              <span className="text-[var(--c-text-faint)] ml-1.5">Tendencia (prom. 3 meses)</span>
            </div>
          )}
        </div>
      )}

      <InformeAusentismo
        meses={meses}
        causasPresentes={causasPresentes}
        totalPorCausa={totalPorCausa}
        totalCantidad={totalCantidad}
        picoIndex={picoIndex}
        escalaMax={escalaMax}
        labelDeCausa={labelDeCausa}
      />
        </>
      )}
    </div>
  );
}
