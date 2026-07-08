import FiltrosPersonal from "./FiltrosPersonal";
import PersonalMasterShell from "./PersonalMasterShell";
import { getAgentesResumen, getOpcionesFiltro, buildQueryString, type FiltrosPersonalParams } from "./lib";

export default async function PersonalMaster({
  searchParams,
  selectedId,
  children,
  fitViewport = false,
}: {
  searchParams: FiltrosPersonalParams;
  selectedId?: string;
  children?: React.ReactNode;
  /** Ajusta ambas columnas a la altura disponible del viewport (sin scroll de página), en vez del comportamiento sticky por defecto. Pensado para la vista sin agente seleccionado. */
  fitViewport?: boolean;
}) {
  const [{ agentes, total }, { sectores, turnos }] = await Promise.all([
    getAgentesResumen(searchParams),
    getOpcionesFiltro(),
  ]);

  const queryString = buildQueryString(searchParams);

  return (
    <PersonalMasterShell
      agentes={agentes}
      selectedId={selectedId}
      queryString={queryString}
      fitViewport={fitViewport}
      filtros={
        <FiltrosPersonal
          key="filtros"
          qValue={searchParams.q ?? ""}
          tipoValue={searchParams.tipo ?? ""}
          estadoValue={searchParams.estado ?? ""}
          turnoValue={searchParams.turno ?? ""}
          sectorValue={searchParams.sector ?? ""}
          sectores={sectores}
          turnos={turnos}
          selectedId={selectedId}
        />
      }
      contador={
        <div key="contador" className="px-4 py-2 text-xs text-slate-500 border-b border-slate-800">
          {total} {total === 1 ? "agente encontrado" : "agentes encontrados"}
          {total > agentes.length ? ` — mostrando los primeros ${agentes.length}` : ""}
        </div>
      }
    >
      {children}
    </PersonalMasterShell>
  );
}
