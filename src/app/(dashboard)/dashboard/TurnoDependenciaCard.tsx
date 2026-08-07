"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConteoLabel, ConteoConIds } from "./stats";
import { buildQueryString } from "../personal/queryString";

const LETRA_TURNO = /^[A-F]$/;
// Buckets sintéticos (ver stats.ts) — no son un valor real de turno/sector/
// origen, así que no tiene sentido armar un link de filtro con ellos.
const SIN_TURNO_LABEL = "Sin turno asignado";
const SIN_DEPENDENCIA_LABEL = "Sin dependencia asignada";
const SIN_ORIGEN_LABEL = "Sin clasificar";

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
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4.5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3.5 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-100">
          Activos por {VISTA_LABEL[vista]}
        </h3>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[11px] text-slate-500 tabular-nums">{totalActivos} agentes activos</span>
          <div className="flex items-center gap-1">
            {VISTAS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                  vista === v
                    ? "bg-blue-500 text-white border-blue-500"
                    : "text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600"
                }`}
              >
                {VISTA_LABEL_CORTO[v]}
              </button>
            ))}
          </div>
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
                    className={`grid grid-cols-[96px_1fr_34px] items-center gap-2.5 -mx-1.5 px-1.5 py-0.5 rounded-lg transition-colors group ${
                      clickable ? "cursor-pointer hover:bg-slate-800/60" : ""
                    }`}
                    onDoubleClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ turno: t.label, estado: "ACTIVO" })}`);
                    }}
                  >
                    <span className="text-xs font-medium text-slate-400 truncate">{t.label}</span>
                    <div className="h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[filter] duration-150 ${
                          LETRA_TURNO.test(t.label) ? "bg-blue-500" : "bg-slate-600"
                        } ${clickable ? "group-hover:brightness-125" : ""}`}
                        style={{ width: `${(t.count / maxTurno) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-100 text-right tabular-nums">{t.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 w-full">
            <div className="flex flex-col">
              {dependencia.map((d, i) => {
                const clickable = d.label !== SIN_DEPENDENCIA_LABEL;
                return (
                  <div
                    key={d.label}
                    className={`flex items-center gap-2.5 py-2.5 border-b border-slate-800 last:border-b-0 -mx-1.5 px-1.5 rounded-lg transition-colors group ${
                      clickable ? "cursor-pointer hover:bg-slate-800/60" : ""
                    }`}
                    onDoubleClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ ids: d.ids.join(",") })}`);
                    }}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-[filter] duration-150 ${
                        i === 0 ? "bg-blue-500" : "bg-slate-600"
                      } ${clickable ? "group-hover:brightness-125" : ""}`}
                    />
                    <span className="text-[12.5px] text-slate-400 flex-1 min-w-0 truncate">{d.label}</span>
                    <span className="text-[12.5px] font-semibold text-slate-100 tabular-nums">{d.count}</span>
                    <span className="text-[11px] text-slate-500 w-9 text-right tabular-nums">
                      {totalActivos > 0 ? Math.round((d.count / totalActivos) * 100) : 0}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 w-full">
            <div className="flex flex-col">
              {origenInstitucional.map((o, i) => {
                const clickable = o.label !== SIN_ORIGEN_LABEL;
                return (
                  <div
                    key={o.label}
                    className={`flex items-center gap-2.5 py-2.5 border-b border-slate-800 last:border-b-0 -mx-1.5 px-1.5 rounded-lg transition-colors group ${
                      clickable ? "cursor-pointer hover:bg-slate-800/60" : ""
                    }`}
                    onDoubleClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ ids: o.ids.join(",") })}`);
                    }}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-[filter] duration-150 ${
                        i === 0 ? "bg-blue-500" : "bg-slate-600"
                      } ${clickable ? "group-hover:brightness-125" : ""}`}
                    />
                    <span className="text-[12.5px] text-slate-400 flex-1 min-w-0 truncate">{o.label}</span>
                    <span className="text-[12.5px] font-semibold text-slate-100 tabular-nums">{o.count}</span>
                    <span className="text-[11px] text-slate-500 w-9 text-right tabular-nums">
                      {totalActivos > 0 ? Math.round((o.count / totalActivos) * 100) : 0}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
