import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDashboardStats } from "../dashboard/stats";
import VistaLicencias from "./VistaLicencias";

const ROLES_PERMITIDOS = ["SUPERADMIN", "ADMIN", "SUPERVISOR"];
const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function LicenciasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: {
      rol: true,
      agente: { select: { sectorId: true } },
    },
  });

  if (!currentUser || !ROLES_PERMITIDOS.includes(currentUser.rol)) {
    redirect("/dashboard");
  }

  const esSupervisor = currentUser.rol === "SUPERVISOR";
  const esAdmin = ROLES_ADMIN.includes(currentUser.rol);
  const sectorId = currentUser.agente?.sectorId ?? null;

  // Supervisores ven solo su sector; admins ven todo. En ambos casos, solo
  // personal activo: si un agente causó baja (p. ej. fallecimiento) o pasó a
  // otra dependencia, su licencia queda registrada en el legajo pero deja de
  // tener sentido operativo en este listado general.
  const filtroSector = { estado: "ACTIVO", ...(esSupervisor && sectorId ? { sectorId } : {}) };

  const [licencias, sectores, feriados, stats] = await Promise.all([
    prisma.licencia.findMany({
      where: { agente: filtroSector },
      orderBy: { fechaInicio: "desc" },
      include: {
        agente: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            sector: { select: { nombre: true } },
            tipoPersonal: true,
          },
        },
      },
    }),
    esSupervisor
      ? Promise.resolve([])
      : prisma.sector.findMany({
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        }),
    esAdmin
      ? prisma.feriado.findMany({ orderBy: { fecha: "asc" } })
      : Promise.resolve([]),
    // Misma fuente que las tarjetas de "Estadísticas generales" (antes en
    // /dashboard) — getDashboardStats() ya está cacheada (Redis, 5 min), así
    // que pedirla también acá es prácticamente gratis, no un query nuevo.
    getDashboardStats(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Licencias y Ausentismo</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
          {esSupervisor ? "Personal de tu sector" : "Todo el personal"}
        </p>
      </div>

      <VistaLicencias
        licencias={licencias.map((l) => ({
          id: l.id,
          tipo: l.tipo,
          estado: l.estado,
          fechaInicio: l.fechaInicio.toISOString(),
          fechaFin: l.fechaFin.toISOString(),
          diasHabiles: l.diasHabiles,
          motivo: l.motivo,
          agente: {
            id: l.agente.id,
            nombres: l.agente.nombres,
            apellidos: l.agente.apellidos,
            sector: l.agente.sector?.nombre ?? null,
            tipoPersonal: l.agente.tipoPersonal,
          },
        }))}
        sectores={sectores}
        canManage={true}
        esSupervisor={esSupervisor}
        esAdmin={esAdmin}
        feriados={feriados}
        ausentismoLicencias={stats.ausentismoLicencias}
        licenciasOrdinarias={stats.licenciasOrdinarias}
        hoy={stats.hoy}
        flujoPersonal={stats.flujoPersonal}
      />
    </div>
  );
}
