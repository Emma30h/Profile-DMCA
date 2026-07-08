// ─── Tipos de dominio (reemplazan los enums de Prisma para compatibilidad SQLite) ───

export type TipoPersonal = "SEGURIDAD" | "TECNICO" | "CIVIL_BECARIO" | "CIVIL_POLICIAL";
export type EstadoAgente = "PENDIENTE" | "ACTIVO" | "BAJA" | "PASE";
export type RolUsuario = "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "OPERADOR" | "READONLY";
export type EstadoLicencia = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";
export type TipoLicencia = "ORDINARIA" | "MEDICA" | "CARPETA_MEDICA" | "ESPECIAL" | "SIN_GOCE_SUELDO" | "ARTICULO" | "SUSPENSION" | "ADSCRIPCION";
export type TipoLicenciaPendiente = "ANUAL_ORDINARIA" | "DIA_ESTIMULO" | "OTRO";
export type UnidadDias = "HABILES" | "CORRIDOS";
export type EstadoLicenciaPendiente = "PENDIENTE" | "PARCIAL" | "USADA";
export type EstadoAsistencia =
  | "PRESENTE"
  | "AUSENTE_JUSTIFICADO"
  | "AUSENTE_INJUSTIFICADO"
  | "FRANCO"
  | "LICENCIA"
  | "FERIADO";
export type TipoSector = "DIRECCION" | "DEPARTAMENTO" | "DIVISION";
export type TipoExcepcionTurno = "HORA_EXTRA" | "CAMBIO_TURNO" | "GUARDIA_ESPECIAL";

// Constantes con todos los valores válidos (útil para validaciones y selects)
export const TIPOS_PERSONAL: TipoPersonal[] = [
  "SEGURIDAD",
  "TECNICO",
  "CIVIL_BECARIO",
  "CIVIL_POLICIAL",
];

export const ESTADOS_AGENTE: EstadoAgente[] = [
  "PENDIENTE",
  "ACTIVO",
  "BAJA",
  "PASE",
];

export const ROLES_USUARIO: RolUsuario[] = [
  "SUPERADMIN",
  "ADMIN",
  "SUPERVISOR",
  "OPERADOR",
  "READONLY",
];

export const TIPOS_LICENCIA: TipoLicencia[] = [
  "ORDINARIA",
  "MEDICA",
  "CARPETA_MEDICA",
  "ESPECIAL",
  "SIN_GOCE_SUELDO",
  "ARTICULO",
  "SUSPENSION",
  "ADSCRIPCION",
];

export const TIPOS_LICENCIA_PENDIENTE: TipoLicenciaPendiente[] = ["ANUAL_ORDINARIA", "DIA_ESTIMULO", "OTRO"];
export const UNIDADES_DIAS: UnidadDias[] = ["HABILES", "CORRIDOS"];

export const ESTADOS_ASISTENCIA: EstadoAsistencia[] = [
  "PRESENTE",
  "AUSENTE_JUSTIFICADO",
  "AUSENTE_INJUSTIFICADO",
  "FRANCO",
  "LICENCIA",
  "FERIADO",
];

export type TipoNotificacion =
  | "SOLICITUD_NUEVA"
  | "APROBADA"
  | "RECHAZADA"
  | "PERMISO_VENCIDO"
  | "LEGAJO_NUEVO"
  | "LEGAJO_APROBADO"
  | "LEGAJO_RECHAZADO"
  | "ESTADO_CAMBIADO"
  | "LICENCIA_NUEVA"
  | "LICENCIA_PENDIENTE_NUEVA";
