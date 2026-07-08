import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getOrSet, CACHE_TTL } from "@/lib/redis";
import type { TipoPersonal } from "@/types";
import { TIPOS_PERSONAL } from "@/types";

interface PersonalStats {
  totalActivos: number;
  porTipo: Record<TipoPersonal, number>;
  enBaja: number;
  suspendidos: number;
}

async function getPersonalStats(): Promise<PersonalStats> {
  return getOrSet("agentes:stats:all", CACHE_TTL.OPERATIVO, async () => {
    const [totalActivos, porTipo, enBaja, suspendidos] = await Promise.all([
      prisma.agente.count({ where: { estado: "ACTIVO" } }),
      prisma.agente.groupBy({
        by: ["tipoPersonal"],
        where: { estado: "ACTIVO" },
        _count: { _all: true },
      }),
      prisma.agente.count({ where: { estado: "BAJA" } }),
      prisma.agente.count({ where: { estado: "SUSPENDIDO" } }),
    ]);

    const porTipoMap = Object.fromEntries(
      TIPOS_PERSONAL.map((t) => [t, 0])
    ) as Record<TipoPersonal, number>;

    for (const entry of porTipo) {
      (porTipoMap as Record<string, number>)[String(entry.tipoPersonal)] = entry._count._all;
    }

    return { totalActivos, porTipo: porTipoMap, enBaja, suspendidos };
  });
}

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

const TIPO_COLORS: Record<TipoPersonal, string> = {
  SEGURIDAD: "bg-blue-500/10 text-blue-300 border-blue-500/25",
  TECNICO: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  CIVIL_BECARIO: "bg-green-500/10 text-green-400 border-green-500/25",
  CIVIL_POLICIAL: "bg-orange-500/10 text-orange-400 border-orange-500/25",
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

  const stats = await getPersonalStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Resumen del Personal</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Dirección Monitoreo Cordobeses en Alerta
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Personal Activo" value={stats.totalActivos} color="bg-blue-600" icon="👥" />
        <StatCard title="En Baja" value={stats.enBaja} color="bg-slate-600" icon="📁" />
        <StatCard title="Suspendidos" value={stats.suspendidos} color="bg-red-600" icon="⛔" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Activos por tipo de personal
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.entries(stats.porTipo) as [TipoPersonal, number][]).map(([tipo, cantidad]) => (
            <div key={tipo} className={`rounded-xl border px-4 py-4 ${TIPO_COLORS[tipo]}`}>
              <p className="text-2xl font-bold">{cantidad}</p>
              <p className="text-xs font-medium mt-1">{TIPO_LABELS[tipo]}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Acceso rápido
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickLink href="/personal" icon="👥" label="Ver todo el personal" />
          <QuickLink href="/asistencia" icon="✅" label="Carga de asistencia" />
          <QuickLink href="/licencias" icon="📋" label="Licencias pendientes" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, icon }: { title: string; value: number; color: string; icon: string }) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 flex items-center gap-4">
      <div className={`${color} rounded-xl p-3 text-white text-xl`}>{icon}</div>
      <div>
        <p className="text-3xl font-bold text-slate-100">{value}</p>
        <p className="text-sm text-slate-400 mt-0.5">{title}</p>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href} className="bg-slate-900 rounded-xl border border-slate-700 px-4 py-3 flex items-center gap-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-700 transition-colors">
      <span className="text-base">{icon}</span>
      {label}
    </a>
  );
}
