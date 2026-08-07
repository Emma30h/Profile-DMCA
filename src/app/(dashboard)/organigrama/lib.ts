import { prisma } from "@/lib/prisma";
import type { CentroInfo, Persona, SectorNodo } from "./OrganigramaChart";

// El dataset es chico (6 sectores, un puñado de roles) y de bajo tráfico —no
// vale la pena cachear en Redis; eso solo suma un lugar más donde olvidarse
// de invalidar (como pasó con dashboard:stats). Se consulta directo.
export async function obtenerArbolOrganigrama(): Promise<{ centro: CentroInfo | null; sectores: SectorNodo[] }> {
  const sectores = await prisma.sector.findMany({
    include: {
      rolesOrganigrama: {
        orderBy: { orden: "asc" },
        include: {
          agente: {
            select: { nombres: true, apellidos: true, fotoUrl: true, sexo: true, rango: { select: { nombre: true } } },
          },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  function aRoster(roles: typeof sectores[number]["rolesOrganigrama"]): Persona[] {
    return roles.map((r) => ({
      orden: r.etiqueta,
      rango: r.agente ? (r.agente.rango?.nombre ?? "") : (r.rangoLibre ?? ""),
      nombre: r.agente ? `${r.agente.apellidos} ${r.agente.nombres}` : (r.nombreLibre ?? ""),
      licencia: r.licencia,
      fotoUrl: r.agente?.fotoUrl ?? null,
      sexo: r.agente?.sexo ?? null,
    }));
  }

  const direccion = sectores.find((s) => s.tipo === "DIRECCION");
  const centro: CentroInfo | null = direccion
    ? {
        id: direccion.id,
        titulo: direccion.nombre,
        jefe: aRoster(direccion.rolesOrganigrama)[0],
      }
    : null;

  const resto: SectorNodo[] = sectores
    .filter((s) => s.tipo !== "DIRECCION")
    .map((s) => ({
      id: s.id,
      parent: s.padreId ?? "",
      tipo: s.tipo === "DEPARTAMENTO" ? "dept" : "div",
      titulo: s.nombre,
      roster: aRoster(s.rolesOrganigrama),
    }));

  return { centro, sectores: resto };
}

export interface RolCrudo {
  id: string;
  orden: number;
  etiqueta: string;
  agenteId: string | null;
  rangoLibre: string | null;
  nombreLibre: string | null;
  licencia: boolean;
  agenteNombre: string | null; // "Apellido Nombre (Rango)" para mostrar, si está vinculado
}

export interface SectorConRoles {
  id: string;
  nombre: string;
  tipo: string;
  padreId: string | null;
  roles: RolCrudo[];
}

// Para el panel de edición: misma info que obtenerArbolOrganigrama, pero sin
// aplanar los roles a texto — se necesitan los ids/agenteId crudos para poder
// editarlos.
export async function obtenerSectoresConRoles(): Promise<SectorConRoles[]> {
  const sectores = await prisma.sector.findMany({
    include: {
      rolesOrganigrama: {
        orderBy: { orden: "asc" },
        include: { agente: { select: { nombres: true, apellidos: true, rango: { select: { nombre: true } } } } },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return sectores.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    tipo: s.tipo,
    padreId: s.padreId,
    roles: s.rolesOrganigrama.map((r) => ({
      id: r.id,
      orden: r.orden,
      etiqueta: r.etiqueta,
      agenteId: r.agenteId,
      rangoLibre: r.rangoLibre,
      nombreLibre: r.nombreLibre,
      licencia: r.licencia,
      agenteNombre: r.agente
        ? `${r.agente.apellidos} ${r.agente.nombres}${r.agente.rango ? ` (${r.agente.rango.nombre})` : ""}`
        : null,
    })),
  }));
}

export interface AgenteParaPicker {
  id: string;
  nombres: string;
  apellidos: string;
  rango: string | null;
}

export async function obtenerAgentesParaPicker(): Promise<AgenteParaPicker[]> {
  const agentes = await prisma.agente.findMany({
    select: { id: true, nombres: true, apellidos: true, rango: { select: { nombre: true } } },
    orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
  });
  return agentes.map((a) => ({ id: a.id, nombres: a.nombres, apellidos: a.apellidos, rango: a.rango?.nombre ?? null }));
}
