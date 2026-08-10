"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { invalidateAgentesCache } from "@/lib/redis";
import { parseArchivo, mapearFila, type DatosImportLegajo, type FilaImportOk, type FilaImportError } from "@/lib/importLegajos";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

async function verificarAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true },
  });
  if (!current || !current.activo || !ROLES_ADMIN.includes(current.rol)) throw new Error("Sin permiso");
}

function str(v: string | undefined | null): string | null {
  if (!v) return null;
  return v.trim() === "" ? null : v.trim();
}

function fecha(v: string | undefined | null): Date | null {
  if (!v || v.trim() === "") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export interface PrevisualizacionImport {
  nuevos: FilaImportOk[];
  errores: FilaImportError[];
}

const MAX_TAMANO_BYTES = 10 * 1024 * 1024; // 10 MB

export async function previsualizarImportacion(formData: FormData): Promise<PrevisualizacionImport> {
  await verificarAdmin();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) throw new Error("No se recibió ningún archivo");
  if (archivo.size > MAX_TAMANO_BYTES) throw new Error("El archivo supera los 10 MB");

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const filas = await parseArchivo(buffer, archivo.name);

  const [rangos, cuilsExistentes, emailsExistentes] = await Promise.all([
    prisma.rango.findMany({ select: { id: true, nombre: true } }),
    prisma.agente.findMany({ select: { cuil: true } }),
    prisma.agente.findMany({ where: { email: { not: null } }, select: { email: true } }),
  ]);

  const rangosPorNombre = new Map(rangos.map((r) => [r.nombre.toUpperCase(), r.id]));
  const cuilsSet = new Set(cuilsExistentes.map((a) => a.cuil));
  const emailsSet = new Set(emailsExistentes.map((a) => a.email!.toLowerCase()));

  const nuevos: FilaImportOk[] = [];
  const errores: FilaImportError[] = [];

  filas.forEach((row, i) => {
    const resultado = mapearFila(row, i + 2, rangosPorNombre, emailsSet);
    if (!resultado) return; // fila vacía, se ignora
    if (!resultado.ok) {
      errores.push(resultado);
      return;
    }
    // Los CUIL que ya existen en la app se ignoran en silencio (no se listan)
    if (cuilsSet.has(resultado.datos.cuil)) return;
    nuevos.push(resultado);
  });

  return { nuevos, errores };
}

export interface ResultadoImport {
  creados: number;
  fallidos: { cuil: string; motivo: string }[];
}

export async function confirmarImportacion(filas: DatosImportLegajo[]): Promise<ResultadoImport> {
  await verificarAdmin();

  const fallidos: { cuil: string; motivo: string }[] = [];
  let creados = 0;

  for (const data of filas) {
    try {
      const cuil = data.cuil.replace(/\D/g, "");
      if (cuil.length !== 11) throw new Error("CUIL inválido");

      const existe = await prisma.agente.findUnique({ where: { cuil }, select: { id: true } });
      if (existe) continue; // ya se creó en otra corrida, se salta en silencio

      const tieneJerarquia = data.tipoPersonal === "SEGURIDAD" || data.tipoPersonal === "TECNICO";
      const tieneLicencia = data.licenciaConducir && data.licenciaConducir !== "NO_POSEO_LICENCIA";

      await prisma.agente.create({
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
          email: str(data.email),
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
          anoEgreso: tieneJerarquia && data.anoEgreso ? new Date(parseInt(data.anoEgreso), 0, 1) : null,
          perteneceETAC: tieneJerarquia ? data.perteneceETAC : null,
          origenInstitucional: str(data.origenInstitucional),
          origenInstitucionalDetalle: data.origenInstitucional === "OTRA_DEPENDENCIA" ? str(data.origenInstitucionalDetalle) : null,
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
          usuarioId: null,
        },
      });
      creados++;
    } catch (e) {
      fallidos.push({ cuil: data.cuil, motivo: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  if (creados > 0) {
    await invalidateAgentesCache();
    revalidatePath("/personal");
    revalidatePath("/dashboard");
    revalidatePath("/configuracion/importar-legajos");
  }

  return { creados, fallidos };
}
