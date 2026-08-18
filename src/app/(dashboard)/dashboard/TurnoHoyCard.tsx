"use client";

import { useEffect, useState } from "react";
import type { TurnoHoyInfo } from "@/app/actions/turnos";
import type { CoberturaTurnoInfo, CoberturasSemana } from "@/app/actions/coberturas";

// Cada franja horaria la cubre una letra del grupo 1 y una del grupo 2 (ver
// GRUPO_TURNO_LETRAS en types/index.ts para el agrupamiento A·C·E / B·D·F);
// acá se discrimina letra por letra según el horario que le toca, y se
// marca la franja vigente ahora mismo.
const BANDAS_TURNO: { horario: string; inicio: number; fin: number; letras: [string, string] }[] = [
  { horario: "07:00 Hrs a 15:00 Hrs", inicio: 7, fin: 15, letras: ["A", "B"] },
  { horario: "15:00 Hrs a 23:00 Hrs", inicio: 15, fin: 23, letras: ["C", "D"] },
  { horario: "23:00 Hrs a 07:00 Hrs", inicio: 23, fin: 7, letras: ["E", "F"] },
];

// El servidor puede correr en cualquier huso horario (ej. UTC en Vercel);
// las franjas están definidas en hora de Córdoba, así que se lee la hora
// ahí explícitamente en vez de usar la hora local del proceso.
function horaActualCordoba(): number {
  const hora = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return Number(hora) % 24; // Intl puede devolver "24" para la medianoche
}

// Misma razón que horaActualCordoba(): la fecha de hoy también se lee en
// hora de Córdoba, no en la del proceso, para que coincida con las franjas.
function fechaHoyCordoba(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${obtener("day")}/${obtener("month")}/${obtener("year")}`;
}

function enBandaVigente(hora: number, inicio: number, fin: number): boolean {
  // Franjas normales (inicio < fin) vs. la que cruza la medianoche (23 a 07).
  return inicio < fin ? hora >= inicio && hora < fin : hora >= inicio || hora < fin;
}

function calcularReloj() {
  return { horaActual: horaActualCordoba(), fecha: fechaHoyCordoba() };
}

function fmtDiaCorto(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function nombreCobertura(item: CoberturaTurnoInfo): string {
  if (item.agente) return item.agente.rango ? `${item.agente.rango} ${item.agente.nombreCompleto}` : item.agente.nombreCompleto;
  return item.nombreManual ?? "Sin asignar";
}

function GrupoCobertura({ titulo, items, hoy }: { titulo: string; items: CoberturaTurnoInfo[]; hoy: string }) {
  return (
    <div>
      <div className="text-slate-400 text-[11px] mb-1">{titulo}</div>
      {items.length === 0 ? (
        <div className="text-slate-500 text-[12px]">Sin turnos cargados esta semana</div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const esHoy = item.fecha === hoy;
            return (
              <div
                key={item.id}
                className={`text-[12px] rounded-md px-2 py-1 ${esHoy ? "bg-blue-500/10" : ""}`}
              >
                <span className={`font-medium capitalize ${esHoy ? "text-blue-300" : "text-slate-400"}`}>{fmtDiaCorto(item.fecha)}</span>
                <span className="text-slate-200"> — {nombreCobertura(item)}</span>
                <div className="text-slate-500 truncate">
                  {item.lugar}
                  {item.zona && ` · Zona ${item.zona}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Vista = "hoy" | "semana";
const VISTAS: Vista[] = ["hoy", "semana"];
const VISTA_LABEL: Record<Vista, string> = { hoy: "Turno de hoy", semana: "Turneros de la semana" };

export default function TurnoHoyCard({ turnoHoy, semana }: { turnoHoy: TurnoHoyInfo; semana: CoberturasSemana }) {
  const grupo = turnoHoy.grupoTurno;
  const [vista, setVista] = useState<Vista>("hoy");
  // La franja vigente y la fecha se recalculan solas cada un minuto (mismo
  // mecanismo que ContadorPermiso en LegajoTabs.tsx) para que la tarjeta no
  // quede mostrando la franja/fecha de cuando se cargó la página si el
  // usuario la deja abierta y cruza una hora o la medianoche.
  const [{ horaActual, fecha }, setReloj] = useState(calcularReloj);
  useEffect(() => {
    const interval = setInterval(() => setReloj(calcularReloj()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const indiceVista = VISTAS.indexOf(vista);

  return (
    <div className="p-4.5">
      {/* Mismo carril deslizante que "Activos por turno/dependencia/origen"
          (TurnoDependenciaCard), pero acá los puntos de paginación van en su
          propia fila arriba de todo (no compiten por espacio con el título,
          que es lo que rompía el layout cuando eran botones con texto). */}
      <div className="flex items-center justify-center gap-1.5 mb-2.5">
        {VISTAS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            aria-label={VISTA_LABEL[v]}
            aria-current={vista === v}
            className={`h-1.5 rounded-full transition-all ${
              vista === v ? "w-5 bg-blue-500" : "w-1.5 bg-slate-700 hover:bg-slate-600"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center justify-between mb-2.5 gap-2 flex-wrap">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{VISTA_LABEL[vista]}</h3>
        <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
          {vista === "hoy" ? fecha : `${fmtDiaCorto(semana.desde)} al ${fmtDiaCorto(semana.hasta)}`}
        </span>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-[420ms] ease-[cubic-bezier(.65,0,.35,1)]"
          style={{ transform: `translateX(-${indiceVista * 100}%)` }}
        >
          <div className="shrink-0 w-full space-y-3 text-[13px]">
            <div>
              <div className="text-slate-400 text-[11px] mb-0.5">En servicio</div>
              {grupo ? (
                <div className="space-y-1">
                  <div className={`font-semibold ${grupo === 1 ? "text-blue-300" : "text-purple-300"}`}>
                    Turno {grupo === 1 ? "I" : "II"}
                  </div>
                  <div className="space-y-0.5">
                    {BANDAS_TURNO.map((b) => {
                      const vigente = enBandaVigente(horaActual, b.inicio, b.fin);
                      return (
                        <div
                          key={b.horario}
                          className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-[12px] transition-colors ${
                            vigente
                              ? grupo === 1
                                ? "bg-blue-500/15"
                                : "bg-purple-500/15"
                              : ""
                          }`}
                        >
                          <span className={vigente ? "font-medium text-slate-200" : "text-slate-500"}>
                            {b.horario}
                          </span>
                          <span className={`font-semibold ${grupo === 1 ? "text-blue-300" : "text-purple-300"}`}>
                            {b.letras[grupo - 1]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">Sin definir</div>
              )}
            </div>
            <div>
              <div className="text-slate-400 text-[11px] mb-0.5">Superior de turno</div>
              <div className={turnoHoy.superiorTurno ? "font-medium text-slate-200" : "text-slate-500"}>
                {turnoHoy.superiorTurno
                  ? `${turnoHoy.superiorTurnoRango ? `${turnoHoy.superiorTurnoRango} ` : ""}${turnoHoy.superiorTurno}`
                  : "Sin definir"}
                {/* Cubre 20 a 8 hs (cruza la medianoche, ver diaDeTurnoActual()
                    en actions/turnos.ts) — horario fijo, no depende del agente. */}
                {turnoHoy.superiorTurno && (
                  <span className="ml-1.5 text-[11px] font-normal text-slate-500">(20:00 a 08:00 Hrs)</span>
                )}
              </div>
            </div>
            {turnoHoy.esFinDeSemana && (
              <div>
                <div className="text-slate-400 text-[11px] mb-0.5">Jefe de fin de semana</div>
                <div className={turnoHoy.jefeFinDe ? "font-medium text-amber-300" : "text-slate-500"}>
                  {turnoHoy.jefeFinDe ?? "Sin definir"}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 w-full space-y-3">
            <GrupoCobertura titulo="Cobertura de jefaturas" items={semana.jefaturas} hoy={semana.hoy} />
            <GrupoCobertura titulo="Lineales" items={semana.lineales} hoy={semana.hoy} />
          </div>
        </div>
      </div>
    </div>
  );
}
