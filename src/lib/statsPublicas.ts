import { prisma } from "@/lib/prisma";
import type { StatsPublicas } from "@/components/landing/PadronStats";

// Las 4 cifras del panel "padrón" que se muestran sin sesión (landing pública
// y panel de marca de Acceso) — antes vivían duplicadas como las mismas dos
// queries en (auth)/login/page.tsx. Turnos y tipos de personal son catálogos
// fijos (ver Agente.turno / enum TipoPersonal en el schema), no una cuenta en
// vivo — igual que ya se documentaba en login/page.tsx.
export async function obtenerStatsPublicas(): Promise<StatsPublicas> {
  const [agentes, rangos] = await Promise.all([
    prisma.agente.count(),
    prisma.rango.count(),
  ]);

  return {
    agentes,
    turnos: 10,
    tipos: 4,
    rangos,
  };
}
