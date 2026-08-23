"use client";

import { useMemo, useState, useTransition } from "react";
import {
  agregarRolOrganigrama,
  actualizarRolOrganigrama,
  eliminarRolOrganigrama,
  moverRolOrganigrama,
} from "@/app/actions/organigrama";
import { normalizarBusqueda } from "@/lib/personalLabels";
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
  DIRECCION: "bg-[var(--c-line)] text-[var(--c-text)]",
  DEPARTAMENTO: "bg-[var(--c-line)] text-[var(--c-text)]",
  DIVISION: "bg-[var(--c-amber-strong)] text-[var(--c-amber)]",
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
    const q = normalizarBusqueda(query);
    return agentes.filter((a) => normalizarBusqueda(`${a.apellidos} ${a.nombres}`).includes(q)).slice(0, 8);
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
        className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-1.5 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--c-blue)]"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] shadow-lg">
          {filtrados.map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={() => {
                onSeleccionar(a);
                setQuery("");
                setAbierto(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
            >
              {a.apellidos} {a.nombres}
              {a.rango && <span className="text-[var(--c-text-faint)]"> · {a.rango}</span>}
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
        className="w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-1.5 text-xs text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-blue)]"
      />

      <div className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, agenteId: null, agenteNombre: null }))}
          disabled={pending}
          className={`px-2 py-1 rounded-md border transition-colors ${
            !conLegajo ? "bg-[var(--c-blue)]/15 border-[var(--c-blue)]/40 text-[var(--c-blue-soft)]" : "border-[var(--c-line)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]"
          }`}
        >
          Sin legajo
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, rangoLibre: "", nombreLibre: "", agenteId: d.agenteId ?? "" }))}
          disabled={pending}
          className={`px-2 py-1 rounded-md border transition-colors ${
            conLegajo ? "bg-[var(--c-blue)]/15 border-[var(--c-blue)]/40 text-[var(--c-blue-soft)]" : "border-[var(--c-line)] text-[var(--c-text-muted)] hover:text-[var(--c-text)]"
          }`}
        >
          Con legajo
        </button>
      </div>

      {conLegajo ? (
        draft.agenteId && draft.agenteNombre ? (
          <div className="flex items-center gap-2 text-sm text-[var(--c-text)] bg-[var(--c-bg-elev)] border border-[var(--c-line)] rounded-lg px-3 py-1.5">
            <span className="flex-1 truncate">{draft.agenteNombre}</span>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, agenteId: "", agenteNombre: null }))}
              disabled={pending}
              className="text-[var(--c-text-faint)] hover:text-[var(--c-text-secondary)]"
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
            className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-1.5 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-blue)]"
          />
          <input
            type="text"
            value={draft.nombreLibre}
            onChange={(e) => setDraft((d) => ({ ...d, nombreLibre: e.target.value }))}
            placeholder="Nombre completo"
            disabled={pending}
            className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-2.5 py-1.5 text-sm text-[var(--c-text)] focus:outline-none focus:ring-1 focus:ring-[var(--c-blue)]"
          />
        </div>
      )}

      <label className="flex items-center gap-1.5 text-xs text-[var(--c-text-muted)]">
        <input
          type="checkbox"
          checked={draft.licencia}
          onChange={(e) => setDraft((d) => ({ ...d, licencia: e.target.checked }))}
          disabled={pending}
          className="rounded border-[var(--c-line-strong)]"
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
      const res = await actualizarRolOrganigrama(rol.id, {
        etiqueta: draft.etiqueta,
        licencia: draft.licencia,
        agenteId: draft.agenteId || null,
        rangoLibre: draft.agenteId ? null : draft.rangoLibre,
        nombreLibre: draft.agenteId ? null : draft.nombreLibre,
      });
      if (!res.ok) setError(res.error);
    });
  }

  function eliminar() {
    if (!confirm(`¿Eliminar "${draft.etiqueta || "este puesto"}" de la nómina?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarRolOrganigrama(rol.id);
      if (!res.ok) setError(res.error);
    });
  }

  function mover(direccion: "arriba" | "abajo") {
    setError(null);
    startTransition(async () => {
      const res = await moverRolOrganigrama(rol.id, direccion);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className={`rounded-lg border border-[var(--c-bg-elev-2)] bg-[var(--c-bg)]/60 p-3 space-y-2.5 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2.5">
          <CamposRol draft={draft} setDraft={setDraft} agentes={agentes} pending={pending} />
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => mover("arriba")}
            disabled={pending || esPrimero}
            className="p-1 rounded text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Subir"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => mover("abajo")}
            disabled={pending || esUltimo}
            className="p-1 rounded text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Bajar"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={pending}
            className="p-1 rounded text-[var(--c-coral)] hover:bg-[var(--c-coral)]/10 transition-colors"
            title="Eliminar"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-[var(--c-coral)]">{error}</span>}
        <button
          type="button"
          onClick={guardar}
          disabled={pending || sinCambios || datosIncompletos}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--c-blue)] text-white hover:bg-[var(--c-blue-strong)] disabled:opacity-40 disabled:hover:bg-[var(--c-blue)] transition-colors"
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
      const res = await agregarRolOrganigrama(sectorId, {
        etiqueta: draft.etiqueta,
        agenteId: draft.agenteId || null,
        rangoLibre: draft.agenteId ? null : draft.rangoLibre,
        nombreLibre: draft.agenteId ? null : draft.nombreLibre,
      });
      if (res.ok) {
        setDraft(DRAFT_VACIO);
        setAbierto(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full text-left text-xs font-medium text-[var(--c-blue-text)] hover:text-[var(--c-blue-soft)] px-3 py-2 rounded-lg border border-dashed border-[var(--c-line)] hover:border-[var(--c-blue)]/40 transition-colors"
      >
        + Agregar puesto
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--c-blue)]/30 bg-[var(--c-bg)]/60 p-3 space-y-2.5">
      <CamposRol draft={draft} setDraft={setDraft} agentes={agentes} pending={pending} />
      <div className="flex items-center justify-end gap-3">
        {error && <span className="text-xs text-[var(--c-coral)]">{error}</span>}
        <button
          type="button"
          onClick={() => {
            setDraft(DRAFT_VACIO);
            setError(null);
            setAbierto(false);
          }}
          disabled={pending}
          className="text-xs font-medium px-3 py-1.5 rounded-md text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={agregar}
          disabled={pending || !puedeAgregar}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--c-blue)] text-white hover:bg-[var(--c-blue-strong)] disabled:opacity-40 disabled:hover:bg-[var(--c-blue)] transition-colors"
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
          className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4 space-y-3"
          style={{ marginLeft: Math.min(sector.nivel, 2) * 20 }}
        >
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${ESTILO_TIPO[sector.tipo] ?? "bg-[var(--c-line)] text-[var(--c-text)]"}`}>
              {sector.tipo}
            </span>
            <h3 className="text-sm font-semibold text-[var(--c-text)]">{sector.nombre}</h3>
          </div>

          <div className="space-y-2">
            {sector.roles.length === 0 && (
              <p className="text-xs text-[var(--c-text-faint)] italic">Sin nómina cargada todavía.</p>
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
