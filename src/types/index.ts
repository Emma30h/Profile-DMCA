// ─── Tipos de dominio (reemplazan los enums de Prisma para compatibilidad SQLite) ───

export type TipoPersonal = "SEGURIDAD" | "TECNICO" | "CIVIL_BECARIO" | "CIVIL_POLICIAL";
export type EstadoAgente = "PENDIENTE" | "ACTIVO" | "BAJA" | "PASE";
export type RolUsuario = "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "OPERADOR" | "READONLY";
export type EstadoLicencia = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";
export type CategoriaLicencia = "ORDINARIA" | "MEDICA" | "EXTRAORDINARIA" | "EXCEPCIONAL" | "ADSCRIPCION";

export type TipoLicencia =
  | "ORDINARIA"
  | "CARPETA_MEDICA" | "MEDICA"
  | "ANTIGUEDAD_POLICIAL" | "MATRIMONIO" | "ASISTENCIA_FAMILIAR_ENFERMO" | "MATERNIDAD"
  | "PATERNIDAD_ADOPCION" | "NACIMIENTO_ADOPCION_HIJO_DISCAPACITADO" | "ESTIMULO"
  | "FALLECIMIENTO_FAMILIAR" | "EXAMEN_CURSOS_NO_POLICIALES"
  | "RETIRO_VOLUNTARIO" | "EXCEPCIONAL_REMUNERADA"
  | "ADSCRIPCION";
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
export type TipoSolicitudFoto = "SUBIR" | "QUITAR";
export type EstadoSolicitudFoto = "PENDIENTE" | "APROBADA" | "RECHAZADA";

// Editable libremente para cualquier agente — no se deriva de tipoPersonal
// ni de perteneceETAC, son solo pautas generales que pueden cambiar caso a caso.
export type OrigenInstitucional = "GOBIERNO" | "DMCA" | "911" | "OTRA_DEPENDENCIA";

// Calendario de guardias: 1 = grupo A·C·E en servicio, 2 = grupo B·D·F en servicio.
// Las letras/horarios de Agente.turno no cambian, esto solo define qué grupo trabaja cada día.
export type GrupoTurno = 1 | 2;
export const GRUPO_TURNO_LETRAS: Record<GrupoTurno, string> = { 1: "A · C · E", 2: "B · D · F" };

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

export const ORIGENES_INSTITUCIONALES: OrigenInstitucional[] = ["GOBIERNO", "DMCA", "911", "OTRA_DEPENDENCIA"];

export const ROLES_USUARIO: RolUsuario[] = [
  "SUPERADMIN",
  "ADMIN",
  "SUPERVISOR",
  "OPERADOR",
  "READONLY",
];

export const CATEGORIAS_LICENCIA: { value: CategoriaLicencia; label: string; badge: string; emoji: string }[] = [
  { value: "ORDINARIA", label: "Licencia Ordinaria", badge: "bg-blue-500/15 text-blue-300", emoji: "🏖️" },
  { value: "MEDICA", label: "Licencia Especial (Médica)", badge: "bg-red-500/15 text-red-400", emoji: "🏥" },
  { value: "EXTRAORDINARIA", label: "Licencia Extraordinaria", badge: "bg-purple-500/15 text-purple-400", emoji: "👨‍👩‍👧‍👦" },
  { value: "EXCEPCIONAL", label: "Licencia Excepcional", badge: "bg-fuchsia-500/15 text-fuchsia-400", emoji: "⭐" },
  { value: "ADSCRIPCION", label: "Adscripción", badge: "bg-indigo-500/15 text-indigo-400", emoji: "🔄" },
];

// Única lista a mano; todo lo demás (lista plana, labels, lookup inverso) se deriva
// de acá para no repetir la taxonomía en cada archivo que la necesita.
export const LICENCIA_TIPOS_POR_CATEGORIA: Record<CategoriaLicencia, { value: TipoLicencia; label: string }[]> = {
  ORDINARIA: [{ value: "ORDINARIA", label: "Licencia Ordinaria" }],
  MEDICA: [
    { value: "CARPETA_MEDICA", label: "Carpeta Médica" },
    { value: "MEDICA", label: "Licencia Médica" },
  ],
  EXTRAORDINARIA: [
    { value: "ANTIGUEDAD_POLICIAL", label: "Antigüedad Policial" },
    { value: "MATRIMONIO", label: "Matrimonio" },
    { value: "ASISTENCIA_FAMILIAR_ENFERMO", label: "Asistencia a Familiar Enfermo" },
    { value: "MATERNIDAD", label: "Maternidad" },
    { value: "PATERNIDAD_ADOPCION", label: "Paternidad o Adopción" },
    { value: "NACIMIENTO_ADOPCION_HIJO_DISCAPACITADO", label: "Nacimiento o Adopción de Hijo Discapacitado" },
    { value: "ESTIMULO", label: "Estímulo" },
    { value: "FALLECIMIENTO_FAMILIAR", label: "Fallecimiento de Familiar" },
    { value: "EXAMEN_CURSOS_NO_POLICIALES", label: "Examen en Cursos No Policiales" },
  ],
  EXCEPCIONAL: [
    { value: "RETIRO_VOLUNTARIO", label: "Retiro Voluntario" },
    { value: "EXCEPCIONAL_REMUNERADA", label: "Excepcional Remunerada" },
  ],
  ADSCRIPCION: [{ value: "ADSCRIPCION", label: "Adscripción" }],
};

export const TIPOS_LICENCIA: TipoLicencia[] = Object.values(LICENCIA_TIPOS_POR_CATEGORIA)
  .flat()
  .map((t) => t.value);

// Tipado como Record<string, string> (no Record<TipoLicencia, string>) a propósito:
// `Licencia.tipo` en la base es un String libre sin constraint real, así que en
// los puntos donde se muestra viene tipado como string genérico, no como
// TipoLicencia — esto evita tener que castear en cada lugar que solo lee un label.
export const TIPO_LICENCIA_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(LICENCIA_TIPOS_POR_CATEGORIA).flat().map((t) => [t.value, t.label])
);

export const LICENCIA_CATEGORIA_DE_TIPO: Record<TipoLicencia, CategoriaLicencia> = Object.fromEntries(
  (Object.entries(LICENCIA_TIPOS_POR_CATEGORIA) as [CategoriaLicencia, { value: TipoLicencia; label: string }[]][])
    .flatMap(([categoria, tipos]) => tipos.map((t) => [t.value, categoria]))
) as Record<TipoLicencia, CategoriaLicencia>;

export const CATEGORIA_LICENCIA_INFO: Record<CategoriaLicencia, { label: string; badge: string; emoji: string }> =
  Object.fromEntries(CATEGORIAS_LICENCIA.map((c) => [c.value, { label: c.label, badge: c.badge, emoji: c.emoji }])) as Record<
    CategoriaLicencia,
    { label: string; badge: string; emoji: string }
  >;

// Paleta categórica validada (daltonismo + contraste, ver skill de dataviz /
// scripts/validate_palette.js) para gráficos reales de licencias — distinta de
// CATEGORIA_LICENCIA_INFO.badge, que son clases Tailwind pensadas para texto
// con label al lado, no para color puro como identidad (barras, líneas de tiempo).
export const CATEGORIA_LICENCIA_CHART_COLOR: Record<CategoriaLicencia, string> = {
  ORDINARIA: "#3987e5",
  MEDICA: "#d95926",
  EXTRAORDINARIA: "#199e70",
  EXCEPCIONAL: "#c98500",
  ADSCRIPCION: "#d55181",
};

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
  | "USUARIO_NUEVO"
  | "SOLICITUD_NUEVA"
  | "APROBADA"
  | "RECHAZADA"
  | "PERMISO_VENCIDO"
  | "LEGAJO_NUEVO"
  | "LEGAJO_APROBADO"
  | "LEGAJO_RECHAZADO"
  | "LEGAJO_VINCULADO_AUTO"
  | "ESTADO_CAMBIADO"
  | "LICENCIA_NUEVA"
  | "LICENCIA_PENDIENTE_NUEVA"
  | "SOLICITUD_FOTO_NUEVA"
  | "FOTO_APROBADA"
  | "FOTO_RECHAZADA"
  | "VINCULACION_PENDIENTE"
  | "VINCULACION_APROBADA"
  | "VINCULACION_RECHAZADA";
