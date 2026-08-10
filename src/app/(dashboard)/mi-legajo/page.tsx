import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { TipoPersonal, EstadoAgente } from "@/types";
import LegajoTabs from "../personal/[id]/LegajoTabs";
import SolicitarEdicionBtn from "./SolicitarEdicionBtn";
import AgenteAvatar from "@/components/AgenteAvatar";
import VincularPorCuilForm from "./VincularPorCuilForm";
import CargarMisDatosBtn from "./CargarMisDatosBtn";

const MAX_INTENTOS_CUIL = 3;

const TIPO_BADGE: Record<TipoPersonal, string> = {
  SEGURIDAD: "bg-blue-500/15 text-blue-300",
  TECNICO: "bg-purple-500/15 text-purple-400",
  CIVIL_BECARIO: "bg-green-500/15 text-green-400",
  CIVIL_POLICIAL: "bg-orange-500/15 text-orange-400",
};

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

const ESTADO_BADGE: Record<EstadoAgente, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  ACTIVO: "bg-green-500/15 text-green-400",
  BAJA: "bg-slate-800 text-slate-400",
  PASE: "bg-blue-500/15 text-blue-300",
};

const ESTADO_LABELS: Record<EstadoAgente, string> = {
  PENDIENTE: "Pendiente",
  ACTIVO: "Activo",
  BAJA: "Baja",
  PASE: "Pase",
};

export default async function MiLegajoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: {
      agente: {
        include: {
          rango: true,
          sector: true,
          historialRangos: {
            include: { rango: true },
            orderBy: { fechaDesde: "desc" },
          },
        },
      },
    },
  });

  const esAdmin = usuario?.rol === "SUPERADMIN" || usuario?.rol === "ADMIN";

  // Verificar permiso temporal de edición para no-admins
  const solicitudActiva = !esAdmin
    ? await prisma.solicitudEdicion.findFirst({
        where: {
          usuarioId: usuario!.id,
          OR: [
            { estado: "PENDIENTE" },
            { estado: "APROBADA", permisoHasta: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const tienePermisoActivo =
    solicitudActiva?.estado === "APROBADA" &&
    solicitudActiva.permisoHasta != null &&
    solicitudActiva.permisoHasta > new Date();

  const tienePendiente = solicitudActiva?.estado === "PENDIENTE";

  const legajoPendiente = usuario?.agente?.estado === "PENDIENTE";
  const legajoBloqueado = usuario?.agente?.estado === "BAJA" || usuario?.agente?.estado === "PASE";
  const canEdit = esAdmin || (!legajoBloqueado && (tienePermisoActivo || legajoPendiente));

  // Si el usuario no tiene agente vinculado, primero ofrecer vincularse con
  // un legajo ya cargado (por CUIL) antes de mandarlo a cargar todo de cero.
  if (!usuario?.agente) {
    const solicitudPendiente = await prisma.solicitudVinculacion.findFirst({
      where: { usuarioId: usuario!.id, estado: "PENDIENTE" },
    });

    if (solicitudPendiente) {
      return (
        <div className="space-y-5">
          <h2 className="text-xl font-semibold text-slate-100">Mi Legajo</h2>
          <div className="bg-slate-900 rounded-xl border border-slate-700 px-8 py-16 text-center space-y-4">
            <p className="text-5xl"><span className="hourglass-flip">⏳</span></p>
            <p className="text-slate-200 font-semibold text-lg">Tu solicitud de vinculación está pendiente</p>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Un administrador va a revisar y confirmar tu vinculación al legajo antes de darte acceso.
              Te avisamos apenas se resuelva.
            </p>
          </div>
        </div>
      );
    }

    const intentosRestantes = Math.max(0, MAX_INTENTOS_CUIL - (usuario?.intentosCuil ?? 0));
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold text-slate-100">Mi Legajo</h2>
        <div className="bg-slate-900 rounded-xl border border-slate-700 px-8 py-16 text-center space-y-4">
          <p className="text-5xl">📋</p>
          <p className="text-slate-200 font-semibold text-lg">Tu cuenta no tiene un legajo asociado</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Si tu legajo ya fue cargado antes (por ejemplo, en el formulario de Google),
            ingresá tu CUIL para vincularlo a tu cuenta.
          </p>
          <VincularPorCuilForm intentosRestantesInicial={intentosRestantes} />
          <div className="pt-4 border-t border-slate-800 max-w-sm mx-auto space-y-3">
            <p className="text-sm text-slate-400">
              ¿No tenés un legajo cargado todavía? Podés crearlo desde cero.
            </p>
            <CargarMisDatosBtn />
          </div>
        </div>
      </div>
    );
  }

  const agente = usuario.agente;
  const tipo = agente.tipoPersonal as TipoPersonal;
  const estado = agente.estado as EstadoAgente;

  const [rangos, sectores, auditLogsRaw, licencias, licenciasPendientes] = canEdit
    ? await Promise.all([
        prisma.rango.findMany({
          select: { id: true, nombre: true, cuerpo: true },
          orderBy: { orden: "asc" },
        }),
        prisma.sector.findMany({
          select: { id: true, nombre: true },
          orderBy: { nombre: "asc" },
        }),
        prisma.auditLog.findMany({
          where: { agenteId: agente.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, usuarioNombre: true, seccion: true, cambios: true, createdAt: true },
        }),
        prisma.licencia.findMany({ where: { agenteId: agente.id }, orderBy: { fechaInicio: "desc" } }),
        prisma.licenciaPendiente.findMany({
          where: { agenteId: agente.id },
          orderBy: [{ anio: "desc" }, { createdAt: "desc" }],
          include: { usos: { orderBy: { fecha: "desc" } } },
        }),
      ])
    : [[], [], await prisma.auditLog.findMany({
        where: { agenteId: agente.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, usuarioNombre: true, seccion: true, cambios: true, createdAt: true },
      }),
      await prisma.licencia.findMany({ where: { agenteId: agente.id }, orderBy: { fechaInicio: "desc" } }),
      await prisma.licenciaPendiente.findMany({
        where: { agenteId: agente.id },
        orderBy: [{ anio: "desc" }, { createdAt: "desc" }],
        include: { usos: { orderBy: { fecha: "desc" } } },
      }),
    ];

  type AuditLogRow = { id: string; usuarioNombre: string | null; seccion: string; cambios: string; createdAt: Date };
  const auditLogs = (auditLogsRaw as AuditLogRow[]).map((l) => ({
    id: l.id,
    usuarioNombre: l.usuarioNombre,
    seccion: l.seccion,
    cambios: l.cambios,
    createdAt: l.createdAt.toISOString(),
  }));

  const agenteSerializado = {
    ...agente,
    fechaNacimiento: agente.fechaNacimiento?.toISOString() ?? null,
    fechaIngreso: agente.fechaIngreso?.toISOString() ?? null,
    anoEgreso: agente.anoEgreso?.toISOString() ?? null,
    fechaInicioCursoAscenso: agente.fechaInicioCursoAscenso?.toISOString() ?? null,
    vencimientoChaleco: agente.vencimientoChaleco?.toISOString() ?? null,
    fechaInicioTNO: agente.fechaInicioTNO?.toISOString() ?? null,
    licenciaEmision: agente.licenciaEmision?.toISOString() ?? null,
    licenciaVencimiento: agente.licenciaVencimiento?.toISOString() ?? null,
    createdAt: agente.createdAt.toISOString(),
    updatedAt: agente.updatedAt.toISOString(),
    historialRangos: agente.historialRangos.map((h) => ({
      ...h,
      fechaDesde: h.fechaDesde.toISOString(),
      fechaHasta: h.fechaHasta?.toISOString() ?? null,
      createdAt: h.createdAt.toISOString(),
    })),
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-100">Mi Legajo</h2>

      {/* Header */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            <AgenteAvatar
              fotoUrl={agente.fotoUrl}
              sexo={agente.sexo}
              sizeClassName="w-16 h-16 rounded-full"
              iconSizeClassName="h-8 w-8"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-slate-100 leading-tight">
                  {agente.apellidos}, {agente.nombres}
                </h1>
                {agente.rango && (
                  <p className="text-sm text-slate-400 mt-0.5">{agente.rango.nombre}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_BADGE[tipo] ?? "bg-slate-800 text-slate-400"}`}>
                  {TIPO_LABELS[tipo] ?? tipo}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[estado] ?? "bg-slate-800 text-slate-400"}`}>
                  {ESTADO_LABELS[estado] ?? estado}
                </span>
                {!esAdmin && estado === "ACTIVO" && (
                  <SolicitarEdicionBtn
                    tienePendiente={tienePendiente}
                    tienePermisoActivo={tienePermisoActivo}
                    permisoHasta={solicitudActiva?.permisoHasta?.toISOString() ?? null}
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-slate-400">
              <span>
                <span className="text-slate-500">CUIL:</span>{" "}
                <span className="font-mono">{agente.cuil}</span>
              </span>
              {agente.turno && (
                <span><span className="text-slate-500">Turno:</span> {agente.turno}</span>
              )}
              {agente.sector && (
                <span><span className="text-slate-500">Sector:</span> {agente.sector.nombre}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banner legajo pendiente */}
      {legajoPendiente && !esAdmin && (
        <div className="space-y-3">
          {agente.motivoRechazo ? (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-5 py-4 space-y-1">
              <p className="text-sm font-semibold text-red-300">❌ Tu legajo fue observado</p>
              <p className="text-sm text-red-400">{agente.motivoRechazo}</p>
              <p className="text-xs text-red-500 mt-1">Corregí los datos indicados y guardá los cambios. El administrador recibirá una notificación para revisarlo nuevamente.</p>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-yellow-300"><span className="hourglass-flip">⏳</span> Tu legajo está en revisión</p>
              <p className="text-sm text-yellow-400 mt-0.5">Un administrador lo revisará y lo activará a la brevedad. Podés editar tus datos mientras tanto.</p>
            </div>
          )}
        </div>
      )}

      <LegajoTabs
        agente={agenteSerializado}
        canEdit={canEdit}
        rangos={rangos}
        sectores={sectores}
        auditLogs={auditLogs}
        licencias={(licencias as Awaited<ReturnType<typeof prisma.licencia.findMany>>).map((l) => ({
          id: l.id,
          tipo: l.tipo,
          estado: l.estado,
          fechaInicio: l.fechaInicio.toISOString(),
          fechaFin: l.fechaFin.toISOString(),
          diasHabiles: l.diasHabiles,
          motivo: l.motivo,
          observacion: l.observacion,
          createdAt: l.createdAt.toISOString(),
        }))}
        licenciasPendientes={(licenciasPendientes as Awaited<ReturnType<typeof prisma.licenciaPendiente.findMany<{ include: { usos: true } }>>>).map((p) => ({
          id: p.id,
          tipo: p.tipo,
          tipoOtroDetalle: p.tipoOtroDetalle,
          unidad: p.unidad,
          anio: p.anio,
          cantidadDias: p.cantidadDias,
          referencia: p.referencia,
          createdAt: p.createdAt.toISOString(),
          usos: p.usos.map((u) => ({
            id: u.id,
            fecha: u.fecha.toISOString(),
            cantidadDias: u.cantidadDias,
            referencia: u.referencia,
            createdAt: u.createdAt.toISOString(),
          })),
        }))}
        canManageLicencias={false}
        permisoHasta={tienePermisoActivo ? (solicitudActiva?.permisoHasta?.toISOString() ?? null) : null}
      />
    </div>
  );
}
