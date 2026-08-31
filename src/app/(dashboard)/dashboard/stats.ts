import { prisma } from "@/lib/prisma";
import { getOrSet, CACHE_TTL } from "@/lib/redis";
import type { TipoPersonal, TipoLicencia, OrigenInstitucional } from "@/types";
import { TIPOS_PERSONAL, TIPOS_LICENCIA } from "@/types";
import { compararTurnos } from "../personal/lib";
import { MESES_CORTOS, MESES_LARGOS, claveMes, type LicenciaAusentismoRow } from "@/lib/ausentismo";

// Mismo horizonte para "licencias que vencen pronto" (alerta) y "licencias
// próximas a iniciar" (sub-línea del KPI) — confirmado con el usuario.
const VENTANA_DIAS_ALERTA = 7;

// Los 2 sectores que, organizativamente, son el Departamento Alerta Ciudadana
// aunque en la tabla Sector estén cargados como filas independientes (ver
// memoria del proyecto sobre la jerarquía de sectores no reflejada en la BD).
// División Alerta y División Coordinación Vecinal se fusionaron en un único
// sector ("División Alerta y Coordinación Vecinal") en agosto 2026.
const NOMBRE_ALERTA_CIUDADANA = "Departamento Alerta Ciudadana";
const SECTORES_ALERTA_CIUDADANA = new Set([
  NOMBRE_ALERTA_CIUDADANA,
  "División Alerta y Coordinación Vecinal",
]);

const ORIGEN_LABEL: Record<OrigenInstitucional, string> = {
  GOBIERNO: "Gobierno",
  DMCA: "DMCA",
  "911": "911",
  OTRA_DEPENDENCIA: "Otra dependencia",
};
const SIN_ORIGEN_LABEL = "Sin clasificar";

function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
}

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

export interface KpiStats {
  enPase: number;
  enBaja: number;
  legajosPendientes: number;
  licenciasActivasHoy: number;
  licenciasActivasHoyIds: string[];
  licenciasProximas: number;
}

export interface AlertaLicenciasPorVencer {
  cantidad: number;
  apellidosMuestra: string[];
  restantes: number;
}

export interface AlertaStats {
  licenciasPorVencer: AlertaLicenciasPorVencer;
  conducirVencida: number;
  conducirVencidaIds: string[];
  chalecoVencido: number;
  chalecoVencidoIds: string[];
  chalecoTotal: number;
}

export interface ConteoLabel {
  label: string;
  count: number;
}

export interface ConteoConIds {
  label: string;
  count: number;
  ids: string[];
}

export interface TipoPersonalStats {
  tipo: TipoPersonal;
  count: number;
  pct: number;
}

export interface RingStats {
  count: number;
  pct: number;
}

export interface HijosStats {
  conHijos: RingStats;
  conHijosIds: string[];
  sinHijos: RingStats;
  sinHijosIds: string[];
  totalActivos: number;
  histograma: ConteoConIds[]; // "0 hijos".."4 hijos", "+4 hijos"
}

export interface PadresMadresStats {
  padres: RingStats;
  padresIds: string[];
  madres: RingStats;
  madresIds: string[];
  totalConHijos: number;
}

export interface FlujoMensual {
  key: string; // "2025-03"
  label: string; // "mar" o "mar '25" en enero / primer mes de la serie
  mesLargo: string; // "Marzo 2025"
  altas: number;
  altasIds: string[];
  bajas: number;
  bajasIds: string[];
  neto: number;
}

export interface FlujoPersonalStats {
  meses: FlujoMensual[];
  totalAltas: number;
  totalBajas: number;
  totalNeto: number;
  escalaMax: number; // techo del eje, redondeado, para dibujar las barras
}

export interface NovedadTipoStats {
  tipo: TipoLicencia;
  count: number;
  ids: string[];
}

export interface TnoStats {
  count: number;
  ids: string[];
}

export interface DashboardStats {
  // Snapshot del "hoy" server-side usado para armar el resto de las stats —
  // AusentismoCard.tsx lo reusa como límite superior del rango "Todo el
  // historial" al recalcular el gráfico por período en el cliente, para que
  // el primer render (SSR) y la hidratación arranquen del mismo punto en
  // vez de que el cliente llame a su propio `new Date()`.
  hoy: string;
  kpi: KpiStats;
  alertas: AlertaStats;
  tno: TnoStats;
  cursoAscenso: TnoStats;
  totalActivos: number;
  turno: ConteoLabel[];
  dependencia: ConteoConIds[];
  origenInstitucional: ConteoConIds[];
  tipoPersonal: TipoPersonalStats[];
  sexo: { masculino: RingStats; femenino: RingStats; otros: ConteoLabel[] };
  hijos: HijosStats;
  padresMadres: PadresMadresStats;
  flujoPersonal: FlujoPersonalStats;
  // Filas crudas (no pre-agrupadas por mes): a diferencia del resto de las
  // stats, "Ausentismo por causa" ahora se recalcula en el cliente cuando
  // el usuario cambia de período (ver AusentismoCard.tsx) — mismo criterio
  // que ya usa EstadisticasLicencias.tsx para el informe por legajo.
  ausentismoLicencias: LicenciaAusentismoRow[];
  // Licencia Ordinaria (vacaciones), aparte de `ausentismoLicencias` — el
  // único consumidor es RankingPersonalCard.tsx, con su propio checkbox
  // "Licencia Ordinaria" desactivado por defecto (ver ese componente). El
  // resto de los gráficos de ausentismo sigue sin verla nunca.
  licenciasOrdinarias: LicenciaAusentismoRow[];
  novedades: NovedadTipoStats[];
}

// El gráfico expresa entrada/salida de personal DE LA DEPENDENCIA, no de la
// fuerza. Ingresos = fechaIngreso del agente (dato laboral cargado en el
// legajo, no cuándo se validó el legajo en el sistema). Bajas = transiciones
// a "BAJA" o "PASE" en HistorialEstado — ambas sacan al agente de la nómina
// activa acá, aunque el motivo sea distinto (baja real vs. pase a otra
// dependencia). El alta por validación de legajo (PENDIENTE→ACTIVO en
// legajo.ts) no pasa por HistorialEstado, por eso no se puede usar la misma
// tabla para ambos lados.
//
// Asimetría conocida: si alguien vuelve de un pase (PASE→ACTIVO), ese regreso
// no se cuenta como un nuevo ingreso porque fechaIngreso no se actualiza — solo
// se resta al irse, no se suma al volver. Si esto empieza a pasar seguido,
// hay que revisar el criterio.
//
// Un agente puede tener varias transiciones el mismo mes (pruebas corregidas
// al toque, o un pase-y-vuelta real). Lo que cuenta como "baja" de ese mes es
// el ÚLTIMO estado al que llegó ese agente dentro del mes, no cada fila suelta
// de HistorialEstado — si terminó de nuevo en ACTIVO, no fue una baja real
// aunque haya pasado por BAJA/PASE en el medio.
//
// Pero además hace falta el PRIMER estadoAnterior del mes: un agente que ya
// venía de PASE (se fue en un mes anterior) y en este mes solo tiene un
// cambio interno PASE→BAJA no volvió a irse de la nómina activa — ya no
// estaba. Sin este chequeo, esa transición se contaba como una baja nueva en
// AMBOS meses (el mes real en que se fue y el mes del cambio de estado
// posterior), duplicando a la misma persona en dos barras distintas.
function calcularFlujoPersonal(
  hoy: Date,
  agentesConIngreso: { id: string; fechaIngreso: Date }[],
  transicionesEstado: { agenteId: string; estadoAnterior: string; estadoNuevo: string; createdAt: Date }[]
): FlujoPersonalStats {
  if (agentesConIngreso.length === 0) {
    return { meses: [], totalAltas: 0, totalBajas: 0, totalNeto: 0, escalaMax: 5 };
  }

  const minFecha = agentesConIngreso.reduce(
    (min, a) => (a.fechaIngreso < min ? a.fechaIngreso : min),
    agentesConIngreso[0].fechaIngreso
  );
  const inicio = new Date(Date.UTC(minFecha.getUTCFullYear(), minFecha.getUTCMonth(), 1));
  const fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));

  const meses: FlujoMensual[] = [];
  const cursor = new Date(inicio);
  while (cursor <= fin) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const esPrimeroOEnero = meses.length === 0 || m === 0;
    meses.push({
      key: claveMes(cursor),
      label: esPrimeroOEnero ? `${MESES_CORTOS[m]} '${String(y).slice(2)}` : MESES_CORTOS[m],
      mesLargo: `${MESES_LARGOS[m]} ${y}`,
      altas: 0,
      altasIds: [],
      bajas: 0,
      bajasIds: [],
      neto: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const indicePorClave = new Map(meses.map((m, i) => [m.key, i]));
  for (const a of agentesConIngreso) {
    const i = indicePorClave.get(claveMes(a.fechaIngreso));
    if (i !== undefined) {
      meses[i].altas++;
      meses[i].altasIds.push(a.id);
    }
  }
  const primeraTransicionPorAgenteYMes = new Map<string, { estadoAnterior: string; createdAt: Date }>();
  const ultimaTransicionPorAgenteYMes = new Map<string, { agenteId: string; estadoNuevo: string; createdAt: Date }>();
  for (const t of transicionesEstado) {
    const clave = `${t.agenteId}|${claveMes(t.createdAt)}`;
    const primera = primeraTransicionPorAgenteYMes.get(clave);
    if (!primera || t.createdAt < primera.createdAt) {
      primeraTransicionPorAgenteYMes.set(clave, t);
    }
    const ultima = ultimaTransicionPorAgenteYMes.get(clave);
    if (!ultima || t.createdAt > ultima.createdAt) {
      ultimaTransicionPorAgenteYMes.set(clave, t);
    }
  }
  for (const [clave, t] of ultimaTransicionPorAgenteYMes) {
    if (t.estadoNuevo !== "BAJA" && t.estadoNuevo !== "PASE") continue;
    // Sólo cuenta si, al entrar el mes, el agente todavía estaba activo —
    // si ya venía de un PASE/BAJA anterior, esto es un cambio de estado
    // interno, no una salida nueva de la nómina activa.
    if (primeraTransicionPorAgenteYMes.get(clave)?.estadoAnterior !== "ACTIVO") continue;
    const i = indicePorClave.get(claveMes(t.createdAt));
    if (i !== undefined) {
      meses[i].bajas++;
      meses[i].bajasIds.push(t.agenteId);
    }
  }

  let totalAltas = 0;
  let totalBajas = 0;
  let picoMes = 1;
  for (const m of meses) {
    m.neto = m.altas - m.bajas;
    totalAltas += m.altas;
    totalBajas += m.bajas;
    picoMes = Math.max(picoMes, m.altas, m.bajas);
  }
  const escalaMax = Math.max(5, Math.ceil(picoMes / 5) * 5);

  return { meses, totalAltas, totalBajas, totalNeto: totalAltas - totalBajas, escalaMax };
}

async function calcularStats(): Promise<DashboardStats> {
  const hoy = hoyUTC();
  const finVentana = sumarDias(hoy, VENTANA_DIAS_ALERTA);

  const [
    enPase,
    enBaja,
    legajosPendientes,
    licenciasActivasHoyRows,
    licenciasProximas,
    licenciasPorVencerRows,
    novedadesPorTipo,
    conducirVencidaRows,
    chalecoVencidoRows,
    chalecoTotal,
    tnoRows,
    cursoAscensoRows,
    totalActivos,
    porTurno,
    agentesPorSector,
    sectores,
    porTipo,
    porSexo,
    agentesPorHijos,
    agentesConHijos,
    agentesConIngreso,
    transicionesEstado,
    agentesPorOrigen,
    ausentismoRows,
  ] = await Promise.all([
    prisma.agente.count({ where: { estado: "PASE" } }),
    prisma.agente.count({ where: { estado: "BAJA" } }),
    prisma.agente.count({ where: { estado: "PENDIENTE" } }),
    // Igual que en /licencias: si el agente ya no está activo (baja o pase),
    // su licencia deja de contar acá aunque el rango de fechas siga vigente.
    // findMany (no count) para poder ofrecer el drill-down a /personal con
    // los agentes puntuales, igual que conducirVencidaIds/chalecoVencidoIds.
    prisma.licencia.findMany({
      where: { estado: "APROBADA", fechaInicio: { lte: hoy }, fechaFin: { gte: hoy }, agente: { estado: "ACTIVO" } },
      select: { agenteId: true },
    }),
    prisma.licencia.count({
      where: { estado: "APROBADA", fechaInicio: { gt: hoy, lte: finVentana }, agente: { estado: "ACTIVO" } },
    }),
    // Mismo criterio que licenciasActivasHoy/licenciasProximas: si el agente
    // ya no está activo (baja o pase), su licencia deja de aparecer acá.
    prisma.licencia.findMany({
      where: { estado: "APROBADA", fechaFin: { gte: hoy, lte: finVentana }, agente: { estado: "ACTIVO" } },
      select: { agenteId: true, agente: { select: { apellidos: true } } },
      orderBy: { fechaFin: "asc" },
    }),
    // "Novedades administrativas" (cajón del dashboard): mismo criterio de
    // "vigente hoy" que licenciasActivasHoy, desglosado por tipo. findMany
    // (no groupBy) para poder ofrecer el drill-down a /personal con los
    // agentes puntuales de cada tipo, igual que el resto de las tarjetas.
    prisma.licencia.findMany({
      where: { estado: "APROBADA", fechaInicio: { lte: hoy }, fechaFin: { gte: hoy }, agente: { estado: "ACTIVO" } },
      select: { tipo: true, agenteId: true },
    }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO", tipoPersonal: { in: ["SEGURIDAD", "TECNICO"] }, licenciaVencimiento: { lt: hoy } },
      select: { id: true },
    }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO", tipoPersonal: "SEGURIDAD", chalecoProvisto: true, vencimientoChaleco: { lt: hoy } },
      select: { id: true },
    }),
    prisma.agente.count({
      where: { estado: "ACTIVO", tipoPersonal: "SEGURIDAD", chalecoProvisto: true },
    }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO", tipoPersonal: "SEGURIDAD", enTNO: true },
      select: { id: true },
    }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO", fechaInicioCursoAscenso: { not: null } },
      select: { id: true },
    }),
    prisma.agente.count({ where: { estado: "ACTIVO" } }),
    prisma.agente.groupBy({ by: ["turno"], where: { estado: "ACTIVO" }, _count: { _all: true } }),
    prisma.agente.findMany({ where: { estado: "ACTIVO" }, select: { id: true, sectorId: true } }),
    prisma.sector.findMany({ select: { id: true, nombre: true } }),
    prisma.agente.groupBy({ by: ["tipoPersonal"], where: { estado: "ACTIVO" }, _count: { _all: true } }),
    prisma.agente.groupBy({ by: ["sexo"], where: { estado: "ACTIVO" }, _count: { _all: true } }),
    prisma.agente.findMany({ where: { estado: "ACTIVO" }, select: { id: true, hijosCargo: true } }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO", hijosCargo: { gt: 0 } },
      select: { id: true, sexo: true },
    }),
    prisma.agente.findMany({
      where: { fechaIngreso: { not: null } },
      select: { id: true, fechaIngreso: true },
    }),
    // Se traen TODAS las transiciones (no solo a BAJA/PASE): calcularFlujoPersonal
    // necesita ver también los regresos a ACTIVO para saber cuál fue el último
    // estado real de cada agente dentro del mes.
    prisma.historialEstado.findMany({
      select: { agenteId: true, estadoAnterior: true, estadoNuevo: true, createdAt: true },
    }),
    prisma.agente.findMany({
      where: { estado: "ACTIVO" },
      select: { id: true, origenInstitucional: true },
    }),
    // Se trae TODO lo APROBADO, incluida Ordinaria (vacaciones planificadas)
    // — se separa recién abajo en dos arrays (ausentismoLicencias /
    // licenciasOrdinarias) en vez de excluirla acá: RankingPersonalCard.tsx
    // necesita poder sumarla opcionalmente, el resto de los gráficos sigue
    // recibiendo exactamente lo mismo que antes. Sin filtro por
    // agente.estado, ver comentario en calcularAusentismoMensual.
    prisma.licencia.findMany({
      where: { estado: "APROBADA" },
      select: {
        tipo: true,
        fechaInicio: true,
        agenteId: true,
        diasHabiles: true,
        motivo: true,
        agente: { select: { nombres: true, apellidos: true, fotoUrl: true, sexo: true, turno: true, estado: true, tipoPersonal: true } },
      },
    }),
  ]);

  // ── Alerta: licencias por vencer — apellidos únicos, hasta 5, orden por vencimiento ──
  const apellidosUnicos: string[] = [];
  const agentesVistos = new Set<string>();
  for (const row of licenciasPorVencerRows) {
    if (agentesVistos.has(row.agenteId)) continue;
    agentesVistos.add(row.agenteId);
    apellidosUnicos.push(row.agente.apellidos);
  }
  const licenciasPorVencer: AlertaLicenciasPorVencer = {
    cantidad: licenciasPorVencerRows.length,
    apellidosMuestra: apellidosUnicos.slice(0, 5),
    restantes: Math.max(0, apellidosUnicos.length - 5),
  };

  // ── Turno: A–F primero, luego el resto por la convención ya usada en /personal ──
  const turno: ConteoLabel[] = porTurno
    .filter((t) => t.turno !== null)
    .map((t) => ({ label: t.turno as string, count: t._count._all }))
    .sort((a, b) => compararTurnos(a.label, b.label));
  const sinTurno = porTurno.find((t) => t.turno === null);
  if (sinTurno && sinTurno._count._all > 0) {
    turno.push({ label: "Sin turno asignado", count: sinTurno._count._all });
  }

  // ── Dependencia: fold de los 3 sectores de Alerta Ciudadana + bucket sin sector ──
  const nombrePorId = new Map(sectores.map((s) => [s.id, s.nombre]));
  const dependenciaIdsMap = new Map<string, string[]>();
  const sinDependenciaIds: string[] = [];
  for (const a of agentesPorSector) {
    const nombre = a.sectorId ? nombrePorId.get(a.sectorId) : null;
    if (!nombre) {
      sinDependenciaIds.push(a.id);
      continue;
    }
    const clave = SECTORES_ALERTA_CIUDADANA.has(nombre) ? NOMBRE_ALERTA_CIUDADANA : nombre;
    const lista = dependenciaIdsMap.get(clave);
    if (lista) lista.push(a.id);
    else dependenciaIdsMap.set(clave, [a.id]);
  }
  const dependencia: ConteoConIds[] = Array.from(dependenciaIdsMap, ([label, ids]) => ({
    label,
    count: ids.length,
    ids,
  })).sort((a, b) => b.count - a.count);
  if (sinDependenciaIds.length > 0) {
    dependencia.push({ label: "Sin dependencia asignada", count: sinDependenciaIds.length, ids: sinDependenciaIds });
  }

  // ── Origen institucional: 911 / DMCA / Gobierno / Otra dependencia ──
  const origenIdsMap = new Map<string, string[]>();
  for (const a of agentesPorOrigen) {
    const label = a.origenInstitucional && a.origenInstitucional in ORIGEN_LABEL
      ? ORIGEN_LABEL[a.origenInstitucional as OrigenInstitucional]
      : SIN_ORIGEN_LABEL;
    const lista = origenIdsMap.get(label);
    if (lista) lista.push(a.id);
    else origenIdsMap.set(label, [a.id]);
  }
  const origenInstitucional: ConteoConIds[] = Array.from(origenIdsMap, ([label, ids]) => ({
    label,
    count: ids.length,
    ids,
  })).sort((a, b) => b.count - a.count);

  // ── Novedades administrativas: con 15 tipos posibles, solo se muestran los
  // que tienen actividad hoy (mostrar los 15 siempre, la mayoría en 0, dejó de
  // ser "de un vistazo" como cuando eran 8) ──
  const idsPorTipoLicencia = Object.fromEntries(TIPOS_LICENCIA.map((t) => [t, [] as string[]])) as Record<TipoLicencia, string[]>;
  for (const n of novedadesPorTipo) {
    idsPorTipoLicencia[n.tipo as TipoLicencia].push(n.agenteId);
  }
  const novedades: NovedadTipoStats[] = TIPOS_LICENCIA
    .map((tipo) => ({ tipo, count: idsPorTipoLicencia[tipo].length, ids: idsPorTipoLicencia[tipo] }))
    .filter((n) => n.count > 0);

  const tno: TnoStats = { count: tnoRows.length, ids: tnoRows.map((a) => a.id) };
  const cursoAscenso: TnoStats = { count: cursoAscensoRows.length, ids: cursoAscensoRows.map((a) => a.id) };

  // ── Tipo de personal: todos los tipos presentes aunque tengan 0 ──
  const conteoPorTipo = Object.fromEntries(TIPOS_PERSONAL.map((t) => [t, 0])) as Record<TipoPersonal, number>;
  for (const t of porTipo) {
    conteoPorTipo[t.tipoPersonal as TipoPersonal] = t._count._all;
  }
  const tipoPersonal: TipoPersonalStats[] = TIPOS_PERSONAL.map((tipo) => ({
    tipo,
    count: conteoPorTipo[tipo],
    pct: pct(conteoPorTipo[tipo], totalActivos),
  })).sort((a, b) => b.count - a.count);

  // ── Sexo: Masculino/Femenino como anillos principales, el resto como chips ──
  const conteoPorSexo = new Map(porSexo.map((s) => [s.sexo, s._count._all]));
  const masc = conteoPorSexo.get("MASCULINO") ?? 0;
  const fem = conteoPorSexo.get("FEMENINO") ?? 0;
  const otros: ConteoLabel[] = porSexo
    .filter((s) => s.sexo !== "MASCULINO" && s.sexo !== "FEMENINO")
    .map((s) => ({ label: s.sexo, count: s._count._all }))
    .filter((o) => o.count > 0);

  // ── Hijos a cargo: con/sin + histograma 0..4 / +4 ──
  const conHijosIds = agentesPorHijos.filter((a) => a.hijosCargo > 0).map((a) => a.id);
  const sinHijosIds = agentesPorHijos.filter((a) => a.hijosCargo === 0).map((a) => a.id);
  const balde: string[][] = [[], [], [], [], []]; // 0,1,2,3,4
  const masDeCuatroIds: string[] = [];
  for (const a of agentesPorHijos) {
    if (a.hijosCargo >= 0 && a.hijosCargo <= 4) balde[a.hijosCargo].push(a.id);
    else if (a.hijosCargo > 4) masDeCuatroIds.push(a.id);
  }
  const histograma: ConteoConIds[] = [
    { label: "0 hijos", count: balde[0].length, ids: balde[0] },
    { label: "1 hijo", count: balde[1].length, ids: balde[1] },
    { label: "2 hijos", count: balde[2].length, ids: balde[2] },
    { label: "3 hijos", count: balde[3].length, ids: balde[3] },
    { label: "4 hijos", count: balde[4].length, ids: balde[4] },
    { label: "+4 hijos", count: masDeCuatroIds.length, ids: masDeCuatroIds },
  ];

  // ── Padres y madres: entre los que tienen hijos a cargo, Masculino/Femenino ──
  const padresIds = agentesConHijos.filter((a) => a.sexo === "MASCULINO").map((a) => a.id);
  const madresIds = agentesConHijos.filter((a) => a.sexo === "FEMENINO").map((a) => a.id);
  const padresCount = padresIds.length;
  const madresCount = madresIds.length;
  const totalConHijos = padresCount + madresCount;

  const fechasIngreso = agentesConIngreso
    .filter((a): a is { id: string; fechaIngreso: Date } => a.fechaIngreso !== null);
  const flujoPersonal = calcularFlujoPersonal(hoy, fechasIngreso, transicionesEstado);
  const mapearAusentismoRow = (l: (typeof ausentismoRows)[number]): LicenciaAusentismoRow => ({
    tipo: l.tipo,
    fechaInicio: l.fechaInicio.toISOString(),
    agenteId: l.agenteId,
    diasHabiles: l.diasHabiles,
    motivo: l.motivo,
    agente: {
      nombres: l.agente.nombres,
      apellidos: l.agente.apellidos,
      fotoUrl: l.agente.fotoUrl,
      sexo: l.agente.sexo,
      turno: l.agente.turno,
      estado: l.agente.estado,
      tipoPersonal: l.agente.tipoPersonal,
    },
  });
  const ausentismoLicencias: LicenciaAusentismoRow[] = ausentismoRows
    .filter((l) => l.tipo !== "ORDINARIA")
    .map(mapearAusentismoRow);
  const licenciasOrdinarias: LicenciaAusentismoRow[] = ausentismoRows
    .filter((l) => l.tipo === "ORDINARIA")
    .map(mapearAusentismoRow);

  const licenciasActivasHoyIds = licenciasActivasHoyRows.map((l) => l.agenteId);

  return {
    hoy: hoy.toISOString(),
    kpi: {
      enPase,
      enBaja,
      legajosPendientes,
      licenciasActivasHoy: licenciasActivasHoyRows.length,
      licenciasActivasHoyIds,
      licenciasProximas,
    },
    alertas: {
      licenciasPorVencer,
      conducirVencida: conducirVencidaRows.length,
      conducirVencidaIds: conducirVencidaRows.map((a) => a.id),
      chalecoVencido: chalecoVencidoRows.length,
      chalecoVencidoIds: chalecoVencidoRows.map((a) => a.id),
      chalecoTotal,
    },
    tno,
    cursoAscenso,
    totalActivos,
    turno,
    dependencia,
    origenInstitucional,
    tipoPersonal,
    sexo: {
      masculino: { count: masc, pct: pct(masc, totalActivos) },
      femenino: { count: fem, pct: pct(fem, totalActivos) },
      otros,
    },
    hijos: {
      conHijos: { count: conHijosIds.length, pct: pct(conHijosIds.length, totalActivos) },
      conHijosIds,
      sinHijos: { count: sinHijosIds.length, pct: pct(sinHijosIds.length, totalActivos) },
      sinHijosIds,
      totalActivos,
      histograma,
    },
    padresMadres: {
      padres: { count: padresCount, pct: pct(padresCount, totalConHijos) },
      padresIds,
      madres: { count: madresCount, pct: pct(madresCount, totalConHijos) },
      madresIds,
      totalConHijos,
    },
    flujoPersonal,
    ausentismoLicencias,
    licenciasOrdinarias,
    novedades,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return getOrSet("dashboard:stats:all", CACHE_TTL.OPERATIVO, calcularStats);
}
