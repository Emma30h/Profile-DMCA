"use client";

import Link from "next/link";
import type { TipoPersonal } from "@/types";
import type { AgenteResumen } from "./lib";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

function cuilToDni(cuil: string): string {
  const digits = cuil.replace(/\D/g, "");
  if (digits.length !== 11) return digits;
  const dniConCeros = digits.slice(2, 10);
  return dniConCeros.replace(/^0+/, "") || dniConCeros;
}

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

function Avatar({ agente }: { agente: AgenteResumen }) {
  const inicial = agente.apellidos.charAt(0).toUpperCase();
  return (
    <div className="relative shrink-0">
      {agente.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={agente.fotoUrl}
          alt=""
          className="h-11 w-11 rounded-full object-cover border border-slate-700"
        />
      ) : (
        <div className="h-11 w-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-semibold text-slate-500">
          {inicial}
        </div>
      )}
      {agente.estado === "ACTIVO" && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-slate-900" />
      )}
    </div>
  );
}

export default function ListaAgentes({
  agentes,
  selectedId,
  queryString,
  onSelect,
}: {
  agentes: AgenteResumen[];
  selectedId?: string;
  queryString: string;
  /** Cuando se provee, intercepta el click para navegar vía transición en vez de un link normal. */
  onSelect?: (href: string) => void;
}) {
  const { anclado, toggle } = useAgenteAnclado();

  if (agentes.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-500">
        No se encontraron agentes con los filtros aplicados.
      </div>
    );
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onSelect) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(href);
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-slate-800">
      {agentes.map((a) => {
        const activo = a.id === selectedId;
        const subLabel = a.turno ?? TIPO_LABELS[a.tipoPersonal as TipoPersonal] ?? a.tipoPersonal;
        const href = `/personal/${a.id}${queryString ? `?${queryString}` : ""}`;
        const estaAnclado = anclado?.id === a.id;
        return (
          <li key={a.id} className="relative">
            <Link
              href={href}
              onClick={(e) => handleClick(e, href)}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${activo ? "pr-10" : "pr-4"} ${
                activo ? "bg-blue-500/10 border-l-2 border-blue-600" : "hover:bg-slate-800 border-l-2 border-transparent"
              }`}
            >
              <Avatar agente={a} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${activo ? "text-blue-300" : "text-slate-100"}`}>
                  {a.apellidos}, {a.nombres}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  DNI: {cuilToDni(a.cuil)} · {subLabel}
                </p>
              </div>
            </Link>
            {activo && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggle({ id: a.id, nombres: a.nombres, apellidos: a.apellidos });
                }}
                title={estaAnclado ? "Desanclar" : "Anclar para acceso rápido"}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors ${
                  estaAnclado ? "text-blue-400 hover:text-blue-300" : "text-slate-600 hover:text-slate-300"
                }`}
              >
                {estaAnclado ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
