// Evita un hydration mismatch de React: toLocaleDateString/toLocaleTimeString
// con hour/minute delega en el Intl del motor que lo ejecuta, y el ICU de
// Node (server) y el del navegador (cliente) pueden formatear el espacio
// antes de "a. m./p. m." de forma distinta según su versión — mismo texto a
// simple vista, pero un carácter diferente por debajo. Server y cliente
// terminan renderizando strings distintos para el mismo Date, y React tira
// el árbol SSR entero para volver a renderizar en el cliente. Se arma el
// string a mano, sin pasar por Intl, para que el resultado sea siempre
// idéntico en los dos lados.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

interface FormatFechaHoraOpts {
  /** Leer los componentes de fecha en UTC en vez de en el huso horario local. */
  utc?: boolean;
  /** Separador entre la fecha y la hora — Intl usa ", " al pedir ambas en un solo llamado. */
  separador?: string;
}

export function formatFechaHora(value: string | Date, opts: FormatFechaHoraOpts = {}): string {
  const { utc = false, separador = ", " } = opts;
  const d = typeof value === "string" ? new Date(value) : value;
  const dia = utc ? d.getUTCDate() : d.getDate();
  const mes = (utc ? d.getUTCMonth() : d.getMonth()) + 1;
  const anio = utc ? d.getUTCFullYear() : d.getFullYear();
  const horas24 = utc ? d.getUTCHours() : d.getHours();
  const minutos = utc ? d.getUTCMinutes() : d.getMinutes();
  const meridiano = horas24 < 12 ? "a. m." : "p. m.";
  const horas12 = horas24 % 12 || 12;
  return `${pad2(dia)}/${pad2(mes)}/${anio}${separador}${pad2(horas12)}:${pad2(minutos)} ${meridiano}`;
}
