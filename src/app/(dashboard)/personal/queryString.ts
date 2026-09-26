// Separado de lib.ts a propósito: lib.ts importa ioredis/Prisma (solo server),
// y esta función la necesita también PersonalMasterShell (Client Component).
// Si viviera en lib.ts, cualquier import de un valor real (no solo un tipo)
// arrastraría esas dependencias de servidor al bundle del cliente.
export interface FiltrosPersonalParams {
  q?: string;
  tipo?: string;
  estado?: string;
  turno?: string;
  sector?: string;
  /** "ETAC" | "911" | "DMCA" | "GOBIERNO" | "OTRA_DEPENDENCIA" — origen institucional del agente. */
  origen?: string;
  /** "SI" — en curso de ascenso (solo aplica a Seguridad/Técnico). */
  ascenso?: string;
  /** Lista de ids de agente separados por coma — drill-down puntual (p. ej. desde
   * las alertas del dashboard), no un filtro editable desde FiltrosPersonal. */
  ids?: string;
  /** Igual que ids: drill-down puntual desde los anillos de sexo del dashboard,
   * no un filtro con su propia UI en FiltrosPersonal. */
  sexo?: string;
}

export function buildQueryString(params: FiltrosPersonalParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.estado) qs.set("estado", params.estado);
  if (params.turno) qs.set("turno", params.turno);
  if (params.sector) qs.set("sector", params.sector);
  if (params.origen) qs.set("origen", params.origen);
  if (params.ascenso) qs.set("ascenso", params.ascenso);
  if (params.ids) qs.set("ids", params.ids);
  if (params.sexo) qs.set("sexo", params.sexo);
  return qs.toString();
}
