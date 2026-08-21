"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  enviarAprobacionEdicion,
  enviarRechazoEdicion,
  enviarPermisoVencido,
} from "@/lib/email";
import { verificarPassword } from "@/lib/verificarPassword";
import type { ResultadoAccion } from "@/types";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];
const HORAS_PERMISO = 48;

async function getUsuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, rol: true, activo: true, nombre: true, apellido: true, email: true },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (!usuario.activo) throw new Error("Sin permiso");

  return usuario;
}

async function verificarAdmin() {
  const usuario = await getUsuarioActual();
  if (!ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
  return usuario;
}

// ─── Crear solicitud ──────────────────────────────────────────────────────────

async function _crearSolicitudEdicion(password: string, motivo?: string) {
  const usuario = await getUsuarioActual();

  if (ROLES_ADMIN.includes(usuario.rol)) {
    throw new Error("Los administradores no necesitan solicitar permiso");
  }

  const passwordOk = await verificarPassword(usuario.email, password);
  if (!passwordOk) throw new Error("Contraseña incorrecta.");

  // Verificar que no tenga una solicitud pendiente o permiso activo
  const existente = await prisma.solicitudEdicion.findFirst({
    where: {
      usuarioId: usuario.id,
      OR: [
        { estado: "PENDIENTE" },
        { estado: "APROBADA", permisoHasta: { gt: new Date() } },
      ],
    },
  });

  if (existente) {
    throw new Error("Ya tenés una solicitud activa o un permiso vigente");
  }

  await prisma.solicitudEdicion.create({
    data: { usuarioId: usuario.id, estado: "PENDIENTE", motivo: motivo?.trim() || null },
  });

  // Notificar a todos los admins
  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ADMIN }, activo: true },
    select: { id: true },
  });

  const nombreCompleto =
    [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;

  await prisma.notificacion.createMany({
    data: admins.map((admin) => ({
      usuarioId: admin.id,
      tipo: "SOLICITUD_NUEVA",
      mensaje: `${nombreCompleto} solicita permiso para actualizar sus datos de legajo.`,
    })),
  });

  revalidatePath("/mi-legajo");
  revalidatePath("/configuracion/solicitudes");
}

export async function crearSolicitudEdicion(password: string, motivo?: string): Promise<ResultadoAccion> {
  try {
    await _crearSolicitudEdicion(password, motivo);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la solicitud" };
  }
}

// ─── Aprobar solicitud ────────────────────────────────────────────────────────

async function _aprobarSolicitud(solicitudId: string) {
  await verificarAdmin();

  const solicitud = await prisma.solicitudEdicion.findUnique({
    where: { id: solicitudId },
    include: {
      usuario: {
        select: { id: true, email: true, nombre: true, apellido: true },
      },
    },
  });

  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  const permisoHasta = new Date();
  permisoHasta.setHours(permisoHasta.getHours() + HORAS_PERMISO);

  await prisma.solicitudEdicion.update({
    where: { id: solicitudId },
    data: { estado: "APROBADA", permisoHasta },
  });

  const { usuario } = solicitud;
  const nombreCompleto =
    [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;

  // Notificación in-app al usuario
  await prisma.notificacion.create({
    data: {
      usuarioId: usuario.id,
      tipo: "APROBADA",
      mensaje: `Tu solicitud fue aprobada. Podés editar tu legajo hasta ${permisoHasta.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}.`,
    },
  });

  // Email al usuario
  try {
    await enviarAprobacionEdicion(usuario.email, nombreCompleto, permisoHasta);
  } catch {
    // No interrumpir el flujo si falla el email
  }

  revalidatePath("/configuracion/solicitudes");
  revalidatePath("/mi-legajo");
}

export async function aprobarSolicitud(solicitudId: string): Promise<ResultadoAccion> {
  try {
    await _aprobarSolicitud(solicitudId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al aprobar la solicitud" };
  }
}

// ─── Rechazar solicitud ───────────────────────────────────────────────────────

async function _rechazarSolicitud(solicitudId: string, motivo: string) {
  await verificarAdmin();

  const solicitud = await prisma.solicitudEdicion.findUnique({
    where: { id: solicitudId },
    include: {
      usuario: {
        select: { id: true, email: true, nombre: true, apellido: true },
      },
    },
  });

  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  await prisma.solicitudEdicion.update({
    where: { id: solicitudId },
    data: { estado: "RECHAZADA", motivoRechazo: motivo.trim() || null },
  });

  const { usuario } = solicitud;
  const nombreCompleto =
    [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;

  // Notificación in-app al usuario
  await prisma.notificacion.create({
    data: {
      usuarioId: usuario.id,
      tipo: "RECHAZADA",
      mensaje: `Tu solicitud fue rechazada${motivo.trim() ? `: ${motivo.trim()}` : "."}`,
    },
  });

  // Email al usuario
  try {
    await enviarRechazoEdicion(usuario.email, nombreCompleto, motivo.trim() || "Sin motivo especificado");
  } catch {
    // No interrumpir el flujo si falla el email
  }

  revalidatePath("/configuracion/solicitudes");
  revalidatePath("/mi-legajo");
}

export async function rechazarSolicitud(solicitudId: string, motivo: string): Promise<ResultadoAccion> {
  try {
    await _rechazarSolicitud(solicitudId, motivo);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al rechazar la solicitud" };
  }
}

// ─── Marcar notificaciones como leídas ───────────────────────────────────────
// Sin try/catch en el llamador (es un fire-and-forget al abrir la campanita):
// si esto tirase, un unhandled error dentro de startTransition escala al
// error boundary más cercano y rompe la pantalla por algo no crítico. Por
// eso, a diferencia del resto de este archivo, acá alcanza con no dejar que
// se propague — no hay mensaje que mostrarle al usuario.
export async function marcarNotificacionesLeidas(): Promise<ResultadoAccion> {
  try {
    const usuario = await getUsuarioActual();

    await prisma.notificacion.updateMany({
      where: { usuarioId: usuario.id, leida: false },
      data: { leida: true },
    });

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al marcar las notificaciones" };
  }
}

// ─── Notificar permiso vencido (llamar desde cron o middleware) ───────────────

export async function notificarPermisosVencidos() {
  const ahora = new Date();
  const hace1Hora = new Date(ahora.getTime() - 60 * 60 * 1000);

  // Permisos que vencieron en la última hora (para no re-notificar)
  const vencidos = await prisma.solicitudEdicion.findMany({
    where: {
      estado: "APROBADA",
      permisoHasta: { gte: hace1Hora, lte: ahora },
    },
    include: {
      usuario: { select: { id: true, email: true, nombre: true, apellido: true } },
    },
  });

  for (const s of vencidos) {
    const { usuario } = s;
    const nombreCompleto =
      [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;

    await prisma.notificacion.create({
      data: {
        usuarioId: usuario.id,
        tipo: "PERMISO_VENCIDO",
        mensaje: "Tu permiso de edición de legajo venció. Podés solicitar uno nuevo cuando lo necesites.",
      },
    });

    try {
      await enviarPermisoVencido(usuario.email, nombreCompleto);
    } catch {
      // continuar con el siguiente
    }
  }
}
