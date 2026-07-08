import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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

  // Supervisores ven solo su sector; admins ven todo
  const filtroSector = esSupervisor && sectorId ? { sectorId } : {};

  const [licencias, sectores, feriados] = await Promise.all([
    prisma.licencia.findMany({
      where: { agente: filtroSector },
      orderBy: { fechaInicio: "desc" },
      include: {
        agente: {
          select: { id: true, nombres: true, apellidos: true, sector: { select: { nombre: true } } },
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
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Licencias y Ausentismo</h2>
        <p className="text-sm text-slate-400 mt-0.5">
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
          },
        }))}
        sectores={sectores}
        canManage={true}
        esSupervisor={esSupervisor}
        esAdmin={esAdmin}
        feriados={feriados}
      />
    </div>
  );
}
