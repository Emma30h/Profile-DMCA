import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { TipoPersonal, EstadoAgente } from "@/types";
import LegajoTabs from "./LegajoTabs";
import InvalidarAnclajeAnterior from "./InvalidarAnclajeAnterior";
import ValidarLegajoBtn from "@/components/legajo/ValidarLegajoBtn";
import CambiarEstadoBtn from "@/components/legajo/CambiarEstadoBtn";
import FotoLegajoBtn from "@/components/legajo/FotoLegajoBtn";
import AgenteAvatar from "@/components/AgenteAvatar";
import LimpiarFicheroButton from "../LimpiarFicheroButton";
import { buildQueryString, type FiltrosPersonalParams } from "../queryString";

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

export default async function PersonalDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<FiltrosPersonalParams & { tab?: string; volver?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (currentUser?.rol === "READONLY") redirect("/mi-legajo");

  const canEdit = currentUser?.rol === "SUPERADMIN" || currentUser?.rol === "ADMIN";

  const { id } = await params;
  const sp = await searchParams;
  // Cuando se llega al legajo desde otra sección (ej. el calendario de
  // Licencias), "volver" debe mandar ahí y no a la lista de Personal — la
  // propia sección de origen pasa a dónde volver por query string. Se valida
  // que sea una ruta relativa propia (nunca "//host" ni una URL absoluta),
  // para no abrir la puerta a un open redirect.
  const volverExterno = sp.volver && sp.volver.startsWith("/") && !sp.volver.startsWith("//") ? sp.volver : null;
  const volverQueryString = buildQueryString(sp);
  const volverHref = volverExterno ?? `/personal${volverQueryString ? `?${volverQueryString}` : ""}`;

  const [agente, rangos, sectores, auditLogs, historialEstados, licencias, licenciasPendientes, feriados] = await Promise.all([
    prisma.agente.findUnique({
      where: { id },
      include: {
        rango: true,
        sector: true,
        historialRangos: {
          include: { rango: true },
          orderBy: { fechaDesde: "desc" },
        },
      },
    }),
    prisma.rango.findMany({
      select: { id: true, nombre: true, cuerpo: true },
      orderBy: { orden: "asc" },
    }),
    prisma.sector.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { agenteId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, usuarioNombre: true, seccion: true, cambios: true, createdAt: true },
    }),
    prisma.historialEstado.findMany({
      where: { agenteId: id },
      orderBy: { createdAt: "desc" },
      select: { id: true, estadoAnterior: true, estadoNuevo: true, motivo: true, usuarioNombre: true, createdAt: true },
    }),
    prisma.licencia.findMany({
      where: { agenteId: id },
      orderBy: { fechaInicio: "desc" },
    }),
    prisma.licenciaPendiente.findMany({
      where: { agenteId: id },
      orderBy: [{ anio: "desc" }, { createdAt: "desc" }],
      include: { usos: { orderBy: { fecha: "desc" } } },
    }),
    prisma.feriado.findMany({
      orderBy: { fecha: "asc" },
    }),
  ]);

  if (!agente) notFound();

  const feriadosSerializados = feriados.map((f) => ({
    id: f.id,
    fecha: f.fecha.toISOString(),
    nombre: f.nombre,
    aplica: f.aplica,
  }));

  type AuditLogRow = { id: string; usuarioNombre: string | null; seccion: string; cambios: string; createdAt: Date };
  const auditLogsSerialized = (auditLogs as AuditLogRow[]).map((l) => ({
    id: l.id,
    usuarioNombre: l.usuarioNombre,
    seccion: l.seccion,
    cambios: l.cambios,
    createdAt: l.createdAt.toISOString(),
  }));

  type HistorialEstadoRow = { id: string; estadoAnterior: string; estadoNuevo: string; motivo: string | null; usuarioNombre: string | null; createdAt: Date };
  const historialEstadosSerialized = (historialEstados as HistorialEstadoRow[]).map((h) => ({
    id: h.id,
    estadoAnterior: h.estadoAnterior,
    estadoNuevo: h.estadoNuevo,
    motivo: h.motivo,
    usuarioNombre: h.usuarioNombre,
    createdAt: h.createdAt.toISOString(),
  }));

  const tipo = agente.tipoPersonal as TipoPersonal;
  const estado = agente.estado as EstadoAgente;

  // Serializar fechas para pasar al Client Component
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

  const subtitulo = [agente.rango?.nombre, TIPO_LABELS[tipo] ?? tipo].filter(Boolean).join(" - ");

  return (
    <>
      <InvalidarAnclajeAnterior id={agente.id} />
      <div className="space-y-5">
        {/* Header del legajo */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
          <div className="flex justify-start lg:justify-end mb-4">
            <LimpiarFicheroButton href={volverHref} agenteId={agente.id} />
          </div>

          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <AgenteAvatar
                fotoUrl={agente.fotoUrl}
                sexo={agente.sexo}
                sizeClassName="w-16 h-16 rounded-xl"
                iconSizeClassName="h-8 w-8"
              />
              {estado === "ACTIVO" && (
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-slate-900" />
              )}
              {canEdit && <FotoLegajoBtn agenteId={agente.id} fotoUrlActual={agente.fotoUrl} />}
            </div>

            {/* Info principal */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-xl font-bold text-slate-100 leading-tight">
                    {agente.apellidos}, {agente.nombres}
                  </h1>
                  {subtitulo && (
                    <p className="text-sm font-semibold text-blue-400 uppercase tracking-wide mt-0.5">{subtitulo}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canEdit && estado !== "PENDIENTE" ? (
                    <CambiarEstadoBtn agenteId={agente.id} estadoActual={estado} />
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ESTADO_BADGE[estado] ?? "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {ESTADO_LABELS[estado] ?? estado}
                    </span>
                  )}
                  {agente.turno && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-white">
                      {agente.turno}
                    </span>
                  )}
                  {agente.enTNO && (
                    <span
                      title="Tarea No Operativa"
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-400"
                    >
                      TNO
                    </span>
                  )}
                </div>
              </div>

              {/* Datos rápidos */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-slate-400">
                <span>
                  <span className="text-slate-500">CUIL:</span>{" "}
                  <span className="font-mono">{agente.cuil}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Validación de legajo pendiente */}
        {canEdit && estado === "PENDIENTE" && (
          <ValidarLegajoBtn agenteId={agente.id} />
        )}

        {/* Tabs con todo el legajo */}
        <LegajoTabs
          agente={agenteSerializado}
          canEdit={canEdit}
          rangos={rangos}
          sectores={sectores}
          auditLogs={auditLogsSerialized}
          historialEstados={historialEstadosSerialized}
          tabInicial={sp.tab === "licencias" ? "licencias" : undefined}
          licencias={licencias.map((l) => ({
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
          licenciasPendientes={licenciasPendientes.map((p) => ({
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
          canManageLicencias={["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(currentUser?.rol ?? "")}
          feriados={feriadosSerializados}
        />
      </div>
    </>
  );
}
