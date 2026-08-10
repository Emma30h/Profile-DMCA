"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TIPO_LICENCIA_LABELS, LICENCIA_CATEGORIA_DE_TIPO, CATEGORIA_LICENCIA_INFO, type TipoLicencia } from "@/types";
import type { NovedadTipoStats, TnoStats } from "./stats";
import { buildQueryString } from "../personal/queryString";

const TIPO_LABEL = TIPO_LICENCIA_LABELS;

function categoriaInfo(tipo: TipoLicencia) {
  return CATEGORIA_LICENCIA_INFO[LICENCIA_CATEGORIA_DE_TIPO[tipo]];
}

export default function NovedadesDrawer({
  novedades,
  tno,
  // Fallback por si queda una respuesta vieja cacheada en Redis (5 min de
  // TTL) de antes de que este campo existiera — sin esto, cualquier campo
  // nuevo que se agregue a DashboardStats rompe la página hasta que expire
  // la caché.
  cursoAscenso = { count: 0, ids: [] },
}: {
  novedades: NovedadTipoStats[];
  tno: TnoStats;
  cursoAscenso?: TnoStats;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const total = novedades.reduce((acc, n) => acc + n.count, 0) + tno.count + cursoAscenso.count;

  function irAPersonalFiltrado(ids: string[] | undefined) {
    if (!ids || ids.length === 0) return;
    router.push(`/personal?${buildQueryString({ ids: ids.join(",") })}`);
  }

  // Escape para cerrar, igual que el resto de los paneles/overlays de la app.
  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-expanded={abierto}
        aria-controls="novedades-drawer"
        // Cerrada, esta pestaña flota a media altura de la pantalla, sobre
        // el borde derecho.
        className={`fixed top-1/2 -translate-y-1/2 z-40 flex flex-col items-center rounded-l-[10px] border border-r-0 border-slate-700 bg-slate-900 px-1.5 py-4.5 text-slate-400 shadow-[-4px_0_16px_rgba(0,0,0,.25)] transition-[right,background-color,color] duration-300 hover:bg-slate-800 hover:text-slate-200 ${
          // El cajón es w-[380px] max-w-[88vw] (ver <aside> abajo) — este
          // offset tiene que replicar exactamente ese mismo cálculo, si no
          // en pantallas angostas el botón queda desalineado del borde real
          // del cajón (o directamente empujado fuera del viewport).
          abierto ? "right-[min(380px,88vw)]" : "right-0"
        }`}
      >
        <span className="text-[11px] font-semibold tracking-wide whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
          Novedades administrativas
        </span>
      </button>

      <div
        onClick={() => setAbierto(false)}
        className={`fixed inset-0 z-50 bg-slate-950/60 transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        id="novedades-drawer"
        aria-hidden={!abierto}
        className={`fixed top-0 right-0 bottom-0 z-[51] flex w-[380px] max-w-[88vw] flex-col overflow-y-auto border-l border-slate-700 bg-slate-900 shadow-[-12px_0_32px_rgba(0,0,0,.45)] transition-transform duration-300 ease-[cubic-bezier(.65,0,.35,1)] ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4.5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Novedades administrativas</h3>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              {total} {total === 1 ? "vigente hoy" : "vigentes hoy"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-500 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {novedades.length === 0 && tno.count === 0 && cursoAscenso.count === 0 ? (
          <p className="p-5 text-sm text-slate-500 text-center">Sin novedades hoy.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-5">
            {tno.count > 0 && (
              <div
                onDoubleClick={() => irAPersonalFiltrado(tno.ids)}
                title="Doble clic para ver quiénes son"
                className="flex flex-col gap-2.5 rounded-xl border border-slate-700 p-3.5 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Tarea No Operativa (TNO)</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] bg-amber-500/15 text-amber-400">
                    🛡️
                  </span>
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-100 tabular-nums">{tno.count}</div>
                <div className="text-[11px] text-slate-500">{tno.count === 1 ? "agente hoy" : "agentes hoy"}</div>
              </div>
            )}
            {cursoAscenso.count > 0 && (
              <div
                onDoubleClick={() => irAPersonalFiltrado(cursoAscenso.ids)}
                title="Doble clic para ver quiénes son"
                className="flex flex-col gap-2.5 rounded-xl border border-slate-700 p-3.5 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">En curso de ascenso</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] bg-blue-500/15 text-blue-400">
                    🎓
                  </span>
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-100 tabular-nums">{cursoAscenso.count}</div>
                <div className="text-[11px] text-slate-500">{cursoAscenso.count === 1 ? "agente" : "agentes"}</div>
              </div>
            )}
            {novedades.map((n) => (
              <div
                key={n.tipo}
                onDoubleClick={() => irAPersonalFiltrado(n.ids)}
                title="Doble clic para ver quiénes son"
                className="flex flex-col gap-2.5 rounded-xl border border-slate-700 p-3.5 cursor-pointer hover:bg-slate-800/60 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">{TIPO_LABEL[n.tipo]}</span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] ${categoriaInfo(n.tipo).badge}`}>
                    {categoriaInfo(n.tipo).emoji}
                  </span>
                </div>
                <div className="text-2xl font-semibold tracking-tight text-slate-100 tabular-nums">{n.count}</div>
                <div className="text-[11px] text-slate-500">{n.count === 1 ? "vigente hoy" : "vigentes hoy"}</div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}
