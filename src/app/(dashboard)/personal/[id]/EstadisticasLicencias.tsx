"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  LICENCIA_CATEGORIA_DE_TIPO,
  CATEGORIA_LICENCIA_INFO,
  CATEGORIA_LICENCIA_CHART_COLOR,
  TIPO_LICENCIA_LABELS,
  type CategoriaLicencia,
} from "@/types";
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

// ─── Período dinámico (año puntual / todo el historial / rango a elección) ───

type ModoPeriodo = "anio" | "todo" | "rango";

interface MesBucket {
  anio: number;
  mes: number; // 0-11
  label: string;
}

// Genera los meses entre dos fechas (inclusive) para la línea de tiempo — a
// diferencia del año puntual (siempre Ene-Dic), "Todo"/"rango" pueden cruzar
// años, así que la cantidad de columnas es variable.
function generarMeses(desde: Date, hasta: Date): MesBucket[] {
  const multiAnio = desde.getUTCFullYear() !== hasta.getUTCFullYear();
  const buckets: MesBucket[] = [];
  let anio = desde.getUTCFullYear();
  let mes = desde.getUTCMonth();
  while (anio < hasta.getUTCFullYear() || (anio === hasta.getUTCFullYear() && mes <= hasta.getUTCMonth())) {
    buckets.push({ anio, mes, label: multiAnio ? `${MESES[mes]} ${String(anio).slice(2)}` : MESES[mes] });
    mes++;
    if (mes > 11) { mes = 0; anio++; }
  }
  return buckets;
}

function indiceMes(fecha: Date, buckets: MesBucket[]): number {
  const i = buckets.findIndex((b) => b.anio === fecha.getUTCFullYear() && b.mes === fecha.getUTCMonth());
  if (i !== -1) return i;
  // La licencia empieza/termina fuera del rango visible (ej. arrancó antes
  // del "desde" elegido) — se clampea al primer/último mes visible.
  return fecha.getTime() < Date.UTC(buckets[0]?.anio ?? 0, buckets[0]?.mes ?? 0) ? 0 : buckets.length - 1;
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

function hoyCortoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Foto del agente para el informe: a diferencia de AgenteAvatar (pensado para
// la app en tema oscuro), acá el fallback ante link roto/sin foto es el
// placeholder claro del propio marco .inf-photo, no el ícono de silueta.
function InformeFoto({ fotoUrl }: { fotoUrl: string | null }) {
  const [error, setError] = useState(false);
  if (fotoUrl && !error) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt="" onError={() => setError(true)} />;
  }
  return <span>Sin foto</span>;
}

// Vista de solo impresión: el tema oscuro de la app es ilegible en papel, así
// que trae su propia paleta clara (sistema visual "Industry", ver .inf-* en
// globals.css) en vez de reusar los bloques de arriba. Se oculta en pantalla
// (.print-informe en globals.css) y solo se revela dentro de @media print
// cuando el botón dispara window.print().
function InformeImprimible({
  agente,
  tituloPeriodo,
  nroDocumento,
  totalDias,
  porCategoria,
  porTipo,
  licenciasFiltradas,
  slicesDonut,
  totalLicencias,
}: {
  agente: AgenteInfoInforme;
  tituloPeriodo: string;
  nroDocumento: string;
  totalDias: number;
  porCategoria: { categoria: CategoriaLicencia; dias: number; info: { label: string } }[];
  porTipo: { tipo: string; cantidad: number; label: string }[];
  licenciasFiltradas: LicenciaEntry[];
  slicesDonut: { tipo: string; label: string; cantidad: number; porcentaje: number; path: string }[];
  totalLicencias: number;
}) {
  const promedioLabel =
    totalLicencias > 0
      ? (totalDias / totalLicencias).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "—";

  const categoriaLider = porCategoria[0];
  const pctCategoriaLider = categoriaLider && totalDias > 0 ? Math.round((categoriaLider.dias / totalDias) * 100) : 0;

  const tipoLider = porTipo[0];
  const tipoCaption =
    porTipo.length === 0
      ? "Sin licencias registradas en el período."
      : porTipo.length === 1
        ? `${tipoLider.label} concentra la totalidad de los registros.`
        : `${tipoLider.label} concentra el ${Math.round((tipoLider.cantidad / totalLicencias) * 100)}% de los registros, seguido por ${porTipo.length - 1} tipo${porTipo.length - 1 === 1 ? "" : "s"} más.`;

  // El nodo se crea acá (durante el render, sin efecto secundario visible
  // hasta que se inserte en el documento) para no necesitar un setState
  // dentro del useEffect de abajo.
  const [contenedor] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div")
  );

  // Se inserta como primer hijo de <body> (no al final, como un portal
  // normal): cualquier otra cosa de /personal que esté antes en el DOM
  // seguiría reservando su alto real durante el print (aunque invisible),
  // empujando el informe a páginas en blanco — insertarlo primero evita eso
  // (la regla que colapsa el resto de la app en globals.css es la que se
  // encarga de las páginas en blanco DESPUÉS del informe; esto es lo que
  // evita las de ANTES). Mismo mecanismo ya probado en NominaBuilderBtn.tsx.
  useEffect(() => {
    if (!contenedor) return;
    document.body.insertBefore(contenedor, document.body.firstChild);
    return () => {
      contenedor.remove();
    };
  }, [contenedor]);

  if (!contenedor) return null;

  return createPortal(
    // <table> con thead/tfoot en vez de <article> con position:fixed: es el
    // mecanismo estándar de CSS para que un encabezado/pie se repita en
    // cada hoja de un documento paginado (mismo truco que ya usa
    // .inf-table thead más abajo para repetir la fila de columnas). Ver el
    // comentario en globals.css sobre por qué position:fixed no alcanzaba.
    <table className="inf print-informe">
      <thead>
        <tr>
          <td>
            <div className="inf-runhead">
              <strong>D.M.C.A<span> · Monitoreo Cordobeses en Alerta</span></strong>
              <span>Informe de ausentismo</span>
            </div>
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td>
            <div className="inf-runfoot">
              <span>Documento de uso interno — Área de Personal</span>
              <span className="inf-rev">Rev. {hoyCortoAR()}</span>
            </div>
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td>

      <header className="inf-head">
        <div>
          <div className="inf-kicker">Legajo · Ausentismo</div>
          <h1 className="inf-title">Informe de ausentismo</h1>
          <div className="inf-sub">{tituloPeriodo}</div>
        </div>
        <div className="inf-meta">
          <div>Generado</div>
          <b>{hoyLargoAR()}</b>
          <div className="inf-meta-gap">Documento</div>
          <b>{nroDocumento}</b>
        </div>
      </header>

      <section className="inf-plate">
        <figure className="bp inf-photo">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <InformeFoto fotoUrl={agente.fotoUrl} />
        </figure>
        <div>
          <div className="inf-kicker">Datos del personal</div>
          <h2 className="inf-name">{agente.nombreCompleto}</h2>
          <div className="inf-fields">
            <div><div className="inf-fl">CUIL</div><div className="inf-fv">{agente.cuil}</div></div>
            <div>
              <div className="inf-fl">Rango</div>
              <div className={agente.rango ? "inf-fv" : "inf-fv inf-fv--empty"}>{agente.rango ?? "Sin consignar"}</div>
            </div>
            <div>
              <div className="inf-fl">Sector</div>
              <div className={agente.sector ? "inf-fv" : "inf-fv inf-fv--empty"}>{agente.sector ?? "Sin consignar"}</div>
            </div>
            <div><div className="inf-fl">Período cubierto</div><div className="inf-fv">{tituloPeriodo}</div></div>
          </div>
        </div>
      </section>

      <section className="inf-kpis inf-kpis--3">
        <div className="bp bp--solid inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Total de días</div>
          <div className="inf-kpi-n">{totalDias}</div>
          <div className="inf-kpi-s">días de ausencia acumulados</div>
        </div>
        <div className="bp inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Cantidad de licencias</div>
          <div className="inf-kpi-n">{totalLicencias}</div>
          <div className="inf-kpi-s">registros individuales</div>
        </div>
        <div className="bp inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Promedio por licencia</div>
          <div className="inf-kpi-n">{promedioLabel}</div>
          <div className="inf-kpi-s">días por registro</div>
        </div>
      </section>

      <section className="inf-sec">
        <div className="inf-sech">
          <h3>01 — Composición</h3>
          <span className="inf-line" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "var(--inf-8)" }}>
          <div>
            <div className="inf-fl" style={{ marginBottom: "var(--inf-2)" }}>Días por categoría</div>
            <table className="inf-table">
              <thead><tr><th>Categoría</th><th className="num" style={{ width: 64 }}>Días</th></tr></thead>
              <tbody>
                {porCategoria.length === 0 ? (
                  <tr><td colSpan={2} className="txt">Sin licencias en el período.</td></tr>
                ) : porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td className="txt">{c.info.label}</td>
                    <td className="num">{c.dias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categoriaLider && (
              <>
                <div className="inf-meter" style={{ marginTop: "var(--inf-3)" }}>
                  <span style={{ width: `${pctCategoriaLider}%` }} />
                </div>
                <div className="inf-total" style={{ borderTop: "none", marginTop: "var(--inf-1)", paddingTop: 0, fontSize: 10 }}>
                  <span>{categoriaLider.info.label}</span>
                  <span>{pctCategoriaLider} %</span>
                </div>
              </>
            )}
          </div>
          <div>
            <div className="inf-fl" style={{ marginBottom: "var(--inf-2)" }}>Cantidad por tipo</div>
            <table className="inf-table">
              <thead><tr><th>Tipo</th><th className="num" style={{ width: 74 }}>Cantidad</th><th className="num" style={{ width: 52 }}>%</th></tr></thead>
              <tbody>
                {porTipo.length === 0 ? (
                  <tr><td colSpan={3} className="txt">Sin licencias en el período.</td></tr>
                ) : porTipo.map((t) => (
                  <tr key={t.tipo}>
                    <td className="txt">{t.label}</td>
                    <td className="num">{t.cantidad}</td>
                    <td className="num">{Math.round((t.cantidad / totalLicencias) * 100)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {porTipo.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "var(--inf-4)", marginTop: "var(--inf-3)" }}>
                <svg viewBox="0 0 100 100" style={{ width: 74, height: 74, flex: "none" }} role="img" aria-label="Distribución porcentual por tipo de licencia">
                  {slicesDonut.map((s) => (
                    <path key={s.tipo} d={s.path} fill={categoriaColor(s.tipo)} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
                  ))}
                  <text x="50" y="47" textAnchor="middle" style={{ fontSize: 20, fontWeight: 600, fill: "var(--inf-text)" }}>
                    {totalLicencias}
                  </text>
                  <text x="50" y="60" textAnchor="middle" style={{ fontSize: 8, fill: "var(--inf-muted)" }}>
                    {totalLicencias === 1 ? "licencia" : "licencias"}
                  </text>
                </svg>
                <div style={{ fontSize: 12, color: "var(--inf-muted)", maxWidth: "20ch" }}>{tipoCaption}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="inf-sec">
        <div className="inf-sech">
          <h3>02 — Detalle cronológico</h3>
          <span className="inf-line" />
          <span className="inf-flag">{totalLicencias} registros</span>
        </div>
        <table className="inf-table">
          <thead>
            <tr>
              <th className="num" style={{ width: 26 }}>#</th>
              <th style={{ width: 116 }}>Tipo</th>
              <th style={{ width: 78 }}>Desde</th>
              <th style={{ width: 78 }}>Hasta</th>
              <th className="num" style={{ width: 44 }}>Días</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {licenciasFiltradas.length === 0 ? (
              <tr><td colSpan={6} className="txt">Sin licencias en el período.</td></tr>
            ) : licenciasFiltradas.map((l, i) => (
              <tr key={l.id}>
                <td className="idx">{String(i + 1).padStart(2, "0")}</td>
                <td><span className="inf-tag">{TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}</span></td>
                <td>{fmt(l.fechaInicio)}</td>
                <td>{fmt(l.fechaFin)}</td>
                <td className="num">{l.diasHabiles}</td>
                <td className="txt">{l.motivo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inf-total">
          <span>Total</span>
          <span>{totalDias} días · {totalLicencias} registros</span>
        </div>
      </section>

          </td>
        </tr>
      </tbody>
    </table>,
    contenedor
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

  // Arranca en "Todo" (no en el último año con datos): tanto la vista como
  // el informe impreso deben mostrar el historial completo por defecto, para
  // no imprimir de forma silenciosa solo el año más reciente si el usuario
  // no toca el selector antes de imprimir.
  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");

  function elegirPeriodo(valor: string) {
    if (valor === "todo") {
      setModo("todo");
      return;
    }
    if (valor === "rango") {
      setModo("rango");
      // Precarga el rango con el historial completo, para no arrancar con
      // los dos campos vacíos (y el informe vacío) hasta que el usuario
      // toque algo.
      if (!rangoDesde && !rangoHasta && aprobadas.length > 0) {
        const fechas = aprobadas.map((l) => l.fechaInicio.slice(0, 10)).sort();
        setRangoDesde(fechas[0]);
        setRangoHasta(fechas[fechas.length - 1]);
      }
      return;
    }
    setModo("anio");
    setAnio(Number(valor));
  }

  const licenciasFiltradas = useMemo(() => {
    if (modo === "todo") {
      return [...aprobadas].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    }
    if (modo === "rango") {
      if (!rangoDesde || !rangoHasta) return [];
      return aprobadas
        .filter((l) => {
          const f = l.fechaInicio.slice(0, 10);
          return f >= rangoDesde && f <= rangoHasta;
        })
        .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    }
    return aprobadas
      .filter((l) => new Date(l.fechaInicio).getUTCFullYear() === anioActivo)
      .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  }, [aprobadas, modo, anioActivo, rangoDesde, rangoHasta]);

  const tituloPeriodo =
    modo === "todo"
      ? "Todo el historial"
      : modo === "rango"
        ? (rangoDesde && rangoHasta ? `Del ${fmt(rangoDesde)} al ${fmt(rangoHasta)}` : "Seleccioná un período")
        : `Año ${anioActivo}`;

  // Identificador del documento impreso: no hay una numeración formal de
  // informes en la app, así que se arma uno legible/estable a partir del
  // período elegido y los últimos dígitos del CUIL (alcanza para diferenciar
  // informes de distintos agentes o períodos sin persistir nada nuevo).
  const nroDocumento = useMemo(() => {
    const cuilCorto = agente.cuil.replace(/\D/g, "").slice(-4) || "0000";
    const periodo = modo === "todo" ? "HIST" : modo === "rango" ? "PER" : String(anioActivo);
    return `AUS-${periodo}-${cuilCorto}`;
  }, [agente.cuil, modo, anioActivo]);

  // Rango de meses a graficar en la línea de tiempo: Ene-Dic del año activo
  // en modo "anio", o el tramo real cubierto por las licencias filtradas en
  // "todo"/"rango" (puede cruzar años).
  const rangoMeses = useMemo(() => {
    if (modo === "anio") {
      return { desde: new Date(Date.UTC(anioActivo, 0, 1)), hasta: new Date(Date.UTC(anioActivo, 11, 1)) };
    }
    if (licenciasFiltradas.length === 0) return null;
    const tiempos = licenciasFiltradas.flatMap((l) => [new Date(l.fechaInicio).getTime(), new Date(l.fechaFin).getTime()]);
    return { desde: new Date(Math.min(...tiempos)), hasta: new Date(Math.max(...tiempos)) };
  }, [modo, anioActivo, licenciasFiltradas]);

  const meses = useMemo(() => (rangoMeses ? generarMeses(rangoMeses.desde, rangoMeses.hasta) : []), [rangoMeses]);

  const totalDias = licenciasFiltradas.reduce((acc, l) => acc + l.diasHabiles, 0);

  const porCategoria = useMemo(() => {
    const acc = new Map<CategoriaLicencia, number>();
    for (const l of licenciasFiltradas) {
      const categoria = LICENCIA_CATEGORIA_DE_TIPO[l.tipo as keyof typeof LICENCIA_CATEGORIA_DE_TIPO];
      if (!categoria) continue;
      acc.set(categoria, (acc.get(categoria) ?? 0) + l.diasHabiles);
    }
    return [...acc.entries()]
      .map(([categoria, dias]) => ({ categoria, dias, info: CATEGORIA_LICENCIA_INFO[categoria] }))
      .sort((a, b) => b.dias - a.dias);
  }, [licenciasFiltradas]);

  const maxDiasCategoria = Math.max(1, ...porCategoria.map((c) => c.dias));

  const porTipo = useMemo(() => {
    const acc = new Map<string, number>();
    for (const l of licenciasFiltradas) acc.set(l.tipo, (acc.get(l.tipo) ?? 0) + 1);
    return [...acc.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad, label: TIPO_LICENCIA_LABELS[tipo] ?? tipo }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [licenciasFiltradas]);

  const totalLicencias = licenciasFiltradas.length;
  const slicesDonut = useMemo(() => buildDonutSlices(porTipo, totalLicencias), [porTipo, totalLicencias]);

  if (anios.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] px-4 py-8 text-center">
        <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas registradas todavía.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-[var(--c-text-faint)] uppercase tracking-wide mb-0.5">Total — {tituloPeriodo}</p>
          <p className="text-3xl font-semibold tracking-tight text-[var(--c-text)] tabular-nums">
            {totalDias} <span className="text-base font-normal text-[var(--c-text-muted)]">{totalDias === 1 ? "día" : "días"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {modo === "rango" && (
            <>
              <input
                type="date"
                value={rangoDesde}
                onChange={(e) => setRangoDesde(e.target.value)}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
              />
              <span className="text-[var(--c-text-faint)] text-sm">→</span>
              <input
                type="date"
                value={rangoHasta}
                onChange={(e) => setRangoHasta(e.target.value)}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] [color-scheme:dark]"
              />
            </>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            title='Antes de imprimir, desmarcá "Encabezados y pies de página" en el diálogo del navegador para un resultado prolijo.'
            className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] hover:text-[var(--c-text)]"
          >
            🖨️ Imprimir informe
          </button>
          <select
            value={modo === "anio" ? String(anioActivo) : modo}
            onChange={(e) => elegirPeriodo(e.target.value)}
            className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]"
          >
            {anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="todo">Todo</option>
            <option value="rango">Seleccionar período…</option>
          </select>
          {/* El doble encabezado/pie que se ve en el PDF/impresión (fecha,
              URL, número de página) no lo agrega nuestro diseño — lo agrega
              el propio navegador y solo se puede sacar desde su diálogo de
              impresión, no hay forma de hacerlo desde CSS/JS. */}
          <p className="basis-full text-right text-[11px] text-[var(--c-text-faint)]">
            Antes de imprimir, desmarcá &quot;Encabezados y pies de página&quot; en el diálogo del navegador.
          </p>
        </div>
      </div>

      {/* Total de días por categoría */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Días por categoría</h3>
        {porCategoria.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <div className="space-y-2.5">
            {porCategoria.map((c) => (
              <div key={c.categoria} className="flex items-center gap-3" title={`${c.info.label}: ${c.dias} ${c.dias === 1 ? "día" : "días"}`}>
                <span className="w-40 shrink-0 text-xs text-[var(--c-text-muted)] truncate">{c.info.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--c-bg-elev)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(4, (c.dias / maxDiasCategoria) * 100)}%`, backgroundColor: CATEGORIA_LICENCIA_CHART_COLOR[c.categoria] }}
                  />
                </div>
                <span className="w-14 shrink-0 text-xs text-[var(--c-text-secondary)] text-right tabular-nums">{c.dias} {c.dias === 1 ? "día" : "días"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cantidad de licencias por tipo */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Cantidad por tipo</h3>
        {porTipo.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
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
                  <span className="flex-1 text-[var(--c-text-secondary)] truncate">{t.label}</span>
                  <span className="text-xs text-[var(--c-text-faint)] tabular-nums">{Math.round((t.cantidad / totalLicencias) * 100)}%</span>
                  <span className="w-5 text-right text-[var(--c-text-muted)] tabular-nums">{t.cantidad}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Línea de tiempo del período */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Línea de tiempo — {tituloPeriodo}</h3>
        {licenciasFiltradas.length === 0 || meses.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <div className="space-y-2 overflow-x-auto">
            <div
              className="grid gap-px text-[10px] text-[var(--c-text-faint)] pl-0 min-w-max"
              style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(28px, 1fr))` }}
            >
              {meses.map((m, i) => (
                <span key={`${m.anio}-${m.mes}-${i}`} className="text-center">{m.label}</span>
              ))}
            </div>
            <div className="space-y-1.5 min-w-max">
              {licenciasFiltradas.map((l) => {
                const mesInicio = indiceMes(new Date(l.fechaInicio), meses);
                const mesFin = indiceMes(new Date(l.fechaFin), meses);
                const color = categoriaColor(l.tipo);
                return (
                  <div
                    key={l.id}
                    className="grid gap-px h-5"
                    style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(28px, 1fr))` }}
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
        tituloPeriodo={tituloPeriodo}
        nroDocumento={nroDocumento}
        totalDias={totalDias}
        porCategoria={porCategoria}
        porTipo={porTipo}
        licenciasFiltradas={licenciasFiltradas}
        slicesDonut={slicesDonut}
        totalLicencias={totalLicencias}
      />
    </div>
  );
}
