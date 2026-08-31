"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calcularEstacionalidadDiagnostico,
  calcularRankingDiagnosticos,
  mesesEntre,
  type FilaDiagnostico,
  type LicenciaAusentismoRow,
  type MesEnRango,
} from "@/lib/ausentismo";
import { useEntrada } from "@/lib/useEntrada";
import { useReplayOnChange } from "@/lib/useReplayOnChange";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

// Igual que CAUSAS_AUSENTISMO/DonutTipoPersonal: la paleta categórica de 8
// colores ya validada (daltonismo + contraste, skill de dataviz) es el techo
// de series distinguibles a la vez — por eso se limita la comparación a 8
// diagnósticos, no es un número arbitrario.
const MAX_SERIES = 8;

// Opacidad de una barra según cuál (si alguna) está aislada por hover en su
// leyenda — inspirado en el gráfico "Car vs Transit" de referencia: sin
// hover, todas las series se superponen a media opacidad (se interponen, no
// se reparten el ancho — ver `anchoBarra` más abajo); con hover, la elegida
// resalta y el resto casi desaparece, que es lo que hace legible comparar
// más de 2 series a la vez sin que quede todo mezclado.
function opacidadSerie(clave: string, hoverClave: string | null): number {
  if (hoverClave === null) return 0.6;
  return hoverClave === clave ? 0.92 : 0.08;
}

interface Serie {
  clave: string;
  etiqueta: string;
  color: string;
  porMes: number[];
  total: number;
  picoMes: number | null;
}

interface Tooltip {
  x: number;
  y: number;
  mes: number;
}

const ALTURA = 280;
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)
const VBW = 1000; // ancho virtual del viewBox, ver CantidadLicenciasCard.tsx

export default function EstacionalidadDiagnosticosCard({
  licencias,
  desde,
  hasta,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
  seleccionadasInicial,
  claveAisladaInicial = null,
}: {
  licencias: LicenciaAusentismoRow[];
  // Mismo rango que ya reciben AusentismoCard/AusentismoPorDotacionCard
  // (calculado una vez en EstadisticasAusentismo.tsx vía rangoMesesPeriodo):
  // todas las series comparten ESTE eje de meses reales, no un ciclo de 12
  // meses que junta todos los eneros entre sí — así arrancan del mismo punto,
  // igual que Car y Transit en el gráfico de referencia miden ambos sobre el
  // mismo espectro de minutos.
  desde: Date;
  hasta: Date;
  tema?: ChartTheme;
  modoExport?: boolean;
  // Solo se usa al abrir "Descargar como imagen": la vista exportada tiene
  // que salir con la misma comparación que el usuario armó, no reiniciada a
  // los 5 diagnósticos por defecto — ver el self-render dentro de
  // GraficoDescargable más abajo.
  seleccionadasInicial?: string[];
  // Ídem, pero para el diagnóstico aislado con click: si el usuario dejó uno
  // resaltado en la vista interactiva, la imagen exportada tiene que salir
  // con ESE mismo resaltado (no todas las series a la misma opacidad).
  claveAisladaInicial?: string | null;
}) {
  const ranking = useMemo(() => calcularRankingDiagnosticos(licencias), [licencias]);
  const meses: MesEnRango[] = useMemo(() => mesesEntre(desde, hasta), [desde, hasta]);
  // Diezmado de etiquetas del eje X cuando el rango es "todo el historial"
  // (puede ser 20+ meses) — mismo criterio ya usado en CantidadLicenciasCard.tsx.
  const pasoEtiqueta = meses.length > 20 ? 3 : meses.length > 10 ? 2 : 1;

  // Arranca con los 5 diagnósticos más frecuentes — la selección después NO
  // se resetea si cambia `licencias` (ej. el usuario toca el filtro de
  // período): si ya armó una comparación puntual, cambiar de período debe
  // recalcular las barras, no perderle la elección.
  const [seleccionadas, setSeleccionadas] = useState<string[]>(
    () => seleccionadasInicial ?? ranking.slice(0, 5).map((f) => f.clave)
  );
  const [abierto, setAbierto] = useState(false);
  const [hoverClave, setHoverClave] = useState<string | null>(null);
  // Aislar un diagnóstico también queda "pegado" con un click en su chip,
  // no solo mientras dura el hover del mouse (que en touch no existe) — un
  // segundo click sobre la misma chip lo suelta. El hover, si está activo,
  // manda por sobre lo clickeado (preview instantáneo al pasar el mouse por
  // otra chip sin perder la selección de abajo al sacarlo).
  const [seleccionAislada, setSeleccionAislada] = useState<string | null>(claveAisladaInicial);
  const claveAislada = hoverClave ?? seleccionAislada;
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  // Carrousel de las "chips" de diagnósticos elegidos: en vez de dejarlas
  // envolver en varias filas (`flex-wrap`), quedan en una sola fila que se
  // desplaza hacia los costados — libera el alto que antes se comía el
  // envoltorio, y ese alto pasa directo al gráfico (ver ALTURA más arriba).
  // Mismo patrón de flechas + no-scrollbar que la barra de pestañas del
  // legajo (LegajoTabs.tsx).
  const carruselRef = useRef<HTMLDivElement>(null);
  const [scrollCarrusel, setScrollCarrusel] = useState({ left: false, right: false });

  function actualizarScrollCarrusel() {
    const el = carruselRef.current;
    if (!el) return;
    setScrollCarrusel({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    actualizarScrollCarrusel();
    const el = carruselRef.current;
    if (!el) return;
    const ro = new ResizeObserver(actualizarScrollCarrusel);
    ro.observe(el);
    return () => ro.disconnect();
  }, [seleccionadas.length]);

  function desplazarCarrusel(direccion: 1 | -1) {
    carruselRef.current?.scrollBy({ left: direccion * 220, behavior: "smooth" });
  }

  // Siempre en el mismo orden (el de `ranking`, por frecuencia descendente)
  // para que el color de cada diagnóstico no cambie de lugar cada vez que se
  // tilda/destilda otro — el color depende de la posición acá, no del orden
  // en que se fueron eligiendo.
  const series: Serie[] = useMemo(() => {
    const porClave = new Map(ranking.map((f) => [f.clave, f]));
    return seleccionadas
      .map((clave) => porClave.get(clave))
      .filter((f): f is FilaDiagnostico => f !== undefined)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, MAX_SERIES)
      .map((f, i) => {
        const porMes = calcularEstacionalidadDiagnostico(licencias, f.clave, meses);
        const total = porMes.reduce((a, b) => a + b, 0);
        return {
          clave: f.clave,
          etiqueta: f.etiqueta,
          color: tema.categorico[i % tema.categorico.length],
          porMes,
          total,
          picoMes: total > 0 ? porMes.indexOf(Math.max(...porMes)) : null,
        };
      });
  }, [seleccionadas, ranking, licencias, meses, tema]);

  // Solo se monta cuando RevealOnScroll lo revela: no hace falta delayMs, el
  // propio montaje ya es el disparador de "empezar a tomar vida". En
  // modoExport la vista previa tiene que salir ya "crecida" (ver
  // GraficoDescargable.tsx), nunca a mitad de animación. replayListo hace
  // que cambiar la comparación o de período reactive la misma transición de
  // "crecer desde 0" en vez de que las columnas salten directo al valor
  // nuevo.
  const entrada = useEntrada();
  const replayListo = useReplayOnChange(series);
  const listo = modoExport || (entrada && replayListo);

  const picoValor = Math.max(1, ...series.flatMap((s) => s.porMes));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);
  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });

  // A diferencia de un gráfico de barras agrupadas, acá las barras de cada
  // serie ocupan EL MISMO lugar dentro del mes (se interponen, no se
  // reparten el ancho) — mismo lenguaje visual que la referencia "Car vs
  // Transit" del usuario: las series superpuestas se distinguen por opacidad
  // + la interacción de hover-aislar de más abajo, no por su posición en x.
  // Cada barra ocupa el 100% de su mes (pegada a la del mes siguiente, sin
  // hueco) — cada columna es un mes completo, igual que un histograma real
  // donde los bins son contiguos.
  const anchoSlot = meses.length > 0 ? VBW / meses.length : VBW;
  const anchoBarra = anchoSlot;

  function alternarDiagnostico(clave: string) {
    setSeleccionadas((prev) => (prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]));
    setSeleccionAislada((prev) => (prev === clave ? null : prev));
  }

  function alternarAislada(clave: string) {
    setSeleccionAislada((prev) => (prev === clave ? null : clave));
  }

  function manejarMovimiento(e: React.PointerEvent<HTMLDivElement>) {
    if (meses.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(0.999, Math.max(0, (e.clientX - rect.left) / rect.width));
    setTooltip({ x: e.clientX, y: e.clientY, mes: Math.floor(frac * meses.length) });
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Estacionalidad de diagnósticos</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="estacionalidad-de-diagnosticos">
            {(t) => (
              <EstacionalidadDiagnosticosCard
                licencias={licencias}
                desde={desde}
                hasta={hasta}
                modoExport
                tema={t}
                seleccionadasInicial={seleccionadas}
                claveAisladaInicial={seleccionAislada}
              />
            )}
          </GraficoDescargable>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Cantidad de carpetas médicas por mes para los diagnósticos que elijas comparar, en el período seleccionado.
      </p>

      {modoExport ? (
        // Estática: sin carrousel (no tiene sentido "scrollear" una imagen
        // descargada). Se listan TODOS los diagnósticos elegidos, ordenados
        // por frecuencia (mismo orden que `series`), para que quien mire el
        // PNG pueda discriminar cada espectro de color sin depender de pasar
        // el mouse por una leyenda interactiva. `flex-wrap` (no grid de
        // columnas iguales) para que cada chip mida lo que necesite su
        // propio texto en una sola línea — con columnas parejas, un nombre
        // largo terminaba partido a la mitad de la palabra.
        series.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {series.map((s) => (
              <ChipDiagnostico
                key={s.clave}
                serie={s}
                meses={meses}
                modoExport
                claveAislada={claveAislada}
                seleccionadaClick={seleccionAislada}
                onHoverChange={() => {}}
                onQuitar={() => {}}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex items-stretch gap-2 mb-4">
          <SelectorDiagnosticosMultiple
            ranking={ranking}
            seleccionadas={seleccionadas}
            onAlternar={alternarDiagnostico}
            abierto={abierto}
            onAbrir={() => setAbierto(true)}
            onCerrar={() => setAbierto(false)}
          />

          <div className="relative flex-1 min-w-0 flex items-stretch gap-1">
            {scrollCarrusel.left && (
              <button
                type="button"
                onClick={() => desplazarCarrusel(-1)}
                aria-label="Ver diagnósticos anteriores"
                className="shrink-0 flex items-center justify-center w-6 rounded-md text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div
              ref={carruselRef}
              onScroll={actualizarScrollCarrusel}
              className="flex items-stretch gap-2 overflow-x-auto no-scrollbar scroll-smooth min-w-0"
            >
              {series.map((s) => (
                <ChipDiagnostico
                  key={s.clave}
                  serie={s}
                  meses={meses}
                  modoExport={false}
                  claveAislada={claveAislada}
                  seleccionadaClick={seleccionAislada}
                  onHoverChange={setHoverClave}
                  onClickChip={alternarAislada}
                  onQuitar={alternarDiagnostico}
                  compacto
                />
              ))}
            </div>

            {scrollCarrusel.right && (
              <button
                type="button"
                onClick={() => desplazarCarrusel(1)}
                aria-label="Ver más diagnósticos"
                className="shrink-0 flex items-center justify-center w-6 rounded-md text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {series.length === 0 || meses.length === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">
          {meses.length === 0 ? "Sin período válido para graficar." : "Elegí al menos un diagnóstico para ver su evolución."}
        </p>
      ) : (
        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0 w-7 text-right text-[10px] text-[var(--c-text-faint)]" style={{ height: ALTURA }}>
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

          <div className="flex-1 min-w-0">
            <div
              className="relative cursor-crosshair"
              style={{ height: ALTURA }}
              onPointerMove={manejarMovimiento}
              onPointerLeave={() => setTooltip(null)}
            >
              <div className="absolute inset-0 pointer-events-none">
                {lineasGrilla.map(({ frac }) => (
                  <div
                    key={frac}
                    className="absolute left-0 right-0 border-t border-[var(--c-line)]"
                    style={{ top: `${(1 - frac) * ALTURA}px`, opacity: frac === 0 ? 1 : 0.5 }}
                  />
                ))}
              </div>

              <svg viewBox={`0 0 ${VBW} ${ALTURA}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                {Array.from({ length: meses.length }, (_, mes) => {
                  const x = mes * anchoSlot + (anchoSlot - anchoBarra) / 2;
                  return (
                    <g key={mes}>
                      {series.map((s) => {
                        const valor = s.porMes[mes];
                        const altura = listo ? (valor / escalaMax) * ALTURA : 0;
                        return (
                          <rect
                            key={s.clave}
                            x={x}
                            y={ALTURA - altura}
                            width={anchoBarra}
                            height={altura}
                            rx={2}
                            fill={s.color}
                            style={{
                              opacity: opacidadSerie(s.clave, claveAislada),
                              transition: `opacity 150ms, height 550ms cubic-bezier(.22,1,.36,1) ${mes * 25}ms, y 550ms cubic-bezier(.22,1,.36,1) ${mes * 25}ms`,
                            }}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {tooltip && (
                  <line
                    x1={tooltip.mes * anchoSlot + anchoSlot / 2}
                    x2={tooltip.mes * anchoSlot + anchoSlot / 2}
                    y1={0}
                    y2={ALTURA}
                    stroke="var(--c-line-strong)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>

            <div className="relative mt-1.5" style={{ height: 14 }}>
              {meses.map((m, i) => {
                // Las etiquetas de cambio de año ("ene '25") se muestran
                // siempre aunque no les toque turno en el diezmado — marcan
                // un corte real en la serie (mismo criterio que CantidadLicenciasCard.tsx).
                if (i % pasoEtiqueta !== 0 && i !== meses.length - 1 && !m.label.includes("'")) return null;
                return (
                  <span
                    key={m.key}
                    className="absolute -translate-x-1/2 text-[10.5px] text-[var(--c-text-faint)] whitespace-nowrap"
                    style={{ left: `${((i + 0.5) / meses.length) * 100}%` }}
                  >
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tooltip && series.length > 0 && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{meses[tooltip.mes]?.mesLargo}</div>
          {series.map((s) => (
            <div key={s.clave} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="font-bold tabular-nums">{s.porMes[tooltip.mes]}</span>
              <span className="text-[var(--c-text-faint)] truncate max-w-[160px]">{s.etiqueta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Una "chip" de diagnóstico elegido: swatch de color + etiqueta + total/pico,
// con botón de quitar salvo en modoExport. `compacto` la angosta y evita que
// se achique dentro del carrousel horizontal (ver más arriba); en la grilla
// de export no hace falta (ocupa el ancho de su celda). Un click la deja
// "aislada" (border + texto en negrita) hasta que se hace otro click encima
// — mismo efecto que aislar con el mouse, pero persistente (ver
// `seleccionAislada` en el componente padre).
function ChipDiagnostico({
  serie,
  meses,
  modoExport,
  claveAislada,
  seleccionadaClick,
  onHoverChange,
  onClickChip,
  onQuitar,
  compacto,
}: {
  serie: Serie;
  meses: MesEnRango[];
  modoExport: boolean;
  claveAislada: string | null;
  seleccionadaClick?: string | null;
  onHoverChange: (clave: string | null) => void;
  onClickChip?: (clave: string) => void;
  onQuitar: (clave: string) => void;
  compacto?: boolean;
}) {
  // El border/negrita es un indicador visual de "esta es la aislada", no
  // exclusivo de la interacción por click — también tiene que verse en la
  // imagen exportada (ahí `seleccionadaClick` llega vía `claveAisladaInicial`,
  // no de un click real). Lo que sí queda gateado a `!modoExport` es el
  // handler de click en sí (más abajo).
  const seleccionada = seleccionadaClick === serie.clave;
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border pl-2.5 pr-1.5 py-1.5 transition-colors ${
        compacto ? "shrink-0" : ""
      } ${modoExport ? "" : "cursor-pointer"} ${
        seleccionada ? "border-[var(--c-blue)] bg-[var(--c-bg-elev-2)]" : "border-[var(--c-line)] bg-[var(--c-bg)]"
      }`}
      style={{ opacity: claveAislada && claveAislada !== serie.clave ? 0.45 : 1 }}
      onPointerEnter={() => !modoExport && onHoverChange(serie.clave)}
      onPointerLeave={() => !modoExport && onHoverChange(null)}
      onClick={() => !modoExport && onClickChip?.(serie.clave)}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: serie.color }} />
      <span className="min-w-0">
        <span
          className={`block text-[12px] text-[var(--c-text)] ${seleccionada ? "font-semibold" : ""} ${
            compacto ? "truncate max-w-[150px]" : "whitespace-nowrap"
          }`}
          title={compacto ? serie.etiqueta : undefined}
        >
          {serie.etiqueta}
        </span>
        <span className="block text-[10.5px] text-[var(--c-text-faint)] tabular-nums">
          {serie.total} {serie.total === 1 ? "caso" : "casos"}
          {serie.picoMes !== null && <> · pico en {meses[serie.picoMes].mesLargo.toLowerCase()}</>}
        </span>
      </span>
      {!modoExport && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuitar(serie.clave);
          }}
          title="Quitar de la comparación"
          className="rounded p-1 text-[var(--c-text-faint)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Botón + desplegable de casillas con buscador para elegir hasta MAX_SERIES
// diagnósticos a comparar — mismo patrón de "capa fija invisible que cierra
// al primer click afuera" que ya usan FiltrosPersonal.tsx y FiltroMultiple
// (EstadisticasAusentismo.tsx): onClick de React, sin listeners de window.
// A diferencia de FiltroMultiple (listas fijas de ≤6 opciones), acá hace
// falta buscador porque hay ~170 diagnósticos distintos.
function SelectorDiagnosticosMultiple({
  ranking,
  seleccionadas,
  onAlternar,
  abierto,
  onAbrir,
  onCerrar,
}: {
  ranking: FilaDiagnostico[];
  seleccionadas: string[];
  onAlternar: (clave: string) => void;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? ranking.filter((f) => f.etiqueta.toLowerCase().includes(q)) : ranking;
  }, [ranking, busqueda]);
  const limiteAlcanzado = seleccionadas.length >= MAX_SERIES;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onAbrir}
        className="inline-flex items-center gap-1.5 h-full rounded-lg border border-dashed border-[var(--c-line-strong)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:border-[var(--c-blue)] transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Diagnósticos
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={onCerrar} />
          <div
            className="absolute left-0 top-full mt-1 z-40 w-72 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar diagnóstico…"
              className="w-full rounded-md border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2 py-1 text-[12px] text-[var(--c-text)] mb-1 focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
            />
            {limiteAlcanzado && (
              <p className="px-1.5 pb-1 text-[10.5px] text-[var(--c-text-faint)]">
                Máximo {MAX_SERIES} diagnósticos a la vez, para que el gráfico se pueda leer.
              </p>
            )}
            <div className="max-h-64 overflow-y-auto">
              {filtradas.map((f) => {
                const marcado = seleccionadas.includes(f.clave);
                const deshabilitado = !marcado && limiteAlcanzado;
                return (
                  <label
                    key={f.clave}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-[12px] ${
                      deshabilitado ? "text-[var(--c-text-faint)] opacity-50" : "text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-[var(--c-text)] cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={deshabilitado}
                      onChange={() => onAlternar(f.clave)}
                      className="rounded border-[var(--c-line-strong)] bg-[var(--c-bg-elev)] text-[var(--c-blue)] focus:ring-[var(--c-blue)]"
                    />
                    <span className="flex-1 truncate">{f.etiqueta}</span>
                    <span className="shrink-0 text-[10.5px] text-[var(--c-text-faint)] tabular-nums">{f.cantidad}</span>
                  </label>
                );
              })}
              {filtradas.length === 0 && <p className="px-2 py-2 text-[11px] text-[var(--c-text-faint)]">Sin resultados.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
