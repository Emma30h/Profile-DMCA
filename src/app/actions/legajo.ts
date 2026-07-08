"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

function str(v: string | undefined | null): string | null {
  if (!v) return null;
  return v.trim() === "" ? null : v.trim();
}

function fecha(v: string | undefined | null): Date | null {
  if (!v || v.trim() === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export interface DatosNuevoLegajo {
  // Personales
  apellidos: string;
  nombres: string;
  sexo: string;
  sexoPersonalizado: string;
  cuil: string;
  fechaNacimiento: string;
  estadoCivil: string;
  nacionalidad: string;
  provinciaOrigen: string;
  ciudadOrigen: string;
  // Contacto
  telefono: string;
  telefonoAlternativo: string;
  contactoEmergencia: string;
  domicilioReal: string;
  ciudad: string;
  barrio: string;
  nroDomicilio: string;
  piso: string;
  // Laboral
  turno: string;
  fechaIngreso: string;
  tipoPersonal: string;
  rangoId: string;
  anoEgreso: string;
  perteneceETAC: boolean;
  hijosCargo: number;
  poseeSepelio: boolean;
  empresaSepelio: string;
  // Médica
  grupoSanguineo: string;
  alergias: string;
  enfermedadesCronicas: string;
  medicamentos: string;
  cirugias: string;
  // Académica
  nivelPrimario: string;
  nivelSecundario: string;
  nivelTerciario: string;
  nivelUniversitario: string;
  nivelSuperior: string;
  detalleTitulos: string;
  // Licencia
  licenciaConducir: string;
  licenciaEmision: string;
  licenciaVencimiento: string;
  // Foto
  fotoUrl: string;
}

export async function crearLegajoPropio(data: DatosNuevoLegajo): Promise<{ agenteId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true } } },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (usuario.agente) throw new Error("Ya tenés un legajo vinculado a tu cuenta");

  // Validaciones
  const cuil = data.cuil.replace(/\D/g, "");
  if (cuil.length !== 11) throw new Error("El CUIL debe tener exactamente 11 dígitos");

  const existeCuil = await prisma.agente.findUnique({ where: { cuil } });
  if (existeCuil) throw new Error("Ya existe un legajo registrado con ese CUIL");

  if (!data.apellidos.trim()) throw new Error("El apellido es obligatorio");
  if (!data.nombres.trim()) throw new Error("El nombre es obligatorio");
  if (!data.tipoPersonal) throw new Error("El tipo de personal es obligatorio");

  const tieneJerarquia = data.tipoPersonal === "SEGURIDAD" || data.tipoPersonal === "TECNICO";
  const tieneLicencia = data.licenciaConducir && data.licenciaConducir !== "NO_POSEO_LICENCIA";

  const agente = await prisma.agente.create({
    data: {
      cuil,
      nombres: data.nombres.trim(),
      apellidos: data.apellidos.trim(),
      sexo: data.sexo || "PREFIERO_NO_DECIR",
      sexoPersonalizado: data.sexo === "OTRO" ? str(data.sexoPersonalizado) : null,
      fechaNacimiento: fecha(data.fechaNacimiento),
      estadoCivil: str(data.estadoCivil),
      nacionalidad: str(data.nacionalidad),
      provinciaOrigen: str(data.provinciaOrigen),
      ciudadOrigen: str(data.ciudadOrigen),
      email: user.email,
      telefono: str(data.telefono),
      telefonoAlternativo: str(data.telefonoAlternativo),
      contactoEmergencia: str(data.contactoEmergencia),
      domicilioReal: str(data.domicilioReal),
      ciudad: str(data.ciudad),
      barrio: str(data.barrio),
      nroDomicilio: str(data.nroDomicilio),
      piso: str(data.piso),
      hijosCargo: data.hijosCargo ?? 0,
      poseeSepelio: data.poseeSepelio ?? false,
      empresaSepelio: data.poseeSepelio ? str(data.empresaSepelio) : null,
      turno: str(data.turno),
      fechaIngreso: fecha(data.fechaIngreso),
      tipoPersonal: data.tipoPersonal,
      estado: "PENDIENTE",
      rangoId: tieneJerarquia ? str(data.rangoId) : null,
      anoEgreso: tieneJerarquia && data.anoEgreso
        ? new Date(parseInt(data.anoEgreso), 0, 1)
        : null,
      perteneceETAC: tieneJerarquia ? data.perteneceETAC : null,
      grupoSanguineo: str(data.grupoSanguineo),
      alergias: str(data.alergias),
      enfermedadesCronicas: str(data.enfermedadesCronicas),
      medicamentos: str(data.medicamentos),
      cirugias: str(data.cirugias),
      nivelPrimario: str(data.nivelPrimario),
      nivelSecundario: str(data.nivelSecundario),
      nivelTerciario: str(data.nivelTerciario),
      nivelUniversitario: str(data.nivelUniversitario),
      nivelSuperior: str(data.nivelSuperior),
      detalleTitulos: str(data.detalleTitulos),
      licenciaConducir: str(data.licenciaConducir),
      licenciaEmision: tieneLicencia ? fecha(data.licenciaEmision) : null,
      licenciaVencimiento: tieneLicencia ? fecha(data.licenciaVencimiento) : null,
      fotoUrl: str(data.fotoUrl),
      usuarioId: usuario.id,
    },
  });

  // Notificar a todos los admins
  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ADMIN }, activo: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    await prisma.notificacion.createMany({
      data: admins.map((a) => ({
        usuarioId: a.id,
        tipo: "LEGAJO_NUEVO",
        mensaje: `${data.apellidos.trim()}, ${data.nombres.trim()} cargó su legajo y requiere validación.`,
        referenciaId: agente.id,
      })),
    });
  }

  revalidatePath("/mi-legajo");
  revalidatePath("/personal");

  return { agenteId: agente.id };
}

export async function actualizarFotoLegajo(agenteId: string, fotoUrl: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true } } },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (usuario.agente?.id !== agenteId) throw new Error("Sin permiso");

  await prisma.agente.update({
    where: { id: agenteId },
    data: { fotoUrl },
  });

  revalidatePath("/mi-legajo");
  revalidatePath(`/personal/${agenteId}`);
}

export async function aprobarLegajo(agenteId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  const agente = await prisma.agente.update({
    where: { id: agenteId },
    data: { estado: "ACTIVO", motivoRechazo: null },
    include: { usuario: { select: { id: true } } },
  });

  if (agente.usuario?.id) {
    await prisma.notificacion.create({
      data: {
        usuarioId: agente.usuario.id,
        tipo: "LEGAJO_APROBADO",
        mensaje: "Tu legajo fue aprobado. Ya podés acceder a todos tus datos.",
        referenciaId: agenteId,
      },
    });
  }

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
}

export async function rechazarLegajo(agenteId: string, motivo: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  if (!motivo.trim()) throw new Error("El motivo de rechazo es obligatorio");

  const agente = await prisma.agente.update({
    where: { id: agenteId },
    data: { estado: "PENDIENTE", motivoRechazo: motivo.trim() },
    include: { usuario: { select: { id: true } } },
  });

  if (agente.usuario?.id) {
    await prisma.notificacion.create({
      data: {
        usuarioId: agente.usuario.id,
        tipo: "LEGAJO_RECHAZADO",
        mensaje: `Tu legajo fue observado. Motivo: ${motivo.trim()}`,
        referenciaId: agenteId,
      },
    });
  }

  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
}
