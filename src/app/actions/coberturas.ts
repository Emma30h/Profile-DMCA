"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ZONAS_CORDOBA_CAPITAL } from "@/lib/coberturaZonas";
import { semanaActualCordoba } from "@/lib/semanaCordoba";
import type { ResultadoAccion } from "@/types";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];
// Directores/Jefes de Departamento cubriendo otra dependencia: Subcomisario y
// superior (Rango.orden 13 en adelante, ver prisma/seed.ts). Por debajo de
// ese umbral es personal habilitado para lineales.
const UMBRAL_JEFATURA = 13;

export type TipoCobertura = "JEFATURA" | "LINEAL";

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
  return usuario;
}

export interface CoberturaTurnoInfo {
  id: string;
  fecha: string; // YYYY-MM-DD
  horarioDesde: string;
  horarioHasta: string;
  agente: { id: string; nombreCompleto: string; rango: string | null } | null;
  nombreManual: string | null;
  lugar: string;
  zona: string | null;
  telefono: string | null;
  observacion: string | null;
}

const AGENTE_COBERTURA_SELECT = {
  id: true,
  nombres: true,
  apellidos: true,
  rango: { select: { nombre: true } },
} as const;

function mapearCobertura(r: {
  id: string;
  fecha: Date;
  horarioDesde: string;
  horarioHasta: string;
  agente: { id: string; nombres: string; apellidos: string; rango: { nombre: string } | null } | null;
  nombreManual: string | null;
  lugar: string;
  zona: string | null;
  telefono: string | null;
  observacion: string | null;
}): CoberturaTurnoInfo {
  return {
    id: r.id,
    fecha: r.fecha.toISOString().slice(0, 10),
    horarioDesde: r.horarioDesde,
    horarioHasta: r.horarioHasta,
    agente: r.agente
      ? { id: r.agente.id, nombreCompleto: `${r.agente.apellidos}, ${r.agente.nombres}`, rango: r.agente.rango?.nombre ?? null }
      : null,
    nombreManual: r.nombreManual,
    lugar: r.lugar,
    zona: r.zona,
    telefono: r.telefono,
    observacion: r.observacion,
  };
}

export async function obtenerCoberturas(tipo: TipoCobertura, anio: number, mes: number): Promise<CoberturaTurnoInfo[]> {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));

  const registros = await prisma.coberturaTurno.findMany({
    where: { tipo, fecha: { gte: inicio, lt: fin } },
    include: { agente: { select: AGENTE_COBERTURA_SELECT } },
    orderBy: [{ fecha: "asc" }, { horarioDesde: "asc" }],
  });

  return registros.map(mapearCobertura);
}

export interface CoberturasSemana {
  hoy: string; // YYYY-MM-DD
  desde: string; // YYYY-MM-DD, lunes
  hasta: string; // YYYY-MM-DD, domingo
  jefaturas: CoberturaTurnoInfo[];
  lineales: CoberturaTurnoInfo[];
}

export async function obtenerCoberturasSemana(): Promise<CoberturasSemana> {
  const { hoy, lunes, domingo, finExclusivo } = semanaActualCordoba();

  const registros = await prisma.coberturaTurno.findMany({
    where: { fecha: { gte: lunes, lt: finExclusivo } },
    include: { agente: { select: AGENTE_COBERTURA_SELECT } },
    orderBy: [{ fecha: "asc" }, { horarioDesde: "asc" }],
  });

  return {
    hoy: hoy.toISOString().slice(0, 10),
    desde: lunes.toISOString().slice(0, 10),
    hasta: domingo.toISOString().slice(0, 10),
    jefaturas: registros.filter((r) => r.tipo === "JEFATURA").map(mapearCobertura),
    lineales: registros.filter((r) => r.tipo === "LINEAL").map(mapearCobertura),
  };
}

interface DatosCobertura {
  fecha: string; // YYYY-MM-DD
  horarioDesde: string;
  horarioHasta: string;
  agenteId?: string;
  nombreManual?: string | null;
  lugar: string;
  zona?: string;
  telefono?: string;
  observacion?: string;
}

function normalizar(data: DatosCobertura) {
  const agenteId = data.agenteId?.trim() || null;
  const nombreManual = agenteId ? null : data.nombreManual?.trim() || null;
  if (!agenteId && !nombreManual) throw new Error("Elegí un agente o cargá un nombre");

  const lugar = data.lugar.trim();
  if (!lugar) throw new Error("El lugar es obligatorio");

  const zona = data.zona?.trim() || null;
  if (zona && !ZONAS_CORDOBA_CAPITAL.includes(zona as (typeof ZONAS_CORDOBA_CAPITAL)[number])) {
    throw new Error("Zona inválida");
  }

  const fecha = new Date(`${data.fecha}T00:00:00.000Z`);
  if (isNaN(fecha.getTime())) throw new Error("Fecha inválida");

  if (!data.horarioDesde || !data.horarioHasta) throw new Error("El horario es obligatorio");

  return {
    fecha,
    horarioDesde: data.horarioDesde,
    horarioHasta: data.horarioHasta,
    agenteId,
    nombreManual,
    lugar,
    zona,
    telefono: data.telefono?.trim() || null,
    observacion: data.observacion?.trim() || null,
  };
}

export async function crearCobertura(data: DatosCobertura & { tipo: TipoCobertura }): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    const normalizado = normalizar(data);

    await prisma.coberturaTurno.create({
      data: { tipo: data.tipo, ...normalizado },
    });

    revalidatePath("/turnos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al crear la cobertura" };
  }
}

export async function actualizarCobertura(id: string, data: DatosCobertura): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    const normalizado = normalizar(data);

    await prisma.coberturaTurno.update({
      where: { id },
      data: normalizado,
    });

    revalidatePath("/turnos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar la cobertura" };
  }
}

export async function eliminarCobertura(id: string): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    await prisma.coberturaTurno.delete({ where: { id } });
    revalidatePath("/turnos");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar la cobertura" };
  }
}

export interface AgenteElegibleCobertura {
  id: string;
  nombreCompleto: string;
  rango: string;
}

export interface ElegiblesCobertura {
  jefaturas: AgenteElegibleCobertura[];
  lineales: AgenteElegibleCobertura[];
}

export async function obtenerElegiblesCobertura(): Promise<ElegiblesCobertura> {
  const agentes = await prisma.agente.findMany({
    where: { estado: "ACTIVO", tipoPersonal: "SEGURIDAD", rangoId: { not: null } },
    select: { id: true, nombres: true, apellidos: true, rango: { select: { nombre: true, orden: true } } },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
  });

  const jefaturas: AgenteElegibleCobertura[] = [];
  const lineales: AgenteElegibleCobertura[] = [];
  for (const a of agentes) {
    const item = { id: a.id, nombreCompleto: `${a.apellidos}, ${a.nombres}`, rango: a.rango?.nombre ?? "" };
    if ((a.rango?.orden ?? 0) >= UMBRAL_JEFATURA) jefaturas.push(item);
    else lineales.push(item);
  }
  return { jefaturas, lineales };
}
