"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAUSAS_AUSENTISMO,
  causaDeLicencia,
  colorDeCausa,
  labelDeCausa,
  type CausaAusentismo,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import { useEntrada } from "@/lib/useEntrada";
import { useCountUp } from "@/lib/useCountUp";
import { useReplayOnChange } from "@/lib/useReplayOnChange";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

interface Fila {
  causa: CausaAusentismo;
  cantidad: number;
  ids: string[];
}

interface Tooltip {
  x: number;
  y: number;
  causa: CausaAusentismo;
}

const ALTURA_BARRA = 26;
const GAP_FILAS = 10;
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)

export default function RankingCausasCard({
  licencias,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  licencias: LicenciaAusentismoRow[];
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  const router = useRouter();

  const filas: Fila[] = useMemo(() => {
    const porCausa = new Map<CausaAusentismo, { cantidad: number; ids: string[] }>(
      CAUSAS_AUSENTISMO.map((c) => [c, { cantidad: 0, ids: [] }])
    );
    for (const l of licencias) {
      const entrada = porCausa.get(causaDeLicencia(l.tipo))!;
      entrada.cantidad += 1;
      if (!entrada.ids.includes(l.agenteId)) entrada.ids.push(l.agenteId);
    }
    // Descendente (la barra más larga queda arriba): la causa dominante se
    // ve de entrada, sin tener que escanear toda la lista hacia abajo.
    return [...porCausa.entries()]
      .map(([causa, v]) => ({ causa, cantidad: v.cantidad, ids: v.ids }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [licencias]);

  // Solo se monta cuando RevealOnScroll lo revela: no hace falta delayMs, el
  // propio montaje ya es el disparador de "empezar a tomar vida". En
  // modoExport la vista previa tiene que salir ya "crecida" (ver
  // GraficoDescargable.tsx), nunca a mitad de animación. replayListo hace
  // que cambiar de período reactive la misma transición de "crecer desde 0"
  // en vez de que las barras salten directo al valor nuevo.
  const entrada = useEntrada();
  const replayListo = useReplayOnChange(filas);
  const listo = modoExport || (entrada && replayListo);

  const totalCantidad = filas.reduce((acc, f) => acc + f.cantidad, 0);
  const totalCantidadAnimado = useCountUp(totalCantidad, 0, modoExport ? 0 : 1600);
  const picoValor = Math.max(1, ...filas.map((f) => f.cantidad));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);

  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });

  const [hoverCausa, setHoverCausa] = useState<CausaAusentismo | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  function irAPersonal(f: Fila) {
    if (f.ids.length > 0) router.push(`/personal?${buildQueryString({ ids: f.ids.join(",") })}`);
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Causas más frecuentes</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="causas-mas-frecuentes">
            {(t) => <RankingCausasCard licencias={licencias} modoExport tema={t} />}
          </GraficoDescargable>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-4">
        Cantidad de licencias por causa, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total.
      </p>

      {totalCantidad === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin licencias en el período elegido.</p>
      ) : (
        <div className="flex items-start gap-2.5">
          <div className="flex flex-col shrink-0" style={{ gap: GAP_FILAS }}>
            {filas.map((f) => (
              <div
                key={f.causa}
                className="flex items-center justify-end text-[11.5px] text-[var(--c-text-secondary)] text-right whitespace-nowrap"
                style={{ height: ALTURA_BARRA, width: 132 }}
              >
                {labelDeCausa(f.causa)}
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative">
              <div className="absolute inset-0 pointer-events-none">
                {lineasGrilla.map(({ frac }) => (
                  <div
                    key={frac}
                    className="absolute top-0 bottom-0 border-l border-[var(--c-line)]"
                    style={{ left: `${frac * 100}%`, opacity: frac === 0 ? 1 : 0.5 }}
                  />
                ))}
              </div>
              <div className="flex flex-col relative" style={{ gap: GAP_FILAS }}>
                {filas.map((f, i) => {
                  const clickable = f.ids.length > 0;
                  return (
                    <div
                      key={f.causa}
                      className={`flex items-center rounded-r-[3px] ${clickable ? "cursor-pointer" : ""}`}
                      style={{ height: ALTURA_BARRA }}
                      onPointerEnter={(e) => {
                        setHoverCausa(f.causa);
                        setTooltip({ x: e.clientX, y: e.clientY, causa: f.causa });
                      }}
                      onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, causa: f.causa })}
                      onPointerLeave={() => {
                        setHoverCausa(null);
                        setTooltip(null);
                      }}
                      onDoubleClick={() => irAPersonal(f)}
                    >
                      <div
                        className="h-full rounded-r-[3px]"
                        style={{
                          width: listo ? `${Math.max(f.cantidad > 0 ? 1.5 : 0, (f.cantidad / escalaMax) * 100)}%` : 0,
                          background: colorDeCausa(f.causa, tema),
                          filter: hoverCausa === f.causa ? "brightness(1.15)" : undefined,
                          transition: `filter 150ms, width 550ms cubic-bezier(.22,1,.36,1) ${i * 35}ms`,
                        }}
                      />
                      {f.cantidad > 0 && (
                        <span className="ml-2 text-[11px] font-bold text-[var(--c-text)] tabular-nums whitespace-nowrap">{f.cantidad}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="relative mt-1.5" style={{ height: 14 }}>
              {lineasGrilla.map(({ frac, valor }) => (
                <span
                  key={frac}
                  className="absolute text-[10.5px] text-[var(--c-text-faint)] tabular-nums whitespace-nowrap"
                  style={{
                    left: `${frac * 100}%`,
                    transform: frac === 0 ? "translateX(0)" : frac === 1 ? "translateX(-100%)" : "translateX(-50%)",
                  }}
                >
                  {valor}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorDeCausa(tooltip.causa, tema) }} />
            {labelDeCausa(tooltip.causa)}
          </div>
          <div>
            <span className="font-bold tabular-nums">{filas.find((f) => f.causa === tooltip.causa)?.cantidad ?? 0}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">
              {totalCantidad > 0 ? Math.round(((filas.find((f) => f.causa === tooltip.causa)?.cantidad ?? 0) / totalCantidad) * 100) : 0}% del total
            </span>
          </div>
          {(filas.find((f) => f.causa === tooltip.causa)?.ids.length ?? 0) > 0 && (
            <div className="text-[var(--c-text-faint)] mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">Doble click para ver el personal</div>
          )}
        </div>
      )}
    </div>
  );
}
