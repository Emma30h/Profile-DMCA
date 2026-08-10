import type { TipoNotificacion } from "@/types";

export const TIPO_LABELS: Record<TipoNotificacion, string> = {
  USUARIO_NUEVO: "Usuario nuevo",
  SOLICITUD_NUEVA: "Solicitud de edición",
  APROBADA: "Solicitud aprobada",
  RECHAZADA: "Solicitud rechazada",
  PERMISO_VENCIDO: "Permiso vencido",
  LEGAJO_NUEVO: "Legajo nuevo",
  LEGAJO_APROBADO: "Legajo aprobado",
  LEGAJO_RECHAZADO: "Legajo rechazado",
  LEGAJO_VINCULADO_AUTO: "Legajo vinculado",
  ESTADO_CAMBIADO: "Estado de cuenta cambiado",
  LICENCIA_NUEVA: "Licencia nueva",
  LICENCIA_PENDIENTE_NUEVA: "Licencia pendiente",
  SOLICITUD_FOTO_NUEVA: "Solicitud de foto",
  FOTO_APROBADA: "Foto aprobada",
  FOTO_RECHAZADA: "Foto rechazada",
  VINCULACION_PENDIENTE: "Vinculación pendiente",
  VINCULACION_APROBADA: "Vinculación aprobada",
  VINCULACION_RECHAZADA: "Vinculación rechazada",
};

export const TIPO_ICON: Record<TipoNotificacion, string> = {
  USUARIO_NUEVO: "🆕",
  SOLICITUD_NUEVA: "📋",
  APROBADA: "✅",
  RECHAZADA: "❌",
  PERMISO_VENCIDO: "⏰",
  LEGAJO_NUEVO: "🔔",
  LEGAJO_APROBADO: "✅",
  LEGAJO_RECHAZADO: "❌",
  LEGAJO_VINCULADO_AUTO: "🔗",
  ESTADO_CAMBIADO: "🔄",
  LICENCIA_NUEVA: "📅",
  LICENCIA_PENDIENTE_NUEVA: "🏖️",
  SOLICITUD_FOTO_NUEVA: "🖼️",
  FOTO_APROBADA: "✅",
  FOTO_RECHAZADA: "❌",
  VINCULACION_PENDIENTE: "🔗",
  VINCULACION_APROBADA: "✅",
  VINCULACION_RECHAZADA: "❌",
};

const TIPO_HREF: Record<TipoNotificacion, string> = {
  USUARIO_NUEVO: "/configuracion/usuarios",
  SOLICITUD_NUEVA: "/configuracion/solicitudes",
  LEGAJO_NUEVO: "/personal",
  APROBADA: "/mi-legajo",
  RECHAZADA: "/mi-legajo",
  PERMISO_VENCIDO: "/mi-legajo",
  LEGAJO_APROBADO: "/mi-legajo",
  LEGAJO_RECHAZADO: "/mi-legajo",
  LEGAJO_VINCULADO_AUTO: "/personal",
  ESTADO_CAMBIADO: "/mi-legajo",
  LICENCIA_NUEVA: "/mi-legajo",
  LICENCIA_PENDIENTE_NUEVA: "/mi-legajo",
  SOLICITUD_FOTO_NUEVA: "/configuracion/solicitudes",
  FOTO_APROBADA: "/perfil",
  FOTO_RECHAZADA: "/perfil",
  VINCULACION_PENDIENTE: "/configuracion/solicitudes",
  VINCULACION_APROBADA: "/mi-legajo",
  VINCULACION_RECHAZADA: "/mi-legajo",
};

// Algunos tipos apuntan al legajo puntual que los originó en vez del destino
// genérico de su tipo — depende de si viene con referenciaId (id de agente).
const TIPOS_CON_REFERENCIA_A_LEGAJO: TipoNotificacion[] = [
  "LEGAJO_NUEVO",
  "LEGAJO_VINCULADO_AUTO",
  "USUARIO_NUEVO",
];

export function hrefNotificacion(tipo: string, referenciaId?: string | null): string | undefined {
  const t = tipo as TipoNotificacion;
  if (referenciaId && TIPOS_CON_REFERENCIA_A_LEGAJO.includes(t)) {
    return `/personal/${referenciaId}`;
  }
  return TIPO_HREF[t];
}

export function iconoNotificacion(tipo: string): string {
  return TIPO_ICON[tipo as TipoNotificacion] ?? "🔔";
}

export function labelNotificacion(tipo: string): string {
  return TIPO_LABELS[tipo as TipoNotificacion] ?? tipo;
}
