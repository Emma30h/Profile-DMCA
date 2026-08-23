"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConteoLabel, ConteoConIds } from "./stats";
import { buildQueryString } from "../personal/queryString";

const LETRA_TURNO = /^[A-F]$/;
// Bucket sintético (ver stats.ts): no es un valor real de turno, así que no
// tiene sentido armar un link de filtro con él (el filtro de turno matchea
// por el valor literal, y "Sin turno asignado" no es un turno real).
// Dependencia y origen no tienen este problema: filtran por ids puntuales de
// agente (ver ConteoConIds), así que su bucket "sin clasificar" también es
// filtrable como cualquier otro.
const SIN_TURNO_LABEL = "Sin turno asignado";

type Vista = "turno" | "dependencia" | "origen";
const VISTAS: Vista[] = ["turno", "dependencia", "origen"];
const VISTA_LABEL: Record<Vista, string> = {
  turno: "turno / guardia",
  dependencia: "dependencia",
  origen: "origen institucional",
};
const VISTA_LABEL_CORTO: Record<Vista, string> = {
  turno: "Turno",
  dependencia: "Dependencia",
  origen: "Origen",
};

interface Props {
  turno: ConteoLabel[];
  dependencia: ConteoConIds[];
  origenInstitucional: ConteoConIds[];
  totalActivos: number;
}

export default function TurnoDependenciaCard({ turno, dependencia, origenInstitucional, totalActivos }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("turno");
  const maxTurno = Math.max(1, ...turno.map((t) => t.count));
  const indiceVista = VISTAS.indexOf(vista);

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3.5 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">
          Activos por {VISTA_LABEL[vista]}
        </h3>
        <span className="text-[11px] text-[var(--c-text-faint)] tabular-nums">{totalActivos} agentes activos</span>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {VISTAS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                vista === v
                  ? "bg-[var(--c-blue)] text-white border-[var(--c-blue)]"
                  : "text-[var(--c-text-muted)] border-[var(--c-line)] hover:text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
              }`}
            >
              {VISTA_LABEL_CORTO[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden flex-1">
        <div
          className="flex h-full transition-transform duration-[420ms] ease-[cubic-bezier(.65,0,.35,1)]"
          style={{ transform: `translateX(-${indiceVista * 100}%)` }}
        >
          <div className="shrink-0 w-full">
            <div className="flex flex-col gap-2.5">
              {turno.map((t) => {
                const clickable = t.label !== SIN_TURNO_LABEL;
                return (
                  <div
                    key={t.label}
                    className={`grid grid-cols-[132px_1fr_34px] items-center gap-2.5 -mx-1.5 px-1.5 py-0.5 rounded-none transition-colors group ${
                      clickable ? "cursor-pointer hover:bg-[var(--c-bg-elev-2)]/60" : ""
                    }`}
                    onClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ turno: t.label, estado: "ACTIVO" })}`);
                    }}
                  >
                    <span className="text-[10px] font-medium text-[var(--c-text-muted)] whitespace-nowrap">{t.label}</span>
                    <div className="h-2.5 rounded-none bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-none transition-[filter] duration-150 ${
                          LETRA_TURNO.test(t.label) ? "bg-[var(--c-blue)]" : "bg-[var(--c-line-strong)]"
                        } ${clickable ? "group-hover:brightness-125" : ""}`}
                        style={{ width: `${(t.count / maxTurno) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[var(--c-text)] text-right tabular-nums">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 w-full">
            <div className="flex flex-col">
              {dependencia.map((d, i) => (
                <div
                  key={d.label}
                  className="flex items-center gap-2.5 py-2.5 border-b border-[var(--c-bg-elev-2)] last:border-b-0 -mx-1.5 px-1.5 rounded-lg transition-colors group cursor-pointer hover:bg-[var(--c-bg-elev-2)]/60"
                  onClick={() => router.push(`/personal?${buildQueryString({ ids: d.ids.join(",") })}`)}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 transition-[filter] duration-150 group-hover:brightness-125 ${
                      i === 0 ? "bg-[var(--c-blue)]" : "bg-[var(--c-line-strong)]"
                    }`}
                  />
                  <span className="text-[12.5px] text-[var(--c-text-muted)] flex-1 min-w-0 truncate">{d.label}</span>
                  <span className="text-[12.5px] font-semibold text-[var(--c-text)] tabular-nums">{d.count}</span>
                  <span className="text-[11px] text-[var(--c-text-faint)] w-9 text-right tabular-nums">
                    {totalActivos > 0 ? Math.round((d.count / totalActivos) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="shrink-0 w-full">
            <div className="flex flex-col">
              {origenInstitucional.map((o, i) => (
                <div
                  key={o.label}
                  className="flex items-center gap-2.5 py-2.5 border-b border-[var(--c-bg-elev-2)] last:border-b-0 -mx-1.5 px-1.5 rounded-lg transition-colors group cursor-pointer hover:bg-[var(--c-bg-elev-2)]/60"
                  onClick={() => router.push(`/personal?${buildQueryString({ ids: o.ids.join(",") })}`)}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 transition-[filter] duration-150 group-hover:brightness-125 ${
                      i === 0 ? "bg-[var(--c-blue)]" : "bg-[var(--c-line-strong)]"
                    }`}
                  />
                  <span className="text-[12.5px] text-[var(--c-text-muted)] flex-1 min-w-0 truncate">{o.label}</span>
                  <span className="text-[12.5px] font-semibold text-[var(--c-text)] tabular-nums">{o.count}</span>
                  <span className="text-[11px] text-[var(--c-text-faint)] w-9 text-right tabular-nums">
                    {totalActivos > 0 ? Math.round((o.count / totalActivos) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
