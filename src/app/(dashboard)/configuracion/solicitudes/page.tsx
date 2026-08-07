import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import GestorSolicitudes from "./GestorSolicitudes";
import GestorSolicitudesFoto from "./GestorSolicitudesFoto";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function SolicitudesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });

  if (!currentUser || !ROLES_ADMIN.includes(currentUser.rol)) {
    redirect("/dashboard");
  }

  const solicitudes = await prisma.solicitudEdicion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      usuario: {
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          agente: { select: { nombres: true, apellidos: true } },
        },
      },
    },
  });

  const serialized = solicitudes.map((s) => ({
    id: s.id,
    estado: s.estado,
    motivoRechazo: s.motivoRechazo,
    permisoHasta: s.permisoHasta?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    usuario: {
      id: s.usuario.id,
      email: s.usuario.email,
      nombre: s.usuario.nombre,
      apellido: s.usuario.apellido,
      agente: s.usuario.agente
        ? { nombres: s.usuario.agente.nombres, apellidos: s.usuario.agente.apellidos }
        : null,
    },
  }));

  const pendientes = serialized.filter((s) => s.estado === "PENDIENTE");
  const historial = serialized.filter((s) => s.estado !== "PENDIENTE");

  const solicitudesFoto = await prisma.solicitudFoto.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      usuario: {
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          agente: { select: { nombres: true, apellidos: true } },
        },
      },
    },
  });

  const fotoSerialized = solicitudesFoto.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    estado: s.estado,
    fotoUrlPropuesta: s.fotoUrlPropuesta,
    fotoUrlAnterior: s.fotoUrlAnterior,
    motivoRechazo: s.motivoRechazo,
    createdAt: s.createdAt.toISOString(),
    usuario: {
      id: s.usuario.id,
      email: s.usuario.email,
      nombre: s.usuario.nombre,
      apellido: s.usuario.apellido,
      agente: s.usuario.agente
        ? { nombres: s.usuario.agente.nombres, apellidos: s.usuario.agente.apellidos }
        : null,
    },
  }));

  const fotoPendientes = fotoSerialized.filter((s) => s.estado === "PENDIENTE");
  const fotoHistorial = fotoSerialized.filter((s) => s.estado !== "PENDIENTE");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Solicitudes de edición</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Gestioná los permisos temporales para que el personal actualice sus datos.
        </p>
      </div>

      <GestorSolicitudes pendientes={pendientes} historial={historial} />

      <div>
        <h2 className="text-xl font-semibold text-slate-100">Cambios de foto de perfil</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Revisá que la foto propuesta cumpla los estándares del legajo antes de aprobarla.
        </p>
      </div>

      <GestorSolicitudesFoto pendientes={fotoPendientes} historial={fotoHistorial} />
    </div>
  );
}
