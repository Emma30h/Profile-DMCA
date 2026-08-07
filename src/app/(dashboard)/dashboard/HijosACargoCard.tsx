"use client";

import { useState } from "react";
import RingCompare from "./RingCompare";
import type { HijosStats } from "./stats";
import { buildQueryString } from "../personal/queryString";

function hrefIds(ids: string[]): string {
  return ids.length > 0 ? `/personal?${buildQueryString({ ids: ids.join(",") })}` : "/personal";
}

const CON_HIJOS_COLOR = "#1f9e6d";
const SIN_HIJOS_COLOR = "#64748b";

function IconoCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M4 10.5l3.5 3.5L16 5.5" />
    </svg>
  );
}

function IconoGuion() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="w-full h-full">
      <path d="M5 10h10" />
    </svg>
  );
}

interface Props {
  hijos: HijosStats;
}

export default function HijosACargoCard({ hijos }: Props) {
  const [verDetalle, setVerDetalle] = useState(false);
  const max = Math.max(1, ...hijos.histograma.map((h) => h.count));

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4.5">
      <div className="flex items-baseline justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-slate-100">Personal con hijos a cargo</h3>
        <span className="text-[11px] text-slate-500 tabular-nums">{hijos.totalActivos} agentes activos</span>
      </div>

      <div className="overflow-hidden">
        <div className={`dashboard-slide-track ${verDetalle ? "mostrar-detalle" : ""}`}>
          <div className="dashboard-slide-pane">
            <RingCompare
              left={{
                value: hijos.conHijos.count,
                label: "Con hijos a cargo",
                pct: hijos.conHijos.pct,
                color: CON_HIJOS_COLOR,
                icon: <IconoCheck />,
                href: hrefIds(hijos.conHijosIds),
              }}
              right={{
                value: hijos.sinHijos.count,
                label: "Sin hijos a cargo",
                pct: hijos.sinHijos.pct,
                color: SIN_HIJOS_COLOR,
                icon: <IconoGuion />,
                href: hrefIds(hijos.sinHijosIds),
              }}
            />
          </div>

          <div className="dashboard-slide-pane pt-1">
            <div className="flex flex-col gap-2.5">
              {hijos.histograma.map((h) => {
                const dim = h.label === "0 hijos" || h.label === "+4 hijos";
                return (
                  <div key={h.label} className="grid grid-cols-[96px_1fr_34px] items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-400 truncate">{h.label}</span>
                    <div className="h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${dim ? "bg-slate-600" : "bg-blue-500"}`}
                        style={{ width: `${(h.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-100 text-right tabular-nums">{h.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setVerDetalle((v) => !v)}
        className="block mx-auto mt-4 text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-md px-2.5 py-1 transition-colors"
      >
        {verDetalle ? "Ocultar cantidad de hijos" : "Ver por cantidad de hijos"}
      </button>
    </div>
  );
}
