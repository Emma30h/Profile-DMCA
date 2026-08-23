"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TipoPersonal } from "@/types";
import type { TipoPersonalStats } from "./stats";

const R = 70;
const CIRCUNFERENCIA = 2 * Math.PI * R;

// Paleta categórica validada con el skill de dataviz (scripts/validate_palette.js,
// modo oscuro, --pairs all porque el orden de las porciones cambia con los
// datos — cualquier par puede terminar siendo adyacente en el anillo). El
// verde/magenta anteriores no pasaban ese chequeo (ΔE insuficiente entre
// pares). El único WARN (ΔE 6.5 en visión deuteranope/protanope entre
// TECNICO y CIVIL_BECARIO) queda cubierto por la leyenda de abajo, que ya
// muestra la etiqueta de texto de cada tipo — la identidad no depende solo
// del color.
const COLORES: Record<TipoPersonal, string> = {
  SEGURIDAD: "#3987e5",
  TECNICO: "#199e70",
  CIVIL_BECARIO: "#e66767",
  CIVIL_POLICIAL: "#a67c00",
};

const LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

interface Props {
  data: TipoPersonalStats[];
  total: number;
}

export default function DonutTipoPersonal({ data, total }: Props) {
  const router = useRouter();
  const [hover, setHover] = useState<TipoPersonal | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; tipo: TipoPersonal } | null>(null);
  const [comoTabla, setComoTabla] = useState(false);

  function irAPersonalFiltrado(tipo: TipoPersonal) {
    // El donut cuenta solo activos — sin este filtro, /personal muestra el
    // tipo en todos los estados (pendientes/bajas/pases incluidos) y el
    // total no coincide con el que se ve acá.
    router.push(`/personal?tipo=${tipo}&estado=ACTIVO`);
  }

  // Largo del arco a partir de la fracción exacta (count/total), no del pct
  // ya redondeado a entero — sumar pcts redondeados por separado puede dar
  // 101% o 99%, y ese desvío corre el offset acumulado del último segmento
  // hasta coincidir con el del primero, tapándolo por completo. Además, un
  // mínimo de largo visible evita que un tipo con muy pocos agentes (ej. 1%)
  // quede como una franja de menos de un píxel, invisible en la práctica.
  const MIN_LARGO = 6;
  const segmentos = data.reduce<Array<TipoPersonalStats & { largo: number; offset: number }>>((acc, d) => {
    const acumulado = acc.length > 0 ? -acc[acc.length - 1].offset + acc[acc.length - 1].largo : 0;
    const fraccion = total > 0 ? d.count / total : 0;
    const largo = d.count > 0 ? Math.max(fraccion * CIRCUNFERENCIA, MIN_LARGO) : 0;
    return [...acc, { ...d, largo, offset: -acumulado }];
  }, []);

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 flex flex-col h-full">
      <div className="flex items-baseline justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Activos por tipo de personal</h3>
        <button
          type="button"
          onClick={() => setComoTabla((v) => !v)}
          className="text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
        >
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      <div className="overflow-hidden flex-1">
        <div className={`dashboard-slide-track h-full ${comoTabla ? "mostrar-detalle" : ""}`}>
          <div className="dashboard-slide-pane flex items-center gap-7 flex-wrap">
            <div className="relative w-[200px] h-[200px] shrink-0">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="100" cy="100" r={R} fill="none" stroke="#0b1220" strokeWidth="32" />
                {segmentos.map((s) => (
                  <circle
                    key={s.tipo}
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke={COLORES[s.tipo]}
                    strokeWidth={hover === s.tipo ? 36 : 32}
                    strokeDasharray={`${s.largo} ${CIRCUNFERENCIA}`}
                    strokeDashoffset={s.offset}
                    className="cursor-pointer transition-[stroke-width] duration-150"
                    style={{ filter: hover === s.tipo ? "brightness(1.12)" : undefined }}
                    onPointerMove={(e) => {
                      setHover(s.tipo);
                      setTooltip({ x: e.clientX, y: e.clientY, tipo: s.tipo });
                    }}
                    onPointerLeave={() => {
                      setHover(null);
                      setTooltip(null);
                    }}
                    onDoubleClick={() => irAPersonalFiltrado(s.tipo)}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-3xl font-semibold tracking-tight text-[var(--c-text)] tabular-nums">{total}</span>
                <span className="text-[10.5px] text-[var(--c-text-faint)] mt-1 max-w-[88px] leading-tight">personal activo</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 flex-1 min-w-[220px]">
              {data.map((d) => (
                <div
                  key={d.tipo}
                  onPointerEnter={() => setHover(d.tipo)}
                  onPointerLeave={() => setHover(null)}
                  onDoubleClick={() => irAPersonalFiltrado(d.tipo)}
                  className={`grid grid-cols-[12px_1fr_auto_auto] items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                    hover === d.tipo ? "bg-[var(--c-bg-elev-2)]/70 border-[var(--c-line)]" : "border-transparent"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-[3.5px]" style={{ background: COLORES[d.tipo] }} />
                  <span className="text-[12.5px] font-medium text-[var(--c-text)]">{LABELS[d.tipo]}</span>
                  <span className="text-[13px] font-semibold text-[var(--c-text)] tabular-nums">{d.count}</span>
                  <span className="text-[11.5px] text-[var(--c-text-faint)] w-8 text-right tabular-nums">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-slide-pane">
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)]">
                    Tipo de personal
                  </th>
                  <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums">
                    Activos
                  </th>
                  <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums">
                    % del total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr
                    key={d.tipo}
                    onDoubleClick={() => irAPersonalFiltrado(d.tipo)}
                    className="cursor-pointer hover:bg-[var(--c-bg-elev-2)]/40"
                  >
                    <td className="py-2.5 border-b border-[var(--c-bg-elev-2)] text-[var(--c-text)]">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORES[d.tipo] }} />
                        {LABELS[d.tipo]}
                      </span>
                    </td>
                    <td className="py-2.5 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text)] tabular-nums">{d.count}</td>
                    <td className="py-2.5 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text)] tabular-nums">{d.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <span className="font-bold tabular-nums">
            {data.find((d) => d.tipo === tooltip.tipo)?.count} ({data.find((d) => d.tipo === tooltip.tipo)?.pct}%)
          </span>
          <span className="text-[var(--c-text-faint)] ml-1.5">{LABELS[tooltip.tipo]}</span>
        </div>
      )}
    </div>
  );
}
