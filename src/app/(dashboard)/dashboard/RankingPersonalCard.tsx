"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AgenteAvatar from "@/components/AgenteAvatar";
import {
  CAUSAS_AUSENTISMO,
  CAUSA_COLOR,
  causaDeLicencia,
  labelDeCausa,
  type CausaAusentismo,
  type LicenciaAusentismoRow,
} from "@/lib/ausentismo";
import { useEntrada } from "@/lib/useEntrada";
import { useCountUp } from "@/lib/useCountUp";

type ModoPeriodo = "todo" | "anio" | "rango";
type Metrica = "licencias" | "dias";
type Vista = "general" | "porTipo";

interface FilaPersonal {
  agenteId: string;
  nombreCompleto: string;
  fotoUrl: string | null;
  sexo: string | null;
  porCausaCantidad: Record<CausaAusentismo, number>;
  porCausaDias: Record<CausaAusentismo, number>;
  totalCantidad: number;
  totalDias: number;
}

interface Tooltip {
  x: number;
  y: number;
  fila: FilaPersonal;
}

const ALTURA_FILA = 30;
const GAP_FILAS = 8;
const SEGMENTOS_GRILLA = 4; // 5 líneas de referencia (0, 25, 50, 75, 100% de escalaMax)
const PASO_MOSTRAR = 10;

const METRICA_LABEL: Record<Metrica, string> = { licencias: "Licencias", dias: "Días" };
const VISTA_LABEL: Record<Vista, string> = { general: "General", porTipo: "Por tipo" };
// Color único para la vista "general" (no representa ninguna causa
// puntual): mismo azul que ya usa el resto del dashboard para
// acciones/selección, para que se lea como "total agregado" y no se
// confunda con el color de alguna causa específica.
const COLOR_GENERAL = "var(--c-blue)";

export default function RankingPersonalCard({ licencias, hoy }: { licencias: LicenciaAusentismoRow[]; hoy: string }) {
  const router = useRouter();
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);

  const anios = useMemo(() => {
    const set = new Set(licencias.map((l) => new Date(l.fechaInicio).getUTCFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [licencias]);

  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [anio, setAnio] = useState<number | null>(null);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [metrica, setMetrica] = useState<Metrica>("licencias");
  const [vista, setVista] = useState<Vista>("porTipo");
  const [causasSeleccionadas, setCausasSeleccionadas] = useState<Set<CausaAusentismo>>(
    () => new Set(CAUSAS_AUSENTISMO)
  );
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const filtroRef = useRef<HTMLDivElement>(null);
  const [cantidadMostrada, setCantidadMostrada] = useState(PASO_MOSTRAR);
  const anioActivo = anio ?? anios[0] ?? hoyDate.getUTCFullYear();

  useEffect(() => {
    if (!filtroAbierto) return;
    // Chequeo de contención (no un simple listener global): sin esto, el
    // mousedown sobre un checkbox del propio panel lo cierra antes de que
    // llegue a dispararse su click — mismo patrón que exportMenuRef en
    // AusentismoCard.tsx.
    function cerrar(e: MouseEvent) {
      if (filtroRef.current?.contains(e.target as Node)) return;
      setFiltroAbierto(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, [filtroAbierto]);

  function alternarCausa(c: CausaAusentismo) {
    setCantidadMostrada(PASO_MOSTRAR);
    setCausasSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function elegirPeriodo(valor: string) {
    setCantidadMostrada(PASO_MOSTRAR);
    if (valor === "todo") {
      setModo("todo");
      return;
    }
    if (valor === "rango") {
      setModo("rango");
      if (!rangoDesde && !rangoHasta && licencias.length > 0) {
        const fechas = licencias.map((l) => l.fechaInicio.slice(0, 10)).sort();
        setRangoDesde(fechas[0]);
        setRangoHasta(fechas[fechas.length - 1]);
      }
      return;
    }
    setModo("anio");
    setAnio(Number(valor));
  }

  const licenciasPeriodo = useMemo(() => {
    if (modo === "anio") {
      return licencias.filter((l) => new Date(l.fechaInicio).getUTCFullYear() === anioActivo);
    }
    if (modo === "rango") {
      if (!rangoDesde || !rangoHasta) return [];
      return licencias.filter((l) => {
        const f = l.fechaInicio.slice(0, 10);
        return f >= rangoDesde && f <= rangoHasta;
      });
    }
    return licencias;
  }, [licencias, modo, anioActivo, rangoDesde, rangoHasta]);

  // Filtro de causas: aplicado sobre las licencias crudas (no sobre las
  // filas ya agrupadas) — así un agente cuya única licencia sea, por
  // ejemplo, Maternidad, directamente desaparece del ranking cuando esa
  // causa se destilda, en vez de quedar con una fila en 0.
  const licenciasFiltradas = useMemo(
    () => licenciasPeriodo.filter((l) => causasSeleccionadas.has(causaDeLicencia(l.tipo))),
    [licenciasPeriodo, causasSeleccionadas]
  );

  // Una fila por agente (no por causa): la barra de cada fila queda
  // apilada por causa, mismo lenguaje visual que "Ausentismo por causa" —
  // acá el eje es "quién", no "cuándo".
  const filas: FilaPersonal[] = useMemo(() => {
    const porAgente = new Map<string, FilaPersonal>();
    for (const l of licenciasFiltradas) {
      let fila = porAgente.get(l.agenteId);
      if (!fila) {
        fila = {
          agenteId: l.agenteId,
          nombreCompleto: `${l.agente.apellidos}, ${l.agente.nombres}`,
          fotoUrl: l.agente.fotoUrl,
          sexo: l.agente.sexo,
          porCausaCantidad: Object.fromEntries(CAUSAS_AUSENTISMO.map((c) => [c, 0])) as Record<CausaAusentismo, number>,
          porCausaDias: Object.fromEntries(CAUSAS_AUSENTISMO.map((c) => [c, 0])) as Record<CausaAusentismo, number>,
          totalCantidad: 0,
          totalDias: 0,
        };
        porAgente.set(l.agenteId, fila);
      }
      const causa = causaDeLicencia(l.tipo);
      fila.porCausaCantidad[causa] += 1;
      fila.porCausaDias[causa] += l.diasHabiles;
      fila.totalCantidad += 1;
      fila.totalDias += l.diasHabiles;
    }
    return [...porAgente.values()].sort((a, b) =>
      metrica === "licencias" ? b.totalCantidad - a.totalCantidad : b.totalDias - a.totalDias
    );
  }, [licenciasFiltradas, metrica]);

  const picoValor = Math.max(1, ...filas.map((f) => (metrica === "licencias" ? f.totalCantidad : f.totalDias)));
  const escalaMax = Math.max(5, Math.ceil(picoValor / 5) * 5);
  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });

  // Causas presentes en el ranking actual, en el orden fijo de
  // CAUSAS_AUSENTISMO — sostiene la leyenda de la vista "Por tipo" (con
  // ≥2 series la identidad no puede depender solo del color).
  const causasConDatos = useMemo(() => {
    const set = new Set<CausaAusentismo>();
    for (const f of filas) {
      for (const c of CAUSAS_AUSENTISMO) {
        if ((metrica === "licencias" ? f.porCausaCantidad[c] : f.porCausaDias[c]) > 0) set.add(c);
      }
    }
    return CAUSAS_AUSENTISMO.filter((c) => set.has(c));
  }, [filas, metrica]);

  const filasVisibles = filas.slice(0, cantidadMostrada);

  // Solo se monta cuando RevealOnScroll lo revela: no hace falta delayMs, el
  // propio montaje ya es el disparador de "empezar a tomar vida".
  const listo = useEntrada();
  const cantidadAgentesAnimada = useCountUp(filas.length);

  const [hoverAgente, setHoverAgente] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  function irALegajo(agenteId: string) {
    router.push(`/personal/${agenteId}`);
  }

  if (licencias.length === 0) {
    return (
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
        <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Personal con más licencias</h3>
        <p className="text-[12.5px] text-[var(--c-text-faint)]">Todavía no hay licencias aprobadas cargadas.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-center justify-between mb-1 gap-2.5 flex-wrap">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Personal con más licencias</h3>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative">
            <select
              value={modo === "anio" ? String(anioActivo) : modo}
              onChange={(e) => elegirPeriodo(e.target.value)}
              className="text-[11px] font-semibold text-[var(--c-text-muted)] bg-[var(--c-bg-elev)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
            >
              <option value="todo">Todo el historial</option>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
              <option value="rango">Seleccionar período…</option>
            </select>
            {modo === "rango" && (
              <div className="absolute right-0 top-full mt-1 z-30 flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40 whitespace-nowrap">
                <input
                  type="date"
                  value={rangoDesde}
                  onChange={(e) => setRangoDesde(e.target.value)}
                  className="rounded-md border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2 py-1 text-[11px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
                />
                <span className="text-[var(--c-text-faint)] text-[11px]">→</span>
                <input
                  type="date"
                  value={rangoHasta}
                  onChange={(e) => setRangoHasta(e.target.value)}
                  className="rounded-md border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2 py-1 text-[11px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
                />
              </div>
            )}
          </div>
          <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
            {(["porTipo", "general"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                aria-pressed={vista === v}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  vista === v
                    ? "bg-[var(--c-blue)] text-white"
                    : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                }`}
              >
                {VISTA_LABEL[v]}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
            {(["licencias", "dias"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetrica(m)}
                aria-pressed={metrica === m}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  metrica === m
                    ? "bg-[var(--c-blue)] text-white"
                    : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                }`}
              >
                {METRICA_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="relative" ref={filtroRef}>
            <button
              type="button"
              onClick={() => setFiltroAbierto((v) => !v)}
              aria-expanded={filtroAbierto}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
            >
              Causas{causasSeleccionadas.size < CAUSAS_AUSENTISMO.length ? ` (${causasSeleccionadas.size})` : ""}
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {filtroAbierto && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-2 shadow-lg shadow-black/40">
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCantidadMostrada(PASO_MOSTRAR);
                      setCausasSeleccionadas(new Set(CAUSAS_AUSENTISMO));
                    }}
                    className="text-[10.5px] font-semibold text-[var(--c-blue)] hover:underline"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCantidadMostrada(PASO_MOSTRAR);
                      setCausasSeleccionadas(new Set());
                    }}
                    className="text-[10.5px] font-semibold text-[var(--c-text-faint)] hover:underline"
                  >
                    Ninguna
                  </button>
                </div>
                {CAUSAS_AUSENTISMO.map((c) => (
                  <label
                    key={c}
                    className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-[var(--c-line)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={causasSeleccionadas.has(c)}
                      onChange={() => alternarCausa(c)}
                      className="accent-[var(--c-blue)]"
                    />
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAUSA_COLOR[c] }} />
                    <span className="text-[12px] text-[var(--c-text-secondary)]">{labelDeCausa(c)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[var(--c-text-faint)] mb-3.5">
        Ranking por {metrica === "licencias" ? "cantidad de licencias" : "cantidad de días"}, sin licencia ordinaria (vacaciones) — <b className="text-[var(--c-text-muted)] tabular-nums">{cantidadAgentesAnimada}</b> {filas.length === 1 ? "agente" : "agentes"} con ausentismo en el período.
        {causasSeleccionadas.size < CAUSAS_AUSENTISMO.length && (
          <> Filtrado a {causasSeleccionadas.size} de {CAUSAS_AUSENTISMO.length} causas.</>
        )}
      </p>

      {vista === "porTipo" && causasConDatos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-3.5">
          {causasConDatos.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 text-[11px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAUSA_COLOR[c] }} />
              {labelDeCausa(c)}
            </span>
          ))}
        </div>
      )}

      {filas.length === 0 ? (
        <p className="text-[12.5px] text-[var(--c-text-faint)] py-6 text-center">
          {causasSeleccionadas.size === 0
            ? "Seleccioná al menos un tipo de licencia en el filtro de causas."
            : "Sin licencias en el período elegido."}
        </p>
      ) : (
        <>
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col shrink-0" style={{ gap: GAP_FILAS }}>
              {filasVisibles.map((f, i) => (
                <div
                  key={f.agenteId}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ height: ALTURA_FILA }}
                  onPointerEnter={() => setHoverAgente(f.agenteId)}
                  onPointerLeave={() => setHoverAgente(null)}
                  onClick={() => irALegajo(f.agenteId)}
                >
                  <span className="w-4 text-right text-[11px] font-bold text-[var(--c-text-faint)] tabular-nums">{i + 1}</span>
                  <AgenteAvatar fotoUrl={f.fotoUrl} sexo={f.sexo} sizeClassName="h-7 w-7 rounded-full shrink-0" />
                  <span
                    className={`text-[11.5px] truncate transition-colors ${
                      hoverAgente === f.agenteId ? "text-[var(--c-text)]" : "text-[var(--c-text-secondary)]"
                    }`}
                    style={{ width: 118 }}
                  >
                    {f.nombreCompleto}
                  </span>
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
                    const porCausa = metrica === "licencias" ? f.porCausaCantidad : f.porCausaDias;
                    const total = metrica === "licencias" ? f.totalCantidad : f.totalDias;
                    return (
                      <div
                        key={f.agenteId}
                        className="flex items-center cursor-pointer"
                        style={{ height: ALTURA_FILA }}
                        onPointerEnter={(e) => {
                          setHoverAgente(f.agenteId);
                          setTooltip({ x: e.clientX, y: e.clientY, fila: f });
                        }}
                        onPointerMove={(e) => setTooltip({ x: e.clientX, y: e.clientY, fila: f })}
                        onPointerLeave={() => {
                          setHoverAgente(null);
                          setTooltip(null);
                        }}
                        onClick={() => irALegajo(f.agenteId)}
                      >
                        <div
                          className="flex h-full rounded-r-[3px] overflow-hidden"
                          style={{
                            width: listo ? `${Math.max(total > 0 ? 1.5 : 0, (total / escalaMax) * 100)}%` : 0,
                            filter: hoverAgente === f.agenteId ? "brightness(1.15)" : undefined,
                            transition: `filter 150ms, width 550ms cubic-bezier(.22,1,.36,1) ${Math.min(i, 24) * 35}ms`,
                          }}
                        >
                          {vista === "porTipo" ? (
                            CAUSAS_AUSENTISMO.map((c) => {
                              const valor = porCausa[c];
                              if (valor <= 0) return null;
                              return <div key={c} style={{ width: `${(valor / total) * 100}%`, background: CAUSA_COLOR[c] }} />;
                            })
                          ) : (
                            <div style={{ width: "100%", background: COLOR_GENERAL }} />
                          )}
                        </div>
                        {total > 0 && (
                          <span className="ml-2 text-[11px] font-bold text-[var(--c-text)] tabular-nums whitespace-nowrap">{total}</span>
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

          {cantidadMostrada < filas.length && (
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
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <div className="font-bold mb-1">{tooltip.fila.nombreCompleto}</div>
          {vista === "porTipo" &&
            CAUSAS_AUSENTISMO.map((c) => {
              const valor = metrica === "licencias" ? tooltip.fila.porCausaCantidad[c] : tooltip.fila.porCausaDias[c];
              if (valor <= 0) return null;
              return (
                <div key={c} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAUSA_COLOR[c] }} />
                  <span className="font-bold tabular-nums">{valor}</span>
                  <span className="text-[var(--c-text-faint)]">{labelDeCausa(c)}</span>
                </div>
              );
            })}
          <div className="mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">
            <span className="font-bold tabular-nums">{metrica === "licencias" ? tooltip.fila.totalCantidad : tooltip.fila.totalDias}</span>
            <span className="text-[var(--c-text-faint)] ml-1.5">Total {metrica === "licencias" ? "licencias" : "días"}</span>
          </div>
          <div className="text-[var(--c-text-faint)] mt-1 pt-1 border-t border-[var(--c-bg-elev-2)]">Click para ver el legajo</div>
        </div>
      )}
    </div>
  );
}
