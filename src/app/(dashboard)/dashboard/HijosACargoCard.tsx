"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RingCompare from "./RingCompare";
import type { HijosStats } from "./stats";
import { buildQueryString } from "../personal/queryString";
import { useEntrada } from "@/lib/useEntrada";

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
  /** Escalona esta tarjeta respecto de otras en la misma pantalla al montar. */
  delayMs?: number;
}

export default function HijosACargoCard({ hijos, delayMs = 0 }: Props) {
  const router = useRouter();
  const [verDetalle, setVerDetalle] = useState(false);
  const max = Math.max(1, ...hijos.histograma.map((h) => h.count));
  const listo = useEntrada(delayMs);

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-baseline justify-between mb-3.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Personal con hijos a cargo</h3>
        <span className="text-[11px] text-[var(--c-text-faint)] tabular-nums">{hijos.totalActivos} agentes activos</span>
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
              delayMs={delayMs}
            />
          </div>

          <div className="dashboard-slide-pane pt-1">
            <div className="flex flex-col gap-2.5">
              {hijos.histograma.map((h, i) => {
                const dim = h.label === "0 hijos" || h.label === "+4 hijos";
                const clickable = h.count > 0;
                return (
                  <div
                    key={h.label}
                    className={`grid grid-cols-[96px_1fr_34px] items-center gap-2.5 -mx-1.5 px-1.5 py-0.5 rounded-lg transition-colors group ${
                      clickable ? "cursor-pointer hover:bg-[var(--c-bg-elev-2)]/60" : ""
                    }`}
                    onClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ ids: h.ids.join(",") })}`);
                    }}
                  >
                    <span className="text-xs font-medium text-[var(--c-text-muted)] truncate">{h.label}</span>
                    <div className="h-2.5 rounded-none bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] overflow-hidden">
                      <div
                        className={`h-full rounded-none ${dim ? "bg-[var(--c-line-strong)]" : "bg-[var(--c-blue)]"} ${
                          clickable ? "group-hover:brightness-125" : ""
                        }`}
                        style={{
                          width: `${listo ? (h.count / max) * 100 : 0}%`,
                          transition: `filter 150ms, width 550ms cubic-bezier(.22,1,.36,1) ${i * 35}ms`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[var(--c-text)] text-right tabular-nums">{h.count}</span>
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
        className="block mx-auto mt-4 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
      >
        {verDetalle ? "Ocultar cantidad de hijos" : "Ver por cantidad de hijos"}
      </button>
    </div>
  );
}
