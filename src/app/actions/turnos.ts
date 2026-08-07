"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { GrupoTurno } from "@/types";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];
// Superior de Turno (20-8hs): Oficiales Jefes de menor grado — Subcomisario.
// Jefe de Fin de Semana: Oficiales Superiores — Comisario Inspector y Comisario
// Mayor (Comisario General queda afuera del grupo principal a propósito: existe
// en el escalafón pero nunca cubre este rol en la práctica; si hiciera falta,
// se elige igual desde la lista de excepciones).
const RANGOS_SUPERIOR_TURNO = ["Subcomisario"];
const RANGOS_JEFE_FIN_DE = ["Comisario Inspector", "Comisario Mayor"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");
  return usuario;
}

export interface DiaTurnoInfo {
  fecha: string; // YYYY-MM-DD
  grupoTurno: GrupoTurno | null;
  superiorTurno: { id: string; nombreCompleto: string } | null;
  jefeFinDe: { id: string; nombreCompleto: string } | null;
  observacion: string | null;
}

function toFechaKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

export interface TurnoHoyInfo {
  grupoTurno: GrupoTurno | null;
  superiorTurno: string | null;
  superiorTurnoRango: string | null;
  jefeFinDe: string | null;
  esFinDeSemana: boolean;
}

// El "fin de semana" del Jefe de Fin de Semana arranca el viernes, no solo sábado/domingo.
export async function obtenerTurnoHoy(): Promise<TurnoHoyInfo> {
  const hoy = hoyUTC();
  const dia = await prisma.diaTurno.findUnique({
    where: { fecha: hoy },
    include: {
      superiorTurno: { select: { nombres: true, apellidos: true, rango: { select: { nombre: true } } } },
      jefeFinDe: { select: { nombres: true, apellidos: true } },
    },
  });
  const diaSemana = hoy.getUTCDay();

  return {
    grupoTurno: (dia?.grupoTurno as GrupoTurno | null | undefined) ?? null,
    superiorTurno: dia?.superiorTurno ? `${dia.superiorTurno.apellidos}, ${dia.superiorTurno.nombres}` : null,
    superiorTurnoRango: dia?.superiorTurno?.rango?.nombre ?? null,
    jefeFinDe: dia?.jefeFinDe ? `${dia.jefeFinDe.apellidos}, ${dia.jefeFinDe.nombres}` : null,
    esFinDeSemana: diaSemana === 5 || diaSemana === 0 || diaSemana === 6,
  };
}

export async function obtenerMesTurno(anio: number, mes: number): Promise<DiaTurnoInfo[]> {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(anio, mes, 1));
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

  const registros = await prisma.diaTurno.findMany({
    where: { fecha: { gte: inicio, lt: fin } },
    include: {
      superiorTurno: { select: { id: true, nombres: true, apellidos: true } },
      jefeFinDe: { select: { id: true, nombres: true, apellidos: true } },
    },
  });

  const porFecha = new Map(registros.map((r) => [toFechaKey(r.fecha), r]));

  return Array.from({ length: diasEnMes }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1, i + 1));
    const clave = toFechaKey(fecha);
    const registro = porFecha.get(clave);
    return {
      fecha: clave,
      grupoTurno: (registro?.grupoTurno as GrupoTurno | null | undefined) ?? null,
      superiorTurno: registro?.superiorTurno
        ? { id: registro.superiorTurno.id, nombreCompleto: `${registro.superiorTurno.apellidos}, ${registro.superiorTurno.nombres}` }
        : null,
      jefeFinDe: registro?.jefeFinDe
        ? { id: registro.jefeFinDe.id, nombreCompleto: `${registro.jefeFinDe.apellidos}, ${registro.jefeFinDe.nombres}` }
        : null,
      observacion: registro?.observacion ?? null,
    };
  });
}

export interface AgenteElegible {
  id: string;
  nombreCompleto: string;
  rango: string;
}

export interface ElegiblesTurno {
  subcomisarios: AgenteElegible[];
  oficialesSuperiores: AgenteElegible[];
  // "Otros" por excepción (ej. Oficial Principal Nievas cubriendo fin de
  // semana pese a no tener el rango exigido) — dos listas porque cada rol
  // tiene su propio grado de referencia, ordenadas por cercanía de rango
  // (Rango.orden) al puesto en cuestión, no alfabéticamente, para que la
  // excepción más plausible aparezca primero en vez de perderse en la lista.
  otrosParaSuperiorTurno: AgenteElegible[];
  otrosParaJefeFinDe: AgenteElegible[];
}

export async function obtenerElegiblesTurno(): Promise<ElegiblesTurno> {
  const [agentes, rangos] = await Promise.all([
    prisma.agente.findMany({
      where: { estado: "ACTIVO", tipoPersonal: "SEGURIDAD", rangoId: { not: null } },
      select: { id: true, nombres: true, apellidos: true, rango: { select: { nombre: true, orden: true } } },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    }),
    prisma.rango.findMany({ select: { nombre: true, orden: true } }),
  ]);

  const ordenPorNombre = new Map(rangos.map((r) => [r.nombre, r.orden]));
  const ordenSuperiorTurno = ordenPorNombre.get(RANGOS_SUPERIOR_TURNO[0]) ?? 0;
  const ordenJefeFinDe = Math.min(...RANGOS_JEFE_FIN_DE.map((r) => ordenPorNombre.get(r) ?? Infinity));

  const subcomisarios: AgenteElegible[] = [];
  const oficialesSuperiores: AgenteElegible[] = [];
  const resto: (AgenteElegible & { orden: number })[] = [];

  for (const a of agentes) {
    const rangoNombre = a.rango?.nombre ?? "";
    const item = { id: a.id, nombreCompleto: `${a.apellidos}, ${a.nombres}`, rango: rangoNombre };
    if (RANGOS_SUPERIOR_TURNO.includes(rangoNombre)) {
      subcomisarios.push(item);
    } else if (RANGOS_JEFE_FIN_DE.includes(rangoNombre)) {
      oficialesSuperiores.push(item);
    } else {
      resto.push({ ...item, orden: a.rango?.orden ?? 0 });
    }
  }

  const otrosParaSuperiorTurno = [...resto]
    .sort((a, b) => Math.abs(a.orden - ordenSuperiorTurno) - Math.abs(b.orden - ordenSuperiorTurno))
    .map(({ id, nombreCompleto, rango }) => ({ id, nombreCompleto, rango }));
  const otrosParaJefeFinDe = [...resto]
    .sort((a, b) => Math.abs(a.orden - ordenJefeFinDe) - Math.abs(b.orden - ordenJefeFinDe))
    .map(({ id, nombreCompleto, rango }) => ({ id, nombreCompleto, rango }));

  return { subcomisarios, oficialesSuperiores, otrosParaSuperiorTurno, otrosParaJefeFinDe };
}

export async function generarMesAutomatico(params: {
  anio: number;
  mes: number;
  fechaAncla: string; // YYYY-MM-DD
  grupoEnAncla: GrupoTurno;
}): Promise<void> {
  await verificarAdmin();
  const { anio, mes, fechaAncla, grupoEnAncla } = params;

  const ancla = new Date(`${fechaAncla}T00:00:00.000Z`);
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const otroGrupo: GrupoTurno = grupoEnAncla === 1 ? 2 : 1;

  const existentes = await prisma.diaTurno.findMany({
    where: { fecha: { gte: new Date(Date.UTC(anio, mes - 1, 1)), lt: new Date(Date.UTC(anio, mes, 1)) } },
    select: { fecha: true, grupoTurno: true },
  });
  const grupoYaDefinido = new Set(
    existentes.filter((r) => r.grupoTurno !== null).map((r) => toFechaKey(r.fecha))
  );

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    const clave = toFechaKey(fecha);
    if (grupoYaDefinido.has(clave)) continue; // no pisar ediciones/excepciones manuales

    // Math.floor maneja bien diffDias negativo (meses antes del ancla): el
    // índice de bloque de 2 días avanza/retrocede de forma monótona y la
    // paridad par/impar sigue alternando el grupo correctamente.
    const diffDias = Math.floor((fecha.getTime() - ancla.getTime()) / (1000 * 60 * 60 * 24));
    const cicloPar = Math.floor(diffDias / 2) % 2 === 0;
    const grupo: GrupoTurno = cicloPar ? grupoEnAncla : otroGrupo;

    await prisma.diaTurno.upsert({
      where: { fecha },
      update: { grupoTurno: grupo },
      create: { fecha, grupoTurno: grupo },
    });
  }

  revalidatePath("/turnos");
}

export async function actualizarDiaTurno(params: {
  fecha: string; // YYYY-MM-DD
  campo: "grupoTurno" | "superiorTurnoId" | "jefeFinDeId" | "observacion";
  valor: string | null;
}): Promise<void> {
  await verificarAdmin();
  const { fecha, campo, valor } = params;
  const fechaDate = new Date(`${fecha}T00:00:00.000Z`);

  const data: Record<string, string | number | null> =
    campo === "grupoTurno" ? { grupoTurno: valor ? Number(valor) : null } : { [campo]: valor };

  await prisma.diaTurno.upsert({
    where: { fecha: fechaDate },
    update: data,
    create: { fecha: fechaDate, ...data },
  });

  revalidatePath("/turnos");
  revalidatePath("/dashboard");
  revalidatePath("/perfil");
}
