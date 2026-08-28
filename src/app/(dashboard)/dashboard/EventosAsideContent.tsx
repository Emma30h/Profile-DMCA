import { obtenerTurnoHoy } from "@/app/actions/turnos";
import { obtenerCoberturasSemana } from "@/app/actions/coberturas";
import { obtenerEventosCursoAscensoSemana } from "@/app/actions/eventosCursoAscenso";
import { obtenerEfemeridesHoy } from "@/lib/calendarioGarden";
import { obtenerCumpleanosHoy } from "@/lib/cumpleanosPersonal";
import { calcularReloj } from "@/lib/relojCordoba";
import TurnoHoyCard from "./TurnoHoyCard";
import EfemeridesHoyCard from "./EfemeridesHoyCard";
import CumpleanosGardenCard from "./CumpleanosGardenCard";

// Async a propósito, separado del resto de la página: al vivir bajo su propio
// <Suspense> en page.tsx, esto puede tardar en resolver sin bloquear el resto
// del dashboard, mostrando EventosAsideSkeleton mientras tanto.
export default async function EventosAsideContent() {
  const [turnoHoy, semana, eventosAscenso, efemerides, cumpleanos] = await Promise.all([
    obtenerTurnoHoy(),
    obtenerCoberturasSemana(),
    obtenerEventosCursoAscensoSemana(),
    obtenerEfemeridesHoy(),
    obtenerCumpleanosHoy(),
  ]);

  return (
    <div className="flex h-full flex-col divide-y divide-[var(--c-line)]">
      <TurnoHoyCard turnoHoy={turnoHoy} semana={semana} eventosAscenso={eventosAscenso} relojInicial={calcularReloj()} />
      <EfemeridesHoyCard eventos={efemerides} />
      {/* flex-1: absorbe el espacio sobrante cuando hay pocas novedades, así
          no queda un bloque de fondo vacío separado debajo de la última
          tarjeta — el "hueco" se ve como parte de esta sección, no de nadie. */}
      <div className="flex-1">
        <CumpleanosGardenCard cumpleanos={cumpleanos} />
      </div>
    </div>
  );
}
