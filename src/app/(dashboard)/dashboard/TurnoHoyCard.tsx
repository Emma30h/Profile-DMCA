"use client";

import { useEffect, useState } from "react";
import type { TurnoHoyInfo } from "@/app/actions/turnos";

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

export default function TurnoHoyCard({ turnoHoy }: { turnoHoy: TurnoHoyInfo }) {
  const grupo = turnoHoy.grupoTurno;
  // La franja vigente y la fecha se recalculan solas cada un minuto (mismo
  // mecanismo que ContadorPermiso en LegajoTabs.tsx) para que la tarjeta no
  // quede mostrando la franja/fecha de cuando se cargó la página si el
  // usuario la deja abierta y cruza una hora o la medianoche.
  const [{ horaActual, fecha }, setReloj] = useState(calcularReloj);
  useEffect(() => {
    const interval = setInterval(() => setReloj(calcularReloj()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4.5">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Turno de hoy</h3>
        <span className="text-[11px] text-slate-500 tabular-nums">{fecha}</span>
      </div>
      <div className="space-y-3 text-[13px]">
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
                      className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 -mx-2 text-[12px] transition-colors ${
                        vigente
                          ? grupo === 1
                            ? "bg-blue-500/15 ring-1 ring-inset ring-blue-500/40"
                            : "bg-purple-500/15 ring-1 ring-inset ring-purple-500/40"
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
    </div>
  );
}
