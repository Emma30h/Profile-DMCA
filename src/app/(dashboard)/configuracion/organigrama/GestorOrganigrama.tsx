"use client";

import { useMemo, useState, useTransition } from "react";
import {
  agregarRolOrganigrama,
  actualizarRolOrganigrama,
  eliminarRolOrganigrama,
  moverRolOrganigrama,
} from "@/app/actions/organigrama";
import type { SectorConRoles, RolCrudo, AgenteParaPicker } from "../../organigrama/lib";

interface SectorConNivel extends SectorConRoles {
  nivel: number;
}

// Los sectores llegan ordenados alfabéticamente (ver obtenerSectoresConRoles);
// acá se reordenan siguiendo la jerarquía real (padreId) para que el panel se
// lea de arriba hacia abajo igual que el organigrama.
function ordenarJerarquico(sectores: SectorConRoles[]): SectorConNivel[] {
  const porPadre = new Map<string | null, SectorConRoles[]>();
  sectores.forEach((s) => {
    const lista = porPadre.get(s.padreId) ?? [];
    lista.push(s);
    porPadre.set(s.padreId, lista);
  });
  const resultado: SectorConNivel[] = [];
  function recorrer(padreId: string | null, nivel: number) {
    (porPadre.get(padreId) ?? []).forEach((s) => {
      resultado.push({ ...s, nivel });
      recorrer(s.id, nivel + 1);
    });
  }
  recorrer(null, 0);
  return resultado;
}

const ESTILO_TIPO: Record<string, string> = {
  DIRECCION: "bg-slate-700 text-slate-200",
  DEPARTAMENTO: "bg-slate-700 text-slate-200",
  DIVISION: "bg-amber-800 text-amber-100",
};

interface DraftRol {
  etiqueta: string;
  licencia: boolean;
  agenteId: string | null;
  agenteNombre: string | null;
  rangoLibre: string;
  nombreLibre: string;
}

const DRAFT_VACIO: DraftRol = {
  etiqueta: "",
  licencia: false,
  agenteId: null,
  agenteNombre: null,
  rangoLibre: "",
  nombreLibre: "",
};

function draftDesdeRol(rol: RolCrudo): DraftRol {
  return {
    etiqueta: rol.etiqueta,
    licencia: rol.licencia,
    agenteId: rol.agenteId,
    agenteNombre: rol.agenteNombre,
    rangoLibre: rol.rangoLibre ?? "",
    nombreLibre: rol.nombreLibre ?? "",
  };
}

function BuscadorAgente({
  agentes,
  onSeleccionar,
}: {
  agentes: AgenteParaPicker[];
  onSeleccionar: (agente: AgenteParaPicker) => void;
}) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);

  const filtrados = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return agentes.filter((a) => `${a.apellidos} ${a.nombres}`.toLowerCase().includes(q)).slice(0, 8);
  }, [agentes, query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Buscar agente por apellido..."
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-lg">
          {filtrados.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => {
                onSeleccionar(a);
                setQuery("");
                setAbierto(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {a.apellidos} {a.nombres}
              {a.rango && <span className="text-slate-500"> · {a.rango}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CamposRol({
  draft,
  setDraft,
  agentes,
  pending,
}: {
  draft: DraftRol;
  setDraft: (fn: (d: DraftRol) => DraftRol) => void;
  agentes: AgenteParaPicker[];
  pending: boolean;
}) {
  const conLegajo = draft.agenteId !== null;

  return (
    <>
      <input
        type="text"
        value={draft.etiqueta}
        onChange={(e) => setDraft((d) => ({ ...d, etiqueta: e.target.value }))}
        placeholder="Etiqueta (Jefe, 2°...)"
        disabled={pending}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, agenteId: null, agenteNombre: null }))}
          disabled={pending}
          className={`px-2 py-1 rounded-md border transition-colors ${
            !conLegajo ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          Sin legajo
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, rangoLibre: "", nombreLibre: "", agenteId: d.agenteId ?? "" }))}
          disabled={pending}
          className={`px-2 py-1 rounded-md border transition-colors ${
            conLegajo ? "bg-blue-500/15 border-blue-500/40 text-blue-300" : "border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          Con legajo
        </button>
      </div>

      {conLegajo ? (
        draft.agenteId && draft.agenteNombre ? (
          <div className="flex items-center gap-2 text-sm text-slate-100 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
            <span className="flex-1 truncate">{draft.agenteNombre}</span>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, agenteId: "", agenteNombre: null }))}
              disabled={pending}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        ) : (
          <BuscadorAgente
            agentes={agentes}
            onSeleccionar={(a) =>
              setDraft((d) => ({
                ...d,
                agenteId: a.id,
                agenteNombre: `${a.apellidos} ${a.nombres}${a.rango ? ` (${a.rango})` : ""}`,
              }))
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={draft.rangoLibre}
            onChange={(e) => setDraft((d) => ({ ...d, rangoLibre: e.target.value }))}
            placeholder="Rango (ej. Subcrio.)"
            disabled={pending}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={draft.nombreLibre}
            onChange={(e) => setDraft((d) => ({ ...d, nombreLibre: e.target.value }))}
            placeholder="Nombre completo"
            disabled={pending}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={draft.licencia}
          onChange={(e) => setDraft((d) => ({ ...d, licencia: e.target.checked }))}
          disabled={pending}
          className="rounded border-slate-600"
        />
        En licencia
      </label>
    </>
  );
}

function FilaRolEditable({
  rol,
  agentes,
  esPrimero,
  esUltimo,
}: {
  rol: RolCrudo;
  agentes: AgenteParaPicker[];
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  const [draft, setDraft] = useState<DraftRol>(() => draftDesdeRol(rol));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sinCambios =
    draft.etiqueta === rol.etiqueta &&
    draft.licencia === rol.licencia &&
    draft.agenteId === rol.agenteId &&
    draft.rangoLibre === (rol.rangoLibre ?? "") &&
    draft.nombreLibre === (rol.nombreLibre ?? "");

  // "Con legajo" pero todavía sin elegir a nadie (agenteId sentinel "") no se
  // puede guardar — guardaría vacío y borraría a quien ya estuviera cargado.
  const datosIncompletos =
    draft.etiqueta.trim() === "" ||
    (draft.agenteId !== null ? draft.agenteId === "" : draft.nombreLibre.trim() === "");

  function guardar() {
    setError(null);
    startTransition(async () => {
      try {
        await actualizarRolOrganigrama(rol.id, {
          etiqueta: draft.etiqueta,
          licencia: draft.licencia,
          agenteId: draft.agenteId || null,
          rangoLibre: draft.agenteId ? null : draft.rangoLibre,
          nombreLibre: draft.agenteId ? null : draft.nombreLibre,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  }

  function eliminar() {
    if (!confirm(`¿Eliminar "${draft.etiqueta || "este puesto"}" de la nómina?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await eliminarRolOrganigrama(rol.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar");
      }
    });
  }

  function mover(direccion: "arriba" | "abajo") {
    setError(null);
    startTransition(async () => {
      try {
        await moverRolOrganigrama(rol.id, direccion);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo mover");
      }
    });
  }

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2.5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2.5">
          <CamposRol draft={draft} setDraft={setDraft} agentes={agentes} pending={pending} />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => mover("arriba")}
            disabled={pending || esPrimero}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Subir"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => mover("abajo")}
            disabled={pending || esUltimo}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Bajar"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={pending}
            className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
            title="Eliminar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          type="button"
          onClick={guardar}
          disabled={pending || sinCambios || datosIncompletos}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function FilaNuevoRol({ sectorId, agentes }: { sectorId: string; agentes: AgenteParaPicker[] }) {
  const [draft, setDraft] = useState<DraftRol>(DRAFT_VACIO);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const puedeAgregar =
    draft.etiqueta.trim() !== "" && (Boolean(draft.agenteId) || draft.nombreLibre.trim() !== "");

  function agregar() {
    setError(null);
    startTransition(async () => {
      try {
        await agregarRolOrganigrama(sectorId, {
          etiqueta: draft.etiqueta,
          agenteId: draft.agenteId || null,
          rangoLibre: draft.agenteId ? null : draft.rangoLibre,
          nombreLibre: draft.agenteId ? null : draft.nombreLibre,
        });
        setDraft(DRAFT_VACIO);
        setAbierto(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo agregar");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full text-left text-xs font-medium text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/40 transition-colors"
      >
        + Agregar puesto
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500/30 bg-slate-950/60 p-3 space-y-2.5">
      <CamposRol draft={draft} setDraft={setDraft} agentes={agentes} pending={pending} />
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          type="button"
          onClick={() => {
            setDraft(DRAFT_VACIO);
            setError(null);
            setAbierto(false);
          }}
          disabled={pending}
          className="text-xs font-medium px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={agregar}
          disabled={pending || !puedeAgregar}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors"
        >
          {pending ? "Agregando…" : "Agregar"}
        </button>
      </div>
    </div>
  );
}

export default function GestorOrganigrama({
  sectores,
  agentes,
}: {
  sectores: SectorConRoles[];
  agentes: AgenteParaPicker[];
}) {
  const ordenados = useMemo(() => ordenarJerarquico(sectores), [sectores]);

  return (
    <div className="space-y-4">
      {ordenados.map((sector) => (
        <div
          key={sector.id}
          className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-3"
          style={{ marginLeft: Math.min(sector.nivel, 2) * 20 }}
        >
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${ESTILO_TIPO[sector.tipo] ?? "bg-slate-700 text-slate-200"}`}>
              {sector.tipo}
            </span>
            <h3 className="text-sm font-semibold text-slate-100">{sector.nombre}</h3>
          </div>

          <div className="space-y-2">
            {sector.roles.length === 0 && (
              <p className="text-xs text-slate-500 italic">Sin nómina cargada todavía.</p>
            )}
            {sector.roles.map((rol, i) => (
              <FilaRolEditable
                key={rol.id}
                rol={rol}
                agentes={agentes}
                esPrimero={i === 0}
                esUltimo={i === sector.roles.length - 1}
              />
            ))}
          </div>

          <FilaNuevoRol sectorId={sector.id} agentes={agentes} />
        </div>
      ))}
    </div>
  );
}
