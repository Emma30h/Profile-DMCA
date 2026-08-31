"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  calcularRankingDiagnosticos,
  colorDeCausa,
  type FilaDiagnostico,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import { buildQueryString } from "../personal/queryString";
import { useEntrada } from "@/lib/useEntrada";
import { useCountUp } from "@/lib/useCountUp";
import { useReplayOnChange } from "@/lib/useReplayOnChange";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";

interface Tooltip {
  x: number;
  y: number;
  fila: FilaDiagnostico;
}

const ALTURA_BARRA = 26;
const GAP_FILAS = 10;
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)
const PASO_MOSTRAR = 8;
// Alto de exactamente PASO_MOSTRAR filas — el techo del área con scroll una
// vez que "Mostrar N más" trae más filas de las que entran de entrada, así
// la tarjeta no crece sin límite cada vez que se pide más.
const ALTURA_LISTA_VISIBLE = PASO_MOSTRAR * (ALTURA_BARRA + GAP_FILAS) - GAP_FILAS;

export default function RankingDiagnosticosCard({
  licencias,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
  cantidadMostradaInicial,
}: {
  licencias: LicenciaAusentismoRow[];
  tema?: ChartTheme;
  modoExport?: boolean;
  // Solo se usa al abrir "Descargar como imagen": la vista exportada tiene
  // que mostrar todos los diagnósticos que el usuario ya reveló con
  // "Mostrar N más" en la vista interactiva, no reiniciarse a los primeros
  // PASO_MOSTRAR — ver el self-render dentro de GraficoDescargable más abajo.
  cantidadMostradaInicial?: number;
}) {
  const router = useRouter();
  // Un solo color para todas las barras — este gráfico es un desglose DENTRO
  // de una única causa (Carpeta Médica), no una comparación entre causas, así
  // que usa el mismo verde con el que esa causa ya se identifica en el resto
  // del dashboard (ver CAUSA_COLOR en ausentismo.ts) en vez del accent
  // genérico del tema.
  const color = colorDeCausa("CARPETA_MEDICA", tema);

  const filas: FilaDiagnostico[] = useMemo(() => calcularRankingDiagnosticos(licencias), [licencias]);

  const [cantidadMostrada, setCantidadMostrada] = useState(cantidadMostradaInicial ?? PASO_MOSTRAR);
  // El filtro general (período/turno/sexo/estado/tipo de personal) vive en
  // EstadisticasAusentismo.tsx y ya llega aplicado en `licencias` — sin
  // esto, cambiar de período dejaría la paginación de "Mostrar N más" en una
  // página que puede ni siquiera existir en el ranking nuevo. Ajuste de
  // estado durante el render (no en un efecto): patrón recomendado por React
  // para resetear estado derivado cuando cambia una prop (mismo criterio que
  // RankingPersonalCard.tsx).
  const [licenciasPrevias, setLicenciasPrevias] = useState(licencias);
  if (licencias !== licenciasPrevias) {
    setLicenciasPrevias(licencias);
    setCantidadMostrada(PASO_MOSTRAR);
  }

  const filasVisibles = filas.slice(0, cantidadMostrada);

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

  const [hoverClave, setHoverClave] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  function irAPersonal(f: FilaDiagnostico) {
    if (f.ids.length > 0) router.push(`/personal?${buildQueryString({ ids: f.ids.join(",") })}`);
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Diagnósticos de carpeta médica más frecuentes</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="diagnosticos-de-carpeta-medica">
            {(t) => (
              <RankingDiagnosticosCard licencias={licencias} modoExport tema={t} cantidadMostradaInicial={cantidadMostrada} />
            )}
          </GraficoDescargable>
        )}
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-4">
        Diagnóstico cargado en cada carpeta médica, agrupando variantes de mayúsculas/acentos del mismo texto —{" "}
        <b className="text-[var(--c-text-muted)] tabular-nums">{totalCantidadAnimado}</b> en total.
      </p>

      {totalCantidad === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">Sin carpetas médicas con diagnóstico en el período elegido.</p>
      ) : (
        <>
          {/* Se cubre PASO_MOSTRAR filas sin scroll (mismo alto que la vista
              por defecto de siempre); pedir más filas con "Mostrar N más"
              no sigue agrandando la tarjeta — a partir de ahí este bloque
              scrollea. En modoExport no hay techo: la imagen exportada tiene
              que salir con TODO lo que `cantidadMostrada` trae (ver
              `cantidadMostradaInicial` en las props), no recortada por el
              scroll de la vista interactiva. */}
          <div
            className={modoExport ? undefined : "overflow-y-auto pr-2"}
            style={modoExport ? undefined : { maxHeight: ALTURA_LISTA_VISIBLE }}
          >
            <div className="flex items-start gap-2.5">
              <div className="flex flex-col shrink-0" style={{ gap: GAP_FILAS }}>
                {filasVisibles.map((f) => (
                  <div
                    key={f.clave}
                    title={f.etiqueta}
                    className="flex items-center justify-end text-[11.5px] text-[var(--c-text-secondary)] text-right truncate"
                    style={{ height: ALTURA_BARRA, width: 176 }}
                  >
                    {f.etiqueta}
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
                    {filasVisibles.map((f, i) => {
                      const clickable = f.ids.length > 0;
                      return (
                        <div
                          key={f.clave}
                          className={`flex items-center rounded-r-[3px] ${clickable ? "cursor-pointer" : ""}`}
                          style={{ height: ALTURA_BARRA }}
                          onPointerEnter={(e) => {
                            setHoverClave(f.clave);
                            setTooltip({ x: e.clientX, y: e.clientY, fila: f });
                          }}
                          onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, fila: f })}
                          onPointerLeave={() => {
                            setHoverClave(null);
                            setTooltip(null);
                          }}
                          onDoubleClick={() => irAPersonal(f)}
                        >
                          <div
                            className="h-full rounded-r-[3px]"
                            style={{
                              width: listo ? `${Math.max(f.cantidad > 0 ? 1.5 : 0, (f.cantidad / escalaMax) * 100)}%` : 0,
                              background: color,
                              filter: hoverClave === f.clave ? "brightness(1.15)" : undefined,
                              transition: `filter 150ms, width 550ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 24) * 35}ms`,
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
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 mt-1.5">
            <div className="shrink-0" style={{ width: 176 }} />
            <div className="relative flex-1 min-w-0" style={{ height: 14 }}>
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

          {!modoExport && cantidadMostrada < filas.length && (
            <button
              type="button"
              onClick={() => setCantidadMostrada((v) => v + PASO_MOSTRAR)}
              className="mt-3 w-full text-center text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md py-1.5 transition-colors"
            >
              Mostrar {Math.min(PASO_MOSTRAR, filas.length - cantidadMostrada)} más
            </button>
          )}
        </>
      )}

      {tooltip && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40 max-w-[240px]"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
            {tooltip.fila.etiqueta}
          </div>
          <div>
            <span className="font-bold tabular-nums">{tooltip.fila.cantidad}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">
              {totalCantidad > 0 ? Math.round((tooltip.fila.cantidad / totalCantidad) * 100) : 0}% del total
            </span>
          </div>
          {tooltip.fila.ids.length > 0 && (
            <div className="text-[var(--c-text-faint)] mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">Doble click para ver el personal</div>
          )}
        </div>
      )}
    </div>
  );
}
