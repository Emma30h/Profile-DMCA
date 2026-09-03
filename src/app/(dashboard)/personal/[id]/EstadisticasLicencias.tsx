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
import { useEntrada } from "@/lib/useEntrada";
import { useReplayOnChange } from "@/lib/useReplayOnChange";
import { useCountUp } from "@/lib/useCountUp";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Un componente aparte (no useCountUp llamado directo dentro de un .map) es
// obligatorio acá: la cantidad de categorías/tipos/días visibles cambia con
// el filtro, así que la cantidad de veces que se llamaría el hook por
// render no sería estable — eso rompe las reglas de hooks de React. Como
// componente, cada fila tiene su propia instancia con exactamente un hook,
// sin importar cuántas entren o salgan al cambiar de período.
function ValorAnimado({ value, duracionMs = 900 }: { value: number; duracionMs?: number }) {
  const animado = useCountUp(value, 0, duracionMs);
  return <>{animado}</>;
}

// Lunes primero (convención local), no domingo-sábado como getUTCDay() nativo.
const DIAS_SEMANA = [
  { corto: "Lun", label: "Lunes" },
  { corto: "Mar", label: "Martes" },
  { corto: "Mié", label: "Miércoles" },
  { corto: "Jue", label: "Jueves" },
  { corto: "Vie", label: "Viernes" },
  { corto: "Sáb", label: "Sábado" },
  { corto: "Dom", label: "Domingo" },
];
// Lunes (0) y viernes (4): arrancar ahí una licencia estira un fin de
// semana — es el patrón que este gráfico existe para hacer visible.
const DIAS_SEMANA_ESTIRAN_FINDE = new Set([0, 4]);

function diaSemanaIndice(iso: string): number {
  return (new Date(iso).getUTCDay() + 6) % 7;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function categoriaColor(tipo: string): string {
  const categoria = LICENCIA_CATEGORIA_DE_TIPO[tipo as keyof typeof LICENCIA_CATEGORIA_DE_TIPO] as CategoriaLicencia | undefined;
  return categoria ? CATEGORIA_LICENCIA_CHART_COLOR[categoria] : "#64748b";
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

// ─── Vista en pantalla: barras/anillo con la terminación visual ya
// establecida en dashboard (grilla de referencia, animación de entrada,
// tooltip flotante) — separado de todo lo de arriba, que sigue siendo lo que
// usa InformeImprimible (paleta clara de impresión, sin animar).

const ALTURA_BARRA_CATEGORIA = 24;
const GAP_BARRAS_CATEGORIA = 10;
const SEGMENTOS_GRILLA = 4;

const RADIO_ANILLO_EXTERNO = 54;
const PASO_ANILLO = 10;
const GROSOR_ANILLO = 7;
const MAX_ANILLOS = 5;
const COLOR_OTROS = "#64748b";

interface TooltipCategoria {
  x: number;
  y: number;
  categoria: CategoriaLicencia;
}

interface TooltipAnillo {
  x: number;
  y: number;
  tipo: string;
}

interface TooltipLicencia {
  x: number;
  y: number;
  licencia: LicenciaEntry;
}

const ALTURA_GRAFICO_SEMANA = 120;

interface TooltipDiaSemana {
  x: number;
  y: number;
  dia: number;
}

export interface AgenteInfoInforme {
  nombreCompleto: string;
  cuil: string;
  rango: string | null;
  sector: string | null;
  fotoUrl: string | null;
  sexo: string | null;
  // Solo ADMINISTRATIVO tiene semana laboral fija (L-V, sábado y domingo
  // libres) — todo el resto (A-F, FULL TIME, GUARDIA LARGA, SUPERIOR DE
  // TURNO, PERSONAL INGRESANTE) trabaja esquema rotativo, sin fin de semana
  // fijo. Usado para decidir si el resaltado de lunes/viernes del gráfico de
  // "Día de la semana en que arrancan" tiene sentido para este agente.
  turno: string | null;
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
  totalLicencias,
}: {
  agente: AgenteInfoInforme;
  tituloPeriodo: string;
  nroDocumento: string;
  totalDias: number;
  porCategoria: { categoria: CategoriaLicencia; dias: number; info: { label: string } }[];
  porTipo: { tipo: string; cantidad: number; label: string }[];
  licenciasFiltradas: LicenciaEntry[];
  totalLicencias: number;
}) {
  const promedioLabel =
    totalLicencias > 0
      ? (totalDias / totalLicencias).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "—";

  const maxDiasComposicion = Math.max(1, ...porCategoria.map((c) => c.dias));

  // Mismo criterio que el anillo en pantalla (ver porTipoVista más arriba):
  // más de MAX_ANILLOS tipos distintos no entran legibles como anillos
  // separados, así que el resto se pliega en "Otros".
  const porTipoAnillo = (() => {
    const conColor = porTipo.map((t) => ({ ...t, color: categoriaColor(t.tipo) }));
    if (conColor.length <= MAX_ANILLOS) return conColor;
    const principales = conColor.slice(0, MAX_ANILLOS - 1);
    const otros = conColor.slice(MAX_ANILLOS - 1).reduce((acc, t) => acc + t.cantidad, 0);
    return [...principales, { tipo: "OTROS", cantidad: otros, label: "Otros", color: COLOR_OTROS }];
  })();

  const tipoLider = porTipo[0];
  const tipoCaption =
    porTipo.length === 0
      ? "Sin licencias registradas en el período."
      : porTipo.length === 1
        ? `${tipoLider.label} concentra la totalidad de los registros.`
        : `${tipoLider.label} concentra el ${Math.round((tipoLider.cantidad / totalLicencias) * 100)}% de los registros, seguido por ${porTipo.length - 1} tipo${porTipo.length - 1 === 1 ? "" : "s"} más.`;

  // El nodo se crea recién en el efecto (no en el initializer de useState):
  // un initializer que chequea `typeof document` devuelve `null` en el
  // server y un div real en el primer render del cliente — esos son
  // valores DISTINTOS ya en el render de hidratación, antes de que corra
  // ningún efecto, y React lo detecta como mismatch de hidratación (mismo
  // bug real, encontrado y corregido primero en InformeAusentismo.tsx).
  // Arrancando en `null` en ambos lados y recién creando el div en el
  // efecto, el primer render (servidor y cliente) coincide siempre.
  //
  // Se inserta como primer hijo de <body> (no al final, como un portal
  // normal): cualquier otra cosa de /personal que esté antes en el DOM
  // seguiría reservando su alto real durante el print (aunque invisible),
  // empujando el informe a páginas en blanco — insertarlo primero evita eso
  // (la regla que colapsa el resto de la app en globals.css es la que se
  // encarga de las páginas en blanco DESPUÉS del informe; esto es lo que
  // evita las de ANTES). Mismo mecanismo ya probado en NominaBuilderBtn.tsx.
  const [contenedor, setContenedor] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    document.body.insertBefore(el, document.body.firstChild);
    // El setState no puede quedar síncrono en el cuerpo del efecto (lint
    // set-state-in-effect de este repo, ver useCountUp.ts) — envolverlo en
    // un rAF también sirve para separarlo del commit de montaje del efecto.
    const raf = requestAnimationFrame(() => setContenedor(el));
    return () => {
      cancelAnimationFrame(raf);
      el.remove();
    };
  }, []);

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
              <strong>Dirección Monitoreo Cordobeses en Alerta</strong>
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
        <div className="inf-head-right">
          {/* eslint-disable-next-line @next/next/no-img-element -- mismo criterio que InformeFoto: fuera del control de next/image en un documento de impresión */}
          <img src="/logo-ojos-en-alerta-blanco.png" alt="" className="inf-logo" />
          <div className="inf-meta">
            <div>Generado</div>
            <b>{hoyLargoAR()}</b>
            <div className="inf-meta-gap">Documento</div>
            <b>{nroDocumento}</b>
          </div>
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
            <div className="inf-fl" style={{ marginBottom: "var(--inf-3)" }}>Días por categoría</div>
            {porCategoria.length === 0 ? (
              <p className="inf-fineprint" style={{ margin: 0 }}>Sin licencias en el período.</p>
            ) : (
              <div className="inf-hbars">
                {porCategoria.map((c) => (
                  <div className="inf-hbar-row" key={c.categoria}>
                    <span className="inf-hbar-label">{c.info.label}</span>
                    <span className="inf-hbar-track">
                      <span
                        className="inf-hbar-fill"
                        style={{ width: `${Math.max(3, (c.dias / maxDiasComposicion) * 100)}%`, background: CATEGORIA_LICENCIA_CHART_COLOR[c.categoria] }}
                      />
                    </span>
                    <span className="inf-hbar-value">{c.dias}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="inf-fl" style={{ marginBottom: "var(--inf-3)" }}>Cantidad por tipo</div>
            {porTipoAnillo.length === 0 ? (
              <p className="inf-fineprint" style={{ margin: 0 }}>Sin licencias en el período.</p>
            ) : (
              <>
                <div className="inf-ring-wrap">
                  <div className="inf-ring-box">
                    <svg viewBox="0 0 120 120" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} role="img" aria-label="Cantidad de licencias por tipo">
                      {porTipoAnillo.map((t, i) => {
                        const r = RADIO_ANILLO_EXTERNO - i * PASO_ANILLO;
                        const circunferencia = 2 * Math.PI * r;
                        const pct = totalLicencias > 0 ? t.cantidad / totalLicencias : 0;
                        const largo = pct * circunferencia;
                        return (
                          <g key={t.tipo}>
                            <circle cx="60" cy="60" r={r} fill="none" stroke={t.color} strokeOpacity={0.18} strokeWidth={GROSOR_ANILLO} />
                            <circle
                              cx="60" cy="60" r={r} fill="none" stroke={t.color} strokeWidth={GROSOR_ANILLO}
                              strokeLinecap="round" strokeDasharray={`${largo} ${circunferencia}`}
                            />
                          </g>
                        );
                      })}
                    </svg>
                    <div className="inf-ring-center">
                      <b>{totalLicencias}</b>
                      <span>{totalLicencias === 1 ? "licencia" : "licencias"}</span>
                    </div>
                  </div>
                  <ul className="inf-ring-legend">
                    {porTipoAnillo.map((t) => (
                      <li className="inf-ring-legend-row" key={t.tipo}>
                        <span className="inf-ring-legend-dot" style={{ background: t.color }} />
                        <span className="inf-ring-legend-label">{t.label}</span>
                        <span className="inf-ring-legend-pct">{totalLicencias > 0 ? Math.round((t.cantidad / totalLicencias) * 100) : 0}%</span>
                        <span className="inf-ring-legend-val">{t.cantidad}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="inf-fineprint" style={{ marginTop: "var(--inf-3)" }}>{tipoCaption}</p>
              </>
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

  // Trae ambas métricas juntas (días y cantidad de licencias) — el toggle de
  // "Días por categoría" solo elige cuál de las dos se grafica, no vuelve a
  // recorrer licenciasFiltradas. El orden de por sí queda por días (es lo
  // que también espera InformeImprimible, que solo usa esta versión).
  const porCategoria = useMemo(() => {
    const acc = new Map<CategoriaLicencia, { dias: number; cantidad: number }>();
    for (const l of licenciasFiltradas) {
      const categoria = LICENCIA_CATEGORIA_DE_TIPO[l.tipo as keyof typeof LICENCIA_CATEGORIA_DE_TIPO];
      if (!categoria) continue;
      const entrada = acc.get(categoria) ?? { dias: 0, cantidad: 0 };
      entrada.dias += l.diasHabiles;
      entrada.cantidad += 1;
      acc.set(categoria, entrada);
    }
    return [...acc.entries()]
      .map(([categoria, v]) => ({ categoria, dias: v.dias, cantidad: v.cantidad, info: CATEGORIA_LICENCIA_INFO[categoria] }))
      .sort((a, b) => b.dias - a.dias);
  }, [licenciasFiltradas]);

  const [metricaCategoria, setMetricaCategoria] = useState<"dias" | "cantidad">("dias");

  // Vista activa del gráfico "por categoría": mismos datos que porCategoria,
  // pero reordenados según la métrica elegida (la barra más grande arriba,
  // sea cual sea el criterio activo).
  const porCategoriaVista = useMemo(() => {
    if (metricaCategoria === "dias") return porCategoria;
    return [...porCategoria].sort((a, b) => b.cantidad - a.cantidad);
  }, [porCategoria, metricaCategoria]);

  const maxValorCategoria = Math.max(1, ...porCategoriaVista.map((c) => (metricaCategoria === "dias" ? c.dias : c.cantidad)));

  const porTipo = useMemo(() => {
    const acc = new Map<string, number>();
    for (const l of licenciasFiltradas) acc.set(l.tipo, (acc.get(l.tipo) ?? 0) + 1);
    return [...acc.entries()]
      .map(([tipo, cantidad]) => ({ tipo, cantidad, label: TIPO_LICENCIA_LABELS[tipo] ?? tipo }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [licenciasFiltradas]);

  const totalLicencias = licenciasFiltradas.length;

  // Igual que porTipo, pero con ambas métricas juntas (días y cantidad) — es
  // lo que alimenta el anillo múltiple de pantalla. El orden y el plegado en
  // "Otros" dependen de cuál esté activa (ver porTipoVista más abajo), así
  // que acá todavía no se ordena ni se pliega nada.
  const porTipoDias = useMemo(() => {
    const acc = new Map<string, { dias: number; cantidad: number }>();
    for (const l of licenciasFiltradas) {
      const entrada = acc.get(l.tipo) ?? { dias: 0, cantidad: 0 };
      entrada.dias += l.diasHabiles;
      entrada.cantidad += 1;
      acc.set(l.tipo, entrada);
    }
    return [...acc.entries()].map(([tipo, v]) => ({
      tipo, dias: v.dias, cantidad: v.cantidad,
      label: TIPO_LICENCIA_LABELS[tipo] ?? tipo,
      color: categoriaColor(tipo),
    }));
  }, [licenciasFiltradas]);

  const [metricaAnillo, setMetricaAnillo] = useState<"dias" | "cantidad">("dias");

  // Ordenado y plegado en "Otros" según la métrica activa (más de
  // MAX_ANILLOS tipos distintos no entran legibles como anillos separados
  // — mismo criterio que el resto de la app para una serie categórica que
  // se pasa de la cantidad de series que entran).
  const porTipoVista = useMemo(() => {
    const ordenado = [...porTipoDias].sort((a, b) =>
      metricaAnillo === "dias" ? b.dias - a.dias : b.cantidad - a.cantidad
    );
    if (ordenado.length <= MAX_ANILLOS) return ordenado;
    const principales = ordenado.slice(0, MAX_ANILLOS - 1);
    const resto = ordenado.slice(MAX_ANILLOS - 1);
    return [
      ...principales,
      {
        tipo: "OTROS",
        dias: resto.reduce((acc, i) => acc + i.dias, 0),
        cantidad: resto.reduce((acc, i) => acc + i.cantidad, 0),
        label: "Otros",
        color: COLOR_OTROS,
      },
    ];
  }, [porTipoDias, metricaAnillo]);

  // Cuántas licencias arrancan cada día de la semana — no días acumulados
  // (una licencia médica larga pesaría igual que diez cortas y taparía el
  // patrón), sino cantidad de veces que ESE día fue el "Desde" elegido.
  const porDiaSemana = useMemo(() => {
    const acc = new Array(7).fill(0);
    for (const l of licenciasFiltradas) acc[diaSemanaIndice(l.fechaInicio)]++;
    return DIAS_SEMANA.map((d, i) => ({ ...d, dia: i, cantidad: acc[i] }));
  }, [licenciasFiltradas]);

  const maxPorDiaSemana = Math.max(1, ...porDiaSemana.map((d) => d.cantidad));

  // El resaltado de lunes/viernes ("estira el fin de semana") solo tiene
  // sentido con una semana laboral fija de L-V — el resto de los turnos
  // (A-F, FULL TIME, GUARDIA LARGA, SUPERIOR DE TURNO, PERSONAL INGRESANTE)
  // son esquemas rotativos sin fin de semana fijo, donde marcar esos dos
  // días sería arbitrario (o directamente engañoso).
  const esAdministrativo = agente.turno === "ADMINISTRATIVO";

  // Gate de animación: arranca "colapsado" y crece una vez montado, y
  // vuelve a jugar la transición cada vez que cambia el período filtrado
  // (mismo mecanismo que dashboard — ver useEntrada/useReplayOnChange).
  const entrada = useEntrada();
  const replayListo = useReplayOnChange(licenciasFiltradas);
  const listo = entrada && replayListo;

  const [hoverCategoria, setHoverCategoria] = useState<CategoriaLicencia | null>(null);
  const [tooltipCategoria, setTooltipCategoria] = useState<TooltipCategoria | null>(null);
  const [hoverAnillo, setHoverAnillo] = useState<string | null>(null);
  const [tooltipAnillo, setTooltipAnillo] = useState<TooltipAnillo | null>(null);
  const [tooltipLicencia, setTooltipLicencia] = useState<TooltipLicencia | null>(null);
  const [tooltipDiaSemana, setTooltipDiaSemana] = useState<TooltipDiaSemana | null>(null);

  const hoyReal = new Date();
  const hoyEnMeses = meses.findIndex((m) => m.anio === hoyReal.getUTCFullYear() && m.mes === hoyReal.getUTCMonth());

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
            <ValorAnimado value={totalDias} /> <span className="text-base font-normal text-[var(--c-text-muted)]">{totalDias === 1 ? "día" : "días"}</span>
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
            onClick={() => {
              // document.title es lo que Chrome/Edge sugieren como nombre de
              // archivo en "Guardar como PDF" — lo pisamos justo antes de
              // imprimir y lo restauramos al cerrar el diálogo (afterprint)
              // para no dejar la pestaña con ese título todo el tiempo.
              const tituloOriginal = document.title;
              document.title = `INFORME DE AUSENTISMO ${agente.nombreCompleto} ${tituloPeriodo}`.replace(/\//g, "-");
              const restaurar = () => {
                document.title = tituloOriginal;
                window.removeEventListener("afterprint", restaurar);
              };
              window.addEventListener("afterprint", restaurar);
              window.print();
            }}
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

      {/* Días u cantidad de licencias por categoría */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--c-text)]">Por categoría</h3>
          <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
            {(["dias", "cantidad"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetricaCategoria(m)}
                aria-pressed={metricaCategoria === m}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  metricaCategoria === m
                    ? "bg-[var(--c-blue)] text-white"
                    : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                }`}
              >
                {m === "dias" ? "Días" : "Cantidad"}
              </button>
            ))}
          </div>
        </div>
        {porCategoriaVista.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col shrink-0" style={{ gap: GAP_BARRAS_CATEGORIA }}>
              {porCategoriaVista.map((c) => (
                <div
                  key={c.categoria}
                  className="flex items-center justify-end text-[11.5px] text-[var(--c-text-secondary)] text-right truncate"
                  title={c.info.label}
                  style={{ height: ALTURA_BARRA_CATEGORIA, width: 172 }}
                >
                  {c.info.label}
                </div>
              ))}
            </div>

            <div className="flex-1 min-w-0">
              <div className="relative">
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => i / SEGMENTOS_GRILLA).map((frac) => (
                    <div
                      key={frac}
                      className="absolute top-0 bottom-0 border-l border-[var(--c-line)]"
                      style={{ left: `${frac * 100}%`, opacity: frac === 0 ? 1 : 0.5 }}
                    />
                  ))}
                </div>
                <div className="flex flex-col relative" style={{ gap: GAP_BARRAS_CATEGORIA }}>
                  {porCategoriaVista.map((c, i) => {
                    const valor = metricaCategoria === "dias" ? c.dias : c.cantidad;
                    // En "cantidad" no hace falta la palabra "licencias": ya
                    // estamos en la sección de licencias, y repetirla en
                    // cada barra era ruido — el número solo se entiende igual.
                    const unidad = metricaCategoria === "dias" ? (valor === 1 ? "día" : "días") : "";
                    return (
                      <div
                        key={c.categoria}
                        className="flex items-center rounded-r-[3px]"
                        style={{ height: ALTURA_BARRA_CATEGORIA }}
                        onPointerEnter={(e) => {
                          setHoverCategoria(c.categoria);
                          setTooltipCategoria({ x: e.clientX, y: e.clientY, categoria: c.categoria });
                        }}
                        onPointerMove={(e) => setTooltipCategoria({ x: e.clientX, y: e.clientY, categoria: c.categoria })}
                        onPointerLeave={() => {
                          setHoverCategoria(null);
                          setTooltipCategoria(null);
                        }}
                      >
                        <div
                          className="h-full rounded-r-[3px]"
                          style={{
                            width: listo ? `${Math.max(1.5, (valor / maxValorCategoria) * 100)}%` : 0,
                            background: CATEGORIA_LICENCIA_CHART_COLOR[c.categoria],
                            filter: hoverCategoria === c.categoria ? "brightness(1.15)" : undefined,
                            transition: `filter 150ms, width 550ms cubic-bezier(.22,1,.36,1) ${i * 35}ms`,
                          }}
                        />
                        <span className="ml-2 text-[11px] font-bold text-[var(--c-text)] tabular-nums whitespace-nowrap">
                          <ValorAnimado value={valor} />{unidad && ` ${unidad}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anillo múltiple por tipo: un anillo por tipo, relleno según qué
          proporción del total (en días o en cantidad, según el toggle) le
          corresponde. */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--c-text)]">Por tipo</h3>
          <div className="inline-flex rounded-md border border-[var(--c-line)] overflow-hidden">
            {(["dias", "cantidad"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetricaAnillo(m)}
                aria-pressed={metricaAnillo === m}
                className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                  metricaAnillo === m
                    ? "bg-[var(--c-blue)] text-white"
                    : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
                }`}
              >
                {m === "dias" ? "Días" : "Cantidad"}
              </button>
            ))}
          </div>
        </div>
        {porTipoVista.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" role="img" aria-label="Licencias por tipo">
              {porTipoVista.map((t, i) => {
                const r = RADIO_ANILLO_EXTERNO - i * PASO_ANILLO;
                const circunferencia = 2 * Math.PI * r;
                const total = metricaAnillo === "dias" ? totalDias : totalLicencias;
                const valor = metricaAnillo === "dias" ? t.dias : t.cantidad;
                const pct = total > 0 ? valor / total : 0;
                const largo = listo ? pct * circunferencia : 0;
                return (
                  <g key={t.tipo}>
                    <circle cx="60" cy="60" r={r} fill="none" stroke={t.color} strokeOpacity={0.16} strokeWidth={GROSOR_ANILLO} />
                    <circle
                      cx="60"
                      cy="60"
                      r={r}
                      fill="none"
                      stroke={t.color}
                      strokeWidth={GROSOR_ANILLO}
                      strokeLinecap="round"
                      strokeDasharray={`${largo} ${circunferencia}`}
                      style={{
                        filter: hoverAnillo === t.tipo ? "brightness(1.25)" : undefined,
                        transition: `stroke-dasharray 700ms cubic-bezier(.22,1,.36,1) ${i * 60}ms, filter 150ms`,
                      }}
                      onPointerEnter={(e) => {
                        setHoverAnillo(t.tipo);
                        setTooltipAnillo({ x: e.clientX, y: e.clientY, tipo: t.tipo });
                      }}
                      onPointerMove={(e) => setTooltipAnillo({ x: e.clientX, y: e.clientY, tipo: t.tipo })}
                      onPointerLeave={() => {
                        setHoverAnillo(null);
                        setTooltipAnillo(null);
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tracking-tight text-[var(--c-text)] tabular-nums">
                <ValorAnimado value={metricaAnillo === "dias" ? totalDias : totalLicencias} />
              </span>
              <span className="text-[10px] text-[var(--c-text-faint)]">
                {metricaAnillo === "dias" ? (totalDias === 1 ? "día" : "días") : ""}
              </span>
            </div>
            </div>
            <ul className="flex-1 w-full space-y-1.5">
              {porTipoVista.map((t) => {
                const total = metricaAnillo === "dias" ? totalDias : totalLicencias;
                const valor = metricaAnillo === "dias" ? t.dias : t.cantidad;
                const unidad = metricaAnillo === "dias" ? (valor === 1 ? "día" : "días") : "";
                return (
                  <li
                    key={t.tipo}
                    className="flex items-center gap-2.5 text-sm rounded px-1 -mx-1 transition-colors"
                    style={{ background: hoverAnillo === t.tipo ? "var(--c-bg-elev)" : undefined }}
                    onPointerEnter={() => setHoverAnillo(t.tipo)}
                    onPointerLeave={() => setHoverAnillo(null)}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="flex-1 text-[var(--c-text-secondary)] truncate">{t.label}</span>
                    <span className="text-xs text-[var(--c-text-faint)] tabular-nums">
                      <ValorAnimado value={total > 0 ? Math.round((valor / total) * 100) : 0} />%
                    </span>
                    <span className="w-14 text-right text-[var(--c-text-muted)] tabular-nums">
                      <ValorAnimado value={valor} />{unidad && ` ${unidad}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Día de la semana en que arrancan las licencias */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Día de la semana en que arrancan</h3>
        {totalLicencias === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <>
            {esAdministrativo && (
              <p className="text-[11px] text-[var(--c-text-faint)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full align-middle mr-1" style={{ background: "var(--c-amber)" }} />
                Lunes y viernes remarcados: arrancar una licencia ahí estira un fin de semana.
              </p>
            )}
            <div className="relative" style={{ height: ALTURA_GRAFICO_SEMANA }}>
              <div className="absolute inset-0 pointer-events-none">
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
                  <div
                    key={frac}
                    className="absolute left-0 right-0 border-t border-[var(--c-line)]"
                    style={{ bottom: `${frac * 100}%`, opacity: frac === 0 ? 1 : 0.5 }}
                  />
                ))}
              </div>
              <div className="relative flex items-end justify-between gap-2 h-full">
                {porDiaSemana.map((d, i) => {
                  const color = esAdministrativo && DIAS_SEMANA_ESTIRAN_FINDE.has(d.dia) ? "var(--c-amber)" : "var(--c-blue)";
                  return (
                    <div
                      key={d.dia}
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-default"
                      onPointerEnter={(e) => setTooltipDiaSemana({ x: e.clientX, y: e.clientY, dia: d.dia })}
                      onPointerMove={(e) => setTooltipDiaSemana({ x: e.clientX, y: e.clientY, dia: d.dia })}
                      onPointerLeave={() => setTooltipDiaSemana(null)}
                    >
                      <span className="text-[10px] font-bold text-[var(--c-text)] tabular-nums mb-1 h-3.5">
                        {d.cantidad > 0 ? <ValorAnimado value={d.cantidad} /> : ""}
                      </span>
                      <div
                        className="w-full max-w-8 rounded-t-[3px]"
                        style={{
                          height: listo ? `${Math.max(d.cantidad > 0 ? 3 : 0, (d.cantidad / maxPorDiaSemana) * 100)}%` : 0,
                          background: color,
                          filter: tooltipDiaSemana?.dia === d.dia ? "brightness(1.15)" : undefined,
                          transition: `filter 150ms, height 550ms cubic-bezier(.22,1,.36,1) ${i * 35}ms`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between gap-2">
              {porDiaSemana.map((d) => (
                <span key={d.dia} className="flex-1 text-center text-[10.5px] text-[var(--c-text-faint)]">{d.corto}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Línea de tiempo del período */}
      <div className="rounded-xl border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)] p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Línea de tiempo — {tituloPeriodo}</h3>
        {licenciasFiltradas.length === 0 || meses.length === 0 ? (
          <p className="text-sm text-[var(--c-text-faint)]">Sin licencias aprobadas en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative min-w-max space-y-2 pt-3">
              {hoyEnMeses !== -1 && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-[var(--c-blue)] pointer-events-none z-10"
                  style={{ left: `${((hoyEnMeses + 0.5) / meses.length) * 100}%` }}
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-[var(--c-blue-text)] whitespace-nowrap">Hoy</span>
                </div>
              )}
              <div
                className="grid gap-px text-[10px] text-[var(--c-text-faint)] pl-0"
                style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(28px, 1fr))` }}
              >
                {meses.map((m, i) => (
                  <span key={`${m.anio}-${m.mes}-${i}`} className="text-center">{m.label}</span>
                ))}
              </div>
              <div className="space-y-1.5">
                {licenciasFiltradas.map((l, i) => {
                  const mesInicio = indiceMes(new Date(l.fechaInicio), meses);
                  const mesFin = indiceMes(new Date(l.fechaFin), meses);
                  const color = categoriaColor(l.tipo);
                  return (
                    <div
                      key={l.id}
                      className="grid gap-px h-5"
                      style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(28px, 1fr))` }}
                    >
                      <div
                        className="h-full rounded cursor-default"
                        style={{
                          gridColumnStart: mesInicio + 1,
                          gridColumnEnd: mesFin + 2,
                          background: color,
                          opacity: listo ? 1 : 0,
                          filter: tooltipLicencia?.licencia.id === l.id ? "brightness(1.2)" : undefined,
                          transition: `opacity 400ms ${i * 20}ms, filter 150ms`,
                        }}
                        onPointerEnter={(e) => setTooltipLicencia({ x: e.clientX, y: e.clientY, licencia: l })}
                        onPointerMove={(e) => setTooltipLicencia({ x: e.clientX, y: e.clientY, licencia: l })}
                        onPointerLeave={() => setTooltipLicencia(null)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {tooltipCategoria && (() => {
        const c = porCategoria.find((x) => x.categoria === tooltipCategoria.categoria);
        if (!c) return null;
        return (
          <div
            className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
            style={{ left: tooltipCategoria.x + 14, top: tooltipCategoria.y + 14 }}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CATEGORIA_LICENCIA_CHART_COLOR[c.categoria] }} />
              {c.info.label}
            </div>
            <div>
              <span className="font-bold tabular-nums"><ValorAnimado value={metricaCategoria === "dias" ? c.dias : c.cantidad} /></span>
              <span className="text-[var(--c-text-faint)] ml-1.5">
                {metricaCategoria === "dias" ? (c.dias === 1 ? "día" : "días") + " · " : ""}
                {metricaCategoria === "dias"
                  ? (totalDias > 0 ? Math.round((c.dias / totalDias) * 100) : 0)
                  : (totalLicencias > 0 ? Math.round((c.cantidad / totalLicencias) * 100) : 0)}% del total
              </span>
            </div>
          </div>
        );
      })()}

      {tooltipAnillo && (() => {
        const t = porTipoVista.find((x) => x.tipo === tooltipAnillo.tipo);
        if (!t) return null;
        const total = metricaAnillo === "dias" ? totalDias : totalLicencias;
        const valor = metricaAnillo === "dias" ? t.dias : t.cantidad;
        const unidad = metricaAnillo === "dias" ? (valor === 1 ? "día" : "días") : "";
        return (
          <div
            className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
            style={{ left: tooltipAnillo.x + 14, top: tooltipAnillo.y + 14 }}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.color }} />
              {t.label}
            </div>
            <div>
              <span className="font-bold tabular-nums"><ValorAnimado value={valor} /></span>
              <span className="text-[var(--c-text-faint)] ml-1.5">
                {unidad && `${unidad} · `}<ValorAnimado value={total > 0 ? Math.round((valor / total) * 100) : 0} />% del total
              </span>
            </div>
          </div>
        );
      })()}

      {tooltipDiaSemana && (() => {
        const d = porDiaSemana[tooltipDiaSemana.dia];
        if (!d) return null;
        return (
          <div
            className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
            style={{ left: tooltipDiaSemana.x + 14, top: tooltipDiaSemana.y + 14 }}
          >
            <div className="font-bold mb-1">{d.label}</div>
            <div>
              <span className="font-bold tabular-nums"><ValorAnimado value={d.cantidad} /></span>
              <span className="text-[var(--c-text-faint)] ml-1.5">
                <ValorAnimado value={totalLicencias > 0 ? Math.round((d.cantidad / totalLicencias) * 100) : 0} />% del total
              </span>
            </div>
          </div>
        );
      })()}

      {tooltipLicencia && (
        <div
          className="fixed z-40 pointer-events-none bg-[var(--c-bg)] border border-[var(--c-line)] rounded-lg px-2.5 py-2 text-xs text-[var(--c-text)] shadow-lg shadow-black/40"
          style={{ left: tooltipLicencia.x + 14, top: tooltipLicencia.y + 14 }}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: categoriaColor(tooltipLicencia.licencia.tipo) }} />
            {TIPO_LICENCIA_LABELS[tooltipLicencia.licencia.tipo] ?? tooltipLicencia.licencia.tipo}
          </div>
          <div className="text-[var(--c-text-secondary)]">
            {fmt(tooltipLicencia.licencia.fechaInicio)} → {fmt(tooltipLicencia.licencia.fechaFin)}
          </div>
          <div className="text-[var(--c-text-faint)] mt-0.5">
            {tooltipLicencia.licencia.diasHabiles} {tooltipLicencia.licencia.diasHabiles === 1 ? "día" : "días"}
          </div>
        </div>
      )}

      <InformeImprimible
        agente={agente}
        tituloPeriodo={tituloPeriodo}
        nroDocumento={nroDocumento}
        totalDias={totalDias}
        porCategoria={porCategoria}
        porTipo={porTipo}
        licenciasFiltradas={licenciasFiltradas}
        totalLicencias={totalLicencias}
      />
    </div>
  );
}
