// Integración de solo lectura con la app hermana "Calendario Garden" (otro
// proyecto, otra base de datos — se consume vía HTTP, no hay conexión directa
// a su Postgres). Endpoint público sin autenticación:
//   GET /api/efemerides/current?month=M&year=Y -> efemérides cargadas desde el PDF
// Si la otra app está caída o CALENDARIO_GARDEN_URL no está configurada, se
// devuelve una lista vacía en silencio: esto es contenido informativo, nunca
// debe romper el dashboard de este sistema.
//
// Los cumpleaños de personal ("Cumpleaños de personal del Garden" en el
// sidebar) NO salen de acá — salen de los legajos propios de esta app, ver
// src/lib/cumpleanosPersonal.ts.

export type TipoEfemeride = "cumpleanos" | "aniversario" | "dia" | "otro";

export interface EfemerideHoy {
  id: string;
  titulo: string;
  tipo: TipoEfemeride;
}

interface EfemerideApiEvent {
  id: string;
  title: string;
  type: string;
  day: number;
}

const TIMEOUT_MS = 5000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    // Sin caché: es contenido filtrado por el día de hoy — cachearlo (aunque
    // sea por poco tiempo) arriesga mostrar la efeméride de un día anterior
    // al entrar a la app recién pasada la medianoche.
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function obtenerEfemeridesHoy(): Promise<EfemerideHoy[]> {
  const baseUrl = process.env.CALENDARIO_GARDEN_URL;
  if (!baseUrl) return [];

  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const dia = hoy.getDate();
  const anio = hoy.getFullYear();

  const efemeridesApi = await fetchJson<{ data: { events: EfemerideApiEvent[] } | null }>(
    `${baseUrl}/api/efemerides/current?month=${mes}&year=${anio}`
  );

  const efemerides: EfemerideHoy[] = [];
  const eventosDelMes = efemeridesApi?.data?.events ?? [];
  for (const e of eventosDelMes) {
    if (e.day !== dia || e.type === "sin_novedad") continue;
    efemerides.push({
      id: e.id,
      titulo: e.title,
      tipo: e.type === "cumpleanos" || e.type === "aniversario" || e.type === "dia" ? e.type : "otro",
    });
  }

  return efemerides;
}
