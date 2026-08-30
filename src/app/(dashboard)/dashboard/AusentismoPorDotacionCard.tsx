"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calcularAusentismoMensual,
  calcularAusentismoPorDotacion,
  type FilaAusentismoDotacion,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import type { FlujoPersonalStats } from "./stats";
import { useCountUp } from "@/lib/useCountUp";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

interface Tooltip {
  x: number;
  y: number;
  fila: FilaAusentismoDotacion;
}

const ALTURA = 200;
const ANCHO_COL = 40;
const GAP_COL = 2; // gap-0.5 entre columnas de la fila de etiquetas de abajo
const PITCH_COL = ANCHO_COL + GAP_COL;
const SEGMENTOS_GRILLA = 4;
const DURACION_ANIM = 400;
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Ignora a propósito los filtros de Turno/Sexo de la barra general: la
// dotación histórica (el denominador) solo se puede reconstruir a nivel
// TOTAL — no hay forma de saber cuánta gente había de un turno o sexo
// puntual en cada mes pasado (a diferencia del turno/sexo ACTUAL de cada
// agente). Filtrar solo el numerador y comparar contra la dotación total
// daría una tasa incorrecta, así que esta tarjeta recibe `licencias` sin
// filtrar por turno/sexo (mismo criterio ya usado para eximir a
// LicenciasPorTurnoCard.tsx del filtro de turno).
export default function AusentismoPorDotacionCard({
  licencias,
  desde,
  hasta,
  flujoPersonal,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  licencias: LicenciaAusentismoRow[];
  desde: Date;
  hasta: Date;
  flujoPersonal: FlujoPersonalStats;
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  const ausentismo = useMemo(() => calcularAusentismoMensual(desde, hasta, licencias), [desde, hasta, licencias]);
  const filas = useMemo(
    () => calcularAusentismoPorDotacion(ausentismo.meses, flujoPersonal.meses),
    [ausentismo, flujoPersonal]
  );

  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const sinDatos = filas.length === 0 || filas.every((f) => f.dotacion === 0);
  const picoValor = Math.max(1, ...filas.map((f) => f.tasaPor100));
  // +1 entero de margen arriba del pico (no un redondeo a múltiplo de 5 como
  // en los gráficos de cantidades enteras): acá el pico suele ser un número
  // chico con decimales (ej. 4.2), así que alcanza con el próximo entero.
  const escalaMax = Math.ceil(picoValor) + 1;

  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac * 10) / 10 };
  });

  const ultimaFila = filas[filas.length - 1];
  const tasaAnimadaX10 = useCountUp(ultimaFila ? Math.round(ultimaFila.tasaPor100 * 10) : 0, 0, modoExport ? 0 : 1200);
  const tasaAnimada = (tasaAnimadaX10 / 10).toFixed(1);

  function puntoXY(i: number, valor: number): { x: number; y: number } {
    return { x: i * PITCH_COL + ANCHO_COL / 2, y: ALTURA - (valor / escalaMax) * ALTURA };
  }

  // El atributo `points` de un <polyline> no es animable por CSS (a
  // diferencia de las barras, que sí pueden animar `height`), así que el
  // movimiento se resuelve con un tween manual vía requestAnimationFrame —
  // mismo mecanismo que ya usa el polígono de LicenciasPorTurnoCard.tsx.
  // Arranca en 0 (no modoExport) para que la primera aparición también sea
  // "la línea va tomando forma" en vez de saltar directo al valor real.
  const valoresObjetivo = useMemo(() => filas.map((f) => f.tasaPor100), [filas]);
  const [valoresAnimados, setValoresAnimados] = useState<number[]>(() =>
    modoExport ? valoresObjetivo : valoresObjetivo.map(() => 0)
  );
  const valoresActualesRef = useRef(valoresAnimados);
  useEffect(() => {
    valoresActualesRef.current = valoresAnimados;
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const destino = valoresObjetivo;
    // Si cambió la cantidad de meses (otro período), se ajusta el arranque
    // al nuevo largo — los meses nuevos entran desde 0, los que ya no están
    // simplemente se descartan.
    const inicio = destino.map((_, i) => valoresActualesRef.current[i] ?? 0);
    const sinCambios = inicio.length === destino.length && inicio.every((v, i) => v === destino[i]);
    if (sinCambios) return;
    const t0 = performance.now();
    function paso(ahora: number) {
      const t = Math.min(1, (ahora - t0) / DURACION_ANIM);
      const k = easeOutCubic(t);
      setValoresAnimados(inicio.map((v, i) => v + (destino[i] - v) * k));
      if (t < 1) rafRef.current = requestAnimationFrame(paso);
    }
    rafRef.current = requestAnimationFrame(paso);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [valoresObjetivo]);

  const puntosLinea = filas.map((f, i) => puntoXY(i, valoresAnimados[i] ?? 0));
  const puntosPoligono = puntosLinea.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Ausentismo por dotación</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="ausentismo-por-dotacion">
            {(t) => <AusentismoPorDotacionCard licencias={licencias} desde={desde} hasta={hasta} flujoPersonal={flujoPersonal} modoExport tema={t} />}
          </GraficoDescargable>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Licencias por cada 100 agentes activos — para aislar si el aumento es solo reflejo del crecimiento de personal.
        {ultimaFila && !sinDatos && (
          <> Tasa del último mes: <b className="text-[var(--c-text-muted)] tabular-nums">{tasaAnimada}</b>.</>
        )}{" "}
        No se ve afectada por los filtros de Turno ni Sexo: compara siempre contra la dotación total.
      </p>

      {sinDatos ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin datos para calcular la tasa en el período elegido.</p>
      ) : (
        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0 w-8 text-right text-[10px] text-[var(--c-text-faint)]" style={{ height: ALTURA }}>
            {lineasGrilla.map(({ frac, valor }) => (
              <span
                key={frac}
                className="absolute right-0 tabular-nums whitespace-nowrap"
                style={{
                  top: `${(1 - frac) * ALTURA}px`,
                  transform: frac === 1 ? "translateY(0)" : frac === 0 ? "translateY(-100%)" : "translateY(-50%)",
                }}
              >
                {valor}
              </span>
            ))}
          </div>

          <div className={`flex-1 min-w-0 ${modoExport ? "" : "overflow-x-auto no-scrollbar"}`}>
            <div className="relative" style={{ width: filas.length * PITCH_COL, height: ALTURA }}>
              <svg
                width={filas.length * PITCH_COL}
                height={ALTURA}
                className="absolute left-0 top-0"
                style={{ overflow: "visible" }}
              >
                {lineasGrilla.map(({ frac }) => (
                  <line
                    key={frac}
                    x1={0}
                    x2={filas.length * PITCH_COL}
                    y1={ALTURA * (1 - frac)}
                    y2={ALTURA * (1 - frac)}
                    stroke="var(--c-line)"
                    strokeWidth={1}
                    opacity={0.5}
                  />
                ))}

                <polyline
                  points={puntosPoligono}
                  fill="none"
                  stroke={tema.accent}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {filas.map((f, i) => (
                  <circle
                    key={f.key}
                    cx={puntosLinea[i].x}
                    cy={puntosLinea[i].y}
                    r={hoverKey === f.key ? 5 : 3.5}
                    fill={tema.accent}
                    stroke="var(--c-bg-elev)"
                    strokeWidth={1.5}
                    className="transition-[r] duration-150"
                  />
                ))}

                {!modoExport &&
                  filas.map((f, i) => {
                    const { x, y } = puntosLinea[i];
                    return (
                      <circle
                        key={f.key}
                        cx={x}
                        cy={y}
                        r={14}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerEnter={(e) => {
                          setHoverKey(f.key);
                          setTooltip({ x: e.clientX, y: e.clientY, fila: f });
                        }}
                        onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, fila: f })}
                        onPointerLeave={() => {
                          setHoverKey(null);
                          setTooltip(null);
                        }}
                      />
                    );
                  })}
              </svg>
            </div>

            <div className="flex gap-0.5 mt-1.5" style={{ width: filas.length * PITCH_COL }}>
              {filas.map((f) => (
                <span
                  key={f.key}
                  className="text-[10.5px] text-[var(--c-text-faint)] text-center whitespace-nowrap"
                  style={{ flex: `0 0 ${ANCHO_COL}px`, width: ANCHO_COL }}
                >
                  {f.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{tooltip.fila.mesLargo}</div>
          <div>
            <span className="font-bold tabular-nums">{tooltip.fila.tasaPor100.toFixed(1)}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">por cada 100 agentes</span>
          </div>
          <div className="mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">
            <span className="font-bold tabular-nums">{tooltip.fila.cantidad}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">licencias</span>
          </div>
          <div>
            <span className="font-bold tabular-nums">{tooltip.fila.dotacion}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">agentes activos</span>
          </div>
        </div>
      )}
    </div>
  );
}
