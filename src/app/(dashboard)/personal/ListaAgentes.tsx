"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { TipoPersonal } from "@/types";
import type { AgenteResumen } from "./lib";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";
import { useSeleccionMultiple } from "@/lib/useSeleccionMultiple";
import AgenteAvatar from "@/components/AgenteAvatar";
import { buildQueryString, type FiltrosPersonalParams } from "./queryString";
import { cuilToDni } from "@/lib/personalLabels";

const PAGINA = 30;

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

function Avatar({ agente }: { agente: AgenteResumen }) {
  return (
    <div className="relative shrink-0">
      <AgenteAvatar fotoUrl={agente.fotoUrl} sexo={agente.sexo} sizeClassName="h-11 w-11 rounded-full" />
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { anclado, toggle } = useAgenteAnclado();
  const { seleccion, toggle: toggleSeleccion, limpiar: limpiarSeleccion } = useSeleccionMultiple();
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [cantidadVisible, setCantidadVisible] = useState(PAGINA);
  const [cargandoMas, setCargandoMas] = useState(false);

  // Si cambian los filtros/búsqueda (reflejados en queryString), se vuelve a
  // mostrar desde las primeras 30 filas. Se ajusta durante el render (en vez
  // de en un efecto) para no violar la regla de este repo de no hacer
  // setState dentro de efectos que sólo derivan un valor.
  const [prevQueryString, setPrevQueryString] = useState(queryString);
  if (queryString !== prevQueryString) {
    setPrevQueryString(queryString);
    setCantidadVisible(PAGINA);
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onSelect) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(href);
  }

  // La lista ya está entera en memoria (no hay pedido de red real), así que
  // sin este pequeño delay artificial el loader no llegaría a verse.
  function cargarMas() {
    setCargandoMas(true);
    setTimeout(() => {
      setCantidadVisible((c) => c + PAGINA);
      setCargandoMas(false);
    }, 400);
  }

  const idsFiltroActivo = Boolean(searchParams.get("ids"));

  // Los filtros del buscador (texto, estado, turno, dependencia, tipo,
  // E.T.A.C.) tienen que sobrevivir a "Ver seleccionados"/"Ver todo": son
  // los que el usuario ya armó a mano en FiltrosPersonal, y "ids" es sólo un
  // filtro puntual que se agrega o se saca encima de esos, nunca los
  // reemplaza.
  function filtrosActualesSinIds(): FiltrosPersonalParams {
    return {
      q: searchParams.get("q") ?? undefined,
      tipo: searchParams.get("tipo") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
      turno: searchParams.get("turno") ?? undefined,
      sector: searchParams.get("sector") ?? undefined,
      etac: searchParams.get("etac") ?? undefined,
      sexo: searchParams.get("sexo") ?? undefined,
    };
  }

  function irCon(destinoBase: string, extra?: FiltrosPersonalParams) {
    const qs = buildQueryString({ ...filtrosActualesSinIds(), ...extra });
    router.push(qs ? `${destinoBase}?${qs}` : destinoBase);
  }

  function verSeleccionados() {
    irCon("/personal", { ids: seleccion.map((a) => a.id).join(",") });
  }

  // Sólo saca el filtro ?ids=... de la URL, sin tocar la selección guardada
  // — para volver a la lista completa (respetando los demás filtros del
  // buscador) y seguir trabajando, pero sin perder lo ya marcado (a
  // diferencia de "Limpiar"/"Cancelar selección", que sí la borran). Si
  // había un legajo abierto, se mantiene abierto.
  function verTodo() {
    irCon(selectedId ? `/personal/${selectedId}` : "/personal");
  }

  // Si "Ver seleccionados" dejó el filtro ?ids=... puesto en la URL, ni
  // "Limpiar" ni "Cancelar selección" alcanzan por sí solos para volver a
  // ver la lista completa: la selección en sessionStorage es un dato
  // distinto del filtro aplicado en la URL, así que hay que sacar también
  // ese filtro.
  function handleLimpiar() {
    limpiarSeleccion();
    if (idsFiltroActivo) verTodo();
  }

  // "Cancelar selección" es un reset completo, no sólo ocultar los
  // checkboxes: si dejara la selección guardada, la barra de "N
  // seleccionados / Ver seleccionados / Limpiar" seguiría mostrándose
  // aunque ya no se esté en modo selección, dando la sensación de que no
  // pasó nada al cancelar.
  function handleToggleModo() {
    if (modoSeleccion) handleLimpiar();
    setModoSeleccion((v) => !v);
  }

  const barraSeleccion = (
    <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-800/40 px-4 py-2">
      <button
        type="button"
        onClick={handleToggleModo}
        className={`text-center text-xs font-medium transition-colors ${
          modoSeleccion ? "text-blue-400 hover:text-blue-300" : "text-slate-400 hover:text-slate-200"
        }`}
      >
        {modoSeleccion ? "Cancelar selección" : "☑️ Selección personalizada"}
      </button>
      {(seleccion.length > 0 || idsFiltroActivo) && (
        <div className="flex items-center gap-3">
          {seleccion.length > 0 && (
            <span className="text-xs font-medium text-slate-300 text-center">
              {seleccion.length} {seleccion.length === 1 ? "seleccionado" : "seleccionados"}
            </span>
          )}
          {idsFiltroActivo ? (
            <button
              type="button"
              onClick={verTodo}
              className="text-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver todo
            </button>
          ) : (
            <button
              type="button"
              onClick={verSeleccionados}
              className="text-center text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Ver seleccionados
            </button>
          )}
          {seleccion.length > 0 && (
            <button
              type="button"
              onClick={handleLimpiar}
              className="text-center text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (agentes.length === 0) {
    return (
      <>
        {barraSeleccion}
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          No se encontraron agentes con los filtros aplicados.
        </div>
      </>
    );
  }

  const agentesVisibles = agentes.slice(0, cantidadVisible);

  return (
    <>
    {barraSeleccion}
    <ul className="flex-1 overflow-y-auto divide-y divide-slate-800">
      {agentesVisibles.map((a) => {
        const activo = a.id === selectedId;
        const subLabel = a.turno ?? TIPO_LABELS[a.tipoPersonal as TipoPersonal] ?? a.tipoPersonal;
        const href = `/personal/${a.id}${queryString ? `?${queryString}` : ""}`;
        const estaAnclado = anclado?.id === a.id;
        const estaSeleccionado = seleccion.some((s) => s.id === a.id);
        return (
          <li key={a.id} className="relative">
            {modoSeleccion && (
              <label
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center cursor-pointer"
                title={estaSeleccionado ? "Quitar de la selección" : "Agregar a la selección"}
              >
                <input
                  type="checkbox"
                  checked={estaSeleccionado}
                  onChange={() => toggleSeleccion({ id: a.id, nombres: a.nombres, apellidos: a.apellidos })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                />
              </label>
            )}
            <Link
              href={href}
              onClick={(e) => handleClick(e, href)}
              className={`flex items-center gap-3 py-3 transition-colors ${modoSeleccion ? "pl-10" : "pl-4"} ${activo ? "pr-10" : "pr-4"} ${
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
    {cantidadVisible < agentes.length && (
      <div className="shrink-0 flex items-center justify-between border-t border-slate-800 px-4 py-2.5">
        <span className="text-xs text-slate-500">
          Mostrando {agentesVisibles.length} de {agentes.length}
        </span>
        <button
          type="button"
          onClick={cargarMas}
          disabled={cargandoMas}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-70"
        >
          {cargandoMas && (
            <span className="h-3 w-3 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
          )}
          Cargar más
        </button>
      </div>
    )}
    </>
  );
}
