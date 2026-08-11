"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  obtenerMesTurno,
  actualizarDiaTurno,
  generarMesAutomatico,
  type DiaTurnoInfo,
  type ElegiblesTurno,
  type AgenteElegible,
} from "@/app/actions/turnos";
import { GRUPO_TURNO_LETRAS, type GrupoTurno } from "@/types";

interface Props {
  anioInicial: number;
  mesInicial: number; // 1-12
  diasInicial: DiaTurnoInfo[];
  elegibles: ElegiblesTurno;
  canEdit: boolean;
}

const GRUPO_BADGE: Record<GrupoTurno, string> = {
  1: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  2: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

function fmtMes(anio: number, mes: number) {
  return new Date(anio, mes - 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

// El "fin de semana" del Jefe de Fin de Semana arranca el viernes (no solo sábado/domingo).
function esFinDeSemana(anio: number, mes: number, dia: number): boolean {
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaSemana === 5 || diaSemana === 0 || diaSemana === 6;
}

// Reemplaza al <select> nativo en la agenda mobile: la lista desplegable de
// un <select> es UI del sistema operativo, no del navegador, así que no hay
// CSS que le impida desbordar el ancho de la pantalla en algunos navegadores
// (justo lo que pasaba acá, con nombres + rango largos en "Otros por
// excepción"). Este modal sí lo controlamos nosotros — mismo patrón que ya
// usa FiltrosPersonal para sus filtros (w-80 centrado, nunca desborda).
function SelectorAgenteModal({
  value,
  valorManual,
  placeholder,
  principal,
  labelPrincipal,
  otros,
  onChange,
  onChangeManual,
  disabled,
  className,
}: {
  value: string;
  /** Nombre libre cuando la persona todavía no tiene legajo cargado — mutuamente excluyente con `value`. */
  valorManual: string | null;
  placeholder: string;
  principal: AgenteElegible[];
  labelPrincipal: string;
  otros: AgenteElegible[];
  onChange: (v: string) => void;
  onChangeManual: (nombre: string) => void;
  disabled: boolean;
  className: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [textoManual, setTextoManual] = useState("");
  const seleccionado = [...principal, ...otros].find((a) => a.id === value);

  function abrir() {
    setTextoManual(valorManual ?? "");
    setAbierto(true);
  }

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
  }

  function guardarManual() {
    const nombre = textoManual.trim();
    if (!nombre) return;
    onChangeManual(nombre);
    setAbierto(false);
  }

  function filaOpcion(id: string, label: string) {
    return (
      <button
        key={id}
        type="button"
        onClick={() => elegir(id)}
        className={`block w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-700 ${
          id === value ? "text-blue-400 font-medium" : "text-slate-200"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={abrir}
        className={`${className} text-left truncate`}
      >
        {seleccionado ? seleccionado.nombreCompleto : valorManual || placeholder}
      </button>

      {abierto && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-80 max-h-[75vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-200">{placeholder}</h4>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Para cuando la persona todavía no tiene legajo cargado en la base. */}
            <div className="mb-3 space-y-1.5">
              <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Nombre manual (si no está en la lista)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textoManual}
                  onChange={(e) => setTextoManual(e.target.value)}
                  placeholder="Nombre y apellido…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={guardarManual}
                  disabled={!textoManual.trim()}
                  className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
            <div className="mb-1 border-t border-slate-800" />

            {filaOpcion("", "Sin asignar")}

            <p className="mt-3 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{labelPrincipal}</p>
            {principal.map((a) => filaOpcion(a.id, a.nombreCompleto))}

            <p className="mt-3 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Otros (por excepción)</p>
            {otros.map((a) => filaOpcion(a.id, `${a.nombreCompleto} — ${a.rango}`))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function VistaTurnos({ anioInicial, mesInicial, diasInicial, elegibles, canEdit }: Props) {
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState(mesInicial);
  const [dias, setDias] = useState<DiaTurnoInfo[]>(diasInicial);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [modalGenerar, setModalGenerar] = useState(false);
  const [fechaAncla, setFechaAncla] = useState("");
  const [grupoEnAncla, setGrupoEnAncla] = useState<GrupoTurno>(1);
  const [generando, setGenerando] = useState(false);

  async function cambiarMes(direccion: -1 | 1) {
    setCargando(true);
    let nuevoAnio = anio;
    let nuevoMes = mes + direccion;
    if (nuevoMes < 1) { nuevoMes = 12; nuevoAnio -= 1; }
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio += 1; }
    const fresh = await obtenerMesTurno(nuevoAnio, nuevoMes);
    setAnio(nuevoAnio);
    setMes(nuevoMes);
    setDias(fresh);
    setCargando(false);
  }

  async function cambiarCampo(
    fecha: string,
    campo: "grupoTurno" | "superiorTurnoId" | "jefeFinDeId" | "superiorTurnoManual" | "jefeFinDeManual",
    valor: string
  ) {
    setGuardando(fecha);
    try {
      await actualizarDiaTurno({ fecha, campo, valor: valor || null });
      const fresh = await obtenerMesTurno(anio, mes);
      setDias(fresh);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar el cambio");
    } finally {
      setGuardando(null);
    }
  }

  async function confirmarGenerar() {
    if (!fechaAncla) return;
    setGenerando(true);
    try {
      await generarMesAutomatico({ anio, mes, fechaAncla, grupoEnAncla });
      const fresh = await obtenerMesTurno(anio, mes);
      setDias(fresh);
      setModalGenerar(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo generar el mes");
    } finally {
      setGenerando(false);
    }
  }

  const primerDia = new Date(Date.UTC(anio, mes - 1, 1));
  const offsetInicio = (primerDia.getUTCDay() + 6) % 7; // Lunes = 0
  const celdas: (number | null)[] = [
    ...Array(offsetInicio).fill(null),
    ...Array.from({ length: dias.length }, (_, i) => i + 1),
  ];
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  const hoy = new Date();

  // Los 3 controles de un día (turno, superior de turno, jefe de fin de
  // semana si aplica), parametrizados por tamaño: "grid" son las celdas
  // diminutas del calendario mensual (desktop), "agenda" es la lista de un
  // día por fila que se usa en mobile en vez del grid de 7 columnas.
  // Superior/jefe usan siempre SelectorAgenteModal (nunca un <select>
  // nativo): además de no desbordar el ancho de la pantalla con nombres +
  // rango largos, es lo que permite ofrecer la carga de nombre manual.
  function renderControlesDia(dia: number, variant: "grid" | "agenda") {
    const info = dias[dia - 1];
    const estaGuardando = guardando === info.fecha;
    const disabled = !canEdit || estaGuardando;
    const finde = esFinDeSemana(anio, mes, dia);
    const compact = variant === "grid";

    // disabled:appearance-none saca la flechita nativa del <select> de Turno
    // cuando el rol no puede editar (ej. Supervisor) — con la flechita
    // puesta parece clickeable/editable aunque no lo sea. Superior/jefe son
    // <button>, no <select>: nunca tuvieron esa flechita nativa.
    const grupoClass = compact
      ? `w-full rounded px-1 py-0.5 text-[10px] font-semibold border disabled:opacity-80 disabled:appearance-none ${info.grupoTurno ? GRUPO_BADGE[info.grupoTurno] : "bg-slate-800 text-slate-500 border-slate-700"}`
      : `w-full rounded-lg px-2 py-1.5 text-xs font-semibold border disabled:opacity-80 disabled:appearance-none ${info.grupoTurno ? GRUPO_BADGE[info.grupoTurno] : "bg-slate-800 text-slate-500 border-slate-700"}`;
    const superiorClass = compact
      ? "w-full rounded px-1 py-0.5 text-[9px] bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-80"
      : "w-full rounded-lg px-2 py-1.5 text-xs bg-slate-800 text-slate-300 border border-slate-700 disabled:opacity-80";
    const jefeClass = compact
      ? "w-full rounded px-1 py-0.5 text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/30 disabled:opacity-80"
      : "w-full rounded-lg px-2 py-1.5 text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 disabled:opacity-80";

    return (
      <>
        <select
          value={info.grupoTurno ?? ""}
          disabled={disabled}
          onChange={(e) => cambiarCampo(info.fecha, "grupoTurno", e.target.value)}
          className={grupoClass}
        >
          <option value="">Turno: sin definir</option>
          <option value="1">Turno 1 ({GRUPO_TURNO_LETRAS[1]})</option>
          <option value="2">Turno 2 ({GRUPO_TURNO_LETRAS[2]})</option>
        </select>

        <SelectorAgenteModal
          value={info.superiorTurno?.id ?? ""}
          valorManual={info.superiorTurnoManual}
          placeholder="Superior de turno: sin asignar"
          principal={elegibles.subcomisarios}
          labelPrincipal="Subcomisarios"
          otros={elegibles.otrosParaSuperiorTurno}
          onChange={(v) => cambiarCampo(info.fecha, "superiorTurnoId", v)}
          onChangeManual={(nombre) => cambiarCampo(info.fecha, "superiorTurnoManual", nombre)}
          disabled={disabled}
          className={superiorClass}
        />

        {finde && (
          <SelectorAgenteModal
            value={info.jefeFinDe?.id ?? ""}
            valorManual={info.jefeFinDeManual}
            placeholder="Jefe de fin de semana: sin asignar"
            principal={elegibles.oficialesSuperiores}
            labelPrincipal="Oficiales Superiores"
            otros={elegibles.otrosParaJefeFinDe}
            onChange={(v) => cambiarCampo(info.fecha, "jefeFinDeId", v)}
            onChangeManual={(nombre) => cambiarCampo(info.fecha, "jefeFinDeManual", nombre)}
            disabled={disabled}
            className={jefeClass}
          />
        )}
      </>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-3 lg:p-5">
      {/* Leyenda de horarios */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-xs text-slate-400">
        <span><span className="text-blue-300 font-semibold">Turno 1 (A·C·E)</span>: A/B 7-15 hs, C/D 15-23 hs, E/F 23-7 hs</span>
        <span><span className="text-purple-300 font-semibold">Turno 2 (B·D·F)</span>: mismos horarios, grupo alterno</span>
        <span>Superior de Turno: 20-8 hs</span>
      </div>

      {/* Navegación mes + generar */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            disabled={cargando}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-sm font-semibold text-slate-200 capitalize w-40 text-center">{fmtMes(anio, mes)}</h3>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            disabled={cargando}
            className="rounded-lg p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setModalGenerar(true)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            Generar automáticamente
          </button>
        )}
      </div>

      {/* Calendario mensual — desktop. En mobile no entran 7 columnas con 3
          selects por celda, así que se reemplaza por la agenda de abajo. */}
      <div className="relative hidden lg:block">
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
                const info = dias[dia - 1];
                const esHoy = hoy.getDate() === dia && hoy.getMonth() === mes - 1 && hoy.getFullYear() === anio;
                const estaGuardando = guardando === info.fecha;

                return (
                  <div
                    key={di}
                    className={`relative min-h-[112px] rounded-lg p-1 border text-xs flex flex-col gap-1 ${
                      esHoy ? "border-blue-400 bg-blue-500/10" : "border-slate-800 bg-slate-900"
                    }`}
                  >
                    {estaGuardando && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
                        <span className="h-4 w-4 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
                      </div>
                    )}
                    <span className={`text-[11px] font-medium ${esHoy ? "text-blue-400" : "text-slate-400"}`}>{dia}</span>
                    {renderControlesDia(dia, "grid")}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {cargando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
            <span className="h-6 w-6 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Agenda del mes — mobile. Un día por fila en vez del grid de 7
          columnas, con los mismos selects a tamaño legible. */}
      <div className="relative lg:hidden space-y-2">
        {dias.map((info, idx) => {
          const dia = idx + 1;
          const esHoy = hoy.getDate() === dia && hoy.getMonth() === mes - 1 && hoy.getFullYear() === anio;
          const finde = esFinDeSemana(anio, mes, dia);
          const estaGuardando = guardando === info.fecha;
          const nombreDia = new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-AR", { weekday: "short", timeZone: "UTC" });

          return (
            <div
              key={info.fecha}
              className={`relative rounded-lg border p-3 space-y-2 ${
                esHoy ? "border-blue-400 bg-blue-500/10" : finde ? "border-amber-500/20 bg-slate-900" : "border-slate-800 bg-slate-900"
              }`}
            >
              {estaGuardando && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
                  <span className="h-5 w-5 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-semibold ${esHoy ? "text-blue-400" : "text-slate-200"}`}>{dia}</span>
                <span className="text-xs text-slate-500 uppercase">{nombreDia}</span>
                {esHoy && <span className="text-[10px] font-medium text-blue-400 ml-auto">Hoy</span>}
              </div>
              {renderControlesDia(dia, "agenda")}
            </div>
          );
        })}
        {cargando && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
            <span className="h-6 w-6 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Modal generar automático */}
      {modalGenerar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !generando && setModalGenerar(false)}>
          <div
            className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-semibold text-slate-100 mb-1">Generar {fmtMes(anio, mes)} automáticamente</h4>
            <p className="text-xs text-slate-400 mb-4">
              Se completan los días sin definir con el patrón 2x2 alternado. Los días ya editados a mano no se pisan.
            </p>

            <label className="block text-xs text-slate-400 mb-1">Fecha ancla</label>
            <input
              type="date"
              value={fechaAncla}
              onChange={(e) => setFechaAncla(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <label className="block text-xs text-slate-400 mb-1">Turno que trabaja ese día</label>
            <select
              value={grupoEnAncla}
              onChange={(e) => setGrupoEnAncla(Number(e.target.value) as GrupoTurno)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Turno 1 ({GRUPO_TURNO_LETRAS[1]})</option>
              <option value={2}>Turno 2 ({GRUPO_TURNO_LETRAS[2]})</option>
            </select>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalGenerar(false)}
                disabled={generando}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarGenerar}
                disabled={generando || !fechaAncla}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {generando ? "Generando…" : "Generar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
