"use client";

import { useState, useRef, useEffect, useLayoutEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GestorFeriados from "./GestorFeriados";

interface Feriado {
  id: string;
  fecha: Date;
  nombre: string;
  aplica: boolean;
}

interface AgenteResumen {
  id: string;
  nombres: string;
  apellidos: string;
  sector: string | null;
}

interface LicenciaRow {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  motivo: string | null;
  agente: AgenteResumen;
}

interface SectorOption {
  id: string;
  nombre: string;
}

const TIPO_LICENCIA_LABELS: Record<string, string> = {
  ORDINARIA: "Ordinaria",
  MEDICA: "Licencia Médica",
  CARPETA_MEDICA: "Carpeta Médica",
  ESPECIAL: "Especial",
  SIN_GOCE_SUELDO: "Sin goce de sueldo",
  ARTICULO: "Artículo",
  SUSPENSION: "Suspensión",
  ADSCRIPCION: "Adscripción",
};

const TIPO_LICENCIA_BADGE: Record<string, string> = {
  ORDINARIA: "bg-blue-500/15 text-blue-300",
  MEDICA: "bg-red-500/15 text-red-400",
  CARPETA_MEDICA: "bg-orange-500/15 text-orange-400",
  ESPECIAL: "bg-purple-500/15 text-purple-400",
  SIN_GOCE_SUELDO: "bg-slate-800 text-slate-400",
  ARTICULO: "bg-teal-500/15 text-teal-400",
  SUSPENSION: "bg-fuchsia-500/15 text-fuchsia-400",
  ADSCRIPCION: "bg-indigo-500/15 text-indigo-400",
};

const TIPO_LICENCIA_EMOJI: Record<string, string> = {
  ORDINARIA: "🏖️",
  MEDICA: "🏥",
  CARPETA_MEDICA: "🏥",
  ESPECIAL: "⭐",
  SIN_GOCE_SUELDO: "💰",
  ARTICULO: "👨‍👩‍👧‍👦",
  SUSPENSION: "🚫",
  ADSCRIPCION: "🔄",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  });
}

function fmtMes(anio: number, mes: number) {
  return new Date(anio, mes).toLocaleDateString("es-AR", {
    month: "long", year: "numeric",
  });
}

// Medianoche UTC del día calendario local de hoy (misma convención con la que se
// guardan fechaInicio/fechaFin al tipear una fecha en un <input type="date">).
function hoyComoFechaUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
}

function esVigente(l: LicenciaRow): boolean {
  if (l.estado === "RECHAZADA" || l.estado === "CANCELADA") return false;
  const hoy = hoyComoFechaUTC();
  return hoy >= new Date(l.fechaInicio) && hoy <= new Date(l.fechaFin);
}

// ─── Calendario mensual ───────────────────────────────────────────────────────

const MAX_CARRILES_VISIBLES = 3;

// Asigna a cada licencia un "carril" (fila) estable, de forma que dos licencias
// cuyos rangos de fechas se superponen nunca comparten carril. Así, la fila en la
// que aparece cada agente se mantiene consistente en todos los días que abarca.
function asignarCarriles(licencias: LicenciaRow[]): Map<string, number> {
  const ordenadas = [...licencias].sort(
    (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
  );
  const finPorCarril: number[] = [];
  const asignacion = new Map<string, number>();

  for (const l of ordenadas) {
    const inicio = new Date(l.fechaInicio).getTime();
    const fin = new Date(l.fechaFin).getTime();
    let carril = finPorCarril.findIndex((finOcupado) => finOcupado < inicio);
    if (carril === -1) {
      carril = finPorCarril.length;
      finPorCarril.push(fin);
    } else {
      finPorCarril[carril] = fin;
    }
    asignacion.set(l.id, carril);
  }

  return asignacion;
}

function CalendarioMes({
  anio,
  mes,
  licencias,
  feriados,
}: {
  anio: number;
  mes: number; // 0-based
  licencias: LicenciaRow[];
  feriados: Feriado[];
}) {
  const router = useRouter();
  const [licenciaResaltada, setLicenciaResaltada] = useState<string | null>(null);
  const [menuContextual, setMenuContextual] = useState<{ x: number; y: number; href: string } | null>(null);
  const [diaExpandido, setDiaExpandido] = useState<number | null>(null);
  const [panelLicencia, setPanelLicencia] = useState<LicenciaRow | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mantiene la licencia visible un instante más al cerrar, para poder jugar
  // la animación de salida antes de desmontar el panel del todo.
  const [panelParaMostrar, setPanelParaMostrar] = useState<LicenciaRow | null>(null);
  const [panelSaliendo, setPanelSaliendo] = useState(false);
  const timeoutSalidaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DURACION_SALIDA_MS = 250;

  useEffect(() => {
    if (panelLicencia) {
      if (timeoutSalidaRef.current) clearTimeout(timeoutSalidaRef.current);
      setPanelSaliendo(false);
      setPanelParaMostrar(panelLicencia);
    } else if (panelParaMostrar) {
      setPanelSaliendo(true);
      timeoutSalidaRef.current = setTimeout(() => {
        setPanelParaMostrar(null);
        setPanelSaliendo(false);
      }, DURACION_SALIDA_MS);
    }
    return () => {
      if (timeoutSalidaRef.current) clearTimeout(timeoutSalidaRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelLicencia]);

  // El panel del mini-calendario mantiene su tamaño natural; la lista del día
  // adopta esa misma altura (medida en vez de adivinada, para calzar exacto
  // sin importar si el mes tiene 5 o 6 semanas).
  const [alturaCalendario, setAlturaCalendario] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (panelParaMostrar && panelRef.current) {
      setAlturaCalendario(panelRef.current.offsetHeight);
    }
  }, [panelParaMostrar]);

  function cerrarModalDia() {
    setDiaExpandido(null);
    setPanelLicencia(null);
    setMenuContextual(null);
  }

  // El evento "click" de React sólo se dispara para el botón izquierdo (por
  // especificación del DOM), así que estos handlers son intrínsecamente
  // inmunes al click derecho: no hace falta filtrar por e.button ni lidiar
  // con listeners globales en fase de captura.
  function cerrarPorClickEnListaDelDia(e: React.MouseEvent) {
    // Si el menú contextual está abierto, este click sólo lo cierra a él: no
    // debe además cerrar el panel (el click se "absorbe", como en Windows).
    if (menuContextual) {
      setMenuContextual(null);
      return;
    }
    if (!panelLicencia) return;
    const target = e.target as HTMLElement;
    // Un click sobre la propia fila marcada no debe cerrar el panel: el
    // doble click es quien lo alterna.
    if (target.closest(`[data-licencia-id="${panelLicencia.id}"]`)) return;
    setPanelLicencia(null);
  }

  // Cierre general del menú contextual: cualquier click izquierdo en
  // cualquier parte de la página (fuera del propio menú) lo cierra — esto
  // cubre la grilla del calendario "suelta", sin el modal de día de por
  // medio. Es un listener simple en fase de burbuja (sin filtrar por
  // e.button, porque "click" nunca se dispara con el botón derecho) que se
  // agrega recién arriba en el árbol nativo: cuando el click ocurre dentro
  // del modal de día, los handlers más específicos (cerrarPorClickEnListaDelDia,
  // el backdrop) ya corrieron antes y decidieron qué hacer: este sólo repite
  // el cierre del menú, de forma inofensiva, si todavía seguía abierto. Si
  // la ventana se mueve o hace scroll también conviene cerrarlo, porque es
  // "fixed" con coordenadas fijas y quedaría mal posicionado.
  useEffect(() => {
    if (!menuContextual) return;
    const cerrar = () => setMenuContextual(null);
    window.addEventListener("click", cerrar);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    return () => {
      window.removeEventListener("click", cerrar);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [menuContextual]);

  useEffect(() => {
    if (diaExpandido === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarModalDia();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [diaExpandido]);

  // Todo el click derecho dentro del modal de día se resuelve en un único
  // lugar (en vez de repartido entre varios elementos, que se pisaban entre
  // sí): si cae sobre la fila o el panel del efectivo marcado, abre/mueve el
  // menú "Ir a Licencias/Ausentismos"; en cualquier otro lado, bloquea el
  // menú nativo del navegador y cierra el nuestro si estaba abierto — sin
  // tocar el panel del mini-calendario ni el modal de día.
  useEffect(() => {
    if (diaExpandido === null) return;
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const esDelMarcado =
        panelLicencia !== null &&
        (panelRef.current?.contains(target) || !!target.closest(`[data-licencia-id="${panelLicencia.id}"]`));

      e.preventDefault();
      if (esDelMarcado && panelLicencia) {
        setMenuContextual({
          x: e.clientX,
          y: e.clientY,
          href: `/personal/${panelLicencia.agente.id}?tab=licencias`,
        });
      } else {
        setMenuContextual(null);
      }
    };
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => window.removeEventListener("contextmenu", onContextMenu, true);
  }, [diaExpandido, panelLicencia]);

  const primerDia = new Date(anio, mes, 1);
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  // Lunes = 0 ... Domingo = 6
  const offsetInicio = (primerDia.getDay() + 6) % 7;

  const celdas: (number | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const carriles = asignarCarriles(licencias);

  // Las fechas se guardan como medianoche UTC; hay que leerlas con getUTC* para
  // no correrse un día según el huso horario del navegador.
  const feriadosDelMes = new Map<number, string>();
  for (const f of feriados) {
    const fecha = new Date(f.fecha);
    if (fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes) {
      feriadosDelMes.set(fecha.getUTCDate(), f.nombre);
    }
  }

  function getLicenciasDelDia(dia: number) {
    const fecha = Date.UTC(anio, mes, dia);
    return licencias.filter((l) => {
      const inicio = new Date(l.fechaInicio);
      const fin = new Date(l.fechaFin);
      const inicioUTC = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
      const finUTC = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
      return fecha >= inicioUTC && fecha <= finUTC;
    });
  }

  // Por el momento el click simple no hace nada (no navega al legajo); el doble
  // click resalta la licencia y atenúa el resto.
  function manejarClic(e: React.MouseEvent) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
  }

  function manejarDobleClic(e: React.MouseEvent, licenciaId: string) {
    e.preventDefault();
    setLicenciaResaltada((actual) => (actual === licenciaId ? null : licenciaId));
  }

  // En el modal de "día expandido" el doble click no resalta: abre/cierra el
  // panel lateral con el mini-calendario de esa licencia puntual.
  function manejarDobleClicModal(e: React.MouseEvent, l: LicenciaRow) {
    e.preventDefault();
    setPanelLicencia((actual) => (actual?.id === l.id ? null : l));
  }

  function manejarClicDerecho(e: React.MouseEvent, href: string) {
    e.preventDefault();
    e.stopPropagation(); // que no burbujee y dispare el cierre del backdrop
    setMenuContextual({ x: e.clientX, y: e.clientY, href });
  }

  // Usado tanto en las celdas del calendario (nombre truncado, por espacio) como
  // en el modal de "día expandido" (nombre completo, sin límite de carriles).
  function renderLicencia(l: LicenciaRow, { truncar, enModal = false }: { truncar: boolean; enModal?: boolean }) {
    const resaltada = enModal ? panelLicencia?.id === l.id : licenciaResaltada === l.id;
    const atenuada = enModal ? false : licenciaResaltada !== null && !resaltada;
    const href = `/personal/${l.agente.id}?tab=licencias`;

    return (
      <Link
        key={l.id}
        href={href}
        data-licencia-id={l.id}
        onClick={manejarClic}
        onDoubleClick={(e) => (enModal ? manejarDobleClicModal(e, l) : manejarDobleClic(e, l.id))}
        onContextMenu={(e) => {
          // Dentro del modal de día el click derecho lo maneja un único
          // listener centralizado (más abajo); acá sólo aplica a la grilla.
          if (enModal) return;
          // El menú de "Ir a Licencias/Ausentismos" sólo se activa si el
          // efectivo ya está marcado (doble click previo); si no, no hace nada.
          if (!resaltada) return;
          manejarClicDerecho(e, href);
        }}
        className={`flex items-center justify-between gap-1 rounded px-1 mb-0.5 text-[10px] font-medium leading-4 transition-all ${
          TIPO_LICENCIA_BADGE[l.tipo] ?? "bg-slate-800 text-slate-400"
        } ${resaltada ? "ring-2 ring-white" : ""} ${atenuada ? "opacity-30" : ""}`}
        title={`${l.agente.apellidos}, ${l.agente.nombres} — Licencia ${TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo} (doble click para ${enModal ? "ver el mes" : "resaltar"}${resaltada ? "; click derecho para ir al legajo" : ""})`}
      >
        <span className="min-w-0 truncate">
          {truncar ? l.agente.apellidos.split(" ")[0] : `${l.agente.apellidos}, ${l.agente.nombres}`}
        </span>
        <span className="shrink-0">{TIPO_LICENCIA_EMOJI[l.tipo]}</span>
      </Link>
    );
  }

  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push(celdas.slice(i, i + 7));
  }

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {semanas.map((semana, si) => (
          <div key={si} className="grid grid-cols-7 gap-0.5">
            {semana.map((dia, di) => {
              if (!dia) return <div key={di} />;
              const lics = getLicenciasDelDia(dia);
              const hoy = new Date();
              const esHoy = hoy.getDate() === dia && hoy.getMonth() === mes && hoy.getFullYear() === anio;
              const nombreFeriado = feriadosDelMes.get(dia);
              const overflow = lics.filter((l) => (carriles.get(l.id) ?? 0) >= MAX_CARRILES_VISIBLES).length;

              return (
                <div
                  key={di}
                  className={`min-h-[80px] rounded-lg p-1 border text-xs ${
                    esHoy ? "border-blue-400 bg-blue-500/10" : "border-slate-800 bg-slate-900"
                  }`}
                >
                  <div className="flex justify-end mb-0.5">
                    <div className="group/feriado relative">
                      <span
                        className={`inline-flex items-center justify-center h-5 w-5 rounded-full font-medium ${
                          nombreFeriado
                            ? "cursor-pointer bg-slate-300/20 text-slate-200 ring-1 ring-slate-300/40"
                            : esHoy
                              ? "text-blue-400"
                              : "text-slate-400"
                        }`}
                      >
                        {dia}
                      </span>
                      {nombreFeriado && (
                        <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 hidden group-hover/feriado:block">
                          <div className="whitespace-nowrap rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 shadow-lg shadow-black/30">
                            {nombreFeriado}
                          </div>
                          <div className="absolute -bottom-1 right-2 h-2 w-2 rotate-45 border-b border-r border-slate-700 bg-slate-800" />
                        </div>
                      )}
                    </div>
                  </div>
                  {Array.from({ length: MAX_CARRILES_VISIBLES }, (_, carril) => {
                    const l = lics.find((x) => carriles.get(x.id) === carril);
                    if (!l) return <div key={carril} className="h-4 mb-0.5" />;
                    return renderLicencia(l, { truncar: true });
                  })}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setDiaExpandido(dia)}
                      className="block w-full text-left text-[10px] text-slate-500 px-1 hover:text-slate-300 hover:underline"
                    >
                      +{overflow} más
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {menuContextual && (
        <div
          className="fixed z-[60] rounded-lg border border-slate-700 bg-slate-800 py-1 text-xs shadow-lg shadow-black/40"
          style={{ top: menuContextual.y, left: menuContextual.x }}
        >
          <button
            type="button"
            onClick={() => {
              router.push(menuContextual.href);
              setMenuContextual(null);
            }}
            className="block w-full whitespace-nowrap px-3 py-1.5 text-left font-medium text-slate-200 hover:bg-slate-700"
          >
            Ir a Licencias/Ausentismos
          </button>
        </div>
      )}
      {diaExpandido !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            // Si el menú contextual está abierto, este click de fondo sólo lo
            // cierra a él (se absorbe), no cierra además todo el modal.
            if (menuContextual) { setMenuContextual(null); return; }
            cerrarModalDia();
          }}
        >
          <div className="flex items-start gap-4" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-96 max-h-[80vh] shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50 animate-fade-in flex flex-col"
              style={alturaCalendario ? { height: `${alturaCalendario}px` } : undefined}
              onClick={cerrarPorClickEnListaDelDia}
            >
              <div className="flex items-center justify-between mb-3 shrink-0">
                <h4 className="text-sm font-semibold text-slate-200 capitalize">
                  {new Date(anio, mes, diaExpandido).toLocaleDateString("es-AR", {
                    weekday: "long", day: "2-digit", month: "long", year: "numeric",
                  })}
                </h4>
                <button
                  type="button"
                  onClick={cerrarModalDia}
                  className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                {getLicenciasDelDia(diaExpandido).map((l) => renderLicencia(l, { truncar: false, enModal: true }))}
              </div>
            </div>
            {panelParaMostrar && (
              <div
                key={panelParaMostrar.id}
                ref={panelRef}
                onClick={() => setMenuContextual(null)}
                className={`w-96 max-h-[80vh] shrink-0 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50 ${
                  panelSaliendo ? "animate-slide-out-left" : "animate-slide-in-right"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-200">Detalle de la licencia</h4>
                  <button
                    type="button"
                    onClick={() => setPanelLicencia(null)}
                    className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <MiniCalendarioLicencia licencia={panelParaMostrar} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Calendario simplificado que sólo pinta los días que abarca una licencia
// puntual, en el mes en que comienza. Se muestra en el panel lateral que
// aparece al hacer doble click sobre un agente dentro del modal de día.
function MiniCalendarioLicencia({ licencia }: { licencia: LicenciaRow }) {
  const inicio = new Date(licencia.fechaInicio);
  const fin = new Date(licencia.fechaFin);
  const anio = inicio.getUTCFullYear();
  const mes = inicio.getUTCMonth();

  const inicioUTC = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const finUTC = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());

  const primerDia = new Date(anio, mes, 1);
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const offsetInicio = (primerDia.getDay() + 6) % 7;
  const celdas: (number | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const badge = TIPO_LICENCIA_BADGE[licencia.tipo] ?? "bg-slate-800 text-slate-400";

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-200">
        {licencia.agente.apellidos}, {licencia.agente.nombres}
      </p>
      <p className="mb-3 text-xs text-slate-500 capitalize">{fmtMes(anio, mes)}</p>
      <div className="grid grid-cols-7 mb-1">
        {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-500 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {celdas.map((dia, i) => {
          if (!dia) return <div key={i} />;
          const enRango = Date.UTC(anio, mes, dia) >= inicioUTC && Date.UTC(anio, mes, dia) <= finUTC;
          return (
            <div
              key={i}
              className={`flex h-8 items-center justify-center rounded-md text-xs font-medium ${
                enRango ? badge : "text-slate-500"
              }`}
            >
              {dia}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TablaLicenciasSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="bg-slate-950 border-b border-slate-700 px-4 py-3 flex gap-6">
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <div className="h-3 w-20 rounded skeleton-shimmer" />
        <div className="h-3 w-16 rounded skeleton-shimmer" />
        <div className="h-3 w-28 rounded skeleton-shimmer" />
        <div className="h-3 w-10 rounded skeleton-shimmer" />
      </div>
      <div className="divide-y divide-slate-800">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-6">
            <div className="h-3 w-32 rounded skeleton-shimmer" />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
            <div className="h-5 w-24 rounded-full skeleton-shimmer" />
            <div className="h-3 w-28 rounded skeleton-shimmer" />
            <div className="h-3 w-10 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarioSkeleton() {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="h-6 w-6 rounded skeleton-shimmer" />
        <div className="h-4 w-32 rounded skeleton-shimmer" />
        <div className="h-6 w-6 rounded skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-3 w-6 rounded skeleton-shimmer mx-auto" />
        ))}
      </div>
      <div className="space-y-1">
        {Array.from({ length: 5 }, (_, si) => (
          <div key={si} className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 7 }, (_, di) => (
              <div key={di} className="min-h-[80px] rounded-lg skeleton-shimmer" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VistaLicencias({
  licencias,
  sectores,
  esSupervisor,
  esAdmin,
  feriados,
}: {
  licencias: LicenciaRow[];
  sectores: SectorOption[];
  canManage: boolean;
  esSupervisor: boolean;
  esAdmin: boolean;
  feriados: Feriado[];
}) {
  const [mainTab, setMainTab] = useState<"licencias" | "feriados">("licencias");
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [targetVista, setTargetVista] = useState<"lista" | "calendario">("lista");
  const [vistaPending, startVistaTransition] = useTransition();

  function cambiarVista(v: "lista" | "calendario") {
    if (v === vista) return;
    setTargetVista(v);
    startVistaTransition(() => setVista(v));
  }

  const tabButtonRefs = useRef<Partial<Record<"licencias" | "feriados", HTMLButtonElement>>>({});
  const [indicador, setIndicador] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const btn = tabButtonRefs.current[mainTab];
    if (btn) setIndicador({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [mainTab, esAdmin]);
  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [soloVigentes, setSoloVigentes] = useState(true);
  // La tabla de lista muestra de a 10 filas; "Cargar más" suma de a 10 hasta
  // llegar al total, para no traer todo de golpe si hay muchas licencias.
  const [cantidadVisible, setCantidadVisible] = useState(10);
  const [cargandoMas, setCargandoMas] = useState(false);

  // El slice ya está en memoria (no hay pedido de red real), así que sin este
  // pequeño delay artificial el loader no llegaría a verse.
  function cargarMas() {
    setCargandoMas(true);
    setTimeout(() => {
      setCantidadVisible((c) => c + 10);
      setCargandoMas(false);
    }, 400);
  }

  // Filtros por columna (sólo se aplican con filtrosActivos = true)
  const [filtrosActivos, setFiltrosActivos] = useState(false);
  const [filtroSectores, setFiltroSectores] = useState<string[]>([]);
  const [filtroTipos, setFiltroTipos] = useState<string[]>([]);
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState("");
  const [filtroPeriodoFin, setFiltroPeriodoFin] = useState("");
  const [filtroAgentes, setFiltroAgentes] = useState<string[]>([]);
  // Al abrir un filtro se muestra como modal centrado con fondo oscuro (ver
  // más abajo), no como desplegable pegado a la cabecera: así nunca queda
  // recortado ni mal posicionado por el scroll o el tamaño de la tabla.
  const [columnaAbierta, setColumnaAbierta] = useState<"sector" | "tipo" | "periodo" | "agente" | null>(null);

  function abrirColumna(columna: "sector" | "tipo" | "periodo" | "agente") {
    setColumnaAbierta((c) => (c === columna ? null : columna));
  }

  function toggleFiltrosActivos() {
    setFiltrosActivos((v) => {
      const activando = !v;
      if (!activando) {
        // Al desactivar, se limpian del todo (no quedan filtros "ocultos" aplicados).
        setFiltroSectores([]);
        setFiltroTipos([]);
        setFiltroPeriodoInicio("");
        setFiltroPeriodoFin("");
        setFiltroAgentes([]);
        setColumnaAbierta(null);
      }
      return activando;
    });
  }

  function toggleFiltroSector(nombre: string) {
    setFiltroSectores((prev) => (prev.includes(nombre) ? prev.filter((x) => x !== nombre) : [...prev, nombre]));
  }

  function toggleFiltroTipo(valor: string) {
    setFiltroTipos((prev) => (prev.includes(valor) ? prev.filter((x) => x !== valor) : [...prev, valor]));
  }

  function toggleFiltroAgente(id: string) {
    setFiltroAgentes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const cantidadFiltrosColumna =
    filtroSectores.length + filtroTipos.length + filtroAgentes.length + (filtroPeriodoInicio || filtroPeriodoFin ? 1 : 0);

  // Navegación del calendario
  const hoy = new Date();
  const [calAnio, setCalAnio] = useState(hoy.getFullYear());
  const [calMes, setCalMes] = useState(hoy.getMonth());
  const [cargandoMes, setCargandoMes] = useState(false);

  // El mes ya está en memoria (no hay pedido de red real), así que sin este
  // pequeño delay artificial el loader no llegaría a verse.
  function cambiarMes(direccion: -1 | 1) {
    setCargandoMes(true);
    setTimeout(() => {
      if (direccion === -1) {
        if (calMes === 0) { setCalAnio((a) => a - 1); setCalMes(11); }
        else setCalMes((m) => m - 1);
      } else {
        if (calMes === 11) { setCalAnio((a) => a + 1); setCalMes(0); }
        else setCalMes((m) => m + 1);
      }
      setCargandoMes(false);
    }, 400);
  }

  // Filtros licencias
  const licenciasFiltradas = licencias.filter((l) => {
    if (soloVigentes && !esVigente(l)) return false;
    if (filtroSectores.length > 0 && (!l.agente.sector || !filtroSectores.includes(l.agente.sector))) return false;
    if (filtroTipos.length > 0 && !filtroTipos.includes(l.tipo)) return false;
    if (filtroAgentes.length > 0 && !filtroAgentes.includes(l.agente.id)) return false;
    // Rango de período: se muestran las licencias que se superponen en algún
    // punto con el rango elegido (inicio del rango <= fin de la licencia, y
    // fin del rango >= inicio de la licencia).
    if (filtroPeriodoInicio && new Date(l.fechaFin).getTime() < new Date(filtroPeriodoInicio).getTime()) return false;
    if (filtroPeriodoFin && new Date(l.fechaInicio).getTime() > new Date(filtroPeriodoFin).getTime()) return false;
    if (filtroBusqueda) {
      const q = filtroBusqueda.toLowerCase();
      if (!`${l.agente.apellidos} ${l.agente.nombres}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Si cambia algún filtro o la búsqueda, se vuelve a mostrar desde las
  // primeras 10 filas (si no, "Cargar más" podría quedar mostrando de más
  // o de menos respecto del nuevo resultado filtrado). Se ajusta durante el
  // render (patrón recomendado por React) en vez de en un efecto, para no
  // disparar una segunda pasada de renders.
  const filtrosKey = JSON.stringify({
    filtroBusqueda, soloVigentes, filtroSectores, filtroTipos, filtroAgentes, filtroPeriodoInicio, filtroPeriodoFin,
  });
  const [prevFiltrosKey, setPrevFiltrosKey] = useState(filtrosKey);
  if (filtrosKey !== prevFiltrosKey) {
    setPrevFiltrosKey(filtrosKey);
    setCantidadVisible(10);
  }

  const licenciasVisibles = licenciasFiltradas.slice(0, cantidadVisible);

  const tiposLicencia = Object.entries(TIPO_LICENCIA_LABELS);

  // Agentes distintos presentes en esta tabla, para el filtro de "Agente".
  const agentesUnicos = Array.from(
    new Map(licencias.map((l) => [l.agente.id, l.agente])).values()
  ).sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`));

  // Cabecera de columna con botón de filtro (sólo con filtrosActivos). Al
  // activarse no despliega nada ahí mismo: abre el modal centrado (definido
  // más abajo, junto al resto del JSX) para no depender de la posición de
  // la cabecera ni del tamaño/scroll de la tabla.
  function renderCabeceraFiltrable(columna: "sector" | "tipo" | "periodo" | "agente", label: string, activo: boolean) {
    if (!filtrosActivos) {
      return <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</th>;
    }
    return (
      <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide">
        <button
          type="button"
          onClick={() => abrirColumna(columna)}
          className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors ${activo ? "text-blue-400" : "text-slate-400 hover:text-slate-200"}`}
        >
          {label}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </th>
    );
  }

  const FILTRO_COLUMNA_TITULOS: Record<"sector" | "tipo" | "periodo" | "agente", string> = {
    sector: "Sector",
    tipo: "Tipo",
    periodo: "Período",
    agente: "Agente",
  };

  const contenidoFiltroSector = (
    <div className="space-y-0.5">
      {sectores.map((s) => (
        <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filtroSectores.includes(s.nombre)}
            onChange={() => toggleFiltroSector(s.nombre)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {s.nombre}
        </label>
      ))}
      {filtroSectores.length > 0 && (
        <button
          type="button"
          onClick={() => setFiltroSectores([])}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoFiltroTipo = (
    <div className="space-y-0.5">
      {tiposLicencia.map(([v, l]) => (
        <label key={v} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filtroTipos.includes(v)}
            onChange={() => toggleFiltroTipo(v)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {l}
        </label>
      ))}
      {filtroTipos.length > 0 && (
        <button
          type="button"
          onClick={() => setFiltroTipos([])}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoFiltroPeriodo = (
    <div className="space-y-2">
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Desde</label>
        <input
          type="date"
          value={filtroPeriodoInicio}
          onChange={(e) => setFiltroPeriodoInicio(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Hasta</label>
        <input
          type="date"
          value={filtroPeriodoFin}
          onChange={(e) => setFiltroPeriodoFin(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {(filtroPeriodoInicio || filtroPeriodoFin) && (
        <button
          type="button"
          onClick={() => { setFiltroPeriodoInicio(""); setFiltroPeriodoFin(""); }}
          className="w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const contenidoFiltroAgente = (
    <div className="space-y-0.5">
      {agentesUnicos.map((a) => (
        <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filtroAgentes.includes(a.id)}
            onChange={() => toggleFiltroAgente(a.id)}
            className="rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-500"
          />
          {a.apellidos}, {a.nombres}
        </label>
      ))}
      {filtroAgentes.length > 0 && (
        <button
          type="button"
          onClick={() => setFiltroAgentes([])}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[11px] text-blue-400 hover:bg-slate-700 hover:text-blue-300"
        >
          Limpiar
        </button>
      )}
    </div>
  );

  const CONTENIDO_FILTRO_COLUMNA: Record<"sector" | "tipo" | "periodo" | "agente", React.ReactNode> = {
    sector: contenidoFiltroSector,
    tipo: contenidoFiltroTipo,
    periodo: contenidoFiltroPeriodo,
    agente: contenidoFiltroAgente,
  };

  return (
    <>
    <div className="space-y-4">
      {/* Pestañas principales + toggle vista */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative flex border-b border-slate-700">
          <button
            type="button"
            ref={(el) => { tabButtonRefs.current.licencias = el ?? undefined; }}
            onClick={() => { setMainTab("licencias"); setFiltroTipos([]); }}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors -mb-px ${mainTab === "licencias" ? "text-blue-400" : "text-slate-400 hover:text-slate-300"}`}
          >
            Licencias
            <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">{licencias.length}</span>
          </button>
          {esAdmin && (
            <button
              type="button"
              ref={(el) => { tabButtonRefs.current.feriados = el ?? undefined; }}
              onClick={() => setMainTab("feriados")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 border-transparent transition-colors -mb-px ${mainTab === "feriados" ? "text-blue-400" : "text-slate-400 hover:text-slate-300"}`}
            >
              Feriados
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">{feriados.length}</span>
            </button>
          )}
          {indicador && (
            <span
              className="absolute bottom-0 h-0.5 bg-blue-500 transition-all duration-300 ease-out"
              style={{ left: indicador.left, width: indicador.width }}
            />
          )}
        </div>

        {/* Toggle lista / calendario */}
        {mainTab !== "feriados" && (
          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => cambiarVista("lista")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${targetVista === "lista" ? "bg-slate-950 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Lista
            </button>
            <button
              type="button"
              onClick={() => cambiarVista("calendario")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${targetVista === "calendario" ? "bg-slate-950 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendario
            </button>
          </div>
        )}
      </div>

      {/* Feriados */}
      {mainTab === "feriados" && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
          <GestorFeriados feriados={feriados} />
        </div>
      )}

      {/* Filtros */}
      {mainTab !== "feriados" && (
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por apellido o nombre..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-96"
        />
        <button
          type="button"
          onClick={toggleFiltrosActivos}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            filtrosActivos ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
          </svg>
          Filtros
          {cantidadFiltrosColumna > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-blue-500 h-4 min-w-4 px-1 text-[10px] font-semibold text-white">
              {cantidadFiltrosColumna}
            </span>
          )}
        </button>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={soloVigentes}
            onClick={() => setSoloVigentes((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              soloVigentes ? "bg-green-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                soloVigentes ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          Solo vigentes
        </label>
      </div>
      )}

      {/* Vista lista / calendario */}
      {mainTab === "licencias" && vistaPending && (
        targetVista === "lista" ? <TablaLicenciasSkeleton /> : <CalendarioSkeleton />
      )}
      {mainTab === "licencias" && !vistaPending && vista === "lista" && (
        <div key={vista} className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden animate-fade-in">
          <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-700">
                  {renderCabeceraFiltrable("agente", "Agente", filtroAgentes.length > 0)}
                  {!esSupervisor && renderCabeceraFiltrable("sector", "Sector", filtroSectores.length > 0)}
                  {renderCabeceraFiltrable("tipo", "Tipo", filtroTipos.length > 0)}
                  {renderCabeceraFiltrable("periodo", "Período", Boolean(filtroPeriodoInicio || filtroPeriodoFin))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Días</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {licenciasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={esSupervisor ? 5 : 6} className="px-6 py-12 text-center text-sm text-slate-500">
                      No hay licencias.
                    </td>
                  </tr>
                ) : (
                  licenciasVisibles.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/personal/${l.agente.id}?tab=licencias`} className="font-medium text-slate-100 hover:text-blue-400 transition-colors">
                          {l.agente.apellidos}, {l.agente.nombres}
                        </Link>
                      </td>
                      {!esSupervisor && (
                        <td className="px-4 py-3 text-slate-400 text-xs">{l.agente.sector ?? "—"}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-between gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_LICENCIA_BADGE[l.tipo] ?? "bg-slate-800 text-slate-400"}`}>
                          {TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}
                          <span>{TIPO_LICENCIA_EMOJI[l.tipo]}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {fmt(l.fechaInicio)} → {fmt(l.fechaFin)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-center">{l.diasHabiles}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">{l.motivo ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
          {cantidadVisible < licenciasFiltradas.length && (
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
              <span className="text-xs text-slate-500">
                Mostrando {licenciasVisibles.length} de {licenciasFiltradas.length}
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
        </div>
      )}

      {mainTab === "licencias" && !vistaPending && vista === "calendario" && (
        <div key={vista} className="bg-slate-900 rounded-xl border border-slate-700 p-5 animate-fade-in">
          {/* Navegación mes */}
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={() => cambiarMes(-1)}
              disabled={cargandoMes}
              className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-semibold text-slate-200 capitalize">{fmtMes(calAnio, calMes)}</h3>
            <button
              type="button"
              onClick={() => cambiarMes(1)}
              disabled={cargandoMes}
              className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <CalendarioMes anio={calAnio} mes={calMes} licencias={licenciasFiltradas} feriados={feriados} />
            {cargandoMes && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
                <span className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
              </div>
            )}
          </div>

          {/* Leyenda */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex flex-wrap gap-2">
              {Object.entries(TIPO_LICENCIA_BADGE).map(([tipo, badge]) => (
                <span key={tipo} className={`inline-flex items-center justify-between gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
                  {TIPO_LICENCIA_LABELS[tipo]}
                  <span>{TIPO_LICENCIA_EMOJI[tipo]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

    {columnaAbierta && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => setColumnaAbierta(null)}
      >
        <div
          className="w-80 max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-200">Filtrar por {FILTRO_COLUMNA_TITULOS[columnaAbierta]}</h4>
            <button
              type="button"
              onClick={() => setColumnaAbierta(null)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {CONTENIDO_FILTRO_COLUMNA[columnaAbierta]}
        </div>
      </div>
    )}
    </>
  );
}
