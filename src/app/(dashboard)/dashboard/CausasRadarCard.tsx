"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAUSAS_AUSENTISMO,
  causaDeLicencia,
  labelDeCausa,
  type CausaAusentismo,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import { useCountUp } from "@/lib/useCountUp";

type ModoPeriodo = "todo" | "anio" | "rango";

// Mismos turnos rotativos que en LicenciasPorTurnoCard.tsx (A a F) — acá
// como filtro en vez de eje, para responder "de estos tipos de licencia,
// cuál es el más frecuente DENTRO de tal turno" en vez de "en total".
const TURNOS_FILTRO = ["A", "B", "C", "D", "E", "F"] as const;
type TurnoFiltro = (typeof TURNOS_FILTRO)[number] | "todos";

interface Eje {
  causa: CausaAusentismo;
  cantidad: number;
  ids: string[];
}

interface Tooltip {
  x: number;
  y: number;
  eje: Eje;
}

const N = CAUSAS_AUSENTISMO.length; // 7 ejes: las 6 causas principales + Otros
// Lienzo más ancho que alto (a diferencia del radar de turnos, que es
// cuadrado): los labels de causa son mucho más largos que una sola letra
// ("Asistencia a Familiar Enfermo"), y en los ejes casi horizontales (el de
// Asistencia y el de Fallecimiento, los dos más próximos a 0°/180°) el
// texto se sale del margen y queda cortado si el lienzo es cuadrado.
const VB_ANCHO = 620;
const VB_ALTO = 460;
const CENTRO_X = VB_ANCHO / 2;
const CENTRO_Y = VB_ALTO / 2;
// No puede ser un radio idéntico al del radar de turnos (108px en un
// lienzo de 340): ese radio deja casi todo el lienzo ocupado por el
// polígono, y acá los labels son mucho más largos ("Asistencia a Familiar
// Enfermo") — necesitan margen alrededor o se vuelven a cortar. Este es el
// radio más grande que entra en un lienzo lo bastante ancho como para no
// recortar esos labels; deja el polígono un ~20% más chico que el de
// turnos en vez de exactamente igual.
const RADIO = 150;
const RADIO_LABEL = RADIO + 30;
const SEGMENTOS_GRILLA = 4; // 4 anillos de referencia (25/50/75/100% de escalaMax)
const ALTURA_LINEA = 11;

function puntoEje(i: number, r: number): { x: number; y: number } {
  const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return { x: CENTRO_X + r * Math.cos(angulo), y: CENTRO_Y + r * Math.sin(angulo) };
}

function anclaTexto(x: number): "start" | "middle" | "end" {
  if (x > CENTRO_X + 4) return "start";
  if (x < CENTRO_X - 4) return "end";
  return "middle";
}

function anclaVertical(y: number): "auto" | "hanging" | "middle" {
  if (y < CENTRO_Y - 4) return "auto";
  if (y > CENTRO_Y + 4) return "hanging";
  return "middle";
}

// Envuelve un label largo ("Asistencia a Familiar Enfermo") en hasta 2
// líneas, cortando en el límite de palabra más cercano a la mitad — evita
// que las etiquetas se superpongan entre sí en un radar de 7 ejes. Los
// labels cortos (≤13 caracteres, ej. "Maternidad" u "Otros") quedan en una
// sola línea.
function envolverEtiqueta(texto: string): string[] {
  if (texto.length <= 13) return [texto];
  const palabras = texto.split(" ");
  if (palabras.length <= 1) return [texto];
  let mejorCorte = 1;
  let mejorDiff = Infinity;
  let acumulado = 0;
  for (let i = 0; i < palabras.length - 1; i++) {
    acumulado += palabras[i].length + 1;
    const diff = Math.abs(acumulado - texto.length / 2);
    if (diff < mejorDiff) {
      mejorDiff = diff;
      mejorCorte = i + 1;
    }
  }
  return [palabras.slice(0, mejorCorte).join(" "), palabras.slice(mejorCorte).join(" ")];
}

// Posición de cada línea (nombre de causa + cantidad al final) de un eje:
// la cantidad se muestra siempre, aunque el punto quede pegado al centro
// por la escala — Carpeta Médica (116) aplasta el resto contra el medio, y
// sin el número al lado un valor real como Fallecimiento (2) es
// indistinguible de "no hay datos". La línea más cercana al punto del eje
// queda pegada a él y las demás se apilan hacia afuera, en vez de
// repartirse alrededor del punto (que en un eje de arriba/abajo dejaría
// una línea "flotando" del lado equivocado).
function lineasEtiqueta(
  x: number,
  y: number,
  lineasLabel: string[],
  valor: number
): { x: number; y: number; texto: string; esValor: boolean }[] {
  const anchorV = anclaVertical(y);
  // Para "hanging" (eje de abajo) el valor va primero (más cerca del
  // punto, que está arriba de las líneas); para "auto" (eje de arriba) va
  // último (más cerca del punto, que está abajo de las líneas).
  const lineas = anchorV === "hanging" ? [String(valor), ...lineasLabel] : [...lineasLabel, String(valor)];
  return lineas.map((texto, i) => {
    let yLinea: number;
    if (anchorV === "auto") {
      yLinea = y - (lineas.length - 1 - i) * ALTURA_LINEA;
    } else if (anchorV === "hanging") {
      yLinea = y + i * ALTURA_LINEA;
    } else {
      yLinea = y - ((lineas.length - 1) / 2) * ALTURA_LINEA + i * ALTURA_LINEA;
    }
    const esValor = anchorV === "hanging" ? i === 0 : i === lineas.length - 1;
    return { x, y: yLinea, texto, esValor };
  });
}

const DURACION_ANIM = 400;
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function CausasRadarCard({ licencias, hoy }: { licencias: LicenciaAusentismoRow[]; hoy: string }) {
  const router = useRouter();
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);

  const anios = useMemo(() => {
    const set = new Set(licencias.map((l) => new Date(l.fechaInicio).getUTCFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [licencias]);

  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [anio, setAnio] = useState<number | null>(null);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState<TurnoFiltro>("todos");
  const anioActivo = anio ?? anios[0] ?? hoyDate.getUTCFullYear();

  function elegirPeriodo(valor: string) {
    if (valor === "todo") {
      setModo("todo");
      return;
    }
    if (valor === "rango") {
      setModo("rango");
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

  const licenciasPeriodo = useMemo(() => {
    if (modo === "anio") {
      return licencias.filter((l) => new Date(l.fechaInicio).getUTCFullYear() === anioActivo);
    }
    if (modo === "rango") {
      if (!rangoDesde || !rangoHasta) return [];
      return licencias.filter((l) => {
        const f = l.fechaInicio.slice(0, 10);
        return f >= rangoDesde && f <= rangoHasta;
      });
    }
    return licencias;
  }, [licencias, modo, anioActivo, rangoDesde, rangoHasta]);

  const licenciasFiltradas = useMemo(
    () => (turnoFiltro === "todos" ? licenciasPeriodo : licenciasPeriodo.filter((l) => l.agente.turno === turnoFiltro)),
    [licenciasPeriodo, turnoFiltro]
  );

  const ejes: Eje[] = useMemo(() => {
    const porCausa = new Map<CausaAusentismo, { cantidad: number; ids: string[] }>(
      CAUSAS_AUSENTISMO.map((c) => [c, { cantidad: 0, ids: [] }])
    );
    for (const l of licenciasFiltradas) {
      const entrada = porCausa.get(causaDeLicencia(l.tipo))!;
      entrada.cantidad += 1;
      if (!entrada.ids.includes(l.agenteId)) entrada.ids.push(l.agenteId);
    }
    return CAUSAS_AUSENTISMO.map((c) => ({ causa: c, ...porCausa.get(c)! }));
  }, [licenciasFiltradas]);

  const totalCantidad = ejes.reduce((acc, e) => acc + e.cantidad, 0);
  const totalCantidadAnimado = useCountUp(totalCantidad);
  const picoValor = Math.max(1, ...ejes.map((e) => e.cantidad));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);
  const anillos = Array.from({ length: SEGMENTOS_GRILLA }, (_, i) => (i + 1) / SEGMENTOS_GRILLA);

  const radiosObjetivo = useMemo(() => ejes.map((e) => (e.cantidad / escalaMax) * RADIO), [ejes, escalaMax]);

  // Mismo tween manual vía requestAnimationFrame que "Licencias por turno":
  // el atributo `points` de un <polygon> no es animable por CSS, así que
  // interpolamos el radio de cada vértice cuadro a cuadro al cambiar de
  // período, en vez de saltar de golpe a la forma nueva.
  // Arranca en 0 (no en radiosObjetivo): así, apenas monta —RevealOnScroll
  // recién lo monta cuando entra en pantalla—, el efecto de más abajo
  // detecta la diferencia contra el objetivo real y dispara el mismo tween
  // que ya usa el gráfico al cambiar de período, dando el efecto de "el
  // polígono va tomando forma" también en la primera aparición.
  const [radiosAnimados, setRadiosAnimados] = useState<number[]>(() => radiosObjetivo.map(() => 0));
  const radiosActualesRef = useRef(radiosAnimados);
  useEffect(() => {
    radiosActualesRef.current = radiosAnimados;
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const inicio = radiosActualesRef.current;
    const destino = radiosObjetivo;
    if (inicio.length === destino.length && inicio.every((v, i) => v === destino[i])) return;
    const t0 = performance.now();
    function paso(ahora: number) {
      const t = Math.min(1, (ahora - t0) / DURACION_ANIM);
      const k = easeOutCubic(t);
      setRadiosAnimados(inicio.map((v, i) => v + (destino[i] - v) * k));
      if (t < 1) rafRef.current = requestAnimationFrame(paso);
    }
    rafRef.current = requestAnimationFrame(paso);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [radiosObjetivo]);

  const puntosPoligono = ejes
    .map((e, i) => {
      const { x, y } = puntoEje(i, radiosAnimados[i] ?? 0);
      return `${x},${y}`;
    })
    .join(" ");

  const [hoverCausa, setHoverCausa] = useState<CausaAusentismo | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  function irAPersonal(e: Eje) {
    if (e.ids.length > 0) router.push(`/personal?${buildQueryString({ ids: e.ids.join(",") })}`);
  }

  if (licencias.length === 0) {
    return (
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Tipos de licencia más frecuentes</h3>
        <p className="text-[12.5px] text-[var(--c-text-faint)]">Todavía no hay licencias aprobadas cargadas.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Tipos de licencia más frecuentes</h3>
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
              <div className="absolute right-0 top-full mt-1 z-30 flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40 whitespace-nowrap">
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
          <select
            value={turnoFiltro}
            onChange={(e) => setTurnoFiltro(e.target.value as TurnoFiltro)}
            className="text-[11px] font-semibold text-[var(--c-text-muted)] bg-[var(--c-bg-elev)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
          >
            <option value="todos">Todos los turnos</option>
            {TURNOS_FILTRO.map((t) => (
              <option key={t} value={t}>Turno {t}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Cantidad de licencias por tipo, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total{turnoFiltro !== "todos" && <> del turno <b className="text-[var(--c-text-muted)]">{turnoFiltro}</b></>}.
      </p>

      <div className="flex-1 flex items-center justify-center">
      {totalCantidad === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin licencias en el período elegido.</p>
      ) : (
          <svg viewBox={`0 0 ${VB_ANCHO} ${VB_ALTO}`} className="w-full max-w-[400px]">
            {anillos.map((frac) => {
              const puntos = ejes.map((_, i) => { const { x, y } = puntoEje(i, RADIO * frac); return `${x},${y}`; }).join(" ");
              return (
                <polygon
                  key={frac}
                  points={puntos}
                  fill="none"
                  stroke="var(--c-line)"
                  strokeWidth={1}
                  opacity={frac === 1 ? 1 : 0.5}
                />
              );
            })}

            {ejes.map((e, i) => {
              const { x, y } = puntoEje(i, RADIO);
              return <line key={e.causa} x1={CENTRO_X} y1={CENTRO_Y} x2={x} y2={y} stroke="var(--c-line)" strokeWidth={1} opacity={0.5} />;
            })}

            {/* Escala numérica sobre el primer eje (el que apunta hacia arriba) */}
            {anillos.map((frac) => (
              <text key={frac} x={CENTRO_X + 4} y={CENTRO_Y - RADIO * frac - 2} className="fill-[var(--c-text-faint)]" fontSize={9}>
                {Math.round(escalaMax * frac)}
              </text>
            ))}

            <polygon
              points={puntosPoligono}
              fill="var(--c-blue)"
              fillOpacity={0.22}
              stroke="var(--c-blue)"
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {ejes.map((e, i) => {
              const { x, y } = puntoEje(i, radiosAnimados[i] ?? 0);
              return (
                <g key={e.causa}>
                  {/* Hit target más grande que el punto visible (dataviz: hit targets bigger than the mark) */}
                  <circle
                    cx={x}
                    cy={y}
                    r={14}
                    fill="transparent"
                    className="cursor-pointer"
                    onPointerEnter={(ev) => {
                      setHoverCausa(e.causa);
                      setTooltip({ x: ev.clientX, y: ev.clientY, eje: e });
                    }}
                    onPointerMove={(ev) => setTooltip({ x: ev.clientX, y: ev.clientY, eje: e })}
                    onPointerLeave={() => {
                      setHoverCausa(null);
                      setTooltip(null);
                    }}
                    onDoubleClick={() => irAPersonal(e)}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={hoverCausa === e.causa ? 5.5 : 4}
                    fill="var(--c-blue)"
                    stroke="var(--c-bg-elev)"
                    strokeWidth={1.5}
                    className="pointer-events-none transition-[r] duration-150"
                  />
                </g>
              );
            })}

            {ejes.map((e, i) => {
              const { x, y } = puntoEje(i, RADIO_LABEL);
              const lineas = lineasEtiqueta(x, y, envolverEtiqueta(labelDeCausa(e.causa)), e.cantidad);
              return (
                <g key={e.causa}>
                  {lineas.map((l, li) => (
                    <text
                      key={li}
                      x={l.x}
                      y={l.y}
                      textAnchor={anclaTexto(x)}
                      dominantBaseline={anclaVertical(y)}
                      className={
                        l.esValor
                          ? "fill-[var(--c-blue)] tabular-nums"
                          : `transition-[fill] duration-150 ${
                              hoverCausa === e.causa ? "fill-[var(--c-text)]" : "fill-[var(--c-text-muted)]"
                            }`
                      }
                      fontSize={l.esValor ? 11 : 10}
                      fontWeight={l.esValor ? 700 : 600}
                    >
                      {l.texto}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
      )}
      </div>

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{labelDeCausa(tooltip.eje.causa)}</div>
          <div>
            <span className="font-bold tabular-nums">{tooltip.eje.cantidad}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">
              {totalCantidad > 0 ? Math.round((tooltip.eje.cantidad / totalCantidad) * 100) : 0}% del total
            </span>
          </div>
          {tooltip.eje.ids.length > 0 && (
            <div className="text-[var(--c-text-faint)] mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">Doble click para ver el personal</div>
          )}
        </div>
      )}
    </div>
  );
}
