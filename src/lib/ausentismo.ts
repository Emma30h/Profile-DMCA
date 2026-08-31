import { TIPO_LICENCIA_LABELS, type TipoLicencia } from "@/types";
import type { ChartTheme } from "./chartThemes";

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

// Posición de cada causa dentro de ChartTheme.categorico PARA TEMAS NUEVOS
// (no institucional) — coincide índice a índice con CAUSAS_AUSENTISMO_PRINCIPALES,
// que es a la vez el orden real en que quedan apiladas/vecinas en la barra
// (CARPETA_MEDICA-MEDICA-ASISTENCIA-MATERNIDAD-PATERNIDAD-FALLECIMIENTO), así
// que la validación "vecinos adyacentes" de cada tema (ver chartThemes.ts)
// ya cubre exactamente esta adyacencia real, sin tener que revalidar nada.
// OTROS nunca entra acá — se pliega siempre al gris fijo.
const INDICE_CATEGORICO_CAUSA: Partial<Record<CausaAusentismo, number>> = {
  CARPETA_MEDICA: 0,
  MEDICA: 1,
  ASISTENCIA_FAMILIAR_ENFERMO: 2,
  MATERNIDAD: 3,
  PATERNIDAD_ADOPCION: 4,
  FALLECIMIENTO_FAMILIAR: 5,
};

// Color de una causa para un tema de descarga dado. El tema institucional
// mantiene el mapeo bespoke de CAUSA_COLOR de arriba (cero cambios respecto
// del look actual del dashboard, incluida la excepción de CARPETA_MEDICA en
// verde) — los temas nuevos usan el mapeo secuencial de arriba, donde SÍ
// varía color por color (si no, cambiar de paleta "no se nota", que fue
// justo el problema reportado). OTROS siempre queda en el gris fijo, en
// todos los temas: no es identidad de serie.
export function colorDeCausa(causa: CausaAusentismo, tema: ChartTheme): string {
  if (causa === "OTROS") return CAUSA_COLOR.OTROS;
  if (tema.id === "institucional") return CAUSA_COLOR[causa];
  const i = INDICE_CATEGORICO_CAUSA[causa];
  return i !== undefined ? tema.categorico[i] : CAUSA_COLOR[causa];
}

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
  motivo: string | null;
  agente: {
    nombres: string;
    apellidos: string;
    fotoUrl: string | null;
    sexo: string | null;
    turno: string | null;
    estado: string;
    tipoPersonal: string;
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
// Filtro de período compartido por las 6 tarjetas de "Estadísticas
// generales" — antes vivía duplicado (con lógica idéntica) en cada tarjeta.
export type ModoPeriodo = "todo" | "anio" | "rango";

export function aniosDeLicencias(licencias: LicenciaAusentismoRow[]): number[] {
  const set = new Set(licencias.map((l) => new Date(l.fechaInicio).getUTCFullYear()));
  return [...set].sort((a, b) => b - a);
}

// Igual lógica que ya tenían RankingCausasCard/RankingPersonalCard/
// CausasRadarCard/LicenciasPorTurnoCard: alcanza con filtrar las licencias
// crudas por fecha, no hace falta un rango de meses continuo (a diferencia
// de AusentismoCard, ver rangoMesesPeriodo).
export function filtrarPorPeriodo(
  licencias: LicenciaAusentismoRow[],
  modo: ModoPeriodo,
  anioActivo: number,
  rangoDesde: string,
  rangoHasta: string
): LicenciaAusentismoRow[] {
  if (modo === "anio") {
    return licencias.filter((l) => new Date(l.fechaInicio).getUTCFullYear() === anioActivo);
  }
  if (modo === "rango") {
    if (!rangoDesde || !rangoHasta) return [];
    return licencias.filter((l) => {
      const f = l.fechaInicio.slice(0, 10);
      return f >= rangoDesde && f <= rangoHasta;
    });
  }
  return licencias;
}

function primerDiaMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

// Igual lógica que ya tenía AusentismoCard: a diferencia de filtrarPorPeriodo,
// acá hace falta un rango [desde, hasta] continuo de MESES (no solo las
// licencias que caen adentro), porque calcularAusentismoMensual arma una
// línea de tiempo con un bucket por mes, incluidos los meses en 0.
export function rangoMesesPeriodo(
  modo: ModoPeriodo,
  anioActivo: number,
  rangoDesde: string,
  rangoHasta: string,
  licencias: LicenciaAusentismoRow[],
  hoyDate: Date
): { desde: Date; hasta: Date } {
  if (modo === "anio") {
    return { desde: new Date(Date.UTC(anioActivo, 0, 1)), hasta: new Date(Date.UTC(anioActivo, 11, 1)) };
  }
  if (modo === "rango") {
    if (!rangoDesde || !rangoHasta) return { desde: new Date(1), hasta: new Date(0) };
    return { desde: primerDiaMes(new Date(rangoDesde)), hasta: primerDiaMes(new Date(rangoHasta)) };
  }
  if (licencias.length === 0) return { desde: hoyDate, hasta: hoyDate };
  const minFecha = licencias.reduce(
    (min, l) => (l.fechaInicio < min ? l.fechaInicio : min),
    licencias[0].fechaInicio
  );
  return { desde: primerDiaMes(new Date(minFecha)), hasta: primerDiaMes(hoyDate) };
}

// Turnos rotativos (A a F) — administrativo, full time, guardia larga,
// superior de turno y personal ingresante no forman parte de la rotación
// (ver Agente.turno en schema.prisma para la lista completa de valores).
export const TURNOS_ROTATIVOS = ["A", "B", "C", "D", "E", "F"] as const;

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

// Ranking por agente — misma lógica que ya tenía RankingPersonalCard.tsx,
// extraída acá para que el informe general (InformeLicenciasModal.tsx) la
// pueda llamar con los mismos datos sin duplicar la agregación.
export interface FilaPersonalRanking {
  agenteId: string;
  nombreCompleto: string;
  fotoUrl: string | null;
  sexo: string | null;
  porCausaCantidad: Record<CausaAusentismo, number>;
  porCausaDias: Record<CausaAusentismo, number>;
  totalCantidad: number;
  totalDias: number;
}

export function calcularRankingPersonal(
  licencias: LicenciaAusentismoRow[],
  metrica: "licencias" | "dias"
): FilaPersonalRanking[] {
  const porAgente = new Map<string, FilaPersonalRanking>();
  for (const l of licencias) {
    let fila = porAgente.get(l.agenteId);
    if (!fila) {
      fila = {
        agenteId: l.agenteId,
        nombreCompleto: `${l.agente.apellidos}, ${l.agente.nombres}`,
        fotoUrl: l.agente.fotoUrl,
        sexo: l.agente.sexo,
        porCausaCantidad: Object.fromEntries(CAUSAS_AUSENTISMO.map((c) => [c, 0])) as Record<CausaAusentismo, number>,
        porCausaDias: Object.fromEntries(CAUSAS_AUSENTISMO.map((c) => [c, 0])) as Record<CausaAusentismo, number>,
        totalCantidad: 0,
        totalDias: 0,
      };
      porAgente.set(l.agenteId, fila);
    }
    const causa = causaDeLicencia(l.tipo);
    fila.porCausaCantidad[causa] += 1;
    fila.porCausaDias[causa] += l.diasHabiles;
    fila.totalCantidad += 1;
    fila.totalDias += l.diasHabiles;
  }
  return [...porAgente.values()].sort((a, b) =>
    metrica === "licencias" ? b.totalCantidad - a.totalCantidad : b.totalDias - a.totalDias
  );
}

// Ranking por turno — misma lógica que ya tenía LicenciasPorTurnoCard.tsx.
export interface EjeTurno {
  turno: (typeof TURNOS_ROTATIVOS)[number];
  cantidad: number;
  ids: string[];
}

export function calcularPorTurno(licencias: LicenciaAusentismoRow[]): EjeTurno[] {
  const porTurno = new Map<(typeof TURNOS_ROTATIVOS)[number], { cantidad: number; ids: string[] }>(
    TURNOS_ROTATIVOS.map((t) => [t, { cantidad: 0, ids: [] }])
  );
  for (const l of licencias) {
    const t = l.agente.turno;
    if (!t || !(TURNOS_ROTATIVOS as readonly string[]).includes(t)) continue;
    const entrada = porTurno.get(t as (typeof TURNOS_ROTATIVOS)[number])!;
    entrada.cantidad += 1;
    if (!entrada.ids.includes(l.agenteId)) entrada.ids.push(l.agenteId);
  }
  return TURNOS_ROTATIVOS.map((t) => ({ turno: t, ...porTurno.get(t)! }));
}

// Ranking de diagnósticos de carpeta médica. El campo `motivo` de una
// carpeta médica se carga como "Diagnostico: <texto libre>" (con tipeos
// ocasionales del prefijo, ej. "Diagnostocp:" — ver la convención establecida
// durante la carga masiva de licencias históricas), a mano y sin un catálogo
// cerrado, así que el mismo diagnóstico puede terminar escrito con distinta
// mayúscula/acentuación entre una carga y otra (p. ej. "SÍNDROME GRIPAL" vs.
// "sindrome gripal"). `clave` normaliza eso (acentos/mayúsculas/espacios) Y
// además saca calificativos de severidad/cronicidad (a pedido explícito del
// usuario: "Gastritis" y "Gastritis Aguda" deben contar como el mismo
// diagnóstico) — pero NO calificativos que describen tipo/causa en vez de
// severidad (ej. "hemorrágica", "viral"), esos sí distinguen diagnósticos
// realmente distintos y quedan separados a propósito.
const PREFIJO_DIAGNOSTICO = /^diagn\S*:\s*/i;

const PALABRAS_SEVERIDAD = new Set([
  "agudo", "aguda", "agudos", "agudas",
  "cronico", "cronica", "cronicos", "cronicas",
  "severo", "severa", "severos", "severas",
  "leve", "leves",
  "moderado", "moderada", "moderados", "moderadas",
  "grave", "graves",
]);

// Sinónimos puntuales: mismo diagnóstico nombrado con otra palabra completa
// (no solo otra grafía/acento — para eso ya alcanza con sacar acentos — ni
// un calificativo de más — para eso está PALABRAS_SEVERIDAD). Curado a mano
// diagnóstico por diagnóstico a pedido del usuario, revisando el listado
// real: NO es un fuzzy-match automático por similitud de texto, para no
// arriesgarse a fusionar diagnósticos que solo "suenan parecido" pero son
// clínicamente distintos (ver el criterio ya establecido para "hemorrágica"/
// "alta" — esos SÍ quedan separados porque marcan una complicación o una
// ubicación anatómica distinta, no solo la causa). "Viral" en cambio sí se
// unifica a pedido del usuario: solo indica el agente causal, no cambia el
// cuadro en sí. Las claves ya pasaron por el resto de la normalización (sin
// acentos/mayúsculas/severidad) antes de llegar acá.
const SINONIMOS_DIAGNOSTICO: Record<string, string> = {
  // Cuadro gripal / gripe: mismo cuadro, muchas formas de nombrarlo —
  // algunas con tipeo de "sindrome" (sinfrome/sintondrome), o agregando
  // "y fiebre" (la fiebre ya es parte esperada del cuadro gripal).
  gripe: "sindrome gripal",
  "cuadro gripal": "sindrome gripal",
  "estado gripal": "sindrome gripal",
  "estado gripal y fiebre": "sindrome gripal",
  "sintoma gripal": "sindrome gripal",
  "sinfrome gripal": "sindrome gripal",
  "sintondrome gripal": "sindrome gripal",
  "enfermedad tipo influenza": "sindrome gripal",
  // Migraña
  "cuadro de migrana": "migrana",
  "cefalea migranosa": "migrana",
  // ITU es la sigla de "Infección de Tracto Urinario" — mismo diagnóstico.
  "itu infeccion de tracto urinario": "infeccion urinaria",
  // Faringoamigdalitis escrito como sus dos partes por separado, o con tipeo.
  "faringitis amigdalitis": "faringoamigdalitis",
  farinjoamigdalitis: "faringoamigdalitis",
  // "Viral" solo aclara la causa, no es un cuadro distinto.
  "faringitis viral": "faringitis",
  "conjuntivitis viral": "conjuntivitis",
  // Lumbalgia = dolor lumbar, mismo concepto con otra redacción.
  "dolor lumbar": "lumbalgia",
  // "Colitis" ya es intestinal por definición — "intestinal" acá es
  // redundante, no un calificativo que agregue información nueva.
  "colitis intestinal": "colitis",
  // "Cuadro de X"/"Trastorno de X" son la misma redacción "por bloque" ya
  // vista en "cuadro gripal"/"cuadro de migraña" — el diagnóstico de fondo
  // es el mismo, solo cambia el envoltorio clínico/burocrático.
  "cuadro de bronquitis": "bronquitis",
  "trastorno de ansiedad": "ansiedad",
  // Extracción dental: la pieza puntual (muela, molar inferior) no cambia
  // el tipo de ausencia, a pedido del usuario.
  "extraccion de muela": "extraccion dentaria",
  "extracion molar inferio": "extraccion dentaria",
  // Fiebre de menor grado — mismo criterio que agudo/leve/grave: la
  // intensidad no cambia el diagnóstico de base.
  febricula: "sindrome febril",
  // Tipeo (falta la "a" de "ciatalgia").
  "lumbocitalgia izquierda": "lumbociatalgia",
  // "Bronquitis espasmódica" es el nombre clínico de "bronquitis con
  // broncoespasmo" — mismo cuadro, una es el término médico y la otra la
  // descripción en palabras sueltas.
  "bronquitis y broncoespasmo": "bronquitis espasmodica",
  // Exacerbación asmática = crisis asmática: mismo término (un brote de
  // asma), no dos cuadros distintos.
  "exacerbacion asmatica": "crisis asmatica",
  // "Post quirúrgico" / "Postcirugía" son el mismo concepto sin especificar
  // qué cirugía — a diferencia de "Postcirugía dental" o "Post Operatorio
  // Septumplastia", que sí nombran una cirugía puntual y quedan separados.
  "post quirurgico": "postcirugia",
  // Mismo diagnóstico (osteocondritis rotuliana grado 2) documentado con
  // cada vez más detalle (lado, tratamiento) en licencias sucesivas — el
  // grado y la localización rotuliana ya identifican el mismo cuadro.
  "ostecondritis rotuliana grado 2 en rodilla derecha": "ostecondritis rotuliana grado 2",
  "ostecondritis rotuliana grado 2 en rodilla derecha tratamiento con infiltracion": "ostecondritis rotuliana grado 2",
  // Misma rodilla, misma lesión de cartílago rotuliano redactada dos veces
  // distinto ("condral" / "condrítica"), a pedido del usuario.
  "lesion condritica rotuliana de rodilla derecha": "lesion condral rotuliana rodilla derecha",
  // Mismo motivo (embarazo) con o sin la semana de gestación aclarada.
  "embarazo de 19 semanas": "embarazo",
  // Tipeos puntuales detectados en la carga real.
  cafalea: "cefalea",
  gastroeteritis: "gastroenteritis",
  umbalgia: "lumbalgia",
  "nauceas y vomito": "nauseas y vomito",
};

function normalizarDiagnostico(texto: string): string {
  const sinAcentos = texto
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // saca acentos para agrupar variantes de escritura
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " "); // puntuación → espacio, para no pegar "aguda." a la palabra siguiente
  const base = sinAcentos
    .split(/\s+/)
    .filter((palabra) => palabra && !PALABRAS_SEVERIDAD.has(palabra))
    .join(" ")
    .trim();
  return SINONIMOS_DIAGNOSTICO[base] ?? base;
}

// Palabras de severidad + "viral" (único calificativo de causa que también
// se unifica, ver SINONIMOS_DIAGNOSTICO) aplicadas al texto ORIGINAL
// (conserva mayúsculas/acentos de lo que quede) — para que la etiqueta que
// se muestra en pantalla nunca diga "Aguda" ni "Viral" aunque esa haya sido
// la variante de escritura más repetida del grupo: el grupo ya mezcla casos
// con y sin ese calificativo, así que mostrarlo en algunos casos sí y en
// otros no sería inconsistente.
const PALABRAS_OCULTAR_EN_ETIQUETA = new Set([...PALABRAS_SEVERIDAD, "viral", "virales"]);

function quitarPalabrasSeveridad(texto: string): string {
  const limpio = texto
    .split(/\s+/)
    .filter((palabra) => {
      const clave = palabra
        .normalize("NFD")
        .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      return !PALABRAS_OCULTAR_EN_ETIQUETA.has(clave);
    })
    .join(" ")
    .trim();
  return limpio || texto;
}

// Clave normalizada del diagnóstico de una licencia (null si no es carpeta
// médica o no tiene un motivo utilizable) — extraída aparte para que
// calcularRankingDiagnosticos y calcularEstacionalidadDiagnostico apliquen
// exactamente el mismo criterio de agrupación sin duplicarlo.
function claveDiagnostico(l: LicenciaAusentismoRow): string | null {
  if (l.tipo !== "CARPETA_MEDICA" || !l.motivo) return null;
  const texto = l.motivo.replace(PREFIJO_DIAGNOSTICO, "").trim();
  if (!texto) return null;
  const clave = normalizarDiagnostico(texto);
  return clave || null;
}

export interface FilaDiagnostico {
  clave: string; // normalizado (sin acentos/mayúsculas) — identidad del grupo
  etiqueta: string; // variante de escritura más repetida del grupo, sin palabras de severidad (ver quitarPalabrasSeveridad) — no se reinventa capitalización del resto
  cantidad: number;
  ids: string[];
}

export function calcularRankingDiagnosticos(licencias: LicenciaAusentismoRow[]): FilaDiagnostico[] {
  const grupos = new Map<string, { cantidad: number; ids: string[]; variantes: Map<string, number> }>();
  for (const l of licencias) {
    const clave = claveDiagnostico(l);
    if (!clave || !l.motivo) continue;
    const texto = l.motivo.replace(PREFIJO_DIAGNOSTICO, "").trim();
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { cantidad: 0, ids: [], variantes: new Map() };
      grupos.set(clave, grupo);
    }
    grupo.cantidad += 1;
    if (!grupo.ids.includes(l.agenteId)) grupo.ids.push(l.agenteId);
    grupo.variantes.set(texto, (grupo.variantes.get(texto) ?? 0) + 1);
  }
  return [...grupos.entries()]
    .map(([clave, g]) => {
      let etiqueta = clave;
      let mejorConteo = 0;
      for (const [variante, conteo] of g.variantes) {
        if (conteo > mejorConteo) {
          etiqueta = variante;
          mejorConteo = conteo;
        }
      }
      return { clave, etiqueta: quitarPalabrasSeveridad(etiqueta), cantidad: g.cantidad, ids: g.ids };
    })
    .sort((a, b) => b.cantidad - a.cantidad);
}

// Esqueleto de meses reales (cronológico, no cíclico) entre `desde` y
// `hasta` — mismo criterio de etiquetado que calcularAusentismoMensual
// (año en la primera columna y en cada enero), extraído aparte para que
// EstacionalidadDiagnosticosCard.tsx arme UN solo eje de meses compartido
// por todas las series que esté comparando.
export interface MesEnRango {
  key: string; // "2025-03"
  label: string; // "mar" o "mar '25" en enero / primer mes de la serie
  mesLargo: string; // "Marzo 2025"
}

export function mesesEntre(desde: Date, hasta: Date): MesEnRango[] {
  const meses: MesEnRango[] = [];
  if (desde > hasta) return meses;
  const cursor = new Date(desde);
  while (cursor <= hasta) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const esPrimeroOEnero = meses.length === 0 || m === 0;
    meses.push({
      key: claveMes(cursor),
      label: esPrimeroOEnero ? `${MESES_CORTOS[m]} '${String(y).slice(2)}` : MESES_CORTOS[m],
      mesLargo: `${MESES_LARGOS[m]} ${y}`,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return meses;
}

// Cantidad de carpetas médicas de un diagnóstico puntual en cada mes real de
// `meses` (línea de tiempo cronológica de verdad, ej. desde que arrancó el
// programa en 2024 hasta hoy — NO un ciclo de 12 meses que junta todos los
// eneros entre sí) — para que, comparando 2+ diagnósticos, todas las series
// compartan el mismo eje y arranquen del mismo punto (mismo criterio que el
// gráfico de referencia del usuario: Car y Transit miden ambos sobre el
// mismo espectro de minutos, no uno por separado).
export function calcularEstacionalidadDiagnostico(licencias: LicenciaAusentismoRow[], clave: string, meses: MesEnRango[]): number[] {
  const indice = new Map(meses.map((m, i) => [m.key, i]));
  const porMes = new Array(meses.length).fill(0) as number[];
  for (const l of licencias) {
    if (claveDiagnostico(l) !== clave) continue;
    const i = indice.get(claveMes(new Date(l.fechaInicio)));
    if (i !== undefined) porMes[i] += 1;
  }
  return porMes;
}

// Ausentismo normalizado por dotación — "licencias por cada 100 agentes
// activos", para poder ver si el crecimiento de licencias es solo reflejo
// del crecimiento de personal o si hay algo más. flujoMeses acepta la forma
// estructural de FlujoMensual (dashboard/stats.ts) en vez de importar ese
// tipo — ese archivo ya importa de acá, y un import en el otro sentido
// crearía un ciclo.
export interface FilaAusentismoDotacion {
  key: string;
  label: string;
  mesLargo: string;
  cantidad: number;
  dotacion: number;
  tasaPor100: number;
}

export function calcularAusentismoPorDotacion(
  meses: AusentismoMensual[],
  flujoMeses: { key: string; neto: number }[]
): FilaAusentismoDotacion[] {
  // Dotación acumulada mes a mes (altas - bajas desde el primer ingreso
  // registrado): no hay dato de "cuánta gente había" en un momento dado,
  // solo el flujo de entradas/salidas, así que se reconstruye sumando.
  const dotacionPorClave = new Map<string, number>();
  let acumulado = 0;
  for (const m of flujoMeses) {
    acumulado += m.neto;
    dotacionPorClave.set(m.key, acumulado);
  }
  return meses.map((m) => {
    const dotacion = dotacionPorClave.get(m.key) ?? 0;
    return {
      key: m.key,
      label: m.label,
      mesLargo: m.mesLargo,
      cantidad: m.cantidad,
      dotacion,
      tasaPor100: dotacion > 0 ? (m.cantidad / dotacion) * 100 : 0,
    };
  });
}
