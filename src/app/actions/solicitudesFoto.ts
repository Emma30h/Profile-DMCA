"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];
const BUCKET = "fotos-legajos";

async function getUsuarioPropietario(agenteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true, fotoUrl: true } } },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (usuario.agente?.id !== agenteId) throw new Error("Sin permiso");
  if (ROLES_ADMIN.includes(usuario.rol)) {
    throw new Error("Los administradores cambian su foto directamente, sin solicitud");
  }
  return usuario;
}

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
  return usuario;
}

async function verificarSinPendiente(agenteId: string) {
  const existente = await prisma.solicitudFoto.findFirst({
    where: { agenteId, estado: "PENDIENTE" },
  });
  if (existente) throw new Error("Ya tenés una solicitud de foto pendiente de revisión");
}

async function notificarAdmins(mensaje: string) {
  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ADMIN }, activo: true },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notificacion.createMany({
    data: admins.map((a) => ({ usuarioId: a.id, tipo: "SOLICITUD_FOTO_NUEVA", mensaje })),
  });
}

// ─── Crear solicitud (self-service, no-admin) ─────────────────────────────────

export async function solicitarCambioFoto(
  agenteId: string,
  fotoUrlPropuesta: string,
  fotoPathPropuesta: string
): Promise<void> {
  const usuario = await getUsuarioPropietario(agenteId);
  await verificarSinPendiente(agenteId);

  await prisma.solicitudFoto.create({
    data: {
      agenteId,
      usuarioId: usuario.id,
      tipo: "SUBIR",
      fotoUrlPropuesta,
      fotoPathPropuesta,
      fotoUrlAnterior: usuario.agente?.fotoUrl ?? null,
    },
  });

  const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;
  await notificarAdmins(`${nombreCompleto} solicitó cambiar su foto de perfil.`);

  revalidatePath("/perfil");
  revalidatePath("/configuracion/solicitudes");
}

export async function solicitarQuitarFoto(agenteId: string): Promise<void> {
  const usuario = await getUsuarioPropietario(agenteId);
  await verificarSinPendiente(agenteId);

  if (!usuario.agente?.fotoUrl) throw new Error("No tenés una foto cargada para quitar");

  await prisma.solicitudFoto.create({
    data: {
      agenteId,
      usuarioId: usuario.id,
      tipo: "QUITAR",
      fotoUrlAnterior: usuario.agente.fotoUrl,
    },
  });

  const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || usuario.email;
  await notificarAdmins(`${nombreCompleto} solicitó sacar su foto de perfil.`);

  revalidatePath("/perfil");
  revalidatePath("/configuracion/solicitudes");
}

// ─── Revisión (admin) ──────────────────────────────────────────────────────────

export async function aprobarSolicitudFoto(solicitudId: string): Promise<void> {
  await verificarAdmin();

  const solicitud = await prisma.solicitudFoto.findUnique({
    where: { id: solicitudId },
    include: { usuario: { select: { id: true } } },
  });
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  await prisma.agente.update({
    where: { id: solicitud.agenteId },
    data: { fotoUrl: solicitud.tipo === "SUBIR" ? solicitud.fotoUrlPropuesta : null },
  });

  // Si se aprueba sacar la foto, se borra el archivo en vivo del storage.
  // Si se aprueba subir una nueva, la que estaba antes queda huérfana en el
  // bucket (mismo criterio que ya usa eliminarFotoLegajoAdmin: best-effort,
  // no hace falta un barrido general de archivos sin referenciar).
  if (solicitud.tipo === "QUITAR") {
    const supabase = await createClient();
    await supabase.storage
      .from(BUCKET)
      .remove([`${solicitud.agenteId}/foto.jpg`, `${solicitud.agenteId}/foto.png`, `${solicitud.agenteId}/foto.webp`]);
  }

  await prisma.solicitudFoto.update({
    where: { id: solicitudId },
    data: { estado: "APROBADA", revisadoEn: new Date() },
  });

  await prisma.notificacion.create({
    data: {
      usuarioId: solicitud.usuario.id,
      tipo: "FOTO_APROBADA",
      mensaje: solicitud.tipo === "SUBIR"
        ? "Tu nueva foto de perfil fue aprobada."
        : "Se confirmó sacar tu foto de perfil.",
    },
  });

  await invalidateAgentesCache();
  revalidatePath("/mi-legajo");
  revalidatePath("/perfil");
  revalidatePath("/personal");
  revalidatePath(`/personal/${solicitud.agenteId}`);
  revalidatePath("/configuracion/solicitudes");
}

export async function rechazarSolicitudFoto(solicitudId: string, motivo: string): Promise<void> {
  await verificarAdmin();

  const solicitud = await prisma.solicitudFoto.findUnique({
    where: { id: solicitudId },
    include: { usuario: { select: { id: true } } },
  });
  if (!solicitud) throw new Error("Solicitud no encontrada");
  if (solicitud.estado !== "PENDIENTE") throw new Error("La solicitud ya fue procesada");

  // La foto propuesta vive en un path aparte del que está en vivo (ver
  // solicitarCambioFoto), así que rechazar no afecta la foto actual del
  // agente — solo se descarta el archivo que quedó pendiente de revisión.
  if (solicitud.tipo === "SUBIR" && solicitud.fotoPathPropuesta) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([solicitud.fotoPathPropuesta]);
  }

  await prisma.solicitudFoto.update({
    where: { id: solicitudId },
    data: { estado: "RECHAZADA", motivoRechazo: motivo.trim() || null, revisadoEn: new Date() },
  });

  await prisma.notificacion.create({
    data: {
      usuarioId: solicitud.usuario.id,
      tipo: "FOTO_RECHAZADA",
      mensaje: `Tu solicitud de foto fue rechazada${motivo.trim() ? `: ${motivo.trim()}` : "."}`,
    },
  });

  revalidatePath("/perfil");
  revalidatePath("/configuracion/solicitudes");
}
