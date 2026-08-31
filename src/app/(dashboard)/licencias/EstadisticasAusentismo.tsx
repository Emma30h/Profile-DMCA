"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import AusentismoCard from "../dashboard/AusentismoCard";
import CantidadLicenciasCard from "../dashboard/CantidadLicenciasCard";
import RankingCausasCard from "../dashboard/RankingCausasCard";
import RankingDiagnosticosCard from "../dashboard/RankingDiagnosticosCard";
import EstacionalidadDiagnosticosCard from "../dashboard/EstacionalidadDiagnosticosCard";
import RankingPersonalCard from "../dashboard/RankingPersonalCard";
import LicenciasPorTurnoCard from "../dashboard/LicenciasPorTurnoCard";
import CausasRadarCard from "../dashboard/CausasRadarCard";
import AusentismoPorDotacionCard from "../dashboard/AusentismoPorDotacionCard";
import type { FlujoPersonalStats } from "../dashboard/stats";
import RevealOnScroll from "@/components/RevealOnScroll";
import InformeLicenciasModal from "./InformeLicenciasModal";
import {
  aniosDeLicencias,
  calcularAusentismoMensual,
  calcularPorTurno,
  calcularRankingPersonal,
  filtrarPorPeriodo,
  rangoMesesPeriodo,
  TURNOS_ROTATIVOS,
  type LicenciaAusentismoRow,
  type ModoPeriodo,
} from "@/lib/ausentismo";
import type { TipoPersonal } from "@/types";

type Turno = (typeof TURNOS_ROTATIVOS)[number];
type Sexo = "MASCULINO" | "FEMENINO" | "otros";
type Estado = "ACTIVO" | "BAJA" | "PASE";

// Los 4 filtros de personal (Turno/Sexo/Estado/Tipo de personal) son
// multi-selección: lista vacía = sin filtro (equivalente al "todos" que
// tenían antes como sentinel), lista no vacía = OR entre las opciones
// tildadas. Un usuario típico quiere poder comparar, por ejemplo, "Turno A +
// Turno B" o "Seguridad + Técnico" contra el resto en una sola pasada.
function cumpleTurno(turno: string | null, filtro: Turno[]): boolean {
  return filtro.length === 0 || (turno !== null && filtro.includes(turno as Turno));
}

function cumpleSexo(sexo: string | null, filtro: Sexo[]): boolean {
  if (filtro.length === 0) return true;
  return filtro.some((f) => (f === "otros" ? sexo !== "MASCULINO" && sexo !== "FEMENINO" : sexo === f));
}

function cumpleEstado(estado: string, filtro: Estado[]): boolean {
  return filtro.length === 0 || filtro.includes(estado as Estado);
}

function cumpleTipoPersonal(tipoPersonal: string, filtro: TipoPersonal[]): boolean {
  return filtro.length === 0 || filtro.includes(tipoPersonal as TipoPersonal);
}

const SEXOS: Sexo[] = ["MASCULINO", "FEMENINO", "otros"];
const SEXO_LABEL: Record<Sexo, string> = { MASCULINO: "Masculino", FEMENINO: "Femenino", otros: "Otros" };
const ESTADOS: Estado[] = ["ACTIVO", "BAJA", "PASE"];
const ESTADO_LABEL: Record<Estado, string> = { ACTIVO: "Activo", BAJA: "Baja", PASE: "Pase" };
const TIPO_PERSONAL_LABEL: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};
const TIPOS_PERSONAL: TipoPersonal[] = ["SEGURIDAD", "TECNICO", "CIVIL_BECARIO", "CIVIL_POLICIAL"];

// Desplegable genérico de casillas para los 4 filtros de personal: evita
// cuadruplicar el par botón+popover (abrir/cerrar, click-afuera, "Limpiar")
// que ya se repetía idéntico entre Turno/Sexo/Estado/Tipo de personal.
function FiltroMultiple<T extends string>({
  placeholder,
  opciones,
  etiqueta,
  seleccion,
  onCambiar,
  abierto,
  onAbrir,
  onCerrar,
}: {
  placeholder: string;
  opciones: readonly T[];
  etiqueta: (v: T) => string;
  seleccion: T[];
  onCambiar: (next: T[]) => void;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}) {
  const texto =
    seleccion.length === 0 ? placeholder : seleccion.length === 1 ? etiqueta(seleccion[0]) : `${seleccion.length} seleccionados`;

  function toggle(valor: T) {
    onCambiar(seleccion.includes(valor) ? seleccion.filter((v) => v !== valor) : [...seleccion, valor]);
  }

  return (
    <div className="relative">
      <button type="button" onClick={abierto ? onCerrar : onAbrir} className={`${selectClass} inline-flex items-center gap-1`}>
        {texto}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {abierto && (
        <>
          {/* Capa invisible a pantalla completa: cierra el desplegable en el
              primer click afuera (patrón ya usado en FiltrosPersonal.tsx),
              sin listeners nativos de window. */}
          <div className="fixed inset-0 z-30" onClick={onCerrar} />
          <div
            className="absolute left-0 top-full mt-1 z-40 w-44 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            {opciones.map((o) => (
              <label key={o} className="flex items-center gap-2 rounded px-2 py-1 text-[11px] text-[var(--c-text)] hover:bg-[var(--c-line)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccion.includes(o)}
                  onChange={() => toggle(o)}
                  className="rounded border-[var(--c-line-strong)] bg-[var(--c-bg-elev)] text-[var(--c-blue)] focus:ring-[var(--c-blue)]"
                />
                {etiqueta(o)}
              </label>
            ))}
            {seleccion.length > 0 && (
              <button
                type="button"
                onClick={() => onCambiar([])}
                className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-[var(--c-blue-text)] hover:bg-[var(--c-line)] hover:text-[var(--c-blue-soft)]"
              >
                Limpiar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Rangos relativos rápidos para el selector de período — sumados a los ya
// existentes "todo"/año puntual/rango a mano. Reutilizan el modo "rango" tal
// cual (filtrarPorPeriodo/rangoMesesPeriodo no necesitan saber que el rango
// vino de un atajo en vez de los inputs de fecha).
type RangoRelativo = "30d" | "90d" | "365d";
const RANGOS_RELATIVOS: { valor: RangoRelativo; dias: number; label: string }[] = [
  { valor: "30d", dias: 30, label: "30D" },
  { valor: "90d", dias: 90, label: "90D" },
  { valor: "365d", dias: 365, label: "365D" },
];
function fechaISO(f: Date): string {
  return f.toISOString().slice(0, 10);
}

// Anclar los filtros los persiste en localStorage para que sobrevivan un
// cambio de sección (esta pantalla se desmonta al navegar a otra parte de la
// app, perdiendo todo su estado en memoria). Igual que el anclaje de agente
// (useAgenteAnclado.ts): es siempre una acción explícita del usuario, nunca
// automática — entrar a esta pestaña con filtros puestos no los ancla solo.
const FILTROS_ANCLADOS_KEY = "licencias-filtros-anclados";

interface FiltrosAnclados {
  modo: ModoPeriodo;
  anio: number | null;
  rangoDesde: string;
  rangoHasta: string;
  turnoFiltro: Turno[];
  sexoFiltro: Sexo[];
  estadoFiltro: Estado[];
  tiposPersonalFiltro: TipoPersonal[];
}

const selectClass =
  "text-[11px] font-semibold text-[var(--c-text-muted)] bg-[var(--c-bg-elev)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]";

// Los 6 gráficos de ausentismo, antes en /dashboard — se mudaron a la
// pestaña "Estadísticas generales" de esta sección porque temáticamente
// pertenecen acá (gestión de licencias), no junto a los KPIs generales de
// RRHH del dashboard. El filtro de período/turno/sexo vivía duplicado (con
// lógica casi idéntica) en 5 de las 6 tarjetas — ahora vive acá una sola
// vez y se aplica a todas.
export default function EstadisticasAusentismo({
  licencias,
  licenciasOrdinarias,
  hoy,
  flujoPersonal,
}: {
  licencias: LicenciaAusentismoRow[];
  // Licencia Ordinaria (vacaciones) — aparte de `licencias` porque el resto
  // de los 6 gráficos de acá abajo debe seguir "sin licencia ordinaria" tal
  // cual. El único que la usa es RankingPersonalCard, con su propio checkbox
  // desactivado por defecto (ver ese componente).
  licenciasOrdinarias: LicenciaAusentismoRow[];
  hoy: string;
  flujoPersonal: FlujoPersonalStats;
}) {
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);
  const anios = useMemo(() => aniosDeLicencias(licencias), [licencias]);

  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [anio, setAnio] = useState<number | null>(null);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState<Turno[]>([]);
  const [sexoFiltro, setSexoFiltro] = useState<Sexo[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState<Estado[]>([]);
  const [tiposPersonalFiltro, setTiposPersonalFiltro] = useState<TipoPersonal[]>([]);
  const [filtroAbierto, setFiltroAbierto] = useState<null | "turno" | "sexo" | "estado" | "tipoPersonal">(null);
  const anioActivo = anio ?? anios[0] ?? hoyDate.getUTCFullYear();

  // Arranca en false (no lee localStorage en el inicializador): el servidor
  // siempre renderiza sin filtros anclados, así que restaurarlos recién en
  // un efecto evita un mismatch de hidratación (mismo criterio que
  // useAgenteAnclado.ts).
  const [anclado, setAnclado] = useState(false);

  useEffect(() => {
    // requestAnimationFrame en vez de setState directo: llamarlos síncrono
    // acá dispara el lint set-state-in-effect (cascading renders) — mismo
    // motivo que en useCountUp.ts.
    const raf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(FILTROS_ANCLADOS_KEY);
        if (!raw) return;
        const guardado: FiltrosAnclados = JSON.parse(raw);
        setModo(guardado.modo);
        setAnio(guardado.anio);
        setRangoDesde(guardado.rangoDesde);
        setRangoHasta(guardado.rangoHasta);
        setTurnoFiltro(guardado.turnoFiltro);
        setSexoFiltro(guardado.sexoFiltro);
        setEstadoFiltro(guardado.estadoFiltro);
        setTiposPersonalFiltro(guardado.tiposPersonalFiltro);
        setAnclado(true);
      } catch {
        // localStorage corrupto o inaccesible: se ignora, arranca sin anclar.
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mientras está anclado, cualquier ajuste posterior a los filtros
  // (cambiar de período, tildar otro turno, etc.) se re-guarda solo — anclar
  // no "congela" la selección actual, mantiene sincronizado lo que haya
  // puesto el usuario en cada momento.
  useEffect(() => {
    if (!anclado) return;
    const datos: FiltrosAnclados = { modo, anio, rangoDesde, rangoHasta, turnoFiltro, sexoFiltro, estadoFiltro, tiposPersonalFiltro };
    localStorage.setItem(FILTROS_ANCLADOS_KEY, JSON.stringify(datos));
  }, [anclado, modo, anio, rangoDesde, rangoHasta, turnoFiltro, sexoFiltro, estadoFiltro, tiposPersonalFiltro]);

  function alternarAnclaje() {
    if (anclado) {
      localStorage.removeItem(FILTROS_ANCLADOS_KEY);
      setAnclado(false);
    } else {
      setAnclado(true);
    }
  }

  function elegirPeriodo(valor: string) {
    if (valor === "todo") {
      setModo("todo");
      return;
    }
    if (valor === "rango") {
      setModo("rango");
      // Precarga el rango con el historial completo, para no arrancar con
      // los dos campos vacíos (y los 6 gráficos vacíos) hasta que el
      // usuario toque algo.
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

  // Atajos de rango relativo ("últimos 30/90/365 días"): reutilizan el modo
  // "rango" tal cual (filtrarPorPeriodo/rangoMesesPeriodo no necesitan saber
  // que el rango vino de un atajo en vez de los inputs de fecha a mano).
  function elegirRangoRelativo(dias: number) {
    setModo("rango");
    setRangoHasta(fechaISO(hoyDate));
    setRangoDesde(fechaISO(new Date(hoyDate.getTime() - (dias - 1) * 86_400_000)));
  }
  // Un atajo se muestra "activo" si el rango actual coincide exactamente con
  // lo que ese atajo calcularía ahora — evita un estado separado que podría
  // desincronizarse si el usuario después edita el rango a mano.
  function esRangoRelativoActivo(dias: number): boolean {
    return (
      modo === "rango" &&
      rangoHasta === fechaISO(hoyDate) &&
      rangoDesde === fechaISO(new Date(hoyDate.getTime() - (dias - 1) * 86_400_000))
    );
  }

  // Sexo/Estado/Tipo de personal se aplican juntos, antes que el turno (no
  // en un único array final): "Licencias por turno" queda excluido a
  // propósito del filtro de turno — sus ejes ya SON los turnos, filtrarla
  // por uno puntual la dejaría con un solo eje activo y los otros 5 en
  // cero — pero sí respeta período, sexo, estado y tipo de personal.
  const licenciasBase = useMemo(
    () =>
      licencias.filter(
        (l) =>
          cumpleSexo(l.agente.sexo, sexoFiltro) &&
          cumpleEstado(l.agente.estado, estadoFiltro) &&
          cumpleTipoPersonal(l.agente.tipoPersonal, tiposPersonalFiltro)
      ),
    [licencias, sexoFiltro, estadoFiltro, tiposPersonalFiltro]
  );
  const licenciasTurnoSexo = useMemo(
    () => licenciasBase.filter((l) => cumpleTurno(l.agente.turno, turnoFiltro)),
    [licenciasBase, turnoFiltro]
  );

  const licenciasFiltradas = useMemo(
    () => filtrarPorPeriodo(licenciasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta),
    [licenciasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta]
  );
  const licenciasPorTurno = useMemo(
    () => filtrarPorPeriodo(licenciasBase, modo, anioActivo, rangoDesde, rangoHasta),
    [licenciasBase, modo, anioActivo, rangoDesde, rangoHasta]
  );

  // Misma cadena de filtros (turno/sexo/estado/tipo de personal + período)
  // que licenciasFiltradas, aplicada aparte sobre licenciasOrdinarias — así
  // el checkbox de Licencia Ordinaria en RankingPersonalCard respeta
  // exactamente el mismo período/turno/sexo/estado/tipo que el resto de la
  // pantalla en vez de traer siempre TODO el historial de vacaciones.
  const licenciasOrdinariasBase = useMemo(
    () =>
      licenciasOrdinarias.filter(
        (l) =>
          cumpleSexo(l.agente.sexo, sexoFiltro) &&
          cumpleEstado(l.agente.estado, estadoFiltro) &&
          cumpleTipoPersonal(l.agente.tipoPersonal, tiposPersonalFiltro)
      ),
    [licenciasOrdinarias, sexoFiltro, estadoFiltro, tiposPersonalFiltro]
  );
  const licenciasOrdinariasTurnoSexo = useMemo(
    () => licenciasOrdinariasBase.filter((l) => cumpleTurno(l.agente.turno, turnoFiltro)),
    [licenciasOrdinariasBase, turnoFiltro]
  );
  const licenciasOrdinariasFiltradas = useMemo(
    () => filtrarPorPeriodo(licenciasOrdinariasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta),
    [licenciasOrdinariasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta]
  );

  const { desde, hasta } = useMemo(
    () => rangoMesesPeriodo(modo, anioActivo, rangoDesde, rangoHasta, licenciasTurnoSexo, hoyDate),
    [modo, anioActivo, rangoDesde, rangoHasta, licenciasTurnoSexo, hoyDate]
  );

  // Datos para el informe general (InformeLicenciasModal): se recalculan
  // acá aparte de adentro de cada tarjeta — son funciones puras y baratas
  // sobre unos cientos de filas, no vale la pena replumbear las props de
  // cada tarjeta solo para compartir un único cálculo.
  const ausentismoReporte = useMemo(
    () => calcularAusentismoMensual(desde, hasta, licenciasTurnoSexo),
    [desde, hasta, licenciasTurnoSexo]
  );
  const rankingPersonalReporte = useMemo(
    () => calcularRankingPersonal(licenciasFiltradas, "licencias"),
    [licenciasFiltradas]
  );
  const porTurnoReporte = useMemo(() => calcularPorTurno(licenciasPorTurno), [licenciasPorTurno]);

  const periodoLabel =
    modo === "todo" ? "Todo el historial" : modo === "anio" ? String(anioActivo) : rangoDesde && rangoHasta ? `${rangoDesde} – ${rangoHasta}` : "Período sin definir";
  const turnoLabel =
    turnoFiltro.length === 0 ? "Todos los turnos" : turnoFiltro.length === 1 ? `Turno ${turnoFiltro[0]}` : `${turnoFiltro.length} turnos`;
  const sexoLabel =
    sexoFiltro.length === 0 ? "Todos los sexos" : sexoFiltro.length === 1 ? SEXO_LABEL[sexoFiltro[0]] : `${sexoFiltro.length} sexos`;
  const estadoLabel =
    estadoFiltro.length === 0 ? "Todo el personal" : estadoFiltro.length === 1 ? ESTADO_LABEL[estadoFiltro[0]] : `${estadoFiltro.length} estados`;
  const tipoPersonalLabel =
    tiposPersonalFiltro.length === 0
      ? "Todos los tipos"
      : tiposPersonalFiltro.length === 1
        ? TIPO_PERSONAL_LABEL[tiposPersonalFiltro[0]]
        : `${tiposPersonalFiltro.length} tipos`;
  const filtroLabel = `${periodoLabel} · ${turnoLabel} · ${sexoLabel} · ${estadoLabel} · ${tipoPersonalLabel}`;

  // No hay NADA cargado en todo el sistema: ni el filtro ni las 6 tarjetas
  // tienen sentido (no hay años entre los que elegir). El estado "sin datos
  // para ESTE período/turno/sexo/estado/tipo de personal" lo resuelve cada
  // tarjeta con su propio chequeo interno (ej. "Sin licencias en el período
  // elegido").
  if (licencias.length === 0) {
    return (
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
        <p className="text-[12.5px] text-[var(--c-text-faint)]">Todavía no hay licencias aprobadas cargadas.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-3.5 mb-6 flex items-center gap-2.5 flex-wrap">
        <div className="relative">
          <select value={modo === "anio" ? String(anioActivo) : modo} onChange={(e) => elegirPeriodo(e.target.value)} className={selectClass}>
            <option value="todo">Todo el historial</option>
            {anios.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
            <option value="rango">Seleccionar período…</option>
          </select>
          {modo === "rango" && (
            <div className="absolute left-0 top-full mt-1 z-30 flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev-2)] p-1.5 shadow-lg shadow-black/40 whitespace-nowrap">
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
          {RANGOS_RELATIVOS.map((r) => (
            <button
              key={r.valor}
              type="button"
              onClick={() => elegirRangoRelativo(r.dias)}
              aria-pressed={esRangoRelativoActivo(r.dias)}
              className={`text-[11px] font-semibold px-2.5 py-1 transition-colors ${
                esRangoRelativoActivo(r.dias)
                  ? "bg-[var(--c-blue)] text-white"
                  : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <FiltroMultiple
          placeholder="Todos los turnos"
          opciones={TURNOS_ROTATIVOS}
          etiqueta={(t) => `Turno ${t}`}
          seleccion={turnoFiltro}
          onCambiar={setTurnoFiltro}
          abierto={filtroAbierto === "turno"}
          onAbrir={() => setFiltroAbierto("turno")}
          onCerrar={() => setFiltroAbierto(null)}
        />
        <FiltroMultiple
          placeholder="Todos los sexos"
          opciones={SEXOS}
          etiqueta={(s) => SEXO_LABEL[s]}
          seleccion={sexoFiltro}
          onCambiar={setSexoFiltro}
          abierto={filtroAbierto === "sexo"}
          onAbrir={() => setFiltroAbierto("sexo")}
          onCerrar={() => setFiltroAbierto(null)}
        />
        <FiltroMultiple
          placeholder="Todo el personal"
          opciones={ESTADOS}
          etiqueta={(e) => ESTADO_LABEL[e]}
          seleccion={estadoFiltro}
          onCambiar={setEstadoFiltro}
          abierto={filtroAbierto === "estado"}
          onAbrir={() => setFiltroAbierto("estado")}
          onCerrar={() => setFiltroAbierto(null)}
        />
        <FiltroMultiple
          placeholder="Todos los tipos"
          opciones={TIPOS_PERSONAL}
          etiqueta={(t) => TIPO_PERSONAL_LABEL[t]}
          seleccion={tiposPersonalFiltro}
          onCambiar={setTiposPersonalFiltro}
          abierto={filtroAbierto === "tipoPersonal"}
          onAbrir={() => setFiltroAbierto("tipoPersonal")}
          onCerrar={() => setFiltroAbierto(null)}
        />
        <button
          type="button"
          onClick={alternarAnclaje}
          aria-pressed={anclado}
          title={anclado ? "Dejar de anclar los filtros" : "Anclar los filtros para no perderlos al cambiar de sección"}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            anclado
              ? "border-[var(--c-blue)] bg-[var(--c-blue)] text-white"
              : "border-[var(--c-line)] bg-[var(--c-bg-elev)] text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:border-[var(--c-line-strong)]"
          }`}
        >
          {anclado ? <Lock className="h-3 w-3" strokeWidth={2.25} /> : <Unlock className="h-3 w-3" strokeWidth={2.25} />}
          {anclado ? "Anclado" : "Anclar"}
        </button>
        <div className="ml-auto">
          <InformeLicenciasModal
            ausentismo={ausentismoReporte}
            rankingPersonal={rankingPersonalReporte}
            porTurno={porTurnoReporte}
            filtroLabel={filtroLabel}
          />
        </div>
      </div>

      <RevealOnScroll className="mb-6" minHeight={420}>
        <AusentismoCard licencias={licenciasTurnoSexo} desde={desde} hasta={hasta} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={360}>
        <CantidadLicenciasCard licencias={licenciasFiltradas} hoy={hoy} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={380}>
        <RankingCausasCard licencias={licenciasFiltradas} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={380}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <RankingDiagnosticosCard licencias={licenciasFiltradas} />
          <EstacionalidadDiagnosticosCard licencias={licenciasFiltradas} desde={desde} hasta={hasta} />
        </div>
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={480}>
        <RankingPersonalCard licencias={licenciasFiltradas} licenciasOrdinarias={licenciasOrdinariasFiltradas} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={480}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <LicenciasPorTurnoCard licencias={licenciasPorTurno} />
          <CausasRadarCard licencias={licenciasFiltradas} />
        </div>
      </RevealOnScroll>

      {/* A diferencia de las 6 de arriba, recibe `licencias` sin filtrar por
          turno/sexo/estado/tipo de personal a propósito — ver comentario en
          AusentismoPorDotacionCard.tsx. */}
      <RevealOnScroll minHeight={380}>
        <AusentismoPorDotacionCard licencias={licencias} desde={desde} hasta={hasta} flujoPersonal={flujoPersonal} />
      </RevealOnScroll>
    </div>
  );
}
