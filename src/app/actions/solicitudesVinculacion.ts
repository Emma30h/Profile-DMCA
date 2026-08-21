"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";
import type { ResultadoAccion } from "@/types";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
  return usuario;
}

async function _aprobarSolicitudVinculacion(solicitudId: string) {
  await verificarAdmin();

  const solicitud = await prisma.solicitudVinculacion.findUnique({
    where: { id: solicitudId },
    include: {
      usuario: { select: { id: true, agente: { select: { id: true } } } },
      agente: { select: { id: true, usuarioId: true, nombres: true, apellidos: true } },
    },
  });
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  // Guarda de carrera: entre que se creó la solicitud y que un admin la
  // revisa, el agente pudo haberse vinculado por otra vía (otra solicitud
  // aprobada primero, o un admin lo vinculó a mano) o el usuario pudo haber
  // cargado un legajo propio.
  if (solicitud.agente.usuarioId) {
    throw new Error("Ese legajo ya fue vinculado a otra cuenta. Rechazá esta solicitud.");
  }
  if (solicitud.usuario.agente) {
    throw new Error("Esa cuenta ya tiene un legajo vinculado. Rechazá esta solicitud.");
  }

  await prisma.agente.update({
    where: { id: solicitud.agenteId },
    data: { usuarioId: solicitud.usuarioId },
  });

  await prisma.solicitudVinculacion.update({
    where: { id: solicitudId },
    data: { estado: "APROBADA", revisadoEn: new Date() },
  });

  await prisma.notificacion.create({
    data: {
      usuarioId: solicitud.usuarioId,
      tipo: "VINCULACION_APROBADA",
      mensaje: "Tu cuenta fue vinculada a tu legajo. Ya podés acceder a tus datos.",
      referenciaId: solicitud.agenteId,
    },
  });

  // Cualquier otra solicitud pendiente sobre el mismo legajo (ej. dos
  // cuentas distintas coincidieron por DNI) queda sin sentido: se rechaza
  // sola y se avisa a esos otros usuarios.
  const otrasPendientes = await prisma.solicitudVinculacion.findMany({
    where: { agenteId: solicitud.agenteId, estado: "PENDIENTE", NOT: { id: solicitudId } },
    select: { id: true, usuarioId: true },
  });
  if (otrasPendientes.length > 0) {
    await prisma.solicitudVinculacion.updateMany({
      where: { id: { in: otrasPendientes.map((s) => s.id) } },
      data: { estado: "RECHAZADA", motivoRechazo: "El legajo ya fue vinculado a otra cuenta", revisadoEn: new Date() },
    });
    await prisma.notificacion.createMany({
      data: otrasPendientes.map((s) => ({
        usuarioId: s.usuarioId,
        tipo: "VINCULACION_RECHAZADA" as const,
        mensaje: "Tu solicitud de vinculación fue rechazada: el legajo ya fue vinculado a otra cuenta.",
      })),
    });
  }

  await invalidateAgentesCache();
  revalidatePath("/mi-legajo");
  revalidatePath("/personal");
  revalidatePath(`/personal/${solicitud.agenteId}`);
  revalidatePath("/configuracion/solicitudes");
  revalidatePath("/configuracion/usuarios");
}

export async function aprobarSolicitudVinculacion(solicitudId: string): Promise<ResultadoAccion> {
  try {
    await _aprobarSolicitudVinculacion(solicitudId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al aprobar la vinculación" };
  }
}

async function _rechazarSolicitudVinculacion(solicitudId: string, motivo: string) {
  await verificarAdmin();

  const solicitud = await prisma.solicitudVinculacion.findUnique({
    where: { id: solicitudId },
    include: { usuario: { select: { id: true } } },
  });
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  await prisma.solicitudVinculacion.update({
    where: { id: solicitudId },
    data: { estado: "RECHAZADA", motivoRechazo: motivo.trim() || null, revisadoEn: new Date() },
  });

  await prisma.notificacion.create({
    data: {
      usuarioId: solicitud.usuario.id,
      tipo: "VINCULACION_RECHAZADA",
      mensaje: `Tu solicitud de vinculación fue rechazada${motivo.trim() ? `: ${motivo.trim()}` : "."}`,
    },
  });

  revalidatePath("/mi-legajo");
  revalidatePath("/configuracion/solicitudes");
}

export async function rechazarSolicitudVinculacion(solicitudId: string, motivo: string): Promise<ResultadoAccion> {
  try {
    await _rechazarSolicitudVinculacion(solicitudId, motivo);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al rechazar la vinculación" };
  }
}
