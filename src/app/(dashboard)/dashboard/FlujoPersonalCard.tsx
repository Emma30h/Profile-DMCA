"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FlujoMensual, FlujoPersonalStats } from "./stats";
import { buildQueryString } from "../personal/queryString";
import { useCountUp } from "@/lib/useCountUp";
import { useEntrada } from "@/lib/useEntrada";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

type Rango = "3m" | "6m" | "1a" | "todo";

const RANGO_COL_WIDTH: Record<Exclude<Rango, "todo">, number> = { "3m": 150, "6m": 100, "1a": 78 };
const RANGO_LABEL: Record<Rango, string> = {
  "3m": "últimos 3 meses",
  "6m": "últimos 6 meses",
  "1a": "últimos 12 meses",
  todo: "historial completo",
};
const RANGOS: Rango[] = ["3m", "6m", "1a", "todo"];

interface Tooltip {
  x: number;
  y: number;
  mes: FlujoMensual;
}

export default function FlujoPersonalCard({
  flujo,
  delayMs = 0,
  modoExport = false,
}: {
  flujo: FlujoPersonalStats;
  delayMs?: number;
  modoExport?: boolean;
}) {
  const router = useRouter();
  const [rango, setRango] = useState<Rango>("1a");
  const [comoTabla, setComoTabla] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  // En modoExport la vista previa tiene que salir ya "crecida" (ver
  // GraficoDescargable.tsx), nunca a mitad de animación.
  const listo = useEntrada(delayMs) || modoExport;
  const totalAltasAnimado = useCountUp(flujo.totalAltas, delayMs, modoExport ? 0 : 1600);
  const totalBajasAnimado = useCountUp(flujo.totalBajas, delayMs + 120, modoExport ? 0 : 1600);
  const totalNetoAnimado = useCountUp(Math.abs(flujo.totalNeto), delayMs + 240, modoExport ? 0 : 1600);

  const viewportRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);
  const brushRef = useRef<HTMLDivElement>(null);
  const brushWindowRef = useRef<HTMLDivElement>(null);
  const panState = useRef({ panning: false, moved: false, startX: 0, startScroll: 0 });
  const brushDragState = useRef({ dragging: false, startX: 0, startLeft: 0 });
  const inicializado = useRef(false);

  const { meses, escalaMax } = flujo;

  const { indiceMaxAltas, indiceMaxBajas } = useMemo(() => {
    let iAltas = -1;
    let iBajas = -1;
    let maxAltas = 0;
    let maxBajas = 0;
    meses.forEach((m, i) => {
      if (m.altas > maxAltas) { maxAltas = m.altas; iAltas = i; }
      if (m.bajas > maxBajas) { maxBajas = m.bajas; iBajas = i; }
    });
    return { indiceMaxAltas: iAltas, indiceMaxBajas: iBajas };
  }, [meses]);

  const maxActividad = Math.max(1, ...meses.map((m) => m.altas + m.bajas));

  // Sin dependencias reales: solo lee refs de DOM, nunca props/estado, así
  // que la identidad se mantiene estable y puede citarse desde otros callbacks
  // memoizados sin violar exhaustive-deps.
  const updateBrushWindow = useCallback(() => {
    const viewport = viewportRef.current;
    const brush = brushRef.current;
    const win = brushWindowRef.current;
    if (!viewport || !brush || !win) return;
    const sw = viewport.scrollWidth;
    const cw = viewport.clientWidth;
    const bw = brush.clientWidth;
    const winWidth = Math.min(bw, Math.max(26, Math.round((cw / sw) * bw)));
    const maxWinLeft = bw - winWidth;
    const maxScroll = Math.max(1, sw - cw);
    const ratio = Math.min(1, Math.max(0, viewport.scrollLeft / maxScroll));
    win.style.width = `${winWidth}px`;
    win.style.left = `${Math.round(ratio * maxWinLeft)}px`;
  }, []);

  function aplicarRango(nuevoRango: Rango) {
    setRango(nuevoRango);
    const cols = colsRef.current;
    const viewport = viewportRef.current;
    if (!cols || !viewport) return;
    const px = nuevoRango === "todo"
      ? Math.max(30, Math.floor(viewport.clientWidth / Math.max(1, meses.length)))
      : RANGO_COL_WIDTH[nuevoRango];
    cols.style.setProperty("--col-w", `${px}px`);
    requestAnimationFrame(() => {
      viewport.scrollLeft = viewport.scrollWidth;
      updateBrushWindow();
    });
  }

  // React adjunta los refs de abajo hacia arriba: cuando este callback corre,
  // colsRef ya está seteado, así que acá se hace el setup inicial (ancho de
  // columna en 1A + scroll a los meses más recientes) una sola vez al montar.
  // useCallback mantiene la identidad estable entre renders (si no, el ref se
  // desmontaría/remontaría en cada render, p. ej. cada vez que se mueve el tooltip).
  const attachViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    if (!node || !colsRef.current || inicializado.current) return;
    inicializado.current = true;
    colsRef.current.style.setProperty("--col-w", `${RANGO_COL_WIDTH["1a"]}px`);
    requestAnimationFrame(() => {
      node.scrollLeft = node.scrollWidth;
      updateBrushWindow();
    });
  }, [updateBrushWindow]);

  function moverBrushA(nuevoLeft: number) {
    const brush = brushRef.current;
    const win = brushWindowRef.current;
    const viewport = viewportRef.current;
    if (!brush || !win || !viewport) return;
    const bw = brush.clientWidth;
    const ww = win.offsetWidth;
    const maxLeft = bw - ww;
    const left = Math.min(maxLeft, Math.max(0, nuevoLeft));
    win.style.left = `${left}px`;
    const sw = viewport.scrollWidth;
    const cw = viewport.clientWidth;
    const ratio = maxLeft > 0 ? left / maxLeft : 0;
    viewport.scrollLeft = ratio * (sw - cw);
  }

  if (meses.length === 0) {
    return (
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Ingresos y bajas de personal</h3>
        <p className="text-[12.5px] text-[var(--c-text-faint)]">Todavía no hay fechas de ingreso cargadas en los legajos.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-3.5 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Ingresos y bajas de personal</h3>
        <div className="flex items-center gap-2.5">
          {!modoExport && (
            <>
              <span className="text-[11px] text-[var(--c-text-faint)]">{RANGO_LABEL[rango]}</span>
              <button
                type="button"
                onClick={() => setComoTabla((v) => !v)}
                className="text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
              >
                {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
              </button>
              <GraficoDescargable nombreArchivo="ingresos-y-bajas-de-personal" sinPaletas>
                {() => <FlujoPersonalCard flujo={flujo} modoExport />}
              </GraficoDescargable>
            </>
          )}
        </div>
      </div>

      {!modoExport && (
        <div className="flex items-center gap-1.5 mb-4">
          {RANGOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => aplicarRango(r)}
              className={`text-[11px] font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                rango === r
                  ? "bg-[var(--c-blue)] text-white border-[var(--c-blue)]"
                  : "text-[var(--c-text-muted)] border-[var(--c-line)] hover:text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
              }`}
            >
              {r === "todo" ? "Todo" : r.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--c-green)]" />
          Ingresos <b className="text-[var(--c-text)] font-bold tabular-nums">{totalAltasAnimado}</b>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--c-coral)]" />
          Bajas <b className="text-[var(--c-text)] font-bold tabular-nums">{totalBajasAnimado}</b>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--c-text-faint)]" />
          Neto del período{" "}
          <b className={`font-bold tabular-nums ${flujo.totalNeto >= 0 ? "text-[var(--c-green)]" : "text-[var(--c-coral)]"}`}>
            {flujo.totalNeto >= 0 ? "+" : "−"}
            {totalNetoAnimado}
          </b>
        </span>
      </div>

      {modoExport ? (
        // En modoExport se muestra el historial completo, sin recortar por
        // scroll (mismo criterio que AusentismoCard): nada de brush ni de
        // paneo, todos los meses uno al lado del otro con ancho fijo.
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col justify-between shrink-0 w-5 text-right text-[10px] text-[var(--c-text-faint)]" style={{ height: 201 }}>
            <span>{escalaMax}</span>
            <span>0</span>
            <span>{escalaMax}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex gap-0.5" style={{ width: "max-content" }}>
              {meses.map((m, i) => (
                <div key={m.key} className="flex flex-col items-center rounded-lg py-0.5" style={{ flex: `0 0 ${RANGO_COL_WIDTH["1a"]}px`, width: RANGO_COL_WIDTH["1a"] }}>
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: 100 }}>
                    {i === indiceMaxAltas && m.altas > 0 && (
                      <span className="text-[10px] font-bold text-[var(--c-text)] mb-1 whitespace-nowrap">+{m.altas}</span>
                    )}
                    <div
                      className="rounded-t-[4px] bg-[var(--c-green)]"
                      style={{ height: `${listo ? (m.altas / escalaMax) * 100 : 0}px`, width: 24 }}
                    />
                  </div>
                  <div className="h-px w-full bg-[var(--c-bg-elev-2)]" />
                  <div className="w-full flex flex-col items-center justify-start" style={{ height: 100 }}>
                    <div
                      className="rounded-b-[4px] bg-[var(--c-coral)]"
                      style={{ height: `${listo ? (m.bajas / escalaMax) * 100 : 0}px`, width: 24 }}
                    />
                    {i === indiceMaxBajas && m.bajas > 0 && (
                      <span className="text-[10px] font-bold text-[var(--c-text)] mt-1 whitespace-nowrap">−{m.bajas}</span>
                    )}
                  </div>
                  <span className="text-[10.5px] text-[var(--c-text-faint)] mt-2 whitespace-nowrap">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div className="overflow-hidden" style={{ height: 300 }}>
        <div className={`dashboard-slide-track h-full ${comoTabla ? "mostrar-detalle" : ""}`}>
          <div className="dashboard-slide-pane">
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col justify-between shrink-0 w-5 text-right text-[10px] text-[var(--c-text-faint)]" style={{ height: 201 }}>
              <span>{escalaMax}</span>
              <span>0</span>
              <span>{escalaMax}</span>
            </div>

            <div
              ref={attachViewport}
              className="flex-1 min-w-0 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing touch-pan-y"
              onPointerDown={(e) => {
                panState.current = { panning: true, moved: false, startX: e.clientX, startScroll: viewportRef.current!.scrollLeft };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!panState.current.panning) return;
                const dx = e.clientX - panState.current.startX;
                if (Math.abs(dx) > 3) {
                  panState.current.moved = true;
                  setTooltip(null);
                }
                viewportRef.current!.scrollLeft = panState.current.startScroll - dx;
              }}
              onPointerUp={() => { panState.current.panning = false; }}
              onPointerCancel={() => { panState.current.panning = false; }}
              onScroll={updateBrushWindow}
            >
              <div ref={colsRef} className="flex gap-0.5" style={{ width: "max-content" }}>
                {meses.map((m, i) => {
                  const idsDelMes = [...m.altasIds, ...m.bajasIds];
                  const clickable = idsDelMes.length > 0;
                  // Escalonado desde el mes más reciente (el que ya está a
                  // la vista tras el auto-scroll) hacia atrás, con un tope:
                  // sin esto, un historial de varios años haría que las
                  // columnas visibles tarden mucho en empezar a crecer.
                  const delayBarra = Math.min(meses.length - 1 - i, 24) * 20;
                  return (
                  <div
                    key={m.key}
                    className={`flex flex-col items-center rounded-lg py-0.5 transition-colors ${hoverKey === m.key ? "bg-[var(--c-bg-elev-2)]/70" : ""} ${clickable ? "cursor-pointer" : ""}`}
                    style={{
                      flex: "0 0 var(--col-w, 70px)",
                      width: "var(--col-w, 70px)",
                      // Sin esto, cambiar de rango (que solo pisa --col-w vía
                      // ref, no re-renderiza con un valor de React distinto)
                      // resize todas las columnas de golpe.
                      transition: "flex-basis 400ms cubic-bezier(.22,1,.36,1), width 400ms cubic-bezier(.22,1,.36,1)",
                    }}
                    onPointerMove={(e) => {
                      if (panState.current.panning && panState.current.moved) return;
                      setHoverKey(m.key);
                      setTooltip({ x: e.clientX, y: e.clientY, mes: m });
                    }}
                    onPointerLeave={() => {
                      setHoverKey(null);
                      setTooltip(null);
                    }}
                    onDoubleClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ ids: idsDelMes.join(",") })}`);
                    }}
                  >
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: 100 }}>
                      {i === indiceMaxAltas && m.altas > 0 && (
                        <span className="text-[10px] font-bold text-[var(--c-text)] mb-1 whitespace-nowrap">+{m.altas}</span>
                      )}
                      <div
                        className="rounded-t-[4px] bg-[var(--c-green)]"
                        style={{
                          height: `${listo ? (m.altas / escalaMax) * 100 : 0}px`,
                          width: "min(24px, calc(var(--col-w, 70px) * .32))",
                          filter: hoverKey === m.key ? "brightness(1.2)" : undefined,
                          transition: `filter 150ms, width 150ms, height 500ms cubic-bezier(.22,1,.36,1) ${delayBarra}ms`,
                        }}
                      />
                    </div>
                    <div className="h-px w-full bg-[var(--c-bg-elev-2)]" />
                    <div className="w-full flex flex-col items-center justify-start" style={{ height: 100 }}>
                      <div
                        className="rounded-b-[4px] bg-[var(--c-coral)]"
                        style={{
                          height: `${listo ? (m.bajas / escalaMax) * 100 : 0}px`,
                          width: "min(24px, calc(var(--col-w, 70px) * .32))",
                          filter: hoverKey === m.key ? "brightness(1.2)" : undefined,
                          transition: `filter 150ms, width 150ms, height 500ms cubic-bezier(.22,1,.36,1) ${delayBarra}ms`,
                        }}
                      />
                      {i === indiceMaxBajas && m.bajas > 0 && (
                        <span className="text-[10px] font-bold text-[var(--c-text)] mt-1 whitespace-nowrap">−{m.bajas}</span>
                      )}
                    </div>
                    <span className="text-[10.5px] text-[var(--c-text-faint)] mt-2 whitespace-nowrap">{m.label}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            ref={brushRef}
            className="relative h-8 mt-3 ml-[30px] rounded-md bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] overflow-hidden cursor-pointer"
            onPointerDown={(e) => {
              if (e.target === brushWindowRef.current) return;
              const rect = brushRef.current!.getBoundingClientRect();
              const ww = brushWindowRef.current?.offsetWidth ?? 0;
              moverBrushA(e.clientX - rect.left - ww / 2);
            }}
          >
            <div className="absolute inset-0 flex items-center gap-px px-1 opacity-60">
              {meses.map((m) => (
                <div
                  key={m.key}
                  className={`flex-1 rounded-[1px] min-w-px ${m.neto >= 0 ? "bg-[var(--c-green)]" : "bg-[var(--c-coral)]"}`}
                  style={{ height: `${Math.max(3, Math.round(((m.altas + m.bajas) / maxActividad) * 20))}px` }}
                />
              ))}
            </div>
            <div
              ref={brushWindowRef}
              className="absolute top-0 bottom-0 left-0 w-10 bg-[var(--c-blue)]/15 border-[1.5px] border-[var(--c-blue)] rounded-md box-border cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                brushDragState.current = { dragging: true, startX: e.clientX, startLeft: brushWindowRef.current!.offsetLeft };
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                e.stopPropagation();
              }}
              onPointerMove={(e) => {
                if (!brushDragState.current.dragging) return;
                moverBrushA(brushDragState.current.startLeft + (e.clientX - brushDragState.current.startX));
              }}
              onPointerUp={() => { brushDragState.current.dragging = false; }}
              onPointerCancel={() => { brushDragState.current.dragging = false; }}
            />
          </div>
          <p className="text-[10.5px] text-[var(--c-text-faint)] text-center mt-2">
            Arrastrá el gráfico o el visor de abajo para recorrer el historial completo
          </p>
          </div>

          <div className="dashboard-slide-pane h-full overflow-y-auto pr-3">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] sticky top-0 bg-[var(--c-bg-elev)]">
                  Mes
                </th>
                <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums sticky top-0 bg-[var(--c-bg-elev)]">
                  Ingresos
                </th>
                <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums sticky top-0 bg-[var(--c-bg-elev)]">
                  Bajas
                </th>
                <th className="text-right text-[10.5px] tracking-wide uppercase text-[var(--c-text-faint)] font-semibold pb-2 border-b border-[var(--c-bg-elev-2)] tabular-nums sticky top-0 bg-[var(--c-bg-elev)]">
                  Neto
                </th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => {
                const idsDelMes = [...m.altasIds, ...m.bajasIds];
                const clickable = idsDelMes.length > 0;
                return (
                  <tr
                    key={m.key}
                    onDoubleClick={() => {
                      if (clickable) router.push(`/personal?${buildQueryString({ ids: idsDelMes.join(",") })}`);
                    }}
                    className={clickable ? "cursor-pointer hover:bg-[var(--c-bg-elev-2)]/40" : ""}
                  >
                    <td className="py-2 border-b border-[var(--c-bg-elev-2)] text-[var(--c-text)]">{m.mesLargo}</td>
                    <td className="py-2 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text)] tabular-nums">{m.altas}</td>
                    <td className="py-2 border-b border-[var(--c-bg-elev-2)] text-right text-[var(--c-text)] tabular-nums">{m.bajas}</td>
                    <td className={`py-2 border-b border-[var(--c-bg-elev-2)] text-right tabular-nums font-medium ${m.neto >= 0 ? "text-[var(--c-green)]" : "text-[var(--c-coral)]"}`}>
                      {m.neto >= 0 ? "+" : ""}
                      {m.neto}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      )}

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{tooltip.mes.mesLargo}</div>
          <div>
            <span className="font-bold tabular-nums text-[var(--c-green)]">+{tooltip.mes.altas}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">Ingresos</span>
          </div>
          <div>
            <span className="font-bold tabular-nums text-[var(--c-coral)]">−{tooltip.mes.bajas}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">Bajas</span>
          </div>
          <div className="mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">
            <span className={`font-bold tabular-nums ${tooltip.mes.neto >= 0 ? "text-[var(--c-green)]" : "text-[var(--c-coral)]"}`}>
              {tooltip.mes.neto >= 0 ? "+" : ""}
              {tooltip.mes.neto}
            </span>
            <span className="text-[var(--c-text-faint)] ml-1.5">Neto</span>
          </div>
        </div>
      )}
    </div>
  );
}
