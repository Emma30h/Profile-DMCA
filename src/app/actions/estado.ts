"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";
import type { ResultadoAccion } from "@/types";

const ROLES_PERMITIDOS = ["SUPERADMIN", "ADMIN"];

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACTIVO: "Activo",
  BAJA: "Baja",
  PASE: "Pase",
};

async function _cambiarEstadoAgente(
  agenteId: string,
  nuevoEstado: string,
  motivo?: string,
  fecha?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, rol: true, nombre: true, apellido: true },
  });
  if (!current) throw new Error("Usuario no encontrado");
  if (!ROLES_PERMITIDOS.includes(current.rol)) {
    throw new Error("Sin permiso para cambiar el estado del legajo");
  }

  const estadosValidos = ["ACTIVO", "BAJA", "PASE"];
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error("Estado no válido");
  }

  if ((nuevoEstado === "BAJA" || nuevoEstado === "PASE") && !motivo?.trim()) {
    throw new Error("El motivo es obligatorio para este cambio de estado");
  }

  // Fecha efectiva del cambio (puede ser pasada, ej. una baja que se está
  // cargando con demora): se guarda como el createdAt del HistorialEstado
  // para que el flujo de personal del dashboard agrupe el movimiento en el
  // mes real en que ocurrió, no en el mes en que se cargó al sistema.
  const fechaEfectiva = fecha ? new Date(fecha) : new Date();
  if (isNaN(fechaEfectiva.getTime())) {
    throw new Error("Fecha inválida");
  }

  const agente = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: { estado: true, usuarioId: true },
  });
  if (!agente) throw new Error("Agente no encontrado");

  const estadoAnterior = agente.estado;
  if (estadoAnterior === nuevoEstado) {
    throw new Error("El agente ya tiene ese estado");
  }

  const usuarioNombre =
    [current.nombre, current.apellido].filter(Boolean).join(" ") || user.email!;

  await prisma.$transaction([
    prisma.agente.update({
      where: { id: agenteId },
      data: { estado: nuevoEstado },
    }),
    prisma.historialEstado.create({
      data: {
        agenteId,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        motivo: motivo?.trim() || null,
        usuarioNombre,
        createdAt: fechaEfectiva,
      },
    }),
  ]);

  // Notificar al usuario dueño del legajo
  if (agente.usuarioId) {
    const textoAnterior = ESTADO_LABELS[estadoAnterior] ?? estadoAnterior;
    const textoNuevo = ESTADO_LABELS[nuevoEstado] ?? nuevoEstado;
    let mensaje = `El estado de tu legajo cambió: ${textoAnterior} → ${textoNuevo}.`;
    if (motivo?.trim()) mensaje += ` Motivo: ${motivo.trim()}.`;

    await prisma.notificacion.create({
      data: {
        usuarioId: agente.usuarioId,
        tipo: "ESTADO_CAMBIADO",
        mensaje,
        referenciaId: agenteId,
      },
    });
  }

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");

  return {
    estadoAnteriorLabel: ESTADO_LABELS[estadoAnterior] ?? estadoAnterior,
    estadoNuevoLabel: ESTADO_LABELS[nuevoEstado] ?? nuevoEstado,
  };
}

export async function cambiarEstadoAgente(
  agenteId: string,
  nuevoEstado: string,
  motivo?: string,
  fecha?: string
): Promise<ResultadoAccion & { estadoAnteriorLabel?: string; estadoNuevoLabel?: string }> {
  try {
    const { estadoAnteriorLabel, estadoNuevoLabel } = await _cambiarEstadoAgente(agenteId, nuevoEstado, motivo, fecha);
    return { ok: true, estadoAnteriorLabel, estadoNuevoLabel };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar el estado" };
  }
}

/** Corrige la fecha de vigencia del estado actual (el registro de
 *  HistorialEstado más reciente cuyo estadoNuevo coincide con el estado
 *  vigente), sin disparar un cambio de estado nuevo. */
async function _actualizarFechaVigenciaEstado(agenteId: string, nuevaFecha: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true },
  });
  if (!current) throw new Error("Usuario no encontrado");
  if (!current.activo || !ROLES_PERMITIDOS.includes(current.rol)) {
    throw new Error("Sin permiso para editar la fecha del estado");
  }

  const fecha = new Date(nuevaFecha);
  if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");

  const agente = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: { estado: true },
  });
  if (!agente) throw new Error("Agente no encontrado");

  const ultimoCambio = await prisma.historialEstado.findFirst({
    where: { agenteId, estadoNuevo: agente.estado },
    orderBy: { createdAt: "desc" },
  });
  if (!ultimoCambio) throw new Error("No hay un registro de vigencia para editar");

  await prisma.historialEstado.update({
    where: { id: ultimoCambio.id },
    data: { createdAt: fecha },
  });

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");
}

export async function actualizarFechaVigenciaEstado(agenteId: string, nuevaFecha: string): Promise<ResultadoAccion> {
  try {
    await _actualizarFechaVigenciaEstado(agenteId, nuevaFecha);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar la fecha" };
  }
}
