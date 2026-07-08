"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { TipoLicencia } from "@/types";

const TIPOS_LICENCIA_VALIDOS: TipoLicencia[] = [
  "ORDINARIA",
  "MEDICA",
  "CARPETA_MEDICA",
  "ESPECIAL",
  "SIN_GOCE_SUELDO",
  "ARTICULO",
  "SUSPENSION",
  "ADSCRIPCION",
];

const TIPO_LABELS: Record<TipoLicencia, string> = {
  ORDINARIA: "Ordinaria",
  MEDICA: "Licencia Médica",
  CARPETA_MEDICA: "Carpeta Médica",
  ESPECIAL: "Especial",
  SIN_GOCE_SUELDO: "Sin goce de sueldo",
  ARTICULO: "Artículo",
  SUSPENSION: "Suspensión",
  ADSCRIPCION: "Adscripción",
};

const LIMITE_CARPETA_MEDICA = 10;

function diasCorridos(fechaInicio: Date, fechaFin: Date): number {
  return Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 86_400_000) + 1;
}

// Carpeta Médica (ausentismo corto) y Licencia Médica (ausentismo prolongado) se
// distinguen por días corridos (calendario), no días hábiles.
function validarDuracionMedica(tipo: TipoLicencia, fechaInicio: Date, fechaFin: Date) {
  const dias = diasCorridos(fechaInicio, fechaFin);
  if (tipo === "CARPETA_MEDICA" && dias > LIMITE_CARPETA_MEDICA) {
    throw new Error(
      `Una Carpeta Médica no puede superar los ${LIMITE_CARPETA_MEDICA} días corridos (este rango tiene ${dias}). Corresponde cargarla como Licencia Médica.`
    );
  }
  if (tipo === "MEDICA" && dias < LIMITE_CARPETA_MEDICA) {
    throw new Error(
      `Una Licencia Médica no puede ser de menos de ${LIMITE_CARPETA_MEDICA} días corridos (este rango tiene ${dias}). Corresponde cargarla como Carpeta Médica.`
    );
  }
}

async function verificarPermiso() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: {
      id: true,
      rol: true,
      nombre: true,
      apellido: true,
      agente: { select: { sectorId: true } },
    },
  });
  if (!current) throw new Error("Usuario no encontrado");

  const rolesPermitidos = ["SUPERADMIN", "ADMIN", "SUPERVISOR"];
  if (!rolesPermitidos.includes(current.rol)) {
    throw new Error("Sin permiso para gestionar licencias");
  }

  return current;
}

async function verificarSector(current: { rol: string; agente: { sectorId: string | null } | null }, agenteId: string) {
  // Admin y superadmin pueden gestionar cualquier agente
  if (["SUPERADMIN", "ADMIN"].includes(current.rol)) return;

  // Supervisor: solo su propio sector
  const sectorSupervisor = current.agente?.sectorId;
  if (!sectorSupervisor) throw new Error("El supervisor no tiene sector asignado");

  const agente = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: { sectorId: true },
  });
  if (!agente) throw new Error("Agente no encontrado");
  if (agente.sectorId !== sectorSupervisor) {
    throw new Error("Sin permiso para gestionar licencias de este agente");
  }
}

export async function crearLicencia(data: {
  agenteId: string;
  tipo: TipoLicencia;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string;
  observacion?: string;
}) {
  const current = await verificarPermiso();
  await verificarSector(current, data.agenteId);

  if (!TIPOS_LICENCIA_VALIDOS.includes(data.tipo)) throw new Error("Tipo de licencia inválido");

  const fechaInicio = new Date(data.fechaInicio);
  const fechaFin = new Date(data.fechaFin);
  if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) throw new Error("Fechas inválidas");
  if (fechaFin < fechaInicio) throw new Error("La fecha de fin no puede ser anterior a la de inicio");

  validarDuracionMedica(data.tipo, fechaInicio, fechaFin);

  const diasHabiles = diasCorridos(fechaInicio, fechaFin);

  const agente = await prisma.agente.findUnique({
    where: { id: data.agenteId },
    select: { usuarioId: true, nombres: true, apellidos: true },
  });
  if (!agente) throw new Error("Agente no encontrado");

  const licencia = await prisma.licencia.create({
    data: {
      agenteId: data.agenteId,
      tipo: data.tipo,
      estado: "APROBADA",
      fechaInicio,
      fechaFin,
      diasHabiles,
      motivo: data.motivo?.trim() || null,
      observacion: data.observacion?.trim() || null,
    },
  });

  // Notificar al agente si tiene usuario vinculado
  if (agente.usuarioId) {
    const tipoLabel = TIPO_LABELS[data.tipo];
    const inicio = fechaInicio.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const fin = fechaFin.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

    await prisma.notificacion.create({
      data: {
        usuarioId: agente.usuarioId,
        tipo: "LICENCIA_NUEVA",
        mensaje: `Se registró una licencia ${tipoLabel} del ${inicio} al ${fin} (${diasHabiles} ${diasHabiles === 1 ? "día" : "días"}).`,
        referenciaId: licencia.id,
      },
    });
  }

  revalidatePath(`/personal/${data.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

export async function actualizarLicencia(
  licenciaId: string,
  data: {
    tipo?: TipoLicencia;
    fechaInicio?: string;
    fechaFin?: string;
    motivo?: string;
    observacion?: string;
  }
) {
  const current = await verificarPermiso();

  const licencia = await prisma.licencia.findUnique({
    where: { id: licenciaId },
    select: { agenteId: true, tipo: true, fechaInicio: true, fechaFin: true, diasHabiles: true },
  });
  if (!licencia) throw new Error("Licencia no encontrada");

  await verificarSector(current, licencia.agenteId);

  const updateData: Record<string, unknown> = {};

  if (data.tipo) {
    if (!TIPOS_LICENCIA_VALIDOS.includes(data.tipo)) throw new Error("Tipo de licencia inválido");
    updateData.tipo = data.tipo;
  }

  const inicioFinal = data.fechaInicio ? new Date(data.fechaInicio) : licencia.fechaInicio;
  const finFinal = data.fechaFin ? new Date(data.fechaFin) : licencia.fechaFin;

  if (data.fechaInicio || data.fechaFin) {
    if (finFinal < inicioFinal) throw new Error("La fecha de fin no puede ser anterior a la de inicio");
    updateData.fechaInicio = inicioFinal;
    updateData.fechaFin = finFinal;
  }

  updateData.diasHabiles = diasCorridos(inicioFinal, finFinal);

  const tipoFinal = data.tipo ?? (licencia.tipo as TipoLicencia);
  validarDuracionMedica(tipoFinal, inicioFinal, finFinal);

  if (data.motivo !== undefined) updateData.motivo = data.motivo.trim() || null;
  if (data.observacion !== undefined) updateData.observacion = data.observacion.trim() || null;

  await prisma.licencia.update({ where: { id: licenciaId }, data: updateData });

  revalidatePath(`/personal/${licencia.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

export async function eliminarLicencia(licenciaId: string) {
  const current = await verificarPermiso();

  const licencia = await prisma.licencia.findUnique({
    where: { id: licenciaId },
    select: { agenteId: true },
  });
  if (!licencia) throw new Error("Licencia no encontrada");

  await verificarSector(current, licencia.agenteId);

  await prisma.licencia.delete({ where: { id: licenciaId } });

  revalidatePath(`/personal/${licencia.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}
