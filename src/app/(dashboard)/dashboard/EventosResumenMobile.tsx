import { obtenerTurnoHoy } from "@/app/actions/turnos";
import { obtenerCoberturasSemana } from "@/app/actions/coberturas";
import { obtenerEventosCursoAscensoSemana } from "@/app/actions/eventosCursoAscenso";
import { obtenerEfemeridesHoy } from "@/lib/calendarioGarden";
import { obtenerCumpleanosHoy } from "@/lib/cumpleanosPersonal";
import TurnoHoyCard from "./TurnoHoyCard";
import EfemeridesHoyCard from "./EfemeridesHoyCard";
import CumpleanosGardenCard from "./CumpleanosGardenCard";
import EventosResumenCollapsible from "./EventosResumenCollapsible";

// Versión mobile del aside "Turno de hoy / Eventos" (ver EventosAsideContent
// para la versión desktop, que vive fija al costado vía EventosAsideShell).
// Trae sus propios datos en vez de compartir el fetch con la versión
// desktop: son 3 consultas livianas (no la agregación pesada cacheada de
// dashboard/stats.ts), así que duplicarlas acá es más simple que intentar
// pasar los mismos datos entre server components ubicados en partes muy
// distintas del árbol (aside fijo del layout vs. arriba del contenido de
// cada página).
export default async function EventosResumenMobile() {
  const [turnoHoy, semana, eventosAscenso, efemerides, cumpleanos] = await Promise.all([
    obtenerTurnoHoy(),
    obtenerCoberturasSemana(),
    obtenerEventosCursoAscensoSemana(),
    obtenerEfemeridesHoy(),
    obtenerCumpleanosHoy(),
  ]);

  const totalNovedades = efemerides.length + cumpleanos.length;
  const parteNovedades = `${totalNovedades} ${totalNovedades === 1 ? "novedad" : "novedades"} hoy`;
  const resumenCerrado = turnoHoy.grupoTurno
    ? `Turno ${turnoHoy.grupoTurno === 1 ? "I" : "II"} · ${parteNovedades}`
    : parteNovedades;

  return (
    <EventosResumenCollapsible resumenCerrado={resumenCerrado}>
      <TurnoHoyCard turnoHoy={turnoHoy} semana={semana} eventosAscenso={eventosAscenso} />
      <EfemeridesHoyCard eventos={efemerides} />
      <CumpleanosGardenCard cumpleanos={cumpleanos} />
    </EventosResumenCollapsible>
  );
}
