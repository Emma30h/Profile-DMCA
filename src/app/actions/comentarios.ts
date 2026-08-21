"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/types";

const ROLES_PERMITIDOS = ["SUPERADMIN", "ADMIN"];

async function verificarAcceso() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true, nombre: true, apellido: true },
  });
  if (!current || !current.activo || !ROLES_PERMITIDOS.includes(current.rol)) {
    throw new Error("Sin permiso para gestionar constancias");
  }

  return { usuarioNombre: [current.nombre, current.apellido].filter(Boolean).join(" ") || user.email! };
}

export async function crearComentario(agenteId: string, texto: string): Promise<ResultadoAccion> {
  try {
    const { usuarioNombre } = await verificarAcceso();

    const textoLimpio = texto.trim();
    if (!textoLimpio) throw new Error("La constancia no puede estar vacía");

    await prisma.comentario.create({
      data: { agenteId, texto: textoLimpio, usuarioNombre },
    });

    revalidatePath(`/personal/${agenteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la constancia" };
  }
}

export async function eliminarComentario(id: string): Promise<ResultadoAccion> {
  try {
    await verificarAcceso();

    const comentario = await prisma.comentario.findUnique({ where: { id }, select: { agenteId: true } });
    if (!comentario) throw new Error("La constancia ya no existe");

    await prisma.comentario.delete({ where: { id } });

    revalidatePath(`/personal/${comentario.agenteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar la constancia" };
  }
}
