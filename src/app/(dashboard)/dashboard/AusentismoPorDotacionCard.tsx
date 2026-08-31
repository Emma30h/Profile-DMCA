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
  index: number;
}

// Mismos 4 tramos que "Ingresos y bajas de personal" (sin 30D: acá cada
// columna es un mes, una ventana de 30 días no aporta nada a esa escala).
// A diferencia de esa tarjeta, acá el rango no controla el ancho de columna
// ni un scroll/brush — solo recorta la cola de `filas` a los últimos N
// meses del período ya resuelto por la barra general (Período), porque el
// período/turno/sexo lo sigue manejando esa barra, no esta tarjeta.
type Rango = "3m" | "6m" | "1a" | "todo";
const RANGOS: Rango[] = ["3m", "6m", "1a", "todo"];
const RANGO_MESES: Record<Exclude<Rango, "todo">, number> = { "3m": 3, "6m": 6, "1a": 12 };

const ALTURA = 200;
const ANCHO_COL = 40;
const GAP_COL = 2; // gap-0.5 entre columnas de la fila de etiquetas de abajo
const PITCH_COL = ANCHO_COL + GAP_COL;
const SEGMENTOS_GRILLA = 4;
const DURACION_ANIM = 400;
const VENTANA_TENDENCIA = 3; // mismo criterio que "Ausentismo por causa": promedio móvil de 3 meses
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Promedio móvil de ventana fija sobre la tasa mensual — mismo mecanismo que
// calcularPromedioMovil en AusentismoCard.tsx (no se comparte porque acá
// suaviza `tasaPor100`, no un conteo entero por causa).
function calcularPromedioMovil(valores: number[], ventana: number): number[] {
  return valores.map((_, i) => {
    const desde = Math.max(0, i - ventana + 1);
    const tramo = valores.slice(desde, i + 1);
    return tramo.reduce((suma, v) => suma + v, 0) / tramo.length;
  });
}

// Catmull-Rom → Bézier (tensión uniforme, divisor /6): a diferencia de la
// línea principal (segmentos rectos, para no sugerir precisión donde no la
// hay entre un mes y el siguiente), la tendencia SÍ busca leerse como una
// curva lisa continua tipo media móvil de un gráfico financiero — con solo
// ~12-22 puntos mensuales, un polyline recto se ve quebrado.
function curvaSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length < 2) return "";
  if (puntos.length === 2) return `M ${puntos[0].x},${puntos[0].y} L ${puntos[1].x},${puntos[1].y}`;
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Ignora a propósito los filtros de Turno/Sexo/Estado/Tipo de personal de la
// barra general: la dotación histórica (el denominador) solo se puede
// reconstruir a nivel TOTAL — no hay forma de saber cuánta gente había de un
// turno, sexo, estado o tipo de personal puntual en cada mes pasado (a
// diferencia de esos mismos datos ACTUALES de cada agente). Filtrar solo el
// numerador y comparar contra la dotación total daría una tasa incorrecta,
// así que esta tarjeta recibe `licencias` sin filtrar por ninguno de esos
// cuatro (mismo criterio ya usado para eximir a LicenciasPorTurnoCard.tsx
// del filtro de turno).
export default function AusentismoPorDotacionCard({
  licencias,
  desde,
  hasta,
  flujoPersonal,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
  rangoInicial = "todo",
  mostrarTendenciaInicial = false,
}: {
  licencias: LicenciaAusentismoRow[];
  desde: Date;
  hasta: Date;
  flujoPersonal: FlujoPersonalStats;
  tema?: ChartTheme;
  modoExport?: boolean;
  // Solo se usan al abrir "Descargar como imagen": ver comentario equivalente
  // en CantidadLicenciasCard.tsx / AusentismoCard.tsx.
  rangoInicial?: Rango;
  mostrarTendenciaInicial?: boolean;
}) {
  const ausentismo = useMemo(() => calcularAusentismoMensual(desde, hasta, licencias), [desde, hasta, licencias]);
  const filasPeriodo = useMemo(
    () => calcularAusentismoPorDotacion(ausentismo.meses, flujoPersonal.meses),
    [ausentismo, flujoPersonal]
  );

  const [rango, setRango] = useState<Rango>(rangoInicial);
  const filas = useMemo(
    () => (rango === "todo" ? filasPeriodo : filasPeriodo.slice(-RANGO_MESES[rango])),
    [filasPeriodo, rango]
  );

  const [mostrarTendencia, setMostrarTendencia] = useState(mostrarTendenciaInicial);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const promedioMovil = useMemo(
    () => calcularPromedioMovil(filas.map((f) => f.tasaPor100), VENTANA_TENDENCIA),
    [filas]
  );

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
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
            <GraficoDescargable nombreArchivo="ausentismo-por-dotacion">
              {(t) => (
                <AusentismoPorDotacionCard
                  licencias={licencias}
                  desde={desde}
                  hasta={hasta}
                  flujoPersonal={flujoPersonal}
                  modoExport
                  tema={t}
                  rangoInicial={rango}
                  mostrarTendenciaInicial={mostrarTendencia}
                />
              )}
            </GraficoDescargable>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Licencias por cada 100 agentes activos — para aislar si el aumento es solo reflejo del crecimiento de personal.
        {ultimaFila && !sinDatos && (
          <> Tasa del último mes: <b className="text-[var(--c-text-muted)] tabular-nums">{tasaAnimada}</b>.</>
        )}{" "}
        No se ve afectada por los filtros de Turno, Sexo, Estado ni Tipo de personal: compara siempre contra la dotación total.
      </p>

      {!modoExport && (
        <div className="flex items-center gap-1.5 mb-3.5">
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRango(r)}
              aria-pressed={rango === r}
              className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                rango === r
                  ? "bg-[var(--c-blue)] text-white border-[var(--c-blue)]"
                  : "text-[var(--c-text-muted)] border-[var(--c-line)] hover:text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
              }`}
            >
              {r === "todo" ? "Todo" : r.toUpperCase()}
            </button>
          ))}
        </div>
      )}

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
                  stroke={tema.accentSolo}
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
                    fill={tema.accentSolo}
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
                          setTooltip({ x: e.clientX, y: e.clientY, fila: f, index: i });
                        }}
                        onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, fila: f, index: i })}
                        onPointerLeave={() => {
                          setHoverKey(null);
                          setTooltip(null);
                        }}
                      />
                    );
                  })}

                {/* Siempre montada (nunca condicionada a mostrarTendencia): así el
                    toggle "Tendencia" hace un fade in/out fluido en vez de
                    aparecer/desaparecer de golpe. Sin marcadores por punto ni
                    trazo punteado — una curva lisa continua (como una media
                    móvil de un gráfico financiero), en ámbar para no
                    confundirse con el azul/paleta de la línea de datos. */}
                <path
                  d={curvaSuave(promedioMovil.map((v, i) => puntoXY(i, v)))}
                  fill="none"
                  stroke="var(--c-amber)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ opacity: mostrarTendencia ? 1 : 0, transition: "opacity 300ms ease" }}
                />
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
          {mostrarTendencia && (
            <div>
              <span className="font-bold tabular-nums text-[var(--c-amber)]">{promedioMovil[tooltip.index].toFixed(1)}</span>
              <span className="text-[var(--c-text-faint)] ml-1.5">Tendencia (prom. 3 meses)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
