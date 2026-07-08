"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { TipoLicenciaPendiente, UnidadDias } from "@/types";

const TIPOS_VALIDOS: TipoLicenciaPendiente[] = ["ANUAL_ORDINARIA", "DIA_ESTIMULO", "OTRO"];
const UNIDADES_VALIDAS: UnidadDias[] = ["HABILES", "CORRIDOS"];

const TIPO_LABELS: Record<TipoLicenciaPendiente, string> = {
  ANUAL_ORDINARIA: "Anual Ordinaria",
  DIA_ESTIMULO: "Día Estímulo",
  OTRO: "Otro",
};

async function verificarPermiso() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: {
      id: true,
      rol: true,
      agente: { select: { sectorId: true } },
    },
  });
  if (!current) throw new Error("Usuario no encontrado");

  const rolesPermitidos = ["SUPERADMIN", "ADMIN", "SUPERVISOR"];
  if (!rolesPermitidos.includes(current.rol)) {
    throw new Error("Sin permiso para gestionar licencias pendientes");
  }

  return current;
}

async function verificarSector(
  current: { rol: string; agente: { sectorId: string | null } | null },
  agenteId: string
) {
  if (["SUPERADMIN", "ADMIN"].includes(current.rol)) return;

  const sectorSupervisor = current.agente?.sectorId;
  if (!sectorSupervisor) throw new Error("El supervisor no tiene sector asignado");

  const agente = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: { sectorId: true },
  });
  if (!agente) throw new Error("Agente no encontrado");
  if (agente.sectorId !== sectorSupervisor) {
    throw new Error("Sin permiso para gestionar licencias pendientes de este agente");
  }
}

function validarDatos(data: {
  tipo: TipoLicenciaPendiente;
  tipoOtroDetalle?: string;
  unidad: UnidadDias;
  anio: number;
  cantidadDias: number;
}) {
  if (!TIPOS_VALIDOS.includes(data.tipo)) throw new Error("Tipo inválido");
  if (!UNIDADES_VALIDAS.includes(data.unidad)) throw new Error("Unidad inválida");
  if (data.tipo === "OTRO" && !data.tipoOtroDetalle?.trim()) {
    throw new Error("Aclará de qué tipo se trata cuando elegís 'Otro'");
  }
  if (!Number.isInteger(data.anio) || data.anio < 2000 || data.anio > new Date().getFullYear() + 1) {
    throw new Error("Año inválido");
  }
  if (!Number.isInteger(data.cantidadDias) || data.cantidadDias <= 0) {
    throw new Error("La cantidad de días debe ser mayor a 0");
  }
}

export async function crearLicenciaPendiente(data: {
  agenteId: string;
  tipo: TipoLicenciaPendiente;
  tipoOtroDetalle?: string;
  unidad: UnidadDias;
  anio: number;
  cantidadDias: number;
  referencia?: string;
}) {
  const current = await verificarPermiso();
  await verificarSector(current, data.agenteId);

  validarDatos(data);

  const agente = await prisma.agente.findUnique({
    where: { id: data.agenteId },
    select: { usuarioId: true },
  });
  if (!agente) throw new Error("Agente no encontrado");

  const pendiente = await prisma.licenciaPendiente.create({
    data: {
      agenteId: data.agenteId,
      tipo: data.tipo,
      tipoOtroDetalle: data.tipo === "OTRO" ? data.tipoOtroDetalle!.trim() : null,
      unidad: data.unidad,
      anio: data.anio,
      cantidadDias: data.cantidadDias,
      referencia: data.referencia?.trim() || null,
    },
  });

  if (agente.usuarioId) {
    const tipoLabel = TIPO_LABELS[data.tipo];
    const esHabiles = data.unidad === "HABILES";
    const unidadLabel =
      data.cantidadDias === 1
        ? (esHabiles ? "día hábil" : "día corrido")
        : (esHabiles ? "días hábiles" : "días corridos");

    await prisma.notificacion.create({
      data: {
        usuarioId: agente.usuarioId,
        tipo: "LICENCIA_PENDIENTE_NUEVA",
        mensaje: `Se registró un saldo pendiente ${tipoLabel} de ${data.cantidadDias} ${unidadLabel} (${data.anio}).`,
        referenciaId: pendiente.id,
      },
    });
  }

  revalidatePath(`/personal/${data.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

export async function actualizarLicenciaPendiente(
  licenciaPendienteId: string,
  data: {
    tipo?: TipoLicenciaPendiente;
    tipoOtroDetalle?: string;
    unidad?: UnidadDias;
    anio?: number;
    cantidadDias?: number;
    referencia?: string;
  }
) {
  const current = await verificarPermiso();

  const existente = await prisma.licenciaPendiente.findUnique({
    where: { id: licenciaPendienteId },
    select: { agenteId: true, tipo: true, tipoOtroDetalle: true, unidad: true, anio: true, cantidadDias: true },
  });
  if (!existente) throw new Error("Registro no encontrado");

  await verificarSector(current, existente.agenteId);

  const final = {
    tipo: (data.tipo ?? existente.tipo) as TipoLicenciaPendiente,
    tipoOtroDetalle: data.tipoOtroDetalle ?? existente.tipoOtroDetalle ?? undefined,
    unidad: (data.unidad ?? existente.unidad) as UnidadDias,
    anio: data.anio ?? existente.anio,
    cantidadDias: data.cantidadDias ?? existente.cantidadDias,
  };
  validarDatos(final);

  await prisma.licenciaPendiente.update({
    where: { id: licenciaPendienteId },
    data: {
      tipo: final.tipo,
      tipoOtroDetalle: final.tipo === "OTRO" ? final.tipoOtroDetalle!.trim() : null,
      unidad: final.unidad,
      anio: final.anio,
      cantidadDias: final.cantidadDias,
      ...(data.referencia !== undefined ? { referencia: data.referencia.trim() || null } : {}),
    },
  });

  revalidatePath(`/personal/${existente.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

export async function eliminarLicenciaPendiente(licenciaPendienteId: string) {
  const current = await verificarPermiso();

  const existente = await prisma.licenciaPendiente.findUnique({
    where: { id: licenciaPendienteId },
    select: { agenteId: true },
  });
  if (!existente) throw new Error("Registro no encontrado");

  await verificarSector(current, existente.agenteId);

  await prisma.licenciaPendiente.delete({ where: { id: licenciaPendienteId } });

  revalidatePath(`/personal/${existente.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

async function verificarSectorPorUso(current: { rol: string; agente: { sectorId: string | null } | null }, usoId: string) {
  const uso = await prisma.usoLicenciaPendiente.findUnique({
    where: { id: usoId },
    select: { licenciaPendiente: { select: { agenteId: true } } },
  });
  if (!uso) throw new Error("Uso no encontrado");
  await verificarSector(current, uso.licenciaPendiente.agenteId);
  return uso;
}

export async function registrarUso(
  licenciaPendienteId: string,
  data: { fecha: string; cantidadDias: number; referencia?: string }
) {
  const current = await verificarPermiso();

  const pendiente = await prisma.licenciaPendiente.findUnique({
    where: { id: licenciaPendienteId },
    select: { agenteId: true, cantidadDias: true, usos: { select: { cantidadDias: true } } },
  });
  if (!pendiente) throw new Error("Registro no encontrado");

  await verificarSector(current, pendiente.agenteId);

  const fecha = new Date(data.fecha);
  if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");
  if (!Number.isInteger(data.cantidadDias) || data.cantidadDias <= 0) {
    throw new Error("La cantidad de días usados debe ser mayor a 0");
  }

  const yaUsado = pendiente.usos.reduce((acc, u) => acc + u.cantidadDias, 0);
  const restante = pendiente.cantidadDias - yaUsado;
  if (data.cantidadDias > restante) {
    const singular = restante === 1;
    throw new Error(`Solo qued${singular ? "a" : "an"} ${restante} día${singular ? "" : "s"} disponible${singular ? "" : "s"} en este saldo`);
  }

  await prisma.usoLicenciaPendiente.create({
    data: {
      licenciaPendienteId,
      fecha,
      cantidadDias: data.cantidadDias,
      referencia: data.referencia?.trim() || null,
    },
  });

  revalidatePath(`/personal/${pendiente.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}

export async function eliminarUso(usoId: string) {
  const current = await verificarPermiso();
  const uso = await verificarSectorPorUso(current, usoId);

  await prisma.usoLicenciaPendiente.delete({ where: { id: usoId } });

  revalidatePath(`/personal/${uso.licenciaPendiente.agenteId}`);
  revalidatePath("/licencias");
  revalidatePath("/mi-legajo");
}
