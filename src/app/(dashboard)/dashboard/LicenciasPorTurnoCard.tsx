"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calcularPorTurno, TURNOS_ROTATIVOS, type EjeTurno, type LicenciaAusentismoRow } from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import { useCountUp } from "@/lib/useCountUp";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

const TURNOS_RADAR = TURNOS_ROTATIVOS;
type TurnoRadar = (typeof TURNOS_RADAR)[number];
type Eje = EjeTurno;

interface Tooltip {
  x: number;
  y: number;
  eje: Eje;
}

const VB = 340;
const CENTRO = VB / 2;
const RADIO = 108;
const RADIO_LABEL = RADIO + 24;
const SEGMENTOS_GRILLA = 4; // 4 anillos de referencia (25/50/75/100% de escalaMax)
const ALTURA_LINEA = 13;

function puntoEje(i: number, r: number): { x: number; y: number } {
  // -90°: el primer eje (turno A) apunta derecho hacia arriba, el resto se
  // reparte en sentido horario cada 60° — mismo criterio visual que la
  // imagen de referencia que trajo el usuario.
  const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / TURNOS_RADAR.length;
  return { x: CENTRO + r * Math.cos(angulo), y: CENTRO + r * Math.sin(angulo) };
}

function anclaTexto(x: number): "start" | "middle" | "end" {
  if (x > CENTRO + 4) return "start";
  if (x < CENTRO - 4) return "end";
  return "middle";
}

function anclaVertical(y: number): "auto" | "hanging" | "middle" {
  if (y < CENTRO - 4) return "auto";
  if (y > CENTRO + 4) return "hanging";
  return "middle";
}

// Etiqueta (letra de turno) + cantidad apiladas, la que quede más cerca del
// punto del eje — igual criterio que CausasRadarCard.tsx: sin el número al
// lado, un turno con pocas licencias queda con el punto pegado al centro
// (aplastado por el que domina la escala) e indistinguible de "no hay
// datos" a simple vista.
function lineasEjeTurno(
  x: number,
  y: number,
  letra: string,
  valor: number
): { x: number; y: number; texto: string; esValor: boolean }[] {
  const anchorV = anclaVertical(y);
  const lineas = anchorV === "hanging" ? [String(valor), letra] : [letra, String(valor)];
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

export default function LicenciasPorTurnoCard({
  licencias,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  licencias: LicenciaAusentismoRow[];
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  const router = useRouter();

  const ejes: Eje[] = useMemo(() => calcularPorTurno(licencias), [licencias]);

  const totalCantidad = ejes.reduce((acc, e) => acc + e.cantidad, 0);
  const totalCantidadAnimado = useCountUp(totalCantidad, 0, modoExport ? 0 : 1600);
  const picoValor = Math.max(1, ...ejes.map((e) => e.cantidad));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);
  const anillos = Array.from({ length: SEGMENTOS_GRILLA }, (_, i) => (i + 1) / SEGMENTOS_GRILLA);

  // Radio en píxeles que le correspondería a cada eje con los datos
  // actuales — el objetivo al que el polígono tiene que "viajar".
  const radiosObjetivo = useMemo(
    () => ejes.map((e) => (e.cantidad / escalaMax) * RADIO),
    [ejes, escalaMax]
  );

  // Tween manual vía requestAnimationFrame (no CSS transition): el atributo
  // `points` de un <polygon> no es una propiedad animable por CSS, así que
  // interpolamos nosotros el radio de cada vértice cuadro a cuadro cuando
  // cambia el período — da el efecto de "el gráfico se va moviendo" que
  // pidió el usuario en vez de saltar de golpe a la forma nueva.
  // Arranca en 0 (no en radiosObjetivo): así, apenas monta —RevealOnScroll
  // recién lo monta cuando entra en pantalla—, el efecto de más abajo
  // detecta la diferencia contra el objetivo real y dispara el mismo tween
  // que ya usa el gráfico al cambiar de período, dando el efecto de "el
  // polígono va tomando forma" también en la primera aparición.
  // En modoExport arrancamos directo en el valor objetivo (no en 0): la
  // vista previa de descarga se monta una sola vez y tiene que salir ya
  // "crecida" — si se sembrara en 0 igual que la tarjeta normal, una
  // captura tomada apenas se abre el modal podría agarrar el tween a mitad
  // de camino.
  const [radiosAnimados, setRadiosAnimados] = useState<number[]>(() => (modoExport ? radiosObjetivo : radiosObjetivo.map(() => 0)));
  // Cantidad mostrada junto a cada vértice, interpolada en el mismo tween
  // que el radio (mismo t/k por cuadro): sin esto, el polígono se mueve
  // suave al cambiar de período pero el número de al lado salta de golpe al
  // valor nuevo — justo lo que se ve "feo" en la captura que trajo el
  // usuario. Los ejes son un array de orden fijo (TURNOS_RADAR, A a F, nunca
  // se reordena por valor), así que interpolar por posición es seguro acá.
  const [cantidadesAnimadas, setCantidadesAnimadas] = useState<number[]>(() =>
    modoExport ? ejes.map((e) => e.cantidad) : ejes.map(() => 0)
  );
  // Espejo del estado en un ref (sincronizado en un efecto, nunca durante el
  // render): lo lee el efecto de más abajo para saber desde dónde arrancar
  // la interpolación, sin tener que declarar `radiosAnimados`/`cantidadesAnimadas`
  // en sus dependencias (eso reiniciaría el efecto en cada uno de los ~24
  // frames que la propia animación genera).
  const radiosActualesRef = useRef(radiosAnimados);
  useEffect(() => {
    radiosActualesRef.current = radiosAnimados;
  });
  const cantidadesActualesRef = useRef(cantidadesAnimadas);
  useEffect(() => {
    cantidadesActualesRef.current = cantidadesAnimadas;
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const radiosInicio = radiosActualesRef.current;
    const radiosDestino = radiosObjetivo;
    const cantidadesInicio = cantidadesActualesRef.current;
    const cantidadesDestino = ejes.map((e) => e.cantidad);
    const sinCambios =
      radiosInicio.length === radiosDestino.length &&
      radiosInicio.every((v, i) => v === radiosDestino[i]) &&
      cantidadesInicio.length === cantidadesDestino.length &&
      cantidadesInicio.every((v, i) => v === cantidadesDestino[i]);
    if (sinCambios) return;
    const t0 = performance.now();
    function paso(ahora: number) {
      const t = Math.min(1, (ahora - t0) / DURACION_ANIM);
      const k = easeOutCubic(t);
      setRadiosAnimados(radiosInicio.map((v, i) => v + (radiosDestino[i] - v) * k));
      setCantidadesAnimadas(cantidadesInicio.map((v, i) => v + (cantidadesDestino[i] - v) * k));
      if (t < 1) rafRef.current = requestAnimationFrame(paso);
    }
    rafRef.current = requestAnimationFrame(paso);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [radiosObjetivo, ejes]);

  const puntosPoligono = ejes
    .map((e, i) => {
      const { x, y } = puntoEje(i, radiosAnimados[i] ?? 0);
      return `${x},${y}`;
    })
    .join(" ");

  const [hoverTurno, setHoverTurno] = useState<TurnoRadar | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  function irAPersonal(e: Eje) {
    if (e.ids.length > 0) router.push(`/personal?${buildQueryString({ ids: e.ids.join(",") })}`);
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Licencias por turno</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="licencias-por-turno">
            {(t) => <LicenciasPorTurnoCard licencias={licencias} modoExport tema={t} />}
          </GraficoDescargable>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Cantidad de licencias por turno, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total. Solo turnos rotativos (A a F); administrativos y otros turnos especiales quedan afuera de este gráfico.
      </p>

      <div className="flex-1 flex items-center justify-center">
      {totalCantidad === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin licencias en el período elegido.</p>
      ) : (
          <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full h-full max-w-[440px] max-h-[440px]">
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
              return <line key={e.turno} x1={CENTRO} y1={CENTRO} x2={x} y2={y} stroke="var(--c-line)" strokeWidth={1} opacity={0.5} />;
            })}

            {/* Escala numérica sobre el eje del turno A (el que apunta hacia arriba) */}
            {anillos.map((frac) => (
              <text key={frac} x={CENTRO + 4} y={CENTRO - RADIO * frac - 2} className="fill-[var(--c-text-faint)]" fontSize={9}>
                {Math.round(escalaMax * frac)}
              </text>
            ))}

            <polygon
              points={puntosPoligono}
              fill={tema.accent}
              fillOpacity={0.22}
              stroke={tema.accent}
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {ejes.map((e, i) => {
              const { x, y } = puntoEje(i, radiosAnimados[i] ?? 0);
              return (
                <g key={e.turno}>
                  {/* Hit target más grande que el punto visible (dataviz: hit targets bigger than the mark) */}
                  <circle
                    cx={x}
                    cy={y}
                    r={14}
                    fill="transparent"
                    className="cursor-pointer"
                    onPointerEnter={(ev) => {
                      setHoverTurno(e.turno);
                      setTooltip({ x: ev.clientX, y: ev.clientY, eje: e });
                    }}
                    onPointerMove={(ev) => setTooltip({ x: ev.clientX, y: ev.clientY, eje: e })}
                    onPointerLeave={() => {
                      setHoverTurno(null);
                      setTooltip(null);
                    }}
                    onDoubleClick={() => irAPersonal(e)}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={hoverTurno === e.turno ? 5.5 : 4}
                    fill={tema.accent}
                    stroke="var(--c-bg-elev)"
                    strokeWidth={1.5}
                    className="pointer-events-none transition-[r] duration-150"
                  />
                </g>
              );
            })}

            {ejes.map((e, i) => {
              const { x, y } = puntoEje(i, RADIO_LABEL);
              const lineas = lineasEjeTurno(x, y, e.turno, Math.round(cantidadesAnimadas[i] ?? e.cantidad));
              return (
                <g key={e.turno}>
                  {lineas.map((l, li) => (
                    <text
                      key={li}
                      x={l.x}
                      y={l.y}
                      textAnchor={anclaTexto(x)}
                      dominantBaseline={anclaVertical(y)}
                      className={
                        l.esValor
                          ? "tabular-nums"
                          : `transition-[fill] duration-150 ${
                              hoverTurno === e.turno ? "fill-[var(--c-text)]" : "fill-[var(--c-text-muted)]"
                            }`
                      }
                      style={l.esValor ? { fill: tema.accent } : undefined}
                      fontSize={l.esValor ? 11 : 13}
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
          <div className="font-bold mb-1">Turno {tooltip.eje.turno}</div>
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
