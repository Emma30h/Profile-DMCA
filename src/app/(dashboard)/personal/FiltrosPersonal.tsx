"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePersonalNav } from "./PersonalMasterShell";

const LOCK_STORAGE_KEY = "personal-filtros-bloqueados";
const VALUES_STORAGE_KEY = "personal-filtros-guardados";

type FiltrosValues = { q: string; tipo: string[]; estado: string[]; turno: string[]; sector: string[] };

type CampoFiltro = "estado" | "turno" | "sector" | "tipo";

const TIPOS = [
  { value: "SEGURIDAD", label: "Seguridad" },
  { value: "TECNICO", label: "Técnico" },
  { value: "CIVIL_BECARIO", label: "Civil Becario" },
  { value: "CIVIL_POLICIAL", label: "Civil Policial" },
];

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "ACTIVO", label: "Activo" },
  { value: "BAJA", label: "Baja" },
  { value: "PASE", label: "Pase" },
];

const FILTRO_TITULOS: Record<CampoFiltro, string> = {
  estado: "Estado",
  turno: "Turno / Guardia",
  sector: "Dependencia",
  tipo: "Tipo de personal",
};

interface SectorOption {
  id: string;
  nombre: string;
}

interface Props {
  qValue: string;
  tipoValue: string;
  estadoValue: string;
  turnoValue: string;
  sectorValue: string;
  sectores: SectorOption[];
  turnos: string[];
  /** Agente actualmente abierto (si hay uno): los filtros deben quedarse en su legajo en vez de mandar a la lista vacía. */
  selectedId?: string;
}

// Los valores llegan de la URL como listas separadas por coma (ver
// buildQueryString en lib.ts); acá se parsean a arrays para el estado local.
function parseLista(valor: string): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

export default function FiltrosPersonal({
  qValue,
  tipoValue,
  estadoValue,
  turnoValue,
  sectorValue,
  sectores,
  turnos,
  selectedId,
}: Props) {
  const router = useRouter();
  const { aplicarFiltros: startTransition } = usePersonalNav();
  const basePath = selectedId ? `/personal/${selectedId}` : "/personal";

  const [q, setQ] = useState(qValue);
  const [tipo, setTipo] = useState<string[]>(() => parseLista(tipoValue));
  const [estado, setEstado] = useState<string[]>(() => parseLista(estadoValue));
  const [turno, setTurno] = useState<string[]>(() => parseLista(turnoValue));
  const [sector, setSector] = useState<string[]>(() => parseLista(sectorValue));
  const [bloqueado, setBloqueado] = useState(false);
  const [filtroAbierto, setFiltroAbierto] = useState<CampoFiltro | null>(null);

  const applyFilters = useCallback(
    (next: FiltrosValues, opts?: { replace?: boolean }) => {
      const params = new URLSearchParams();
      if (next.q) params.set("q", next.q);
      if (next.tipo.length > 0) params.set("tipo", next.tipo.join(","));
      if (next.estado.length > 0) params.set("estado", next.estado.join(","));
      if (next.turno.length > 0) params.set("turno", next.turno.join(","));
      if (next.sector.length > 0) params.set("sector", next.sector.join(","));
      if (bloqueado) localStorage.setItem(VALUES_STORAGE_KEY, JSON.stringify(next));
      startTransition(() => {
        if (opts?.replace) router.replace(`${basePath}?${params.toString()}`);
        else router.push(`${basePath}?${params.toString()}`);
      });
    },
    [router, bloqueado, startTransition, basePath]
  );

  // Al entrar "de cero" a /personal (ej. desde el link del sidebar, que no
  // lleva query string) con el candado activado, restaura los últimos
  // filtros guardados en vez de arrancar vacío.
  useEffect(() => {
    const estabaBloqueado = localStorage.getItem(LOCK_STORAGE_KEY) === "1";
    setBloqueado(estabaBloqueado);
    if (!estabaBloqueado) return;
    if (qValue || tipoValue || estadoValue || turnoValue || sectorValue) return;

    const guardadosRaw = localStorage.getItem(VALUES_STORAGE_KEY);
    if (!guardadosRaw) return;
    let guardados: Partial<FiltrosValues>;
    try {
      guardados = JSON.parse(guardadosRaw);
    } catch {
      return;
    }
    const next: FiltrosValues = {
      q: guardados.q ?? "",
      tipo: guardados.tipo ?? [],
      estado: guardados.estado ?? [],
      turno: guardados.turno ?? [],
      sector: guardados.sector ?? [],
    };
    if (!next.q && next.tipo.length === 0 && next.estado.length === 0 && next.turno.length === 0 && next.sector.length === 0) return;

    setQ(next.q);
    setTipo(next.tipo);
    setEstado(next.estado);
    setTurno(next.turno);
    setSector(next.sector);
    applyFilters(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBloqueado() {
    const nuevo = !bloqueado;
    setBloqueado(nuevo);
    localStorage.setItem(LOCK_STORAGE_KEY, nuevo ? "1" : "0");
    if (nuevo) {
      localStorage.setItem(VALUES_STORAGE_KEY, JSON.stringify({ q, tipo, estado, turno, sector }));
    } else {
      localStorage.removeItem(VALUES_STORAGE_KEY);
    }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => applyFilters({ q: val, tipo, estado, turno, sector }),
      350
    );
  }

  function toggleEstado(valor: string) {
    const next = estado.includes(valor) ? estado.filter((v) => v !== valor) : [...estado, valor];
    setEstado(next);
    applyFilters({ q, tipo, estado: next, turno, sector });
  }

  function toggleTurno(valor: string) {
    const next = turno.includes(valor) ? turno.filter((v) => v !== valor) : [...turno, valor];
    setTurno(next);
    applyFilters({ q, tipo, estado, turno: next, sector });
  }

  function toggleSector(valor: string) {
    const next = sector.includes(valor) ? sector.filter((v) => v !== valor) : [...sector, valor];
    setSector(next);
    applyFilters({ q, tipo, estado, turno, sector: next });
  }

  function toggleTipo(valor: string) {
    const next = tipo.includes(valor) ? tipo.filter((v) => v !== valor) : [...tipo, valor];
    setTipo(next);
    applyFilters({ q, tipo: next, estado, turno, sector });
  }

  function limpiarCampo(campo: CampoFiltro) {
    if (campo === "estado") { setEstado([]); applyFilters({ q, tipo, estado: [], turno, sector }); }
    if (campo === "turno") { setTurno([]); applyFilters({ q, tipo, estado, turno: [], sector }); }
    if (campo === "sector") { setSector([]); applyFilters({ q, tipo, estado, turno, sector: [] }); }
    if (campo === "tipo") { setTipo([]); applyFilters({ q, tipo: [], estado, turno, sector }); }
  }

  function handleClearFilters() {
    setQ("");
    setTipo([]);
    setEstado([]);
    setTurno([]);
    setSector([]);
    applyFilters({ q: "", tipo: [], estado: [], turno: [], sector: [] });
  }

  const hasFilters = Boolean(q) || tipo.length > 0 || estado.length > 0 || turno.length > 0 || sector.length > 0;

  // Texto compacto del disparador: "Todos"/"Todas" sin selección, la
  // etiqueta puntual si hay una sola, o un contador si hay varias.
  function textoDisparador(valores: string[], etiquetaTodos: string, etiqueta: (v: string) => string) {
    if (valores.length === 0) return etiquetaTodos;
    if (valores.length === 1) return etiqueta(valores[0]);
    return `${valores.length} seleccionados`;
  }

  function renderDisparador(campo: CampoFiltro, texto: string, activo: boolean) {
    return (
      <button
        type="button"
        onClick={() => setFiltroAbierto(campo)}
        className={`w-full flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-slate-900 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
          activo ? "border-blue-500 text-blue-300" : "border-slate-700 text-slate-300"
        }`}
      >
        <span className="truncate">{texto}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  }

  const contenidoEstado = (
    <div className="space-y-0.5">
      {ESTADOS.map((e) => (
        <label key={e.value} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={estado.includes(e.value)}
            onChange={() => toggleEstado(e.value)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {e.label}
        </label>
      ))}
      {estado.length > 0 && (
        <button
          type="button"
          onClick={() => limpiarCampo("estado")}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoTurno = (
    <div className="space-y-0.5">
      {turnos.map((t) => (
        <label key={t} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={turno.includes(t)}
            onChange={() => toggleTurno(t)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {t}
        </label>
      ))}
      {turno.length > 0 && (
        <button
          type="button"
          onClick={() => limpiarCampo("turno")}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoSector = (
    <div className="space-y-0.5">
      {sectores.map((s) => (
        <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={sector.includes(s.id)}
            onChange={() => toggleSector(s.id)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {s.nombre}
        </label>
      ))}
      {sector.length > 0 && (
        <button
          type="button"
          onClick={() => limpiarCampo("sector")}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoTipo = (
    <div className="space-y-0.5">
      {TIPOS.map((t) => (
        <label key={t.value} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={tipo.includes(t.value)}
            onChange={() => toggleTipo(t.value)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {t.label}
        </label>
      ))}
      {tipo.length > 0 && (
        <button
          type="button"
          onClick={() => limpiarCampo("tipo")}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const CONTENIDO_FILTRO: Record<CampoFiltro, React.ReactNode> = {
    estado: contenidoEstado,
    turno: contenidoTurno,
    sector: contenidoSector,
    tipo: contenidoTipo,
  };

  return (
    <>
    <div className="p-4 border-b border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Buscador principal
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleBloqueado}
            title={bloqueado ? "Los filtros se mantienen al volver a entrar" : "Mantener estos filtros al volver a entrar"}
            className={`transition-colors ${bloqueado ? "text-blue-400 hover:text-blue-300" : "text-slate-500 hover:text-slate-300"}`}
          >
            {bloqueado ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-5-6V7a5 5 0 0110 0v4m-9 0h8a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-8-6h8m0 0h1a2 2 0 012 2v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2m8 0V7a5 5 0 00-9.9-1" />
              </svg>
            )}
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={handleQChange}
          placeholder="Buscar por apellido o DNI..."
          className="w-full rounded-lg border border-slate-700 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      {/* Filtros en grilla */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Estado
          </label>
          {renderDisparador(
            "estado",
            textoDisparador(estado, "Todos", (v) => ESTADOS.find((e) => e.value === v)?.label ?? v),
            estado.length > 0
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Turno / Guardia
          </label>
          {renderDisparador("turno", textoDisparador(turno, "Todos", (v) => v), turno.length > 0)}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Dependencia
          </label>
          {renderDisparador(
            "sector",
            textoDisparador(sector, "Todas", (v) => sectores.find((s) => s.id === v)?.nombre ?? v),
            sector.length > 0
          )}
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
            Tipo de personal
          </label>
          {renderDisparador(
            "tipo",
            textoDisparador(tipo, "Todos", (v) => TIPOS.find((t) => t.value === v)?.label ?? v),
            tipo.length > 0
          )}
        </div>
      </div>
    </div>

    {filtroAbierto && createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setFiltroAbierto(null)}
      >
        <div
          className="w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-200">Filtrar por {FILTRO_TITULOS[filtroAbierto]}</h4>
            <button
              type="button"
              onClick={() => setFiltroAbierto(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {CONTENIDO_FILTRO[filtroAbierto]}
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
