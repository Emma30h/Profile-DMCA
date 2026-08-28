// Temas de color para la descarga de gráficos como imagen (ver
// GraficoDescargable.tsx). Cada tema define un fondo (claro u oscuro) y una
// paleta categórica de 8 colores, más un par de combinaciones puntuales que
// necesitan su propia validación aparte (el donut de tipo de personal
// necesita 4 colores que pasen el chequeo `--pairs all`, porque el orden de
// sus porciones depende de los datos — un simple slice de 4 índices del
// array de 8 no alcanza, ver abajo).
//
// Los 5 temas fueron diseñados y validados de verdad con
// scripts/validate_palette.js del skill dataviz — banda de luminosidad,
// piso de croma, separación CVD, piso de visión normal — contra la
// superficie real en la que se dibuja cada grupo de colores:
//   - `categorico` (usado en gráficos de barra/línea apilados, donde solo
//     importan los vecinos): --mode light|dark --surface <fondo del tema>,
//     --pairs adjacent, en el mismo orden en que aparecen en cada gráfico
//     (ver colorDeCausa en ausentismo.ts).
//   - El par sexoMasc/sexoFem (RingCompare, dos círculos uno al lado del
//     otro): validado como para suelto, no necesariamente los índices 0/4.
//   - `donut` (DonutTipoPersonal, 4 porciones en orden variable según los
//     datos): validado con --pairs all contra el fondo fijo de la pista del
//     anillo (#0b1220, hardcodeado en ese componente) — ningún subconjunto
//     de 4 del array de 8 pasa ese chequeo más estricto (confirmado
//     exhaustivamente), así que cada tema define su propia combinación de
//     4 colores para este caso puntual, igual que ya hacía el tema
//     institucional con su CIVIL_POLICIAL "extra".
//
// Los colores de ESTADO (verde/rojo de ingresos-bajas en FlujoPersonalCard,
// el par con/sin-hijos de HijosACargoCard, el gris de "Otros"/misceláneo)
// quedan fuera de este archivo a propósito: no son identidad de serie, son
// semántica ("bien"/"mal"/"sin dato"), y quedan iguales en los 5 temas.
export interface ChartTheme {
  id: string;
  nombre: string;
  // Fondo forzado del preview/export — claro (blanco) u oscuro.
  modo: "light" | "dark";
  fondo: string;
  // 8 colores categóricos, en el mismo orden que usan las causas de
  // ausentismo (CARPETA_MEDICA, MEDICA, ASISTENCIA, MATERNIDAD, PATERNIDAD,
  // FALLECIMIENTO — los 6 primeros — más 2 de reserva) — ver colorDeCausa.
  categorico: string[];
  // Color único para gráficos de una sola serie (línea, barra destacada,
  // polígono de radar) — = categorico[0].
  accent: string;
  // Par para comparaciones de sexo (RingCompare).
  sexoMasc: string;
  sexoFem: string;
  // Combinación propia para el donut de tipo de personal (ver comentario
  // arriba — necesita su propia validación con --pairs all).
  donut: {
    seguridad: string;
    tecnico: string;
    civilBecario: string;
    civilPolicial: string;
  };
}

export const TEMA_INSTITUCIONAL: ChartTheme = {
  id: "institucional",
  nombre: "Institucional",
  modo: "light",
  fondo: "#ffffff",
  categorico: [
    "#3987e5", // azul
    "#d95926", // naranja
    "#199e70", // aqua
    "#c98500", // ámbar
    "#d55181", // magenta
    "#008300", // verde
    "#9085e9", // violeta
    "#e66767", // rojo
  ],
  accent: "#3987e5",
  sexoMasc: "#3987e5",
  sexoFem: "#d55181",
  donut: {
    seguridad: "#3987e5",
    tecnico: "#199e70",
    civilBecario: "#e66767",
    civilPolicial: "#a67c00",
  },
};

export const TEMA_OCEANO: ChartTheme = {
  id: "oceano",
  nombre: "Océano",
  modo: "light",
  fondo: "#ffffff",
  categorico: ["#0096b6", "#6a3cc0", "#009134", "#005bb3", "#008f8a", "#4175de", "#00905e", "#0073cf"],
  accent: "#0096b6",
  sexoMasc: "#6a3cc0",
  sexoFem: "#009134",
  donut: {
    seguridad: "#0096b6",
    tecnico: "#6a3cc0",
    civilBecario: "#009134",
    civilPolicial: "#cf2a70",
  },
};

export const TEMA_ATARDECER: ChartTheme = {
  id: "atardecer",
  nombre: "Atardecer",
  modo: "light",
  fondo: "#ffffff",
  categorico: ["#dc4f3c", "#ba0682", "#b56c00", "#913600", "#8c418e", "#c35c38", "#bc31aa", "#bf0038"],
  accent: "#dc4f3c",
  sexoMasc: "#b56c00",
  sexoFem: "#bc31aa",
  donut: {
    seguridad: "#b56c00",
    tecnico: "#bc31aa",
    civilBecario: "#bf0038",
    civilPolicial: "#0071c3",
  },
};

export const TEMA_MEDIANOCHE: ChartTheme = {
  id: "medianoche",
  nombre: "Medianoche",
  modo: "dark",
  fondo: "#0d1526",
  categorico: ["#0097f0", "#1d9a6a", "#1e92ef", "#008f80", "#6e74f2", "#007b2b", "#825dc4", "#009ab2"],
  accent: "#0097f0",
  sexoMasc: "#6e74f2",
  sexoFem: "#007b2b",
  donut: {
    seguridad: "#007b2b",
    tecnico: "#825dc4",
    civilBecario: "#009ab2",
    civilPolicial: "#cf2a70",
  },
};

export const TEMA_BRASAS: ChartTheme = {
  id: "brasas",
  nombre: "Brasas",
  modo: "dark",
  fondo: "#0d1526",
  categorico: ["#bc69ae", "#c96f34", "#a04055", "#b358c3", "#ad3e33", "#cc7800", "#ac2d79", "#c94c15"],
  accent: "#bc69ae",
  sexoMasc: "#b358c3",
  sexoFem: "#cc7800",
  donut: {
    seguridad: "#a04055",
    tecnico: "#b358c3",
    civilBecario: "#cc7800",
    civilPolicial: "#00905b",
  },
};

export const CHART_THEMES: ChartTheme[] = [TEMA_INSTITUCIONAL, TEMA_OCEANO, TEMA_ATARDECER, TEMA_MEDIANOCHE, TEMA_BRASAS];
