"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidatePattern } from "@/lib/redis";
import type { RolUsuario, ResultadoAccion } from "@/types";

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true },
  });

  if (!current || !current.activo || !ROLES_ADMIN.includes(current.rol as RolUsuario)) {
    throw new Error("Sin permiso");
  }
}

async function invalidarOrganigrama() {
  await invalidatePattern("organigrama:*");
  revalidatePath("/organigrama");
  revalidatePath("/configuracion/organigrama");
}

interface DatosRol {
  etiqueta: string;
  agenteId: string | null;
  rangoLibre: string | null;
  nombreLibre: string | null;
}

export async function agregarRolOrganigrama(sectorId: string, datos: DatosRol): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    const max = await prisma.rolOrganigrama.aggregate({
      where: { sectorId },
      _max: { orden: true },
    });
    await prisma.rolOrganigrama.create({
      data: {
        sectorId,
        orden: (max._max.orden ?? -1) + 1,
        etiqueta: datos.etiqueta,
        agenteId: datos.agenteId,
        rangoLibre: datos.agenteId ? null : datos.rangoLibre,
        nombreLibre: datos.agenteId ? null : datos.nombreLibre,
      },
    });
    await invalidarOrganigrama();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al agregar el rol" };
  }
}

export async function actualizarRolOrganigrama(
  id: string,
  datos: DatosRol & { licencia: boolean }
): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    await prisma.rolOrganigrama.update({
      where: { id },
      data: {
        etiqueta: datos.etiqueta,
        licencia: datos.licencia,
        agenteId: datos.agenteId,
        rangoLibre: datos.agenteId ? null : datos.rangoLibre,
        nombreLibre: datos.agenteId ? null : datos.nombreLibre,
      },
    });
    await invalidarOrganigrama();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar el rol" };
  }
}

export async function eliminarRolOrganigrama(id: string): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    await prisma.rolOrganigrama.delete({ where: { id } });
    await invalidarOrganigrama();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar el rol" };
  }
}

// El swap pasa por un valor "orden" temporal fuera de rango (-1): el índice
// único compuesto (sectorId, orden) se valida por sentencia en Postgres, no
// al final de la transacción, así que actualizar los dos directo al valor
// del otro chocaría contra ese índice a mitad de camino.
export async function moverRolOrganigrama(id: string, direccion: "arriba" | "abajo"): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    const actual = await prisma.rolOrganigrama.findUniqueOrThrow({ where: { id } });
    const vecino = await prisma.rolOrganigrama.findFirst({
      where: {
        sectorId: actual.sectorId,
        orden: direccion === "arriba" ? { lt: actual.orden } : { gt: actual.orden },
      },
      orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
    });
    if (!vecino) return { ok: true };

    await prisma.$transaction([
      prisma.rolOrganigrama.update({ where: { id: actual.id }, data: { orden: -1 } }),
      prisma.rolOrganigrama.update({ where: { id: vecino.id }, data: { orden: actual.orden } }),
      prisma.rolOrganigrama.update({ where: { id: actual.id }, data: { orden: vecino.orden } }),
    ]);
    await invalidarOrganigrama();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al mover el rol" };
  }
}
