"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_LICENCIA, TIPO_LICENCIA_LABELS, type TipoLicencia, type ResultadoAccion } from "@/types";

const TIPOS_LICENCIA_VALIDOS = TIPOS_LICENCIA;
const TIPO_LABELS = TIPO_LICENCIA_LABELS;

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

// Sanción: solo personal con estado policial (Seguridad y Técnico) puede ser
// sancionado — Control de Conducta no aplica a Civil Becario/Civil Policial.
async function validarTipoSegunAgente(tipo: TipoLicencia, agenteId: string) {
  if (tipo !== "SANCION") return;
  const agente = await prisma.agente.findUnique({ where: { id: agenteId }, select: { tipoPersonal: true } });
  if (!agente) throw new Error("Agente no encontrado");
  if (agente.tipoPersonal !== "SEGURIDAD" && agente.tipoPersonal !== "TECNICO") {
    throw new Error("La categoría Sanción solo aplica a personal con estado policial (Seguridad o Técnico)");
  }
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
}): Promise<ResultadoAccion> {
  try {
    const current = await verificarPermiso();
    await verificarSector(current, data.agenteId);

    if (!TIPOS_LICENCIA_VALIDOS.includes(data.tipo)) throw new Error("Tipo de licencia inválido");

    const fechaInicio = new Date(data.fechaInicio);
    const fechaFin = new Date(data.fechaFin);
    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) throw new Error("Fechas inválidas");
    if (fechaFin < fechaInicio) throw new Error("La fecha de fin no puede ser anterior a la de inicio");

    validarDuracionMedica(data.tipo, fechaInicio, fechaFin);
    await validarTipoSegunAgente(data.tipo, data.agenteId);

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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la licencia" };
  }
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
): Promise<ResultadoAccion> {
  try {
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
      await validarTipoSegunAgente(data.tipo, licencia.agenteId);
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar la licencia" };
  }
}

// Usado por la vista previa de exportación de /licencias: da el `orden`
// jerárquico real (ver Rango en prisma/schema.prisma) para poder ordenar de
// mayor a menor rango cuando esa columna está en la exportación — el nombre
// del rango solo (que sí trae obtenerDatosNomina) no alcanza para eso, ya
// que el orden alfabético no coincide con el jerárquico.
export async function obtenerRangosAgentes(
  agenteIds: string[]
): Promise<Record<string, { nombre: string; orden: number } | null>> {
  await verificarPermiso();
  if (agenteIds.length === 0) return {};

  const agentes = await prisma.agente.findMany({
    where: { id: { in: agenteIds } },
    select: { id: true, rango: { select: { nombre: true, orden: true } } },
  });
  return Object.fromEntries(agentes.map((a) => [a.id, a.rango]));
}

export async function eliminarLicencia(licenciaId: string): Promise<ResultadoAccion> {
  try {
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar la licencia" };
  }
}
