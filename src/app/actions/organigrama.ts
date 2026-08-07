"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidatePattern } from "@/lib/redis";
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

export async function agregarRolOrganigrama(sectorId: string, datos: DatosRol) {
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
}

export async function actualizarRolOrganigrama(
  id: string,
  datos: DatosRol & { licencia: boolean }
) {
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
}

export async function eliminarRolOrganigrama(id: string) {
  await verificarAdmin();
  await prisma.rolOrganigrama.delete({ where: { id } });
  await invalidarOrganigrama();
}

// El swap pasa por un valor "orden" temporal fuera de rango (-1): el índice
// único compuesto (sectorId, orden) se valida por sentencia en Postgres, no
// al final de la transacción, así que actualizar los dos directo al valor
// del otro chocaría contra ese índice a mitad de camino.
export async function moverRolOrganigrama(id: string, direccion: "arriba" | "abajo") {
  await verificarAdmin();
  const actual = await prisma.rolOrganigrama.findUniqueOrThrow({ where: { id } });
  const vecino = await prisma.rolOrganigrama.findFirst({
    where: {
      sectorId: actual.sectorId,
      orden: direccion === "arriba" ? { lt: actual.orden } : { gt: actual.orden },
    },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return;

  await prisma.$transaction([
    prisma.rolOrganigrama.update({ where: { id: actual.id }, data: { orden: -1 } }),
    prisma.rolOrganigrama.update({ where: { id: vecino.id }, data: { orden: actual.orden } }),
    prisma.rolOrganigrama.update({ where: { id: actual.id }, data: { orden: vecino.orden } }),
  ]);
  await invalidarOrganigrama();
}
