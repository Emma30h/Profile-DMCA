// Módulo puro (sin imports de servidor: nada de @/lib/prisma, @/lib/redis,
// @/lib/supabase/*) para poder importarse tanto desde client components como
// desde módulos de servidor sin arrastrar Prisma al bundle del navegador.

export const TIPO_LABEL: Record<string, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente", ACTIVO: "Activo", BAJA: "Baja", PASE: "Pase",
};

export const SEXO_LABEL: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  NO_BINARIO: "No binario",
  PREFIERO_NO_DECIR: "Prefiero no decir",
  OTRO: "Otro",
};

export const ORIGEN_LABEL: Record<string, string> = {
  GOBIERNO: "Gobierno", DMCA: "DMCA", "911": "911", OTRA_DEPENDENCIA: "Otra dependencia",
};

/** Deriva el DNI a partir del CUIL (formato XX-DNI(8)-X). */
export function cuilToDni(cuil: string): string {
  const digits = cuil.replace(/\D/g, "");
  if (digits.length !== 11) return digits;
  const dniConCeros = digits.slice(2, 10);
  return dniConCeros.replace(/^0+/, "") || dniConCeros;
}

/** Normaliza texto para comparar ignorando mayúsculas/minúsculas y acentos
 * (ej: buscar "sanchez" debe encontrar "Sánchez"). */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function fmt(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

// ─── Catálogo de columnas para "Armar nómina" (/personal) ─────────────────
// Solo metadatos (id/label/grupo) — liviano, seguro de importar desde un
// client component. La extracción de valores desde el Agente vive en
// src/lib/nomina.ts (que sí importa Prisma), mapeada 1 a 1 contra estos ids.

export type GrupoNomina =
  | "identidad" | "contacto" | "laboral" | "armamento"
  | "licencia" | "academico" | "medico" | "familia";

export interface CampoNominaMeta {
  id: string;
  label: string;
  grupo: GrupoNomina;
}

export const GRUPOS_NOMINA: { id: GrupoNomina; titulo: string }[] = [
  { id: "identidad", titulo: "Identidad" },
  { id: "contacto", titulo: "Contacto" },
  { id: "laboral", titulo: "Datos laborales" },
  { id: "armamento", titulo: "Armamento y equipo" },
  { id: "licencia", titulo: "Licencia de conducir" },
  { id: "academico", titulo: "Nivel académico" },
  { id: "medico", titulo: "Datos médicos" },
  { id: "familia", titulo: "Familia y beneficios" },
];

export const CAMPOS_NOMINA_META: CampoNominaMeta[] = [
  // Identidad
  { id: "apellidos", label: "Apellidos", grupo: "identidad" },
  { id: "nombres", label: "Nombres", grupo: "identidad" },
  { id: "dni", label: "DNI", grupo: "identidad" },
  { id: "cuil", label: "CUIL", grupo: "identidad" },
  { id: "sexo", label: "Sexo", grupo: "identidad" },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", grupo: "identidad" },
  { id: "estadoCivil", label: "Estado civil", grupo: "identidad" },
  { id: "nacionalidad", label: "Nacionalidad", grupo: "identidad" },
  { id: "provinciaOrigen", label: "Provincia de origen", grupo: "identidad" },
  { id: "ciudadOrigen", label: "Ciudad de origen", grupo: "identidad" },
  // Contacto
  { id: "email", label: "Email", grupo: "contacto" },
  { id: "telefono", label: "Teléfono", grupo: "contacto" },
  { id: "telefonoAlternativo", label: "Teléfono alternativo", grupo: "contacto" },
  { id: "contactoEmergencia", label: "Contacto de emergencia", grupo: "contacto" },
  { id: "telefonoContactoEmergencia", label: "Teléfono de emergencia", grupo: "contacto" },
  { id: "domicilioReal", label: "Domicilio", grupo: "contacto" },
  { id: "nroDomicilio", label: "N° domicilio", grupo: "contacto" },
  { id: "piso", label: "Piso", grupo: "contacto" },
  { id: "barrio", label: "Barrio", grupo: "contacto" },
  { id: "ciudad", label: "Ciudad", grupo: "contacto" },
  // Laboral
  { id: "tipoPersonal", label: "Tipo de personal", grupo: "laboral" },
  { id: "estado", label: "Estado", grupo: "laboral" },
  { id: "turno", label: "Turno", grupo: "laboral" },
  { id: "sector", label: "Sector / dependencia", grupo: "laboral" },
  { id: "rango", label: "Jerarquía / rango", grupo: "laboral" },
  { id: "origenInstitucional", label: "Origen institucional", grupo: "laboral" },
  { id: "origenInstitucionalDetalle", label: "Detalle de origen", grupo: "laboral" },
  { id: "fechaIngreso", label: "Fecha de ingreso", grupo: "laboral" },
  { id: "anoEgreso", label: "Año de egreso", grupo: "laboral" },
  { id: "perteneceETAC", label: "Pertenece a ETAC", grupo: "laboral" },
  { id: "fechaInicioCursoAscenso", label: "Inicio curso de ascenso", grupo: "laboral" },
  { id: "enTNO", label: "En TNO", grupo: "laboral" },
  { id: "motivoTNO", label: "Motivo TNO", grupo: "laboral" },
  { id: "fechaInicioTNO", label: "Inicio TNO", grupo: "laboral" },
  { id: "motivoRechazo", label: "Motivo de rechazo", grupo: "laboral" },
  // Armamento (oculto para rol Operador)
  { id: "tipoArma", label: "Tipo de arma", grupo: "armamento" },
  { id: "marcaPistola", label: "Marca de pistola", grupo: "armamento" },
  { id: "modeloPistola", label: "Modelo de pistola", grupo: "armamento" },
  { id: "calibre", label: "Calibre", grupo: "armamento" },
  { id: "chalecoProvisto", label: "Chaleco provisto", grupo: "armamento" },
  { id: "marcaChaleco", label: "Marca de chaleco", grupo: "armamento" },
  { id: "nroSeriePlacas", label: "N° de serie / placas", grupo: "armamento" },
  { id: "talleChaleco", label: "Talle de chaleco", grupo: "armamento" },
  { id: "vencimientoChaleco", label: "Vencimiento de chaleco", grupo: "armamento" },
  // Licencia de conducir
  { id: "licenciaConducir", label: "Categoría de licencia", grupo: "licencia" },
  { id: "licenciaEmision", label: "Emisión de licencia", grupo: "licencia" },
  { id: "licenciaVencimiento", label: "Vencimiento de licencia", grupo: "licencia" },
  // Nivel académico
  { id: "nivelPrimario", label: "Nivel primario", grupo: "academico" },
  { id: "nivelSecundario", label: "Nivel secundario", grupo: "academico" },
  { id: "nivelTerciario", label: "Nivel terciario", grupo: "academico" },
  { id: "nivelUniversitario", label: "Nivel universitario", grupo: "academico" },
  { id: "nivelSuperior", label: "Nivel superior", grupo: "academico" },
  { id: "detalleTitulos", label: "Detalle de títulos / estudios", grupo: "academico" },
  // Datos médicos
  { id: "grupoSanguineo", label: "Grupo sanguíneo", grupo: "medico" },
  { id: "alergias", label: "Alergias", grupo: "medico" },
  { id: "enfermedadesCronicas", label: "Enfermedades crónicas", grupo: "medico" },
  { id: "medicamentos", label: "Medicamentos", grupo: "medico" },
  { id: "cirugias", label: "Cirugías", grupo: "medico" },
  // Familia y beneficios
  { id: "hijosCargo", label: "Hijos a cargo", grupo: "familia" },
  { id: "poseeSepelio", label: "Posee servicio de sepelio", grupo: "familia" },
  { id: "empresaSepelio", label: "Empresa de sepelio", grupo: "familia" },
];

/** Columnas tildadas por default al abrir el selector de "Armar nómina". */
export const CAMPOS_NOMINA_DEFAULT = ["apellidos", "nombres", "dni", "turno", "sector", "estado"];
