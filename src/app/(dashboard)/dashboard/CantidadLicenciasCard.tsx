"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MESES_CORTOS, MESES_LARGOS, type LicenciaAusentismoRow } from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import { useEntrada } from "@/lib/useEntrada";
import { useCountUp } from "@/lib/useCountUp";
import { useReplayOnChange } from "@/lib/useReplayOnChange";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

type Granularidad = "dia" | "semana" | "mes";
type Rango = "30d" | "3m" | "6m" | "1a" | "todo";

interface Bucket {
  key: string;
  label: string; // etiqueta corta para el eje X
  labelLargo: string; // para el tooltip
  cantidad: number;
  ids: string[];
}

interface Tooltip {
  x: number;
  y: number;
  index: number;
}

const ALTURA = 200;
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)
const VBW = 1000; // ancho virtual del viewBox — se escala solo vía CSS al ancho real del contenedor, sin scroll horizontal ni pitch fijo por punto (a diferencia del gráfico de barras de causas, acá tiene sentido que la línea siempre ocupe el ancho completo de la tarjeta)

function claveDia(f: Date): string {
  return f.toISOString().slice(0, 10);
}

function sumarDias(f: Date, n: number): Date {
  return new Date(f.getTime() + n * 86400000);
}

// Semana de lunes a domingo (convención local, no la de EE.UU. domingo-sábado).
function inicioSemana(f: Date): Date {
  const dow = f.getUTCDay(); // 0=domingo .. 6=sábado
  const offset = dow === 0 ? 6 : dow - 1;
  return sumarDias(f, -offset);
}

function claveMesLocal(f: Date): string {
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}`;
}

function primerDiaMes(f: Date): Date {
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 1));
}

function sumarMeses(f: Date, n: number): Date {
  return new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + n, 1));
}

// El rango (ventana de tiempo) y la granularidad (tamaño del bucket) son
// ejes independientes, igual que en cualquier gráfico financiero real: acá
// se resuelve el rango a una fecha "desde" concreta, y calcularBuckets solo
// se encarga de partir [desde, hoy] en columnas del tamaño que corresponda.
function calcularDesde(rango: Rango, hoy: Date, licencias: LicenciaAusentismoRow[]): Date {
  switch (rango) {
    case "30d":
      return sumarDias(hoy, -29);
    case "3m":
      return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 3, hoy.getUTCDate()));
    case "6m":
      return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 6, hoy.getUTCDate()));
    case "1a":
      return new Date(Date.UTC(hoy.getUTCFullYear() - 1, hoy.getUTCMonth(), hoy.getUTCDate()));
    case "todo": {
      if (licencias.length === 0) return hoy;
      const minFecha = licencias.reduce((min, l) => (l.fechaInicio < min ? l.fechaInicio : min), licencias[0].fechaInicio);
      return new Date(minFecha);
    }
  }
}

function calcularBuckets(gran: Granularidad, desde: Date, hoy: Date, licencias: LicenciaAusentismoRow[]): Bucket[] {
  const hoyDia = new Date(`${claveDia(hoy)}T00:00:00.000Z`);

  if (gran === "dia") {
    const inicio = new Date(`${claveDia(desde)}T00:00:00.000Z`);
    const buckets: Bucket[] = [];
    for (let cursor = inicio; cursor <= hoyDia; cursor = sumarDias(cursor, 1)) {
      const esPrimeroDeMesOInicio = buckets.length === 0 || cursor.getUTCDate() === 1;
      buckets.push({
        key: claveDia(cursor),
        label: esPrimeroDeMesOInicio ? `${cursor.getUTCDate()} ${MESES_CORTOS[cursor.getUTCMonth()]}` : String(cursor.getUTCDate()),
        labelLargo: `${cursor.getUTCDate()} de ${MESES_LARGOS[cursor.getUTCMonth()]} de ${cursor.getUTCFullYear()}`,
        cantidad: 0,
        ids: [],
      });
    }
    const indice = new Map(buckets.map((b, i) => [b.key, i]));
    for (const l of licencias) {
      const i = indice.get(claveDia(new Date(l.fechaInicio)));
      if (i === undefined) continue;
      buckets[i].cantidad++;
      if (!buckets[i].ids.includes(l.agenteId)) buckets[i].ids.push(l.agenteId);
    }
    return buckets;
  }

  if (gran === "semana") {
    const finSemana = inicioSemana(hoyDia);
    const inicio = inicioSemana(desde);
    const buckets: Bucket[] = [];
    for (let cursor = inicio; cursor <= finSemana; cursor = sumarDias(cursor, 7)) {
      const fin = sumarDias(cursor, 6);
      buckets.push({
        key: claveDia(cursor),
        label: `${cursor.getUTCDate()} ${MESES_CORTOS[cursor.getUTCMonth()]}`,
        labelLargo: `Semana del ${cursor.getUTCDate()} de ${MESES_LARGOS[cursor.getUTCMonth()]} al ${fin.getUTCDate()} de ${MESES_LARGOS[fin.getUTCMonth()]}`,
        cantidad: 0,
        ids: [],
      });
    }
    const indice = new Map(buckets.map((b, i) => [b.key, i]));
    for (const l of licencias) {
      const i = indice.get(claveDia(inicioSemana(new Date(l.fechaInicio))));
      if (i === undefined) continue;
      buckets[i].cantidad++;
      if (!buckets[i].ids.includes(l.agenteId)) buckets[i].ids.push(l.agenteId);
    }
    return buckets;
  }

  // "mes"
  if (licencias.length === 0) return [];
  const fin = primerDiaMes(hoyDia);
  const buckets: Bucket[] = [];
  for (let cursor = primerDiaMes(desde); cursor <= fin; cursor = sumarMeses(cursor, 1)) {
    const esPrimeroOEnero = buckets.length === 0 || cursor.getUTCMonth() === 0;
    buckets.push({
      key: claveMesLocal(cursor),
      label: esPrimeroOEnero ? `${MESES_CORTOS[cursor.getUTCMonth()]} '${String(cursor.getUTCFullYear()).slice(2)}` : MESES_CORTOS[cursor.getUTCMonth()],
      labelLargo: `${MESES_LARGOS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`,
      cantidad: 0,
      ids: [],
    });
  }
  const indice = new Map(buckets.map((b, i) => [b.key, i]));
  for (const l of licencias) {
    const i = indice.get(claveMesLocal(new Date(l.fechaInicio)));
    if (i === undefined) continue;
    buckets[i].cantidad++;
    if (!buckets[i].ids.includes(l.agenteId)) buckets[i].ids.push(l.agenteId);
  }
  return buckets;
}

const GRANULARIDAD_LABEL: Record<Granularidad, string> = { dia: "Día", semana: "Semana", mes: "Mes" };
const RANGO_LABEL: Record<Rango, string> = { "30d": "30D", "3m": "3M", "6m": "6M", "1a": "1A", todo: "Todo" };
// Rango sugerido al cambiar de granularidad — el usuario lo puede pisar
// después con los botones de rango, esto solo evita combinaciones inútiles
// por defecto (ej. "Mes" arrancando en una ventana de 30 días, que casi
// siempre muestra un solo punto).
const RANGO_POR_DEFECTO: Record<Granularidad, Rango> = { dia: "30d", semana: "6m", mes: "todo" };

export default function CantidadLicenciasCard({
  licencias,
  hoy,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  licencias: LicenciaAusentismoRow[];
  hoy: string;
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  const router = useRouter();
  const gradienteId = useId();
  const colorLinea = tema.accent;
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);

  const [granularidad, setGranularidad] = useState<Granularidad>("mes");
  const [rango, setRango] = useState<Rango>("todo");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);

  function elegirGranularidad(g: Granularidad) {
    setGranularidad(g);
    setRango(RANGO_POR_DEFECTO[g]);
  }

  const desde = useMemo(() => calcularDesde(rango, hoyDate, licencias), [rango, hoyDate, licencias]);
  const buckets = useMemo(
    () => calcularBuckets(granularidad, desde, hoyDate, licencias),
    [granularidad, desde, hoyDate, licencias]
  );

  // Solo se monta cuando RevealOnScroll lo revela: no hace falta delayMs, el
  // propio montaje ya es el disparador de "empezar a tomar vida". En
  // modoExport la vista previa tiene que salir ya "crecida" (ver
  // GraficoDescargable.tsx), nunca a mitad de animación. replayListo hace
  // que cambiar de rango/granularidad reactive la misma transición de
  // "crecer desde 0" en vez de que la línea salte directo a la forma nueva.
  const entrada = useEntrada();
  const replayListo = useReplayOnChange(buckets);
  const listo = modoExport || (entrada && replayListo);

  const totalCantidad = buckets.reduce((acc, b) => acc + b.cantidad, 0);
  const totalCantidadAnimado = useCountUp(totalCantidad, 0, modoExport ? 0 : 1600);
  const picoValor = Math.max(1, ...buckets.map((b) => b.cantidad));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);

  let picoIndex = 0;
  for (let i = 1; i < buckets.length; i++) {
    if (buckets[i].cantidad > buckets[picoIndex].cantidad) picoIndex = i;
  }
  const ultimoIndex = buckets.length - 1;

  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });

  const puntos = buckets.map((b, i) => ({
    x: buckets.length > 1 ? (i / (buckets.length - 1)) * VBW : VBW / 2,
    y: ALTURA - (b.cantidad / escalaMax) * ALTURA,
  }));
  const lineaPath = puntos.length > 0 ? `M ${puntos.map((p) => `${p.x},${p.y}`).join(" L ")}` : "";
  const areaPath = puntos.length > 0 ? `${lineaPath} L ${VBW},${ALTURA} L 0,${ALTURA} Z` : "";

  // Diezmado de etiquetas del eje X: a nivel día son 30 columnas, sin esto
  // se pisan entre sí (mismo criterio ya usado en InformeAusentismo.tsx).
  const pasoEtiqueta = buckets.length > 20 ? 3 : buckets.length > 10 ? 2 : 1;

  function manejarMovimiento(e: React.PointerEvent<HTMLDivElement>) {
    const rect = contenedorRef.current?.getBoundingClientRect();
    if (!rect || buckets.length === 0) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const index = buckets.length > 1 ? Math.round(frac * (buckets.length - 1)) : 0;
    setHoverIndex(index);
    setTooltip({ x: e.clientX, y: e.clientY, index });
  }

  function limpiarHover() {
    setHoverIndex(null);
    setTooltip(null);
  }

  function irAPersonal(index: number) {
    const ids = buckets[index]?.ids ?? [];
    if (ids.length > 0) router.push(`/personal?${buildQueryString({ ids: ids.join(",") })}`);
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Cantidad de licencias</h3>
        {!modoExport && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
              {(["30d", "3m", "6m", "1a", "todo"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRango(r)}
                  aria-pressed={rango === r}
                  className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                    rango === r
                      ? "bg-[var(--c-blue)] text-white"
                      : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                  }`}
                >
                  {RANGO_LABEL[r]}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
              {(["dia", "semana", "mes"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => elegirGranularidad(g)}
                  aria-pressed={granularidad === g}
                  className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                    granularidad === g
                      ? "bg-[var(--c-blue)] text-white"
                      : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                  }`}
                >
                  {GRANULARIDAD_LABEL[g]}
                </button>
              ))}
            </div>
            <GraficoDescargable nombreArchivo="cantidad-de-licencias">
              {(t) => <CantidadLicenciasCard licencias={licencias} hoy={hoy} modoExport tema={t} />}
            </GraficoDescargable>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Cantidad de licencias por {GRANULARIDAD_LABEL[granularidad].toLowerCase()}, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total.
      </p>

      {buckets.length < 2 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">No hay suficientes datos para graficar una tendencia.</p>
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
              ref={contenedorRef}
              className="relative cursor-crosshair"
              style={{ height: ALTURA }}
              onPointerMove={manejarMovimiento}
              onPointerLeave={limpiarHover}
              onDoubleClick={() => hoverIndex !== null && irAPersonal(hoverIndex)}
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
                <defs>
                  <linearGradient id={gradienteId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: colorLinea, stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: colorLinea, stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <g
                  style={{
                    transform: listo ? "scaleY(1)" : "scaleY(0)",
                    transformOrigin: `0px ${ALTURA}px`,
                    transition: "transform 700ms cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  <path d={areaPath} fill={`url(#${gradienteId})`} />
                  <path d={lineaPath} fill="none" stroke={colorLinea} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </g>

                {/* Picos destacados sin depender del hover — mismo criterio que Ausentismo por causa.
                    Set para no duplicar la etiqueta (ni la key) cuando el pico coincide con el último punto. */}
                {[...new Set([picoIndex, ultimoIndex])].map((i) =>
                  buckets[i].cantidad > 0 ? (
                    <text
                      key={i}
                      x={puntos[i].x}
                      y={Math.max(12, puntos[i].y - 10)}
                      textAnchor={i === 0 ? "start" : i === ultimoIndex ? "end" : "middle"}
                      fontSize={11}
                      fontWeight={700}
                      fill="var(--c-text)"
                      className="tabular-nums"
                      style={{ opacity: listo ? 1 : 0, transition: "opacity 400ms ease-out 500ms" }}
                    >
                      {buckets[i].cantidad}
                    </text>
                  ) : null
                )}

                {hoverIndex !== null && (
                  <>
                    <line
                      x1={puntos[hoverIndex].x} x2={puntos[hoverIndex].x}
                      y1={0} y2={ALTURA}
                      stroke="var(--c-line-strong)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                    />
                    <circle cx={puntos[hoverIndex].x} cy={puntos[hoverIndex].y} r={4.5} fill={colorLinea} stroke="var(--c-bg-elev)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </>
                )}
              </svg>
            </div>

            <div className="relative mt-1.5" style={{ height: 14 }}>
              {buckets.map((b, i) => {
                // Las etiquetas de cambio de año ("ene '26") se muestran
                // siempre aunque no les toque turno en el diezmado — marcan
                // un corte real en la serie (mismo criterio que InformeAusentismo.tsx).
                if (i % pasoEtiqueta !== 0 && i !== ultimoIndex && !b.label.includes("'")) return null;
                return (
                  <span
                    key={b.key}
                    className="absolute -translate-x-1/2 text-[10.5px] text-[var(--c-text-faint)] whitespace-nowrap"
                    style={{ left: `${buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50}%` }}
                  >
                    {b.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tooltip && hoverIndex !== null && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{buckets[hoverIndex].labelLargo}</div>
          <div>
            <span className="font-bold tabular-nums">{buckets[hoverIndex].cantidad}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">{buckets[hoverIndex].cantidad === 1 ? "licencia" : "licencias"}</span>
          </div>
          {buckets[hoverIndex].ids.length > 0 && (
            <div className="text-[var(--c-text-faint)] mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">Doble click para ver el personal</div>
          )}
        </div>
      )}
    </div>
  );
}
