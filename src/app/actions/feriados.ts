"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { ResultadoAccion } from "@/types";

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (!current || !["SUPERADMIN", "ADMIN"].includes(current.rol)) {
    throw new Error("Sin permiso para gestionar feriados");
  }
}

export async function obtenerFeriadosMes(anio: number, mes: number): Promise<string[]> {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  const feriados = await prisma.feriado.findMany({
    where: { aplica: true, fecha: { gte: inicio, lt: fin } },
    select: { fecha: true },
  });

  return feriados.map((f) => f.fecha.toISOString().slice(0, 10));
}

export async function crearFeriado(data: {
  fecha: string; // ISO date string "YYYY-MM-DD"
  nombre: string;
  aplica: boolean;
}): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();

    if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

    const fecha = new Date(data.fecha);
    if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");

    await prisma.feriado.create({
      data: {
        fecha,
        nombre: data.nombre.trim(),
        aplica: data.aplica,
      },
    });

    revalidatePath("/licencias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear el feriado" };
  }
}

export async function actualizarFeriado(
  id: string,
  data: { fecha?: string; nombre?: string; aplica?: boolean }
): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();

    let fecha: Date | undefined;
    if (data.fecha !== undefined) {
      fecha = new Date(data.fecha);
      if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");
    }

    await prisma.feriado.update({
      where: { id },
      data: {
        ...(fecha !== undefined && { fecha }),
        ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
        ...(data.aplica !== undefined && { aplica: data.aplica }),
      },
    });

    revalidatePath("/licencias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar el feriado" };
  }
}

export async function eliminarFeriado(id: string): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();

    await prisma.feriado.delete({ where: { id } });

    revalidatePath("/licencias");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar el feriado" };
  }
}
