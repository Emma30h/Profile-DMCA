// Tipos y helpers compartidos entre VistaLicencias.tsx y
// ExportarLicenciasBtn.tsx — en un módulo aparte (no exportados desde
// VistaLicencias.tsx) para que ninguno de los dos termine importando al otro.

export interface AgenteResumen {
  id: string;
  nombres: string;
  apellidos: string;
  sector: string | null;
  tipoPersonal: string;
}

export interface LicenciaRow {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  motivo: string | null;
  agente: AgenteResumen;
}

export const TIPO_PERSONAL_LABEL: Record<string, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

export function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  });
}
