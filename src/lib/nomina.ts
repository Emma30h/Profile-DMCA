import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types";
import {
  TIPO_LABEL, ESTADO_LABEL, SEXO_LABEL, ORIGEN_LABEL, fmt, cuilToDni,
  CAMPOS_NOMINA_META,
} from "@/lib/personalLabels";

// Única fuente de verdad de qué campos escalares se traen — CAMPOS_NOMINA
// (más abajo) está tipado contra el resultado de este select, así que un
// campo del catálogo que referencie algo no seleccionado es error de
// compilación, no un `undefined` silencioso en producción.
export const AGENTE_NOMINA_SELECT = {
  cuil: true,
  nombres: true,
  apellidos: true,
  sexo: true,
  fechaNacimiento: true,
  estadoCivil: true,
  nacionalidad: true,
  provinciaOrigen: true,
  ciudadOrigen: true,
  email: true,
  telefono: true,
  telefonoAlternativo: true,
  contactoEmergencia: true,
  telefonoContactoEmergencia: true,
  domicilioReal: true,
  nroDomicilio: true,
  piso: true,
  barrio: true,
  ciudad: true,
  tipoPersonal: true,
  estado: true,
  turno: true,
  origenInstitucional: true,
  origenInstitucionalDetalle: true,
  fechaIngreso: true,
  anoEgreso: true,
  perteneceETAC: true,
  fechaInicioCursoAscenso: true,
  enTNO: true,
  motivoTNO: true,
  fechaInicioTNO: true,
  motivoRechazo: true,
  tipoArma: true,
  marcaPistola: true,
  modeloPistola: true,
  calibre: true,
  chalecoProvisto: true,
  marcaChaleco: true,
  nroSeriePlacas: true,
  talleChaleco: true,
  vencimientoChaleco: true,
  licenciaConducir: true,
  licenciaEmision: true,
  licenciaVencimiento: true,
  nivelPrimario: true,
  nivelSecundario: true,
  nivelTerciario: true,
  nivelUniversitario: true,
  nivelSuperior: true,
  detalleTitulos: true,
  grupoSanguineo: true,
  alergias: true,
  enfermedadesCronicas: true,
  medicamentos: true,
  cirugias: true,
  hijosCargo: true,
  poseeSepelio: true,
  empresaSepelio: true,
  rango: { select: { nombre: true } },
  sector: { select: { nombre: true } },
} satisfies Prisma.AgenteSelect;

export type AgenteNomina = Prisma.AgenteGetPayload<{ select: typeof AGENTE_NOMINA_SELECT }>;

function bool(v: boolean | null | undefined): string {
  if (v == null) return "";
  return v ? "Sí" : "No";
}

const VALOR_CAMPO: Record<string, (a: AgenteNomina) => string> = {
  apellidos: (a) => a.apellidos,
  nombres: (a) => a.nombres,
  dni: (a) => cuilToDni(a.cuil),
  cuil: (a) => a.cuil,
  sexo: (a) => SEXO_LABEL[a.sexo] ?? a.sexo,
  fechaNacimiento: (a) => fmt(a.fechaNacimiento) ?? "",
  estadoCivil: (a) => a.estadoCivil ?? "",
  nacionalidad: (a) => a.nacionalidad ?? "",
  provinciaOrigen: (a) => a.provinciaOrigen ?? "",
  ciudadOrigen: (a) => a.ciudadOrigen ?? "",
  email: (a) => a.email ?? "",
  telefono: (a) => a.telefono ?? "",
  telefonoAlternativo: (a) => a.telefonoAlternativo ?? "",
  contactoEmergencia: (a) => a.contactoEmergencia ?? "",
  telefonoContactoEmergencia: (a) => a.telefonoContactoEmergencia ?? "",
  domicilioReal: (a) => a.domicilioReal ?? "",
  nroDomicilio: (a) => a.nroDomicilio ?? "",
  piso: (a) => a.piso ?? "",
  barrio: (a) => a.barrio ?? "",
  ciudad: (a) => a.ciudad ?? "",
  tipoPersonal: (a) => TIPO_LABEL[a.tipoPersonal] ?? a.tipoPersonal,
  estado: (a) => ESTADO_LABEL[a.estado] ?? a.estado,
  turno: (a) => a.turno ?? "",
  sector: (a) => a.sector?.nombre ?? "",
  rango: (a) => a.rango?.nombre ?? "",
  origenInstitucional: (a) => (a.origenInstitucional ? ORIGEN_LABEL[a.origenInstitucional] ?? a.origenInstitucional : ""),
  origenInstitucionalDetalle: (a) => a.origenInstitucionalDetalle ?? "",
  fechaIngreso: (a) => fmt(a.fechaIngreso) ?? "",
  anoEgreso: (a) => fmt(a.anoEgreso) ?? "",
  perteneceETAC: (a) => bool(a.perteneceETAC),
  fechaInicioCursoAscenso: (a) => fmt(a.fechaInicioCursoAscenso) ?? "",
  enTNO: (a) => bool(a.enTNO),
  motivoTNO: (a) => a.motivoTNO ?? "",
  fechaInicioTNO: (a) => fmt(a.fechaInicioTNO) ?? "",
  motivoRechazo: (a) => a.motivoRechazo ?? "",
  tipoArma: (a) => a.tipoArma ?? "",
  marcaPistola: (a) => a.marcaPistola ?? "",
  modeloPistola: (a) => a.modeloPistola ?? "",
  calibre: (a) => a.calibre ?? "",
  chalecoProvisto: (a) => bool(a.chalecoProvisto),
  marcaChaleco: (a) => a.marcaChaleco ?? "",
  nroSeriePlacas: (a) => a.nroSeriePlacas ?? "",
  talleChaleco: (a) => a.talleChaleco ?? "",
  vencimientoChaleco: (a) => fmt(a.vencimientoChaleco) ?? "",
  licenciaConducir: (a) => a.licenciaConducir ?? "",
  licenciaEmision: (a) => fmt(a.licenciaEmision) ?? "",
  licenciaVencimiento: (a) => fmt(a.licenciaVencimiento) ?? "",
  nivelPrimario: (a) => a.nivelPrimario ?? "",
  nivelSecundario: (a) => a.nivelSecundario ?? "",
  nivelTerciario: (a) => a.nivelTerciario ?? "",
  nivelUniversitario: (a) => a.nivelUniversitario ?? "",
  nivelSuperior: (a) => a.nivelSuperior ?? "",
  detalleTitulos: (a) => a.detalleTitulos ?? "",
  grupoSanguineo: (a) => a.grupoSanguineo ?? "",
  alergias: (a) => a.alergias ?? "",
  enfermedadesCronicas: (a) => a.enfermedadesCronicas ?? "",
  medicamentos: (a) => a.medicamentos ?? "",
  cirugias: (a) => a.cirugias ?? "",
  hijosCargo: (a) => (a.hijosCargo > 0 ? String(a.hijosCargo) : ""),
  poseeSepelio: (a) => bool(a.poseeSepelio),
  empresaSepelio: (a) => a.empresaSepelio ?? "",
};

export const CAMPOS_NOMINA = CAMPOS_NOMINA_META.map((meta) => ({
  ...meta,
  valor: VALOR_CAMPO[meta.id],
}));

const MAX_IDS = 300;

export async function verificarAccesoNomina(): Promise<{ rol: RolUsuario }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true },
  });
  if (!current) throw new Error("Usuario no encontrado");
  if (!current.activo) throw new Error("Sin permiso");

  return { rol: current.rol as RolUsuario };
}

/** Anti CSV/TSV Injection: si el valor arranca con un carácter que un
 *  spreadsheet podría reinterpretar como fórmula al pegar/abrir texto plano,
 *  se antepone un `'` (no aplica a Excel real, ver src/lib/nomina.ts). */
function sanitizarValor(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export interface FilaNomina {
  columnas: { id: string; label: string }[];
  filas: Record<string, string>[];
  /** ids[i] es el agente detrás de filas[i] — permite reconstruir el orden
   *  (incluido el orden de filas que el usuario arma a mano en la vista
   *  previa) para pedidos posteriores, como el Excel. */
  ids: string[];
}

export async function obtenerFilasNomina(
  ids: string[],
  camposIds: string[],
  opts: { sanitizar?: boolean } = {}
): Promise<FilaNomina> {
  const { rol } = await verificarAccesoNomina();
  const sanitizar = opts.sanitizar !== false;

  if (ids.length === 0) throw new Error("No hay agentes para exportar");
  if (ids.length > MAX_IDS) throw new Error(`No se pueden exportar más de ${MAX_IDS} agentes a la vez`);

  const camposPermitidos = CAMPOS_NOMINA.filter(
    (c) => !(rol === "OPERADOR" && c.grupo === "armamento")
  );
  const permitidosPorId = new Map(camposPermitidos.map((c) => [c.id, c]));
  // Recorre camposIds (no CAMPOS_NOMINA) para respetar el orden que eligió
  // el usuario al reordenar columnas en la vista previa — filtra contra el
  // allowlist server-side sin confiar en lo que mandó el cliente.
  const campos = camposIds
    .map((id) => permitidosPorId.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined);
  if (campos.length === 0) throw new Error("Elegí al menos una columna");

  const encontrados = await prisma.agente.findMany({
    where: { id: { in: ids } },
    select: { id: true, ...AGENTE_NOMINA_SELECT },
  });
  // findMany no garantiza devolver en el orden de `ids`; se reordena a mano
  // para respetar tanto el orden alfabético inicial (agentes ya viene
  // ordenado así desde /personal) como el orden a mano que arma el usuario
  // arrastrando filas en la vista previa — ninguno de los dos es un orderBy
  // fijo de Prisma, ambos vienen codificados en la secuencia de `ids`.
  const porId = new Map(encontrados.map((a) => [a.id, a]));
  const agentes = ids.map((id) => porId.get(id)).filter((a): a is NonNullable<typeof a> => a !== undefined);

  const filas = agentes.map((a) => {
    const fila: Record<string, string> = {};
    for (const c of campos) {
      const valor = c.valor(a);
      fila[c.id] = sanitizar ? sanitizarValor(valor) : valor;
    }
    return fila;
  });

  return {
    columnas: campos.map((c) => ({ id: c.id, label: c.label })),
    filas,
    ids: agentes.map((a) => a.id),
  };
}
