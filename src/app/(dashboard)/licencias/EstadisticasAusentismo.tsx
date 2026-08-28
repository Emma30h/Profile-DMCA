"use client";

import AusentismoCard from "../dashboard/AusentismoCard";
import CantidadLicenciasCard from "../dashboard/CantidadLicenciasCard";
import RankingCausasCard from "../dashboard/RankingCausasCard";
import RankingPersonalCard from "../dashboard/RankingPersonalCard";
import LicenciasPorTurnoCard from "../dashboard/LicenciasPorTurnoCard";
import CausasRadarCard from "../dashboard/CausasRadarCard";
import RevealOnScroll from "@/components/RevealOnScroll";
import type { LicenciaAusentismoRow } from "@/lib/ausentismo";

// Los 6 gráficos de ausentismo, antes en /dashboard — se mudaron a la
// pestaña "Estadísticas generales" de esta sección porque temáticamente
// pertenecen acá (gestión de licencias), no junto a los KPIs generales de
// RRHH del dashboard.
export default function EstadisticasAusentismo({ licencias, hoy }: { licencias: LicenciaAusentismoRow[]; hoy: string }) {
  return (
    <div>
      <RevealOnScroll className="mb-6" minHeight={420}>
        <AusentismoCard licencias={licencias} hoy={hoy} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={360}>
        <CantidadLicenciasCard licencias={licencias} hoy={hoy} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={380}>
        <RankingCausasCard licencias={licencias} hoy={hoy} />
      </RevealOnScroll>

      <RevealOnScroll className="mb-6" minHeight={480}>
        <RankingPersonalCard licencias={licencias} hoy={hoy} />
      </RevealOnScroll>

      <RevealOnScroll minHeight={480}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <LicenciasPorTurnoCard licencias={licencias} hoy={hoy} />
          <CausasRadarCard licencias={licencias} hoy={hoy} />
        </div>
      </RevealOnScroll>
    </div>
  );
}
