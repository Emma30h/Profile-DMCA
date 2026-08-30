"use client";

import { useMemo, useState } from "react";
import AusentismoCard from "../dashboard/AusentismoCard";
import CantidadLicenciasCard from "../dashboard/CantidadLicenciasCard";
import RankingCausasCard from "../dashboard/RankingCausasCard";
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

type TurnoFiltro = "todos" | (typeof TURNOS_ROTATIVOS)[number];
type SexoFiltro = "todos" | "MASCULINO" | "FEMENINO" | "otros";

function cumpleSexo(sexo: string | null, filtro: SexoFiltro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "otros") return sexo !== "MASCULINO" && sexo !== "FEMENINO";
  return sexo === filtro;
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
  hoy,
  flujoPersonal,
}: {
  licencias: LicenciaAusentismoRow[];
  hoy: string;
  flujoPersonal: FlujoPersonalStats;
}) {
  const hoyDate = useMemo(() => new Date(hoy), [hoy]);
  const anios = useMemo(() => aniosDeLicencias(licencias), [licencias]);

  const [modo, setModo] = useState<ModoPeriodo>("todo");
  const [anio, setAnio] = useState<number | null>(null);
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [turnoFiltro, setTurnoFiltro] = useState<TurnoFiltro>("todos");
  const [sexoFiltro, setSexoFiltro] = useState<SexoFiltro>("todos");
  const anioActivo = anio ?? anios[0] ?? hoyDate.getUTCFullYear();

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

  // El turno se aplica aparte del resto (no en un único array final):
  // "Licencias por turno" queda excluido a propósito del filtro de turno —
  // sus ejes ya SON los turnos, filtrarla por uno puntual la dejaría con un
  // solo eje activo y los otros 5 en cero — pero sí respeta período y sexo.
  const licenciasSexo = useMemo(
    () => licencias.filter((l) => cumpleSexo(l.agente.sexo, sexoFiltro)),
    [licencias, sexoFiltro]
  );
  const licenciasTurnoSexo = useMemo(
    () => (turnoFiltro === "todos" ? licenciasSexo : licenciasSexo.filter((l) => l.agente.turno === turnoFiltro)),
    [licenciasSexo, turnoFiltro]
  );

  const licenciasFiltradas = useMemo(
    () => filtrarPorPeriodo(licenciasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta),
    [licenciasTurnoSexo, modo, anioActivo, rangoDesde, rangoHasta]
  );
  const licenciasPorTurno = useMemo(
    () => filtrarPorPeriodo(licenciasSexo, modo, anioActivo, rangoDesde, rangoHasta),
    [licenciasSexo, modo, anioActivo, rangoDesde, rangoHasta]
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
  const turnoLabel = turnoFiltro === "todos" ? "Todos los turnos" : `Turno ${turnoFiltro}`;
  const sexoLabel = sexoFiltro === "todos" ? "Todos los sexos" : sexoFiltro === "otros" ? "Otros" : sexoFiltro === "MASCULINO" ? "Masculino" : "Femenino";
  const filtroLabel = `${periodoLabel} · ${turnoLabel} · ${sexoLabel}`;

  // No hay NADA cargado en todo el sistema: ni el filtro ni las 6 tarjetas
  // tienen sentido (no hay años entre los que elegir). El estado "sin datos
  // para ESTE período/turno/sexo" lo resuelve cada tarjeta con su propio
  // chequeo interno (ej. "Sin licencias en el período elegido").
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
        <select value={turnoFiltro} onChange={(e) => setTurnoFiltro(e.target.value as TurnoFiltro)} className={selectClass}>
          <option value="todos">Todos los turnos</option>
          {TURNOS_ROTATIVOS.map((t) => (
            <option key={t} value={t}>Turno {t}</option>
          ))}
        </select>
        <select value={sexoFiltro} onChange={(e) => setSexoFiltro(e.target.value as SexoFiltro)} className={selectClass}>
          <option value="todos">Todos</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMENINO">Femenino</option>
          <option value="otros">Otros</option>
        </select>
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

      <RevealOnScroll className="mb-6" minHeight={480}>
        <RankingPersonalCard licencias={licenciasFiltradas} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={480}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <LicenciasPorTurnoCard licencias={licenciasPorTurno} />
          <CausasRadarCard licencias={licenciasFiltradas} />
        </div>
      </RevealOnScroll>

      {/* A diferencia de las 6 de arriba, recibe `licencias` sin filtrar por
          turno/sexo a propósito — ver comentario en AusentismoPorDotacionCard.tsx. */}
      <RevealOnScroll minHeight={380}>
        <AusentismoPorDotacionCard licencias={licencias} desde={desde} hasta={hasta} flujoPersonal={flujoPersonal} />
      </RevealOnScroll>
    </div>
  );
}
