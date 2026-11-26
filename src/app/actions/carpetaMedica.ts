"use server";

import { revalidatePath } from "next/cache";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { enviarCarpetaMedica } from "@/lib/email";
import { cuilToDni } from "@/lib/personalLabels";
import {
  armarTextoCarpetaMedica,
  asuntoCarpetaMedica,
  esEmailValido,
  esTipoAvisoMedico,
  BUCKET_CERTIFICADOS,
  CLAVE_CONFIG_DESTINATARIO,
  DESTINATARIO_CARPETA_MEDICA_DEFAULT,
  DIAS_RETENCION_CERTIFICADO,
} from "@/lib/carpetaMedica";

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_BYTES_CERTIFICADO = 3 * 1024 * 1024;

function adminStorage() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  }).storage;
}

async function usuarioActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, rol: true, nombre: true, apellido: true, agente: { select: { sectorId: true } } },
  });
  if (!current) throw new Error("Usuario no encontrado");
  if (!["SUPERADMIN", "ADMIN", "SUPERVISOR"].includes(current.rol)) {
    throw new Error("Sin permiso para enviar carpetas médicas");
  }
  return current;
}

async function destinatarioPredeterminado(): Promise<string> {
  const cfg = await prisma.configuracionApp.findUnique({ where: { clave: CLAVE_CONFIG_DESTINATARIO } });
  return cfg?.valor ?? DESTINATARIO_CARPETA_MEDICA_DEFAULT;
}

// El bucket es privado y se crea solo la primera vez que se usa.
async function asegurarBucket() {
  const storage = adminStorage();
  const { error } = await storage.getBucket(BUCKET_CERTIFICADOS);
  if (error) {
    const { error: errCrear } = await storage.createBucket(BUCKET_CERTIFICADOS, { public: false });
    if (errCrear && !/already exists/i.test(errCrear.message)) {
      throw new Error(`No se pudo crear el bucket de certificados: ${errCrear.message}`);
    }
  }
  return storage;
}

/** Borra del bucket los certificados con más de DIAS_RETENCION_CERTIFICADO
 *  días y deja el registro del envío sin imagen. Se llama en cada apertura del
 *  modal y en cada envío, así no hace falta un cron aparte. */
async function limpiarCertificadosVencidos(): Promise<void> {
  const vencidos = await prisma.envioCarpetaMedica.findMany({
    where: { certificadoPath: { not: null }, certificadoExpiraEn: { lt: new Date() } },
    select: { id: true, certificadoPath: true },
  });
  if (vencidos.length === 0) return;
  const { error } = await adminStorage()
    .from(BUCKET_CERTIFICADOS)
    .remove(vencidos.map((v) => v.certificadoPath!));
  if (error) {
    console.error("[limpiarCertificadosVencidos]", error.message);
    return;
  }
  await prisma.envioCarpetaMedica.updateMany({
    where: { id: { in: vencidos.map((v) => v.id) } },
    data: { certificadoPath: null },
  });
}

async function cargarLicenciaCivil(licenciaId: string, current: Awaited<ReturnType<typeof usuarioActual>>) {
  const licencia = await prisma.licencia.findUnique({
    where: { id: licenciaId },
    select: {
      id: true,
      tipo: true,
      agenteId: true,
      agente: { select: { nombres: true, apellidos: true, cuil: true, tipoPersonal: true, sectorId: true } },
    },
  });
  if (!licencia) throw new Error("Licencia no encontrada");
  if (!esTipoAvisoMedico(licencia.tipo)) {
    throw new Error("Solo se envían por mail las Carpetas Médicas y las Licencias Médicas");
  }
  if (licencia.agente.tipoPersonal !== "CIVIL_BECARIO") {
    throw new Error("El aviso por mail aplica solo a Civiles Becarios (Ministerio de Seguridad)");
  }
  if (current.rol === "SUPERVISOR" && licencia.agente.sectorId !== current.agente?.sectorId) {
    throw new Error("Sin permiso para gestionar licencias de este agente");
  }
  return { ...licencia, tipo: licencia.tipo };
}

export async function obtenerConfigCarpetaMedica(): Promise<
  Resultado<{ destinatario: string; puedeCambiarPredeterminado: boolean }>
> {
  try {
    const current = await usuarioActual();
    await limpiarCertificadosVencidos().catch((e) => console.error("[limpiarCertificadosVencidos]", e));
    return {
      ok: true,
      destinatario: await destinatarioPredeterminado(),
      puedeCambiarPredeterminado: ["SUPERADMIN", "ADMIN"].includes(current.rol),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cargar la configuración" };
  }
}

/** Recibe un FormData con: licenciaId, destinatario, guardarPredeterminado
 *  ("1"), turno, fecha (dd/mm/aaaa), hora (HH:mm), diagnostico, doctor,
 *  matricula, reposo y opcionalmente certificado (imagen). */
export async function enviarCarpetaMedicaMail(fd: FormData): Promise<Resultado> {
  try {
    const current = await usuarioActual();
    const campo = (k: string) => String(fd.get(k) ?? "").trim();

    const licencia = await cargarLicenciaCivil(campo("licenciaId"), current);

    const destinatario = campo("destinatario");
    if (!esEmailValido(destinatario)) throw new Error("La dirección de mail del destinatario no es válida");

    const datos = {
      tipo: licencia.tipo,
      turno: campo("turno"),
      fecha: campo("fecha"),
      hora: campo("hora"),
      apellidos: licencia.agente.apellidos,
      nombres: licencia.agente.nombres,
      dni: cuilToDni(licencia.agente.cuil),
      diagnostico: campo("diagnostico"),
      doctor: campo("doctor"),
      matricula: campo("matricula"),
      reposo: campo("reposo"),
    };
    const faltantes = (["turno", "fecha", "hora", "diagnostico", "doctor", "matricula", "reposo"] as const)
      .filter((k) => !datos[k]);
    if (faltantes.length > 0) throw new Error(`Faltan completar: ${faltantes.join(", ")}`);

    const fechaMatch = datos.fecha.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const horaMatch = datos.hora.match(/^(\d{2}):(\d{2})$/);
    if (!fechaMatch || !horaMatch) throw new Error("Fecha u hora con formato inválido");
    // Hora de Córdoba (UTC-3, sin horario de verano).
    const fechaHora = new Date(
      `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}T${horaMatch[1]}:${horaMatch[2]}:00-03:00`
    );

    await limpiarCertificadosVencidos().catch((e) => console.error("[limpiarCertificadosVencidos]", e));

    // Certificado: se sube al bucket privado (vence a los 7 días) y se adjunta al mail.
    let certificadoPath: string | null = null;
    let adjunto: { nombre: string; base64: string } | undefined;
    const archivo = fd.get("certificado");
    if (archivo instanceof File && archivo.size > 0) {
      if (!archivo.type.startsWith("image/")) throw new Error("El certificado tiene que ser una imagen");
      if (archivo.size > MAX_BYTES_CERTIFICADO) throw new Error("La imagen del certificado supera los 3 MB");
      const buffer = Buffer.from(await archivo.arrayBuffer());
      const ext = archivo.type.includes("png") ? "png" : archivo.type.includes("webp") ? "webp" : "jpg";
      certificadoPath = `${licencia.agenteId}/${licencia.id}-${Date.now()}.${ext}`;
      const storage = await asegurarBucket();
      const { error } = await storage
        .from(BUCKET_CERTIFICADOS)
        .upload(certificadoPath, buffer, { contentType: archivo.type, upsert: false });
      if (error) throw new Error(`No se pudo guardar el certificado: ${error.message}`);
      const nombreArchivo = `Certificado ${datos.apellidos} ${datos.nombres} ${datos.fecha.replace(/\//g, "-")}.${ext}`;
      adjunto = { nombre: nombreArchivo, base64: buffer.toString("base64") };
    }

    try {
      await enviarCarpetaMedica(destinatario, asuntoCarpetaMedica(datos), armarTextoCarpetaMedica(datos), adjunto);
    } catch (e) {
      // Si el mail no salió, no dejamos la imagen huérfana en el bucket.
      if (certificadoPath) await adminStorage().from(BUCKET_CERTIFICADOS).remove([certificadoPath]);
      console.error("[enviarCarpetaMedicaMail]", e);
      throw new Error("No se pudo enviar el mail. Revisá la dirección e intentá de nuevo.");
    }

    await prisma.envioCarpetaMedica.create({
      data: {
        licenciaId: licencia.id,
        destinatario,
        turno: datos.turno,
        fechaHora,
        diagnostico: datos.diagnostico,
        doctor: datos.doctor,
        matricula: datos.matricula,
        reposo: datos.reposo,
        certificadoPath,
        certificadoExpiraEn: certificadoPath
          ? new Date(Date.now() + DIAS_RETENCION_CERTIFICADO * 86_400_000)
          : null,
        enviadoPor: [current.nombre, current.apellido].filter(Boolean).join(" ") || null,
      },
    });

    if (fd.get("guardarPredeterminado") === "1" && ["SUPERADMIN", "ADMIN"].includes(current.rol)) {
      await prisma.configuracionApp.upsert({
        where: { clave: CLAVE_CONFIG_DESTINATARIO },
        create: { clave: CLAVE_CONFIG_DESTINATARIO, valor: destinatario },
        update: { valor: destinatario },
      });
    }

    revalidatePath(`/personal/${licencia.agenteId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al enviar la carpeta médica" };
  }
}

/** URL firmada (10 min) para ver el certificado mientras no venció. */
export async function verCertificadoCarpetaMedica(envioId: string): Promise<Resultado<{ url: string }>> {
  try {
    const current = await usuarioActual();
    const envio = await prisma.envioCarpetaMedica.findUnique({
      where: { id: envioId },
      select: { licenciaId: true, certificadoPath: true, certificadoExpiraEn: true },
    });
    if (!envio) throw new Error("Envío no encontrado");
    await cargarLicenciaCivil(envio.licenciaId, current);
    if (!envio.certificadoPath || (envio.certificadoExpiraEn && envio.certificadoExpiraEn < new Date())) {
      throw new Error(`El certificado ya no está disponible (se conserva ${DIAS_RETENCION_CERTIFICADO} días)`);
    }
    const { data, error } = await adminStorage()
      .from(BUCKET_CERTIFICADOS)
      .createSignedUrl(envio.certificadoPath, 600);
    if (error || !data) throw new Error("No se pudo abrir el certificado");
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al abrir el certificado" };
  }
}
