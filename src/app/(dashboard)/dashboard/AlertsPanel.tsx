"use client";

import { useState } from "react";
import Link from "next/link";
import type { AlertaStats } from "./stats";
import { buildQueryString } from "../personal/queryString";

type Severidad = "ok" | "warn" | "crit";

const SEV_DOT: Record<Severidad, string> = {
  ok: "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,.15)]",
  warn: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,.15)]",
  crit: "bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,.15)]",
};

const SEV_CHIP: Record<Severidad, string> = {
  ok: "bg-green-500/10 text-green-400",
  warn: "bg-amber-400/10 text-amber-300",
  crit: "bg-red-500/10 text-red-300",
};

interface Fila {
  severidad: Severidad;
  titulo: React.ReactNode;
  meta: string;
  chip: string;
  href: string;
}

export default function AlertsPanel({ alertas }: { alertas: AlertaStats }) {
  const [abierto, setAbierto] = useState(false);

  const { licenciasPorVencer, conducirVencida, conducirVencidaIds, chalecoVencido, chalecoVencidoIds, chalecoTotal } = alertas;

  const nombresMuestra =
    licenciasPorVencer.apellidosMuestra.join(", ") +
    (licenciasPorVencer.restantes > 0 ? ` +${licenciasPorVencer.restantes}` : "");

  const filas: Fila[] = [
    {
      severidad: licenciasPorVencer.cantidad > 0 ? "warn" : "ok",
      titulo:
        licenciasPorVencer.cantidad > 0 ? (
          <>
            <b className="font-bold">{licenciasPorVencer.cantidad} licencias</b> vencen en los próximos 7 días
          </>
        ) : (
          "Sin licencias por vencer en los próximos 7 días"
        ),
      meta: nombresMuestra,
      chip: licenciasPorVencer.cantidad > 0 ? "Esta semana" : "Al día",
      href: "/licencias",
    },
    {
      severidad: conducirVencida > 0 ? "crit" : "ok",
      titulo:
        conducirVencida > 0 ? (
          <>
            <b className="font-bold">{conducirVencida} agentes</b> con licencia de conducir vencida
          </>
        ) : (
          "Licencias de conducir al día"
        ),
      meta: "Personal de Seguridad y Técnico — revisar en Datos Laborales",
      chip: conducirVencida > 0 ? "Vencido" : "OK",
      href: conducirVencida > 0
        ? `/personal?${buildQueryString({ ids: conducirVencidaIds.join(",") })}`
        : "/personal",
    },
    {
      severidad: chalecoVencido > 0 ? "crit" : "ok",
      titulo:
        chalecoVencido > 0 ? (
          <>
            <b className="font-bold">{chalecoVencido} chalecos</b> vencidos
          </>
        ) : (
          "Vencimientos de chaleco al día"
        ),
      meta: `${chalecoVencido} chalecos vencidos sobre el personal de Seguridad activo (${chalecoTotal} con chaleco provisto)`,
      chip: chalecoVencido > 0 ? "Vencido" : "OK",
      href: chalecoVencido > 0
        ? `/personal?${buildQueryString({ ids: chalecoVencidoIds.join(",") })}`
        : "/personal",
    },
  ];

  const puntosARevisar = filas.filter((f) => f.severidad !== "ok").length;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4.5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-100">Atención requerida</h3>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full">
            {puntosARevisar} {puntosARevisar === 1 ? "punto a revisar" : "puntos a revisar"}
          </span>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            aria-label={abierto ? "Colapsar Atención requerida" : "Expandir Atención requerida"}
            className={`w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-transform duration-300 ${
              abierto ? "" : "-rotate-90"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="5 8 10 13 15 8" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`dashboard-collapse ${abierto ? "abierto" : ""}`}>
        <div>
          <div className="flex flex-col">
            {filas.map((f, i) => (
              <Link
                key={i}
                href={f.href}
                className="flex items-center gap-3.5 px-4.5 py-3.5 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${SEV_DOT[f.severidad]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-slate-100">{f.titulo}</div>
                  {f.meta && <div className="text-[11.5px] text-slate-500 mt-0.5">{f.meta}</div>}
                </div>
                <span className={`text-[10.5px] font-bold tracking-wide px-2 py-1 rounded-md shrink-0 ${SEV_CHIP[f.severidad]}`}>
                  {f.chip}
                </span>
                <span className="text-slate-600 text-sm shrink-0">›</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
