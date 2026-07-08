"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ROLES_PERMITIDOS = ["SUPERADMIN", "ADMIN"];

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ACTIVO: "Activo",
  BAJA: "Baja",
  PASE: "Pase",
};

export async function cambiarEstadoAgente(
  agenteId: string,
  nuevoEstado: string,
  motivo?: string
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

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");

  return {
    estadoAnteriorLabel: ESTADO_LABELS[estadoAnterior] ?? estadoAnterior,
    estadoNuevoLabel: ESTADO_LABELS[nuevoEstado] ?? nuevoEstado,
  };
}
