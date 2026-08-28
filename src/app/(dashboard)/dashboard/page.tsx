import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "./stats";
import { SexoRingCard, PadresMadresRingCard } from "./RingCompareCards";
import DonutTipoPersonal from "./DonutTipoPersonal";
import TurnoDependenciaCard from "./TurnoDependenciaCard";
import HijosACargoCard from "./HijosACargoCard";
import AlertsPanel from "./AlertsPanel";
import FlujoPersonalCard from "./FlujoPersonalCard";
import NovedadesDrawer from "./NovedadesDrawer";
import EventosResumenMobile from "./EventosResumenMobile";
import KpiTile from "./KpiTile";
import RevealOnScroll from "@/components/RevealOnScroll";
import { buildQueryString } from "../personal/queryString";

// Fuerza SSR en cada request: esta página muestra contenido atado al día de
// hoy (turno, efemérides, cumpleaños) — no debe quedar servida desde ningún
// caché de ruta entre requests, ni siquiera por unos minutos.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (currentUser?.rol === "READONLY") redirect("/perfil");
  const esOperador = currentUser?.rol === "OPERADOR";

  const stats = await getDashboardStats();

  return (
    <div>
      <NovedadesDrawer novedades={stats.novedades} tno={stats.tno} cursoAscenso={stats.cursoAscenso} />

      <EventosResumenMobile />

      {/* Indicadores de gestión (pases, bajas, legajos por validar,
          licencias): son información administrativa/RRHH, no algo que un
          Operador necesite para su tarea — se ocultan para ese rol, igual
          que el resto del legajo sensible. */}
      {!esOperador && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiTile
            label="En pase"
            value={stats.kpi.enPase}
            sub="a otra dependencia"
            icon="⇄"
            badgeClass="bg-[var(--c-blue)]/10 text-[var(--c-blue-soft)]"
            href={stats.kpi.enPase > 0 ? "/personal?estado=PASE" : undefined}
            delayMs={0}
          />
          <KpiTile
            label="En baja"
            value={stats.kpi.enBaja}
            sub="fuera de servicio"
            icon="−"
            badgeClass="bg-[var(--c-bg-elev-2)] text-[var(--c-text-faint)]"
            href={stats.kpi.enBaja > 0 ? "/personal?estado=BAJA" : undefined}
            delayMs={90}
          />
          <KpiTile
            label="Legajos pendientes"
            value={stats.kpi.legajosPendientes}
            sub={stats.kpi.legajosPendientes === 0 ? "al día — nada por validar" : "esperando validación"}
            subClass={stats.kpi.legajosPendientes === 0 ? "text-[var(--c-green)]" : undefined}
            icon="✓"
            badgeClass="bg-[var(--c-green)]/10 text-[var(--c-green)]"
            href={stats.kpi.legajosPendientes > 0 ? "/personal?estado=PENDIENTE" : undefined}
            delayMs={180}
          />
          <KpiTile
            label="Licencias activas hoy"
            value={stats.kpi.licenciasActivasHoy}
            sub={`+${stats.kpi.licenciasProximas} próximas a iniciar`}
            icon="◐"
            badgeClass="bg-[var(--c-amber)]/10 text-[var(--c-amber)]"
            href={
              stats.kpi.licenciasActivasHoyIds.length > 0
                ? `/personal?${buildQueryString({ ids: stats.kpi.licenciasActivasHoyIds.join(",") })}`
                : undefined
            }
            delayMs={270}
          />
        </div>
      )}

      <RevealOnScroll minHeight={360}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
          <DonutTipoPersonal data={stats.tipoPersonal} total={stats.totalActivos} />
          <TurnoDependenciaCard
            turno={stats.turno}
            dependencia={stats.dependencia}
            origenInstitucional={stats.origenInstitucional}
            totalActivos={stats.totalActivos}
            delayMs={80}
          />
        </div>
      </RevealOnScroll>

      {/* Mismo criterio que la fila de indicadores: licencias por vencer,
          licencia de conducir y chaleco son datos que un Operador no
          necesita y que además ya están restringidos en el propio legajo. */}
      {!esOperador && (
        <div className="mb-6">
          <AlertsPanel alertas={stats.alertas} />
        </div>
      )}

      <RevealOnScroll minHeight={220}>
        <SexoRingCard sexo={stats.sexo} />
      </RevealOnScroll>

      <RevealOnScroll minHeight={320}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
          <HijosACargoCard hijos={stats.hijos} delayMs={300} />
          <PadresMadresRingCard padresMadres={stats.padresMadres} />
        </div>
      </RevealOnScroll>

      <RevealOnScroll minHeight={280}>
        <div>
          <FlujoPersonalCard flujo={stats.flujoPersonal} delayMs={450} />
        </div>
      </RevealOnScroll>
    </div>
  );
}
