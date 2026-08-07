import { prisma } from "@/lib/prisma";

export interface CumpleanosHoy {
  id: string;
  nombreCompleto: string;
  area: string | null;
}

// Las fechas se guardan como medianoche UTC (misma convención que el resto
// de la app — ver fechaIngreso/fechaNacimiento en los legajos), por eso se
// compara mes/día con los getters UTC y no con los locales.
export async function obtenerCumpleanosHoy(): Promise<CumpleanosHoy[]> {
  const ahora = new Date();
  const hoyUTC = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
  const mesHoy = hoyUTC.getUTCMonth();
  const diaHoy = hoyUTC.getUTCDate();

  const agentes = await prisma.agente.findMany({
    where: { estado: "ACTIVO", fechaNacimiento: { not: null } },
    select: { id: true, nombres: true, apellidos: true, fechaNacimiento: true, sector: { select: { nombre: true } } },
  });

  return agentes
    .filter((a) => a.fechaNacimiento!.getUTCMonth() === mesHoy && a.fechaNacimiento!.getUTCDate() === diaHoy)
    .map((a) => ({
      id: a.id,
      nombreCompleto: `${a.apellidos}, ${a.nombres}`,
      area: a.sector?.nombre ?? null,
    }));
}
