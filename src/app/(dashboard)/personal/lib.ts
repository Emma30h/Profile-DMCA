import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getOrSet, CACHE_TTL } from "@/lib/redis";
import type { TipoPersonal, EstadoAgente } from "@/types";
import { TIPOS_PERSONAL, ESTADOS_AGENTE } from "@/types";

const MAX_RESULTADOS = 300;

export interface FiltrosPersonalParams {
  q?: string;
  tipo?: string;
  estado?: string;
  turno?: string;
  sector?: string;
}

export interface AgenteResumen {
  id: string;
  cuil: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: string;
  estado: string;
  turno: string | null;
  fotoUrl: string | null;
  rango: { nombre: string } | null;
  sector: { nombre: string } | null;
}

// Los campos con selección múltiple viajan en la URL como listas separadas
// por coma (ver buildQueryString más abajo y FiltrosPersonal.tsx).
function parseLista(valor?: string): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

export async function getAgentesResumen(
  params: FiltrosPersonalParams
): Promise<{ agentes: AgenteResumen[]; total: number }> {
  const qDigits = params.q ? params.q.replace(/\D/g, "") : "";

  const tipos = parseLista(params.tipo).filter((t): t is TipoPersonal => TIPOS_PERSONAL.includes(t as TipoPersonal));
  const estados = parseLista(params.estado).filter((e): e is EstadoAgente => ESTADOS_AGENTE.includes(e as EstadoAgente));
  const turnos = parseLista(params.turno);
  const sectorIds = parseLista(params.sector);

  const where = {
    ...(params.q && {
      OR: [
        { nombres: { contains: params.q, mode: "insensitive" as const } },
        { apellidos: { contains: params.q, mode: "insensitive" as const } },
        ...(qDigits ? [{ cuil: { contains: qDigits } }] : []),
      ],
    }),
    ...(tipos.length > 0 && { tipoPersonal: { in: tipos } }),
    ...(estados.length > 0 && { estado: { in: estados } }),
    ...(turnos.length > 0 && { turno: { in: turnos } }),
    ...(sectorIds.length > 0 && { sectorId: { in: sectorIds } }),
  };

  const cacheKey = `agentes:resumen:${crypto
    .createHash("md5")
    .update(JSON.stringify(where))
    .digest("hex")}`;

  return getOrSet(cacheKey, CACHE_TTL.OPERATIVO, async () => {
    const [agentes, total] = await Promise.all([
      prisma.agente.findMany({
        where,
        select: {
          id: true,
          cuil: true,
          nombres: true,
          apellidos: true,
          tipoPersonal: true,
          estado: true,
          turno: true,
          fotoUrl: true,
          rango: { select: { nombre: true } },
          sector: { select: { nombre: true } },
        },
        orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
        take: MAX_RESULTADOS,
      }),
      prisma.agente.count({ where }),
    ]);
    return { agentes, total };
  });
}

// Turnos rotativos agrupados primero, luego los especiales (en vez de orden alfabético,
// que intercala "ADMINISTRATIVO" entre "A" y "B").
const ORDEN_TURNOS = ["A", "B", "C", "D", "E", "F", "ADMINISTRATIVO", "FULL TIME", "GUARDIA LARGA", "SUPERIOR DE TURNO"];

function compararTurnos(a: string, b: string): number {
  const ia = ORDEN_TURNOS.indexOf(a);
  const ib = ORDEN_TURNOS.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export async function getOpcionesFiltro(): Promise<{
  sectores: { id: string; nombre: string }[];
  turnos: string[];
}> {
  const [sectores, turnos] = await Promise.all([
    prisma.sector.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.turno.findMany({
      select: { nombre: true },
    }),
  ]);
  return { sectores, turnos: turnos.map((t) => t.nombre).sort(compararTurnos) };
}

/** Deriva el DNI a partir del CUIL (formato XX-DNI(8)-X). */
export function cuilToDni(cuil: string): string {
  const digits = cuil.replace(/\D/g, "");
  if (digits.length !== 11) return digits;
  const dniConCeros = digits.slice(2, 10);
  return dniConCeros.replace(/^0+/, "") || dniConCeros;
}

export function buildQueryString(params: FiltrosPersonalParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.estado) qs.set("estado", params.estado);
  if (params.turno) qs.set("turno", params.turno);
  if (params.sector) qs.set("sector", params.sector);
  return qs.toString();
}
