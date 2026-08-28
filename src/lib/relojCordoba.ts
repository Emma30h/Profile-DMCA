// Funciones puras (sin "use client"): las llama tanto un Server Component
// (para el snapshot inicial que viaja en el HTML) como el Client Component
// que las vuelve a llamar cada 60s para mantener el reloj al día — ver
// TurnoHoyCard.tsx. El servidor puede correr en cualquier huso horario (ej.
// UTC en Vercel); acá se lee la hora explícitamente en la de Córdoba en vez
// de usar la hora local del proceso.

export function horaActualCordoba(): number {
  const hora = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hora) % 24; // Intl puede devolver "24" para la medianoche
}

export function fechaHoyCordoba(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${obtener("day")}/${obtener("month")}/${obtener("year")}`;
}

export function calcularReloj(): { horaActual: number; fecha: string } {
  return { horaActual: horaActualCordoba(), fecha: fechaHoyCordoba() };
}
