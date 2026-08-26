import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "./stats";
import RingCompare from "./RingCompare";
import DonutTipoPersonal from "./DonutTipoPersonal";
import TurnoDependenciaCard from "./TurnoDependenciaCard";
import HijosACargoCard from "./HijosACargoCard";
import AlertsPanel from "./AlertsPanel";
import FlujoPersonalCard from "./FlujoPersonalCard";
import NovedadesDrawer from "./NovedadesDrawer";
import EventosResumenMobile from "./EventosResumenMobile";
import KpiTile from "./KpiTile";
import { buildQueryString } from "../personal/queryString";

// Fuerza SSR en cada request: esta página muestra contenido atado al día de
// hoy (turno, efemérides, cumpleaños) — no debe quedar servida desde ningún
// caché de ruta entre requests, ni siquiera por unos minutos.
export const dynamic = "force-dynamic";

const MASC_COLOR = "#3987e5";
const FEM_COLOR = "#d55181";
const OTROS_COLOR = "#7c8aa8";

const SEXO_LABEL: Record<string, string> = {
  NO_BINARIO: "No binario",
  PREFIERO_NO_DECIR: "Prefiero no decir",
  OTRO: "Otro",
};

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
        <DonutTipoPersonal data={stats.tipoPersonal} total={stats.totalActivos} />
        <TurnoDependenciaCard
          turno={stats.turno}
          dependencia={stats.dependencia}
          origenInstitucional={stats.origenInstitucional}
          totalActivos={stats.totalActivos}
        />
      </div>

      {/* Mismo criterio que la fila de indicadores: licencias por vencer,
          licencia de conducir y chaleco son datos que un Operador no
          necesita y que además ya están restringidos en el propio legajo. */}
      {!esOperador && (
        <div className="mb-6">
          <AlertsPanel alertas={stats.alertas} />
        </div>
      )}

      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 mb-4">
        <h3 className="text-sm font-semibold text-[var(--c-text)] mb-1">Activos por sexo</h3>
        <RingCompare
          iconSize={78}
          left={{
            value: stats.sexo.masculino.count,
            label: "Masculino",
            pct: stats.sexo.masculino.pct,
            color: MASC_COLOR,
            icon: <IconoMarte />,
            href: "/personal?estado=ACTIVO&sexo=MASCULINO",
          }}
          right={{
            value: stats.sexo.femenino.count,
            label: "Femenino",
            pct: stats.sexo.femenino.pct,
            color: FEM_COLOR,
            icon: <IconoVenus />,
            href: "/personal?estado=ACTIVO&sexo=FEMENINO",
          }}
        />
        <div className="flex items-center justify-center gap-2.5 flex-wrap mt-1">
          {stats.sexo.otros.length > 0 ? (
            stats.sexo.otros.map((o) => (
              <span
                key={o.label}
                className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: OTROS_COLOR }} />
                {SEXO_LABEL[o.label] ?? o.label}
                <b className="text-[var(--c-text)] font-bold">{o.count}</b>
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[var(--c-text-faint)] text-center">
              Sin registros en No binario / Otro / Prefiero no decir entre el personal activo.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
        <HijosACargoCard hijos={stats.hijos} />

        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-semibold text-[var(--c-text)]">Padres y madres</h3>
            <span className="text-[11px] text-[var(--c-text-faint)] tabular-nums">
              {stats.padresMadres.totalConHijos} con hijos a cargo
            </span>
          </div>
          <RingCompare
            left={{
              value: stats.padresMadres.padres.count,
              label: "Padres",
              pct: stats.padresMadres.padres.pct,
              color: MASC_COLOR,
              icon: <IconoPersona />,
              href: stats.padresMadres.padresIds.length > 0
                ? `/personal?${buildQueryString({ ids: stats.padresMadres.padresIds.join(",") })}`
                : "/personal",
            }}
            right={{
              value: stats.padresMadres.madres.count,
              label: "Madres",
              pct: stats.padresMadres.madres.pct,
              color: FEM_COLOR,
              icon: <IconoPersona />,
              href: stats.padresMadres.madresIds.length > 0
                ? `/personal?${buildQueryString({ ids: stats.padresMadres.madresIds.join(",") })}`
                : "/personal",
            }}
          />
        </div>
      </div>

      <div>
        <FlujoPersonalCard flujo={stats.flujoPersonal} />
      </div>
    </div>
  );
}


function IconoMarte() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="8" cy="12" r="5" />
      <line x1="11.7" y1="8.3" x2="17" y2="3" />
      <polyline points="11.5 3 17 3 17 8.5" />
    </svg>
  );
}

function IconoPersona() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
    </svg>
  );
}

function IconoVenus() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="10" cy="7" r="5" />
      <line x1="10" y1="12" x2="10" y2="17.5" />
      <line x1="6.5" y1="14.7" x2="13.5" y2="14.7" />
    </svg>
  );
}
