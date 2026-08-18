// El servidor puede correr en cualquier huso horario (ej. UTC en Vercel); las
// tarjetas de "esta semana" del sidebar (coberturas, eventos de curso de
// ascenso) necesitan la semana calendario en hora de Córdoba, no la del
// proceso — mismo criterio que diaDeTurnoActual() en actions/turnos.ts.
export function hoyCordoba(): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(new Date());
  const obtener = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return new Date(Date.UTC(obtener("year"), obtener("month") - 1, obtener("day")));
}

export interface SemanaActual {
  hoy: Date;
  lunes: Date;
  domingo: Date;
  finExclusivo: Date;
}

// Semana calendario (lunes a domingo) que contiene el día de hoy — no una
// ventana móvil de 7 días desde hoy, para que las tarjetas siempre muestren
// "la semana" completa tal como se la nombra en /turnos.
export function semanaActualCordoba(): SemanaActual {
  const hoy = hoyCordoba();
  const diaSemana = hoy.getUTCDay(); // 0=domingo … 6=sábado
  const offsetALunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = new Date(hoy);
  lunes.setUTCDate(lunes.getUTCDate() - offsetALunes);
  const domingo = new Date(lunes);
  domingo.setUTCDate(domingo.getUTCDate() + 6);
  const finExclusivo = new Date(lunes);
  finExclusivo.setUTCDate(finExclusivo.getUTCDate() + 7);
  return { hoy, lunes, domingo, finExclusivo };
}
