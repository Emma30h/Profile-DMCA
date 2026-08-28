import { TIPO_LICENCIA_LABELS, type TipoLicencia } from "@/types";

// Módulo puro (sin imports de servidor) a propósito: stats.ts llama a
// calcularAusentismoMensual() para el cálculo por defecto en el dashboard,
// y AusentismoCard.tsx (client) la vuelve a llamar cada vez que el usuario
// elige un período distinto — necesita poder importarse desde los dos
// lados sin arrastrar Prisma al bundle del navegador (mismo motivo que
// personalLabels.ts).

// Causas de ausentismo mostradas por separado en el gráfico mensual del
// dashboard — el resto de los tipos se pliega en "OTROS". No es posible
// separar los ~14 tipos posibles: la paleta categórica de 8 colores que ya
// usa el resto del dashboard (ver AusentismoCard.tsx) está validada
// (daltonismo + contraste, skill de dataviz) hasta 8 series — a partir de
// ahí el propio validador falla (dos series terminan siendo indistinguibles
// incluso con visión de color normal). Se eligieron estas 6 por ser las
// causas de ausentismo real más relevantes en la práctica; el resto
// (Matrimonio, Estímulo, Antigüedad Policial, Examen en Cursos No
// Policiales, Retiro Voluntario, Excepcional Remunerada, Adscripción,
// Sanción) son puntuales o no representan ausencia por un problema del
// agente.
export const CAUSAS_AUSENTISMO_PRINCIPALES = [
  "CARPETA_MEDICA",
  "MEDICA",
  "ASISTENCIA_FAMILIAR_ENFERMO",
  "MATERNIDAD",
  "PATERNIDAD_ADOPCION",
  "FALLECIMIENTO_FAMILIAR",
] as const satisfies readonly TipoLicencia[];
export type CausaAusentismo = (typeof CAUSAS_AUSENTISMO_PRINCIPALES)[number] | "OTROS";
export const CAUSAS_AUSENTISMO: CausaAusentismo[] = [...CAUSAS_AUSENTISMO_PRINCIPALES, "OTROS"];

export function causaDeLicencia(tipo: string): CausaAusentismo {
  return (CAUSAS_AUSENTISMO_PRINCIPALES as readonly string[]).includes(tipo) ? (tipo as CausaAusentismo) : "OTROS";
}

export function labelDeCausa(c: CausaAusentismo): string {
  return c === "OTROS" ? "Otros" : TIPO_LICENCIA_LABELS[c];
}

// Misma paleta categórica de 8 colores (validada daltonismo + contraste, ver
// skill de dataviz) que ya usa el resto del dashboard — DonutTipoPersonal.tsx
// y CATEGORIA_LICENCIA_CHART_COLOR en @/types salen de acá. Un color por
// tipo específico y no por categoría, para que causas muy distintas (ej.
// maternidad vs. fallecimiento de familiar) no compartan color. OTROS usa el
// mismo gris que ya se usa para el bucket "Otros" de sexo en RingCompare.
// El orden de asignación NO es arbitrario: determina qué colores terminan
// adyacentes en la barra apilada, y el validador solo aprueba ciertos pares
// vecinos (ej. ámbar/naranja falla siempre que quedan uno al lado del otro).
// Este orden se volvió a validar entero tras pedir Carpeta Médica en verde y
// Asistencia a Familiar Enfermo en azul (mismo resultado que antes: ΔE 8.4
// daltonismo / 19.3 visión normal, sin fallar ningún par vecino real).
// CARPETA_MEDICA usa var(--c-green) (#34d399, el mismo verde menta de
// "Ingresos" en FlujoPersonalCard y del check de "Con hijos a cargo" en
// RingCompare) en vez del verde de la paleta de 8 — a pedido explícito, para
// que empate con el verde que el usuario ya reconoce en el resto del
// dashboard. Es más claro que el resto de la familia (no pasa el chequeo de
// "banda de luminosidad" del validador), pero sí pasa daltonismo/contraste/
// visión normal — aceptable porque además es la causa dominante (80% de los
// casos), así que tiene sentido que resalte un poco más que las demás.
export const CAUSA_COLOR: Record<CausaAusentismo, string> = {
  CARPETA_MEDICA: "#34d399",
  MEDICA: "#d55181",
  ASISTENCIA_FAMILIAR_ENFERMO: "#3987e5",
  MATERNIDAD: "#d95926",
  PATERNIDAD_ADOPCION: "#199e70",
  FALLECIMIENTO_FAMILIAR: "#c98500",
  OTROS: "#7c8aa8",
};

export const MESES_LARGOS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function claveMes(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface AusentismoMensual {
  key: string; // "2025-03"
  label: string; // "mar" o "mar '25" en enero / primer mes de la serie
  mesLargo: string; // "Marzo 2025"
  cantidad: number; // cantidad de licencias (no días) que arrancaron ese mes
  porCausa: Record<CausaAusentismo, number>; // cantidad por causa ese mes (Ordinaria siempre 0, no se agrega)
  ids: string[]; // agentes con ausentismo ese mes (para drill-down a /personal)
}

export interface AusentismoStats {
  meses: AusentismoMensual[];
  totalCantidad: number;
  causasPresentes: CausaAusentismo[]; // solo las que tuvieron al menos un caso, en el orden fijo de CAUSAS_AUSENTISMO_PRINCIPALES + OTROS
  escalaMax: number; // techo del eje, redondeado, para dibujar las barras
}

/** fechaInicio en ISO (no Date): esta fila cruza el límite server/cliente —
 *  stats.ts la arma desde Prisma, AusentismoCard.tsx la recibe como prop.
 *  diasHabiles y los datos de agente van desnormalizados en cada fila (no
 *  en una tabla aparte a unir en el cliente): son ~150 filas en total, así
 *  que repetir nombre/foto por cada licencia del mismo agente no pesa nada,
 *  y evita tener que mandar y cruzar dos arrays separados. */
export interface LicenciaAusentismoRow {
  tipo: string;
  fechaInicio: string;
  agenteId: string;
  diasHabiles: number;
  agente: {
    nombres: string;
    apellidos: string;
    fotoUrl: string | null;
    sexo: string | null;
    turno: string | null;
  };
}

// A diferencia de licenciasActivasHoy/novedades (que filtran por
// agente.estado === "ACTIVO", son una foto del presente), acá NO se filtra
// por estado actual del agente: es un análisis histórico de tendencia, y una
// ausencia que ocurrió realmente no debe desaparecer del gráfico solo porque
// esa persona se dio de baja o pasó a otra dependencia después.
//
// desde/hasta (no se infieren de los datos ni de "hoy" acá adentro): el
// llamador decide el rango de meses a graficar — "todo el historial",
// "un año puntual" o "un rango a mano" son decisiones de UI, no de esta
// función. Las licencias que caen fuera de [desde, hasta] simplemente no
// tienen bucket y se ignoran (no hace falta pre-filtrar el array de
// licencias antes de llamarla).
export function calcularAusentismoMensual(
  desde: Date,
  hasta: Date,
  licencias: LicenciaAusentismoRow[]
): AusentismoStats {
  if (licencias.length === 0 || desde > hasta) {
    return { meses: [], totalCantidad: 0, causasPresentes: [], escalaMax: 5 };
  }

  const meses: AusentismoMensual[] = [];
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const esPrimeroOEnero = meses.length === 0 || m === 0;
    meses.push({
      key: claveMes(cursor),
      label: esPrimeroOEnero ? `${MESES_CORTOS[m]} '${String(y).slice(2)}` : MESES_CORTOS[m],
      mesLargo: `${MESES_LARGOS[m]} ${y}`,
      cantidad: 0,
      porCausa: Object.fromEntries(CAUSAS_AUSENTISMO.map((c) => [c, 0])) as Record<CausaAusentismo, number>,
      ids: [],
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const indicePorClave = new Map(meses.map((m, i) => [m.key, i]));
  const causasConDatos = new Set<CausaAusentismo>();
  for (const l of licencias) {
    const fechaInicio = new Date(l.fechaInicio);
    const i = indicePorClave.get(claveMes(fechaInicio));
    if (i === undefined) continue;
    const causa = causaDeLicencia(l.tipo);
    const mes = meses[i];
    mes.cantidad += 1;
    mes.porCausa[causa] += 1;
    if (!mes.ids.includes(l.agenteId)) mes.ids.push(l.agenteId);
    causasConDatos.add(causa);
  }

  let totalCantidad = 0;
  let picoMes = 1;
  for (const m of meses) {
    totalCantidad += m.cantidad;
    picoMes = Math.max(picoMes, m.cantidad);
  }
  const escalaMax = Math.max(5, Math.ceil(picoMes / 5) * 5);
  const causasPresentes = CAUSAS_AUSENTISMO.filter((c) => causasConDatos.has(c));

  return { meses, totalCantidad, causasPresentes, escalaMax };
}
