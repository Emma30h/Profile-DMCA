"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types";

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });

  if (!current || !ROLES_ADMIN.includes(current.rol as RolUsuario)) {
    throw new Error("Sin permiso");
  }
}

export async function actualizarRol(usuarioId: string, rol: RolUsuario) {
  await verificarAdmin();
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { rol },
  });
  revalidatePath("/configuracion/usuarios");
}

export async function toggleActivo(usuarioId: string, activo: boolean) {
  await verificarAdmin();
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { activo },
  });
  revalidatePath("/configuracion/usuarios");
}

export async function vincularAgente(usuarioId: string, agenteId: string | null) {
  await verificarAdmin();
  if (agenteId) {
    // Desvincular si ese agente ya tenía otro usuario asignado
    await prisma.agente.updateMany({
      where: { usuarioId, NOT: { id: agenteId } },
      data: { usuarioId: null },
    });
    await prisma.agente.update({
      where: { id: agenteId },
      data: { usuarioId },
    });
  } else {
    // Desvincular
    await prisma.agente.updateMany({
      where: { usuarioId },
      data: { usuarioId: null },
    });
  }
  revalidatePath("/configuracion/usuarios");
}
