"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { semanaActualCordoba } from "@/lib/semanaCordoba";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export type TipoEventoCursoAscenso = "CLASE" | "EXAMEN";

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
}

export interface DatosEventoCursoAscenso {
  tipo: TipoEventoCursoAscenso;
  fecha: string; // YYYY-MM-DD
  observacion?: string;
}

export async function crearEventoCursoAscenso(agenteId: string, data: DatosEventoCursoAscenso) {
  await verificarAdmin();

  if (data.tipo !== "CLASE" && data.tipo !== "EXAMEN") throw new Error("Tipo de evento inválido");

  const fecha = new Date(`${data.fecha}T00:00:00.000Z`);
  if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");

  await prisma.eventoCursoAscenso.create({
    data: { agenteId, tipo: data.tipo, fecha, observacion: data.observacion?.trim() || null },
  });

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/mi-legajo");
}

export interface EventoCursoAscensoSemanaInfo {
  id: string;
  tipo: TipoEventoCursoAscenso;
  fecha: string; // YYYY-MM-DD
  observacion: string | null;
  agente: { id: string; nombreCompleto: string; rango: string | null };
}

// Para el sidebar del dashboard: eventos de esta semana, solo de agentes que
// están en curso de ascenso ahora mismo (fechaInicioCursoAscenso activo) —
// si alguien ya ascendió o canceló el curso, sus eventos pasados siguen en
// su legajo pero dejan de aparecer acá.
export async function obtenerEventosCursoAscensoSemana(): Promise<EventoCursoAscensoSemanaInfo[]> {
  const { lunes, finExclusivo } = semanaActualCordoba();

  const eventos = await prisma.eventoCursoAscenso.findMany({
    where: {
      fecha: { gte: lunes, lt: finExclusivo },
      agente: { fechaInicioCursoAscenso: { not: null } },
    },
    include: { agente: { select: { id: true, nombres: true, apellidos: true, rango: { select: { nombre: true } } } } },
    orderBy: { fecha: "asc" },
  });

  return eventos.map((e) => ({
    id: e.id,
    tipo: e.tipo as TipoEventoCursoAscenso,
    fecha: e.fecha.toISOString().slice(0, 10),
    observacion: e.observacion,
    agente: { id: e.agente.id, nombreCompleto: `${e.agente.apellidos}, ${e.agente.nombres}`, rango: e.agente.rango?.nombre ?? null },
  }));
}

export async function eliminarEventoCursoAscenso(id: string) {
  await verificarAdmin();

  const evento = await prisma.eventoCursoAscenso.findUnique({ where: { id }, select: { agenteId: true } });
  if (!evento) throw new Error("El evento ya no existe");

  await prisma.eventoCursoAscenso.delete({ where: { id } });

  revalidatePath(`/personal/${evento.agenteId}`);
  revalidatePath("/mi-legajo");
}
