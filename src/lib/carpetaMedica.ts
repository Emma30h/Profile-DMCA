// Aviso de Carpeta Médica de Civil Becario (personal del Ministerio de
// Seguridad) a RR.HH. Funciones puras: se usan tanto en el modal (vista previa
// y "copiar para WhatsApp") como en la server action que manda el mail, así el
// texto que se ve es exactamente el que sale.

export const DESTINATARIO_CARPETA_MEDICA_DEFAULT = "rrhh.inasistencias@gmail.com";
export const CLAVE_CONFIG_DESTINATARIO = "CARPETA_MEDICA_DESTINATARIO";
export const DIAS_RETENCION_CERTIFICADO = 7;
export const BUCKET_CERTIFICADOS = "certificados-medicos";

export interface DatosCarpetaMedica {
  turno: string;
  fecha: string; // dd/mm/aaaa
  hora: string; // HH:mm
  apellidos: string;
  nombres: string;
  dni: string; // solo dígitos o ya con puntos
  diagnostico: string;
  doctor: string;
  matricula: string;
  reposo: string; // ej. "24 HS"
}

/** 47172623 → 47.172.623 */
export function formatearDni(dni: string): string {
  const digitos = dni.replace(/\D/g, "");
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const mayus = (s: string) => s.trim().toUpperCase();

/** Texto del aviso, con el formato de WhatsApp que usa RR.HH. */
export function armarTextoCarpetaMedica(d: DatosCarpetaMedica): string {
  return [
    `*CARPETA MEDICA - TURNO ${mayus(d.turno)}*`,
    "",
    `*FECHA:* ${d.fecha.trim()}`,
    `*HORA*: ${d.hora.trim()}`,
    `*P. CIVIL ${mayus(d.apellidos)} ${mayus(d.nombres)}*`,
    `*DNI:* ${formatearDni(d.dni)}`,
    `*DIAGNOSTICO:* ${mayus(d.diagnostico)}`,
    `*DOCTOR:* ${mayus(d.doctor)}`,
    `*MP:* ${d.matricula.trim()}`,
    `*REPOSO:* ${mayus(d.reposo)}`,
  ].join("\n");
}

export function asuntoCarpetaMedica(d: Pick<DatosCarpetaMedica, "turno" | "apellidos" | "nombres" | "fecha">): string {
  return `CARPETA MEDICA - TURNO ${mayus(d.turno)} - ${mayus(d.apellidos)} ${mayus(d.nombres)} - ${d.fecha.trim()}`;
}

/** Quita el prefijo "Diagnostico:" (y sus tipeos) con el que se carga el motivo. */
export function diagnosticoDesdeMotivo(motivo: string | null): string {
  if (!motivo) return "";
  return motivo.replace(/^diagn\S*:\s*/i, "").trim();
}

/** Saca doctor y matrícula de la observación, que se carga como
 *  "Dr. Norma B Zalazar M.P. 19327" (o "Dra.", "MP 19327", "M.P: 19327"). */
export function doctorDesdeObservacion(obs: string | null): { doctor: string; matricula: string } {
  if (!obs) return { doctor: "", matricula: "" };
  const m = obs.match(/^\s*(?:dr[a]?\.?\s+)?(.*?)[\s,;-]*m\.?\s*p\.?\s*:?\s*(\d+)/i);
  if (m) return { doctor: m[1].trim(), matricula: m[2] };
  const soloDr = obs.match(/^\s*dr[a]?\.?\s+(.+)$/i);
  return { doctor: soloDr ? soloDr[1].trim() : "", matricula: "" };
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
