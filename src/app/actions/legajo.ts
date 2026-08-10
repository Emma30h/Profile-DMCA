"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";
import { enviarLegajoAprobado, enviarLegajoRechazado } from "@/lib/email";

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
  origenInstitucional: string;
  origenInstitucionalDetalle: string;
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

  const solicitudPendiente = await prisma.solicitudVinculacion.findFirst({
    where: { usuarioId: usuario.id, estado: "PENDIENTE" },
  });
  if (solicitudPendiente) {
    throw new Error("Tenés una solicitud de vinculación pendiente de aprobación. Esperá la revisión antes de cargar un legajo nuevo.");
  }

  // Validaciones
  const cuil = data.cuil.replace(/\D/g, "");
  if (cuil.length !== 11) throw new Error("El CUIL debe tener exactamente 11 dígitos");

  const existeCuil = await prisma.agente.findUnique({ where: { cuil } });
  if (existeCuil) throw new Error("Ya existe un legajo registrado con ese CUIL");

  const existeEmail = await prisma.agente.findUnique({ where: { email: user.email! } });
  if (existeEmail) throw new Error("Ya existe un legajo registrado con ese email. Probá vincularte por CUIL en vez de cargar uno nuevo.");

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
      origenInstitucional: str(data.origenInstitucional),
      origenInstitucionalDetalle: data.origenInstitucional === "OTRA_DEPENDENCIA"
        ? str(data.origenInstitucionalDetalle)
        : null,
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

  await invalidateAgentesCache();
  revalidatePath("/mi-legajo");
  revalidatePath("/personal");
  revalidatePath("/dashboard");

  return { agenteId: agente.id };
}

const MAX_INTENTOS_CUIL = 3;

// Vinculación por autoservicio: el usuario ya confirmó su email y ahora
// prueba emparentarse con un legajo cargado antes por otra vía (ej. Excel
// del formulario de Google) que todavía no tiene usuario asignado. Se limita
// la cantidad de intentos por cuenta para que no sirva como método de fuerza
// bruta contra el CUIL (dato derivable del DNI) de otra persona. El match no
// se aplica solo: queda como SolicitudVinculacion pendiente hasta que un
// admin la confirme (ver src/lib/vincularLegajoAuto.ts para el mismo
// criterio en el registro).
export async function vincularPorCuil(
  cuilInput: string
): Promise<{ pendiente: boolean; intentosRestantes: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true } } },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (usuario.agente) throw new Error("Ya tenés un legajo vinculado a tu cuenta");
  if (usuario.intentosCuil >= MAX_INTENTOS_CUIL) {
    throw new Error("Se agotaron los intentos para vincular por CUIL. Cargá tu legajo manualmente.");
  }

  const solicitudPendiente = await prisma.solicitudVinculacion.findFirst({
    where: { usuarioId: usuario.id, estado: "PENDIENTE" },
  });
  if (solicitudPendiente) {
    throw new Error("Ya tenés una solicitud de vinculación pendiente de aprobación.");
  }

  const cuil = cuilInput.replace(/\D/g, "");
  if (cuil.length !== 11) throw new Error("El CUIL debe tener exactamente 11 dígitos");

  const agente = await prisma.agente.findFirst({
    where: { cuil, usuarioId: null },
    select: { id: true, nombres: true, apellidos: true },
  });

  if (!agente) {
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentosCuil: { increment: 1 } },
    });
    revalidatePath("/mi-legajo");
    return { pendiente: false, intentosRestantes: Math.max(0, MAX_INTENTOS_CUIL - actualizado.intentosCuil) };
  }

  const solicitud = await prisma.solicitudVinculacion.create({
    data: { usuarioId: usuario.id, agenteId: agente.id, criterio: "CUIL" },
  });

  const admins = await prisma.usuario.findMany({
    where: { rol: { in: ROLES_ADMIN }, activo: true },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notificacion.createMany({
      data: admins.map((a) => ({
        usuarioId: a.id,
        tipo: "VINCULACION_PENDIENTE",
        mensaje: `${usuario.email} pidió vincularse por CUIL al legajo de ${agente.apellidos}, ${agente.nombres} — pendiente de tu confirmación.`,
        referenciaId: solicitud.id,
      })),
    });
  }

  revalidatePath("/mi-legajo");

  return { pendiente: true, intentosRestantes: MAX_INTENTOS_CUIL - usuario.intentosCuil };
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

  await invalidateAgentesCache();
  revalidatePath("/mi-legajo");
  revalidatePath("/perfil");
  revalidatePath("/personal");
  revalidatePath(`/personal/${agenteId}`);
}

// Saca la propia foto (equivalente self-service de eliminarFotoLegajoAdmin).
export async function eliminarFotoLegajo(agenteId: string): Promise<void> {
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
    data: { fotoUrl: null },
  });

  await supabase.storage
    .from("fotos-legajos")
    .remove([`${agenteId}/foto.jpg`, `${agenteId}/foto.png`, `${agenteId}/foto.webp`]);

  await invalidateAgentesCache();
  revalidatePath("/mi-legajo");
  revalidatePath("/perfil");
  revalidatePath("/personal");
  revalidatePath(`/personal/${agenteId}`);
}

// Variante para que un admin cargue/reemplace la foto de CUALQUIER legajo
// (a diferencia de actualizarFotoLegajo, que solo permite al propio agente
// tocar su foto). Se usa después de subir el archivo al storage desde el
// cliente, cuando el admin elige "subir archivo" en vez de pegar un link.
export async function actualizarFotoLegajoAdmin(agenteId: string, fotoUrl: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  await prisma.agente.update({
    where: { id: agenteId },
    data: { fotoUrl },
  });

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
}

// Saca la foto ya guardada en el legajo (ej. se subió a un agente equivocado).
export async function eliminarFotoLegajoAdmin(agenteId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  await prisma.agente.update({
    where: { id: agenteId },
    data: { fotoUrl: null },
  });

  await supabase.storage
    .from("fotos-legajos")
    .remove([`${agenteId}/foto.jpg`, `${agenteId}/foto.png`, `${agenteId}/foto.webp`]);

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
}

// Trae la imagen desde un link externo (ej. imgbox) y la guarda en el mismo
// bucket que usa el autoservicio, para no depender de que el admin baje y
// vuelva a subir el archivo a mano.
export async function subirFotoLegajoDesdeUrl(
  agenteId: string,
  urlOrigen: string,
  rotacionGrados = 0
): Promise<void> {
  if (![0, 90, 180, 270].includes(rotacionGrados)) {
    throw new Error("Rotación inválida");
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  let url: URL;
  try {
    url = new URL(urlOrigen);
  } catch {
    throw new Error("El link no es una URL válida");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("El link no es una URL válida");
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("No se pudo descargar la imagen desde el link");
  }
  if (!res.ok) throw new Error("No se pudo descargar la imagen desde el link");

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error("El link no apunta directamente a una imagen");

  let buffer: ArrayBuffer;
  try {
    buffer = await res.arrayBuffer();
  } catch {
    throw new Error("Se cortó la descarga de la imagen antes de terminar. Probá de nuevo.");
  }
  let datosFinales: ArrayBuffer | Buffer = buffer;
  let contentTypeFinal = contentType;

  if (rotacionGrados !== 0) {
    try {
      datosFinales = await sharp(Buffer.from(buffer)).rotate(rotacionGrados).jpeg({ quality: 90 }).toBuffer();
    } catch {
      throw new Error("No se pudo rotar la imagen. Probá subirla como archivo en su lugar.");
    }
    contentTypeFinal = "image/jpeg";
  }

  const ext = contentTypeFinal.includes("png") ? "png" : contentTypeFinal.includes("webp") ? "webp" : "jpg";
  const path = `${agenteId}/foto.${ext}`;

  const { error } = await supabase.storage
    .from("fotos-legajos")
    .upload(path, datosFinales, { contentType: contentTypeFinal, upsert: true });
  if (error) throw new Error(`No se pudo guardar la imagen en el storage: ${error.message}`);

  const { data } = supabase.storage.from("fotos-legajos").getPublicUrl(path);

  await prisma.agente.update({
    where: { id: agenteId },
    // Cache-busting: la URL pública es siempre la misma para este agente
    // (mismo path), así que sin un query param que cambie, el navegador/CDN
    // sigue sirviendo la versión vieja cacheada después de reemplazar la foto.
    data: { fotoUrl: `${data.publicUrl}?v=${Date.now()}` },
  });

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
}

export async function aprobarLegajo(agenteId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  const agente = await prisma.agente.update({
    where: { id: agenteId },
    data: { estado: "ACTIVO", motivoRechazo: null },
    include: { usuario: { select: { id: true, email: true } } },
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

    try {
      await enviarLegajoAprobado(agente.usuario.email, `${agente.apellidos}, ${agente.nombres}`);
    } catch {
      // No interrumpir el flujo si falla el email
    }
  }

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");
}

export async function rechazarLegajo(agenteId: string, motivo: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  if (!motivo.trim()) throw new Error("El motivo de rechazo es obligatorio");

  const agente = await prisma.agente.update({
    where: { id: agenteId },
    data: { estado: "PENDIENTE", motivoRechazo: motivo.trim() },
    include: { usuario: { select: { id: true, email: true } } },
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

    try {
      await enviarLegajoRechazado(agente.usuario.email, `${agente.apellidos}, ${agente.nombres}`, motivo.trim());
    } catch {
      // No interrumpir el flujo si falla el email
    }
  }

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
  revalidatePath("/dashboard");
}

// Deshace un rechazo cargado por error — a diferencia de aprobarLegajo, no
// activa el legajo (el admin puede no haberlo terminado de revisar), solo
// borra el motivo y lo deja como pendiente sin observaciones. No depende de
// que el agente haga nada.
export async function deshacerRechazoLegajo(agenteId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });
  if (!usuario || !usuario.activo || !ROLES_ADMIN.includes(usuario.rol)) throw new Error("Sin permiso");

  await prisma.agente.update({
    where: { id: agenteId },
    data: { motivoRechazo: null },
  });

  await invalidateAgentesCache();
  revalidatePath(`/personal/${agenteId}`);
  revalidatePath("/personal");
  revalidatePath("/mi-legajo");
}
