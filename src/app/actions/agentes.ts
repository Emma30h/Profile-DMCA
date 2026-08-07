"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

/**
 * Verifica que el usuario puede editar el agente indicado.
 * - Admin/Superadmin: puede editar cualquier agente.
 * - Otros roles: solo pueden editar su propio agente y deben tener
 *   una SolicitudEdicion aprobada y vigente.
 */
async function verificarPermiso(agenteId: string): Promise<{ usuarioId: string; usuarioNombre: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: {
      id: true, rol: true, nombre: true, apellido: true,
      agente: { select: { id: true } },
    },
  });
  if (!current) throw new Error("Usuario no encontrado");

  const nombreDisplay =
    [current.nombre, current.apellido].filter(Boolean).join(" ") || user.email!;

  if (ROLES_ADMIN.includes(current.rol)) {
    return { usuarioId: current.id, usuarioNombre: nombreDisplay };
  }

  // No-admin: debe ser su propio agente
  if (!current.agente || current.agente.id !== agenteId) {
    throw new Error("Sin permiso para editar este legajo");
  }

  // Si el legajo está PENDIENTE, puede editar libremente sin solicitud
  const agente = await prisma.agente.findUnique({ where: { id: agenteId }, select: { estado: true } });
  if (agente?.estado === "PENDIENTE") {
    return { usuarioId: current.id, usuarioNombre: nombreDisplay };
  }

  // Si no, debe tener un permiso temporal activo
  const solicitud = await prisma.solicitudEdicion.findFirst({
    where: {
      usuarioId: current.id,
      estado: "APROBADA",
      permisoHasta: { gt: new Date() },
    },
  });
  if (!solicitud) throw new Error("Tu permiso de edición venció o no está activo");

  return { usuarioId: current.id, usuarioNombre: nombreDisplay };
}

async function notificarAdminsSiPendiente(agenteId: string, nombreAgente: string) {
  const agente = await prisma.agente.findUnique({ where: { id: agenteId }, select: { estado: true } });
  if (agente?.estado !== "PENDIENTE") return;
  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ["SUPERADMIN", "ADMIN"] }, activo: true },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notificacion.createMany({
    data: admins.map((a) => ({
      usuarioId: a.id,
      tipo: "LEGAJO_NUEVO",
      mensaje: `${nombreAgente} actualizó su legajo pendiente de validación.`,
      referenciaId: agenteId,
    })),
  });
}

function str(v: string): string | null {
  return v.trim() === "" ? null : v.trim();
}

function fecha(v: string): Date | null {
  if (!v || v.trim() === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

type Cambio = { campo: string; anterior: string; nuevo: string };

function diffS(label: string, anterior: string | null, nuevo: string | null, acc: Cambio[]) {
  const a = anterior?.trim() ?? "";
  const n = nuevo?.trim() ?? "";
  if (a !== n) acc.push({ campo: label, anterior: a || "—", nuevo: n || "—" });
}

function diffB(label: string, anterior: boolean | null | undefined, nuevo: boolean, acc: Cambio[]) {
  const a = anterior == null ? "" : anterior ? "Sí" : "No";
  const n = nuevo ? "Sí" : "No";
  if (a !== n) acc.push({ campo: label, anterior: a || "—", nuevo: n });
}

function diffN(label: string, anterior: number, nuevo: number, acc: Cambio[]) {
  if (anterior !== nuevo) acc.push({ campo: label, anterior: String(anterior), nuevo: String(nuevo) });
}

function diffD(label: string, anterior: Date | null, nuevoStr: string, acc: Cambio[]) {
  const a = anterior ? anterior.toISOString().split("T")[0] : "";
  const n = nuevoStr.trim();
  if (a !== n) acc.push({ campo: label, anterior: a || "—", nuevo: n || "—" });
}

// ─── Datos personales ─────────────────────────────────────────────────────────

export interface DatosPersonales {
  nombres: string;
  apellidos: string;
  estadoCivil: string;
  nacionalidad: string;
  provinciaOrigen: string;
  ciudadOrigen: string;
  grupoSanguineo: string;
  alergias: string;
  enfermedadesCronicas: string;
  medicamentos: string;
  cirugias: string;
  email: string;
  telefono: string;
  telefonoAlternativo: string;
  contactoEmergencia: string;
  domicilioReal: string;
  ciudad: string;
  barrio: string;
  nroDomicilio: string;
  piso: string;
  hijosCargo: number;
  poseeSepelio: boolean;
  empresaSepelio: string;
}

export async function actualizarAgentePersonal(
  agenteId: string,
  data: DatosPersonales
) {
  const { usuarioId, usuarioNombre } = await verificarPermiso(agenteId);

  if (!data.nombres.trim()) throw new Error("El nombre es obligatorio");
  if (!data.apellidos.trim()) throw new Error("El apellido es obligatorio");

  const anterior = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: {
      nombres: true, apellidos: true,
      estadoCivil: true, nacionalidad: true, provinciaOrigen: true, ciudadOrigen: true,
      grupoSanguineo: true, alergias: true, enfermedadesCronicas: true, medicamentos: true,
      cirugias: true, email: true, telefono: true, telefonoAlternativo: true,
      contactoEmergencia: true, domicilioReal: true, ciudad: true, barrio: true,
      nroDomicilio: true, piso: true, hijosCargo: true, poseeSepelio: true, empresaSepelio: true,
    },
  });

  await prisma.agente.update({
    where: { id: agenteId },
    data: {
      nombres: data.nombres.trim(),
      apellidos: data.apellidos.trim(),
      estadoCivil: str(data.estadoCivil),
      nacionalidad: str(data.nacionalidad),
      provinciaOrigen: str(data.provinciaOrigen),
      ciudadOrigen: str(data.ciudadOrigen),
      grupoSanguineo: str(data.grupoSanguineo),
      alergias: str(data.alergias),
      enfermedadesCronicas: str(data.enfermedadesCronicas),
      medicamentos: str(data.medicamentos),
      cirugias: str(data.cirugias),
      email: str(data.email),
      telefono: str(data.telefono),
      telefonoAlternativo: str(data.telefonoAlternativo),
      contactoEmergencia: str(data.contactoEmergencia),
      domicilioReal: str(data.domicilioReal),
      ciudad: str(data.ciudad),
      barrio: str(data.barrio),
      nroDomicilio: str(data.nroDomicilio),
      piso: str(data.piso),
      hijosCargo: data.hijosCargo,
      poseeSepelio: data.poseeSepelio,
      empresaSepelio: str(data.empresaSepelio),
    },
  });

  if (anterior) {
    const cambios: Cambio[] = [];
    diffS("Nombres", anterior.nombres, data.nombres.trim(), cambios);
    diffS("Apellidos", anterior.apellidos, data.apellidos.trim(), cambios);
    diffS("Estado civil", anterior.estadoCivil, str(data.estadoCivil), cambios);
    diffS("Nacionalidad", anterior.nacionalidad, str(data.nacionalidad), cambios);
    diffS("Provincia de origen", anterior.provinciaOrigen, str(data.provinciaOrigen), cambios);
    diffS("Ciudad de origen", anterior.ciudadOrigen, str(data.ciudadOrigen), cambios);
    diffS("Grupo sanguíneo", anterior.grupoSanguineo, str(data.grupoSanguineo), cambios);
    diffS("Alergias", anterior.alergias, str(data.alergias), cambios);
    diffS("Enfermedades crónicas", anterior.enfermedadesCronicas, str(data.enfermedadesCronicas), cambios);
    diffS("Medicamentos", anterior.medicamentos, str(data.medicamentos), cambios);
    diffS("Cirugías", anterior.cirugias, str(data.cirugias), cambios);
    diffS("Email", anterior.email, str(data.email), cambios);
    diffS("Teléfono", anterior.telefono, str(data.telefono), cambios);
    diffS("Teléfono alternativo", anterior.telefonoAlternativo, str(data.telefonoAlternativo), cambios);
    diffS("Contacto de emergencia", anterior.contactoEmergencia, str(data.contactoEmergencia), cambios);
    diffS("Domicilio real", anterior.domicilioReal, str(data.domicilioReal), cambios);
    diffS("Ciudad", anterior.ciudad, str(data.ciudad), cambios);
    diffS("Barrio", anterior.barrio, str(data.barrio), cambios);
    diffS("Número de domicilio", anterior.nroDomicilio, str(data.nroDomicilio), cambios);
    diffS("Piso", anterior.piso, str(data.piso), cambios);
    diffN("Hijos a cargo", anterior.hijosCargo, data.hijosCargo, cambios);
    diffB("Posee sepelio", anterior.poseeSepelio, data.poseeSepelio, cambios);
    diffS("Empresa de sepelio", anterior.empresaSepelio, str(data.empresaSepelio), cambios);

    if (cambios.length > 0) {
      await prisma.auditLog.create({
        data: { agenteId, usuarioId, usuarioNombre, seccion: "PERSONAL", cambios: JSON.stringify(cambios) },
      });
    }
  }

  await notificarAdminsSiPendiente(agenteId, usuarioNombre);
  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");
}

// ─── Datos laborales ──────────────────────────────────────────────────────────

export interface DatosLaborales {
  turno: string;
  sectorId: string;
  rangoId: string;
  perteneceETAC: boolean;
  origenInstitucional: string;
  origenInstitucionalDetalle: string;
  tipoArma: string;
  marcaPistola: string;
  modeloPistola: string;
  calibre: string;
  chalecoProvisto: boolean;
  marcaChaleco: string;
  nroSeriePlacas: string;
  talleChaleco: string;
  vencimientoChaleco: string;
  enTNO: boolean;
  motivoTNO: string;
  fechaInicioTNO: string;
  licenciaConducir: string;
  licenciaEmision: string;
  licenciaVencimiento: string;
  nivelPrimario: string;
  nivelSecundario: string;
  nivelTerciario: string;
  nivelUniversitario: string;
  nivelSuperior: string;
  detalleTitulos: string;
}

export async function actualizarAgenteLaboral(
  agenteId: string,
  data: DatosLaborales
) {
  const { usuarioId, usuarioNombre } = await verificarPermiso(agenteId);

  const agenteActual = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: {
      tipoPersonal: true, estado: true, turno: true,
      sectorId: true, sector: { select: { nombre: true } },
      rangoId: true, rango: { select: { nombre: true } },
      perteneceETAC: true, origenInstitucional: true, origenInstitucionalDetalle: true,
      tipoArma: true, marcaPistola: true, modeloPistola: true,
      calibre: true, chalecoProvisto: true, marcaChaleco: true, nroSeriePlacas: true,
      talleChaleco: true, vencimientoChaleco: true,
      enTNO: true, motivoTNO: true, fechaInicioTNO: true,
      licenciaConducir: true,
      licenciaEmision: true, licenciaVencimiento: true, nivelPrimario: true,
      nivelSecundario: true, nivelTerciario: true, nivelUniversitario: true,
      nivelSuperior: true, detalleTitulos: true,
    },
  });

  const esSeguridad = agenteActual?.tipoPersonal === "SEGURIDAD";
  const tieneRango = esSeguridad || agenteActual?.tipoPersonal === "TECNICO";

  // Fetch nombres de sector/rango nuevos para el diff
  const nuevoSectorId = str(data.sectorId);
  const nuevoRangoId = tieneRango ? str(data.rangoId) : null;
  const [nuevoSector, nuevoRango] = await Promise.all([
    nuevoSectorId ? prisma.sector.findUnique({ where: { id: nuevoSectorId }, select: { nombre: true } }) : null,
    nuevoRangoId ? prisma.rango.findUnique({ where: { id: nuevoRangoId }, select: { nombre: true } }) : null,
  ]);

  await prisma.agente.update({
    where: { id: agenteId },
    data: {
      turno: str(data.turno),
      sectorId: str(data.sectorId),
      rangoId: tieneRango ? str(data.rangoId) : undefined,
      perteneceETAC: tieneRango ? data.perteneceETAC : null,
      origenInstitucional: str(data.origenInstitucional),
      origenInstitucionalDetalle: data.origenInstitucional === "OTRA_DEPENDENCIA"
        ? str(data.origenInstitucionalDetalle)
        : null,
      tipoArma: esSeguridad ? str(data.tipoArma) : null,
      marcaPistola: esSeguridad ? str(data.marcaPistola) : null,
      modeloPistola: esSeguridad ? str(data.modeloPistola) : null,
      calibre: esSeguridad ? str(data.calibre) : null,
      chalecoProvisto: esSeguridad ? data.chalecoProvisto : null,
      marcaChaleco: esSeguridad ? str(data.marcaChaleco) : null,
      nroSeriePlacas: esSeguridad ? str(data.nroSeriePlacas) : null,
      talleChaleco: esSeguridad ? str(data.talleChaleco) : null,
      vencimientoChaleco: esSeguridad ? fecha(data.vencimientoChaleco) : null,
      enTNO: esSeguridad ? data.enTNO : null,
      motivoTNO: esSeguridad && data.enTNO ? str(data.motivoTNO) : null,
      fechaInicioTNO: esSeguridad && data.enTNO ? fecha(data.fechaInicioTNO) : null,
      licenciaConducir: str(data.licenciaConducir),
      licenciaEmision: fecha(data.licenciaEmision),
      licenciaVencimiento: fecha(data.licenciaVencimiento),
      nivelPrimario: str(data.nivelPrimario),
      nivelSecundario: str(data.nivelSecundario),
      nivelTerciario: str(data.nivelTerciario),
      nivelUniversitario: str(data.nivelUniversitario),
      nivelSuperior: str(data.nivelSuperior),
      detalleTitulos: str(data.detalleTitulos),
    },
  });

  if (agenteActual) {
    const cambios: Cambio[] = [];

    diffS("Turno", agenteActual.turno, str(data.turno), cambios);

    const sectorAnterior = agenteActual.sector?.nombre ?? "";
    const sectorNuevo = nuevoSector?.nombre ?? "";
    if (sectorAnterior !== sectorNuevo) {
      cambios.push({ campo: "Sector", anterior: sectorAnterior || "—", nuevo: sectorNuevo || "—" });
    }

    if (tieneRango) {
      const rangoAnterior = agenteActual.rango?.nombre ?? "";
      const rangoNuevo = nuevoRango?.nombre ?? "";
      if (rangoAnterior !== rangoNuevo) {
        cambios.push({ campo: "Jerarquía / Rango", anterior: rangoAnterior || "—", nuevo: rangoNuevo || "—" });
      }
      diffB("Perteneció al E.T.A.C.", agenteActual.perteneceETAC, data.perteneceETAC, cambios);
    }

    const nuevoOrigenInstitucional = str(data.origenInstitucional);
    diffS("Origen institucional", agenteActual.origenInstitucional, nuevoOrigenInstitucional, cambios);
    if (nuevoOrigenInstitucional === "OTRA_DEPENDENCIA") {
      diffS("Dependencia de origen", agenteActual.origenInstitucionalDetalle, str(data.origenInstitucionalDetalle), cambios);
    }

    if (esSeguridad) {
      diffS("Tipo de arma", agenteActual.tipoArma, str(data.tipoArma), cambios);
      diffS("Marca de pistola", agenteActual.marcaPistola, str(data.marcaPistola), cambios);
      diffS("Modelo de pistola", agenteActual.modeloPistola, str(data.modeloPistola), cambios);
      diffS("Calibre", agenteActual.calibre, str(data.calibre), cambios);
      diffB("Chaleco provisto", agenteActual.chalecoProvisto, data.chalecoProvisto, cambios);
      diffS("Marca de chaleco", agenteActual.marcaChaleco, str(data.marcaChaleco), cambios);
      diffS("N° de serie / Placas", agenteActual.nroSeriePlacas, str(data.nroSeriePlacas), cambios);
      diffS("Talle de chaleco", agenteActual.talleChaleco, str(data.talleChaleco), cambios);
      diffD("Vencimiento del chaleco", agenteActual.vencimientoChaleco, data.vencimientoChaleco, cambios);
      diffB("Tarea No Operativa (TNO)", agenteActual.enTNO, data.enTNO, cambios);
      if (data.enTNO) {
        diffS("Motivo de TNO", agenteActual.motivoTNO, str(data.motivoTNO), cambios);
        diffD("Inicio de TNO", agenteActual.fechaInicioTNO, data.fechaInicioTNO, cambios);
      }
    }

    diffS("Licencia de conducir", agenteActual.licenciaConducir, str(data.licenciaConducir), cambios);
    diffD("Emisión de licencia", agenteActual.licenciaEmision, data.licenciaEmision, cambios);
    diffD("Vencimiento de licencia", agenteActual.licenciaVencimiento, data.licenciaVencimiento, cambios);
    diffS("Nivel primario", agenteActual.nivelPrimario, str(data.nivelPrimario), cambios);
    diffS("Nivel secundario", agenteActual.nivelSecundario, str(data.nivelSecundario), cambios);
    diffS("Nivel terciario", agenteActual.nivelTerciario, str(data.nivelTerciario), cambios);
    diffS("Nivel universitario", agenteActual.nivelUniversitario, str(data.nivelUniversitario), cambios);
    diffS("Nivel superior", agenteActual.nivelSuperior, str(data.nivelSuperior), cambios);
    diffS("Detalle de títulos", agenteActual.detalleTitulos, str(data.detalleTitulos), cambios);

    if (cambios.length > 0) {
      await prisma.auditLog.create({
        data: { agenteId, usuarioId, usuarioNombre, seccion: "LABORAL", cambios: JSON.stringify(cambios) },
      });
    }
  }

  await notificarAdminsSiPendiente(agenteId, usuarioNombre);
  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");
}

// ─── Condición de ascenso (solo Seguridad/Técnico, solo ADMIN/SUPERADMIN) ─────

async function verificarAdmin(): Promise<{ usuarioId: string; usuarioNombre: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, rol: true, nombre: true, apellido: true },
  });
  if (!current) throw new Error("Usuario no encontrado");
  if (!ROLES_ADMIN.includes(current.rol)) throw new Error("Sin permiso");

  return {
    usuarioId: current.id,
    usuarioNombre: [current.nombre, current.apellido].filter(Boolean).join(" ") || user.email!,
  };
}

function verificarTieneRango(tipoPersonal: string) {
  if (tipoPersonal !== "SEGURIDAD" && tipoPersonal !== "TECNICO") {
    throw new Error("Solo Seguridad y Técnico pueden estar en condición de ascenso");
  }
}

export async function marcarEnCursoAscenso(agenteId: string): Promise<void> {
  await verificarAdmin();

  const agente = await prisma.agente.findUnique({ where: { id: agenteId }, select: { tipoPersonal: true } });
  if (!agente) throw new Error("Agente no encontrado");
  verificarTieneRango(agente.tipoPersonal);

  await prisma.agente.update({
    where: { id: agenteId },
    data: { fechaInicioCursoAscenso: new Date() },
  });

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
}

export async function cancelarCursoAscenso(agenteId: string): Promise<void> {
  await verificarAdmin();

  await prisma.agente.update({
    where: { id: agenteId },
    data: { fechaInicioCursoAscenso: null },
  });

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
}

export async function confirmarAscenso(agenteId: string): Promise<void> {
  const { usuarioId, usuarioNombre } = await verificarAdmin();

  const agente = await prisma.agente.findUnique({
    where: { id: agenteId },
    select: {
      tipoPersonal: true,
      fechaInicioCursoAscenso: true,
      rango: { select: { id: true, nombre: true, cuerpo: true, orden: true } },
    },
  });
  if (!agente) throw new Error("Agente no encontrado");
  verificarTieneRango(agente.tipoPersonal);
  if (!agente.fechaInicioCursoAscenso) throw new Error("El agente no está en curso de ascenso");
  if (!agente.rango) throw new Error("El agente no tiene un rango cargado");

  const siguienteRango = await prisma.rango.findFirst({
    where: { cuerpo: agente.rango.cuerpo, orden: { gt: agente.rango.orden } },
    orderBy: { orden: "asc" },
  });
  if (!siguienteRango) throw new Error("Ya está en el rango más alto de su cuerpo");

  const ahora = new Date();

  await prisma.$transaction([
    prisma.agente.update({
      where: { id: agenteId },
      data: { rangoId: siguienteRango.id, fechaInicioCursoAscenso: null },
    }),
    // Cierra cualquier tramo de rango que hubiera quedado abierto (no debería
    // haber más de uno) antes de abrir el del rango nuevo.
    prisma.historialRango.updateMany({
      where: { agenteId, fechaHasta: null },
      data: { fechaHasta: ahora },
    }),
    prisma.historialRango.create({
      data: { agenteId, rangoId: siguienteRango.id, fechaDesde: ahora },
    }),
    prisma.auditLog.create({
      data: {
        agenteId,
        usuarioId,
        usuarioNombre,
        seccion: "LABORAL",
        cambios: JSON.stringify([
          { campo: "Jerarquía / Rango", anterior: agente.rango.nombre, nuevo: siguienteRango.nombre },
        ]),
      },
    }),
  ]);

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/dashboard");
}
