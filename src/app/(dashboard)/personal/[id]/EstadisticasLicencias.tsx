"use client";

import { useMemo, useState } from "react";
import {
  LICENCIA_CATEGORIA_DE_TIPO,
  CATEGORIA_LICENCIA_INFO,
  CATEGORIA_LICENCIA_CHART_COLOR,
  TIPO_LICENCIA_LABELS,
  type CategoriaLicencia,
} from "@/types";
import AgenteAvatar from "@/components/AgenteAvatar";
import type { LicenciaEntry } from "./LegajoTabs";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function categoriaColor(tipo: string): string {
  const categoria = LICENCIA_CATEGORIA_DE_TIPO[tipo as keyof typeof LICENCIA_CATEGORIA_DE_TIPO] as CategoriaLicencia | undefined;
  return categoria ? CATEGORIA_LICENCIA_CHART_COLOR[categoria] : "#64748b";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

// Sector anular (para efecto "donut"), no un pie completo — deja lugar al total en el centro.
function describeDonutSlice(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    "M", startOuter.x, startOuter.y,
    "A", rOuter, rOuter, 0, largeArc, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", rInner, rInner, 0, largeArc, 1, startInner.x, startInner.y,
    "Z",
  ].join(" ");
}

function buildDonutSlices<T extends { tipo: string; cantidad: number }>(data: T[], total: number) {
  let anguloActual = -90; // arranca arriba (12hs), como cualquier gráfico de torta convencional
  return data.map((d) => {
    const porcentaje = total > 0 ? d.cantidad / total : 0;
    // Tope en 359.99°: con una sola porción (100%), un barrido de 360° exactos
    // colapsa el punto de inicio y fin del arco SVG y el path deja de dibujarse.
    const anguloBarrido = Math.min(porcentaje * 360, 359.99);
    const anguloInicio = anguloActual;
    const anguloFin = anguloInicio + anguloBarrido;
    anguloActual = anguloFin;
    return { ...d, porcentaje, path: describeDonutSlice(50, 50, 48, 28, anguloInicio, anguloFin) };
  });
}

export interface AgenteInfoInforme {
  nombreCompleto: string;
  cuil: string;
  rango: string | null;
  sector: string | null;
  fotoUrl: string | null;
  sexo: string | null;
}

function hoyLargoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

// Vista de solo impresión: el tema oscuro de la app es ilegible en papel, así
// que trae su propia paleta clara en vez de reusar los bloques de arriba.
// Se oculta en pantalla (.print-informe en globals.css) y solo se revela
// dentro de @media print cuando el botón dispara window.print().
function InformeImprimible({
  agente,
  anioActivo,
  totalDias,
  porCategoria,
  porTipo,
  delAnio,
  slicesDonut,
  totalLicencias,
}: {
  agente: AgenteInfoInforme;
  anioActivo: number;
  totalDias: number;
  porCategoria: { categoria: CategoriaLicencia; dias: number; info: { label: string } }[];
  porTipo: { tipo: string; cantidad: number; label: string }[];
  delAnio: LicenciaEntry[];
  slicesDonut: { tipo: string; label: string; cantidad: number; porcentaje: number; path: string }[];
  totalLicencias: number;
}) {
  return (
    <div className="print-informe px-10 py-8 text-slate-900">
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-bold">Informe de ausentismo</h1>
          <p className="text-sm text-slate-600">Año {anioActivo}</p>
        </div>
        <p className="text-xs text-slate-500">Generado el {hoyLargoAR()}</p>
      </div>

      <div className="flex items-center gap-4 mt-4 mb-6">
        <AgenteAvatar fotoUrl={agente.fotoUrl} sexo={agente.sexo} sizeClassName="h-16 w-16 rounded-lg shrink-0" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-slate-500">Personal:</span> {agente.nombreCompleto}</p>
          <p><span className="text-slate-500">CUIL:</span> {agente.cuil}</p>
          <p><span className="text-slate-500">Rango:</span> {agente.rango ?? "—"}</p>
          <p><span className="text-slate-500">Sector:</span> {agente.sector ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total de días</p>
          <p className="text-2xl font-bold">{totalDias}</p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Cantidad de licencias</p>
          <p className="text-2xl font-bold">{totalLicencias}</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-2">Días por categoría</h2>
      <table className="w-full text-sm mb-6 border-collapse">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 font-medium">Categoría</th>
            <th className="py-1 font-medium text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {porCategoria.length === 0 ? (
            <tr><td colSpan={2} className="py-2 text-slate-500">Sin licencias aprobadas en {anioActivo}.</td></tr>
          ) : porCategoria.map((c) => (
            <tr key={c.categoria} className="border-b border-slate-200">
              <td className="py-1">{c.info.label}</td>
              <td className="py-1 text-right">{c.dias}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="text-sm font-semibold mb-2">Cantidad por tipo</h2>
      <div className="flex items-center gap-6 mb-6">
        {porTipo.length > 0 && (
          <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0" role="img" aria-label="Distribución porcentual por tipo de licencia">
            {slicesDonut.map((s) => (
              <path key={s.tipo} d={s.path} fill={categoriaColor(s.tipo)} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
            ))}
            <text x="50" y="47" textAnchor="middle" style={{ fontSize: 20, fontWeight: 600, fill: "#0f172a" }}>
              {totalLicencias}
            </text>
            <text x="50" y="60" textAnchor="middle" style={{ fontSize: 8, fill: "#475569" }}>
              {totalLicencias === 1 ? "licencia" : "licencias"}
            </text>
          </svg>
        )}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-300 text-left text-slate-500">
              <th className="py-1 font-medium">Tipo</th>
              <th className="py-1 font-medium text-right">Cantidad</th>
              <th className="py-1 font-medium text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {porTipo.length === 0 ? (
              <tr><td colSpan={3} className="py-2 text-slate-500">Sin licencias aprobadas en {anioActivo}.</td></tr>
            ) : porTipo.map((t) => (
              <tr key={t.tipo} className="border-b border-slate-200">
                <td className="py-1 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: categoriaColor(t.tipo) }} />
                  {t.label}
                </td>
                <td className="py-1 text-right">{t.cantidad}</td>
                <td className="py-1 text-right text-slate-500">{Math.round((t.cantidad / totalLicencias) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-sm font-semibold mb-2">Detalle cronológico</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-1 font-medium">Tipo</th>
            <th className="py-1 font-medium">Desde</th>
            <th className="py-1 font-medium">Hasta</th>
            <th className="py-1 font-medium text-right">Días</th>
          </tr>
        </thead>
        <tbody>
          {delAnio.length === 0 ? (
            <tr><td colSpan={4} className="py-2 text-slate-500">Sin licencias aprobadas en {anioActivo}.</td></tr>
          ) : delAnio.map((l) => (
            <tr key={l.id} className="border-b border-slate-200">
              <td className="py-1">{TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}</td>
              <td className="py-1">{fmt(l.fechaInicio)}</td>
              <td className="py-1">{fmt(l.fechaFin)}</td>
              <td className="py-1 text-right">{l.diasHabiles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EstadisticasLicencias({ licencias, agente }: { licencias: LicenciaEntry[]; agente: AgenteInfoInforme }) {
  const aprobadas = useMemo(() => licencias.filter((l) => l.estado === "APROBADA"), [licencias]);

  const anios = useMemo(() => {
    const set = new Set(aprobadas.map((l) => new Date(l.fechaInicio).getUTCFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [aprobadas]);

  const [anio, setAnio] = useState<number | null>(anios[0] ?? null);
  const anioActivo = anio ?? anios[0] ?? new Date().getUTCFullYear();

  const delAnio = useMemo(
    () => aprobadas
      .filter((l) => new Date(l.fechaInicio).getUTCFullYear() === anioActivo)
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)),
    [aprobadas, anioActivo]
  );

  const totalDias = delAnio.reduce((acc, l) => acc + l.diasHabiles, 0);

  const porCategoria = useMemo(() => {
    const acc = new Map<CategoriaLicencia, number>();
    for (const l of delAnio) {
      const categoria = LICENCIA_CATEGORIA_DE_TIPO[l.tipo as keyof typeof LICENCIA_CATEGORIA_DE_TIPO];
      if (!categoria) continue;
      acc.set(categoria, (acc.get(categoria) ?? 0) + l.diasHabiles);
    }
    return [...acc.entries()]
      .map(([categoria, dias]) => ({ categoria, dias, info: CATEGORIA_LICENCIA_INFO[categoria] }))
      .sort((a, b) => b.dias - a.dias);
  }, [delAnio]);

  const maxDiasCategoria = Math.max(1, ...porCategoria.map((c) => c.dias));

  const porTipo = useMemo(() => {
    const acc = new Map<string, number>();
    for (const l of delAnio) acc.set(l.tipo, (acc.get(l.tipo) ?? 0) + 1);
    return [...acc.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad, label: TIPO_LICENCIA_LABELS[tipo] ?? tipo }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [delAnio]);

  const totalLicencias = delAnio.length;
  const slicesDonut = useMemo(() => buildDonutSlices(porTipo, totalLicencias), [porTipo, totalLicencias]);

  if (anios.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-8 text-center">
        <p className="text-sm text-slate-500">Sin licencias aprobadas registradas todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Total en {anioActivo}</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-100 tabular-nums">
            {totalDias} <span className="text-base font-normal text-slate-400">{totalDias === 1 ? "día" : "días"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            🖨️ Imprimir informe
          </button>
          <select
            value={anioActivo}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Total de días por categoría */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Días por categoría</h3>
        {porCategoria.length === 0 ? (
          <p className="text-sm text-slate-500">Sin licencias aprobadas en {anioActivo}.</p>
        ) : (
          <div className="space-y-2.5">
            {porCategoria.map((c) => (
              <div key={c.categoria} className="flex items-center gap-3" title={`${c.info.label}: ${c.dias} ${c.dias === 1 ? "día" : "días"}`}>
                <span className="w-40 shrink-0 text-xs text-slate-400 truncate">{c.info.label}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(4, (c.dias / maxDiasCategoria) * 100)}%`, backgroundColor: CATEGORIA_LICENCIA_CHART_COLOR[c.categoria] }}
                  />
                </div>
                <span className="w-14 shrink-0 text-xs text-slate-300 text-right tabular-nums">{c.dias} {c.dias === 1 ? "día" : "días"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cantidad de licencias por tipo */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Cantidad por tipo</h3>
        {porTipo.length === 0 ? (
          <p className="text-sm text-slate-500">Sin licencias aprobadas en {anioActivo}.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <svg viewBox="0 0 100 100" className="w-28 h-28 shrink-0" role="img" aria-label="Distribución porcentual por tipo de licencia">
              {slicesDonut.map((s) => (
                <path key={s.tipo} d={s.path} fill={categoriaColor(s.tipo)} stroke="#020617" strokeWidth={1.5} strokeLinejoin="round">
                  <title>{`${s.label}: ${s.cantidad} (${Math.round(s.porcentaje * 100)}%)`}</title>
                </path>
              ))}
              <text x="50" y="47" textAnchor="middle" style={{ fontSize: 20, fontWeight: 600, fill: "#f1f5f9" }}>
                {totalLicencias}
              </text>
              <text x="50" y="60" textAnchor="middle" style={{ fontSize: 8, fill: "#cbd5e1" }}>
                {totalLicencias === 1 ? "licencia" : "licencias"}
              </text>
            </svg>
            <ul className="flex-1 w-full space-y-1.5">
              {porTipo.map((t) => (
                <li key={t.tipo} className="flex items-center gap-2.5 text-sm">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoriaColor(t.tipo) }} />
                  <span className="flex-1 text-slate-300 truncate">{t.label}</span>
                  <span className="text-xs text-slate-500 tabular-nums">{Math.round((t.cantidad / totalLicencias) * 100)}%</span>
                  <span className="w-5 text-right text-slate-400 tabular-nums">{t.cantidad}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Línea de tiempo del año */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Línea de tiempo — {anioActivo}</h3>
        {delAnio.length === 0 ? (
          <p className="text-sm text-slate-500">Sin licencias aprobadas en {anioActivo}.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-px text-[10px] text-slate-500 pl-0">
              {MESES.map((m) => (
                <span key={m} className="text-center">{m}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {delAnio.map((l) => {
                const inicio = new Date(l.fechaInicio);
                const fin = new Date(l.fechaFin);
                const mesInicio = inicio.getUTCFullYear() === anioActivo ? inicio.getUTCMonth() : 0;
                const mesFin = fin.getUTCFullYear() > anioActivo ? 11 : fin.getUTCMonth();
                const color = categoriaColor(l.tipo);
                return (
                  <div
                    key={l.id}
                    className="grid grid-cols-12 gap-px h-5"
                    title={`${TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}: ${fmt(l.fechaInicio)} → ${fmt(l.fechaFin)} (${l.diasHabiles} ${l.diasHabiles === 1 ? "día" : "días"})`}
                  >
                    <div
                      className="h-full rounded"
                      style={{ gridColumnStart: mesInicio + 1, gridColumnEnd: mesFin + 2, backgroundColor: color }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <InformeImprimible
        agente={agente}
        anioActivo={anioActivo}
        totalDias={totalDias}
        porCategoria={porCategoria}
        porTipo={porTipo}
        delAnio={delAnio}
        slicesDonut={slicesDonut}
        totalLicencias={totalLicencias}
      />
    </div>
  );
}
