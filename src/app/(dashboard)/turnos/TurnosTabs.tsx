"use client";

import { useState } from "react";
import VistaTurnos from "./VistaTurnos";
import VistaCobertura from "./VistaCobertura";
import type { DiaTurnoInfo, ElegiblesTurno } from "@/app/actions/turnos";
import type { CoberturaTurnoInfo, ElegiblesCobertura } from "@/app/actions/coberturas";

type Tab = "calendario" | "jefaturas" | "lineales";

const TABS: { id: Tab; label: string }[] = [
  { id: "calendario", label: "Calendario" },
  { id: "jefaturas", label: "Cobertura de Jefaturas" },
  { id: "lineales", label: "Lineales" },
];

interface Props {
  anio: number;
  mes: number;
  dias: DiaTurnoInfo[];
  elegibles: ElegiblesTurno;
  jefaturas: CoberturaTurnoInfo[];
  lineales: CoberturaTurnoInfo[];
  elegiblesCobertura: ElegiblesCobertura;
  feriados: string[];
  canEdit: boolean;
}

export default function TurnosTabs({ anio, mes, dias, elegibles, jefaturas, lineales, elegiblesCobertura, feriados, canEdit }: Props) {
  const [tab, setTab] = useState<Tab>("calendario");

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-[var(--c-blue)] text-white" : "text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "calendario" && (
        <VistaTurnos anioInicial={anio} mesInicial={mes} diasInicial={dias} elegibles={elegibles} feriadosInicial={feriados} canEdit={canEdit} />
      )}
      {tab === "jefaturas" && (
        <VistaCobertura
          tipo="JEFATURA"
          campoLabel="Dependencia"
          campoPlaceholder="Ej. Territorial Este"
          labelElegibles="Directores y Jefes"
          elegibles={elegiblesCobertura.jefaturas}
          anioInicial={anio}
          mesInicial={mes}
          datosIniciales={jefaturas}
          canEdit={canEdit}
        />
      )}
      {tab === "lineales" && (
        <VistaCobertura
          tipo="LINEAL"
          campoLabel="Avenida"
          campoPlaceholder="Ej. Av. Colón"
          labelElegibles="Personal habilitado"
          elegibles={elegiblesCobertura.lineales}
          anioInicial={anio}
          mesInicial={mes}
          datosIniciales={lineales}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
