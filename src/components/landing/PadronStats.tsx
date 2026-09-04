"use client";

import { useCountUp } from "@/lib/useCountUp";

export interface StatsPublicas {
  agentes: number;
  turnos: number;
  tipos: number;
  rangos: number;
}

const CELDAS = (stats: StatsPublicas) => [
  { valor: stats.agentes, pad: false, label: "AGENTES REGISTRADOS" },
  { valor: stats.turnos, pad: false, label: "TURNOS OPERATIVOS" },
  { valor: stats.tipos, pad: true, label: "TIPOS DE PERSONAL" },
  { valor: stats.rangos, pad: false, label: "RANGOS DEL ESCALAFÓN" },
];

function Cifra({ valor, pad, delayMs }: { valor: number; pad: boolean; delayMs: number }) {
  const animado = useCountUp(valor, delayMs);
  return <>{pad ? String(animado).padStart(2, "0") : animado}</>;
}

// Grilla 2×2 de estadísticas del padrón, animadas con conteo ascendente —
// compartida entre el panel del hero de la landing (Landing.tsx, celdas
// sobre --t-bg, cifra 42px) y el panel de marca de Acceso (AuthScreen.tsx,
// celdas sobre --t-panel, cifra 34px). El "gap:1px sobre fondo con opacidad"
// es la técnica de línea hairline entre celdas que usa el propio handoff, en
// vez de bordes por celda (evita doble grosor en la intersección central).
export default function PadronStats({
  stats,
  tamaño = "grande",
  fondoCelda = "var(--t-bg)",
}: {
  stats: StatsPublicas;
  tamaño?: "grande" | "chica";
  fondoCelda?: string;
}) {
  const cifraSize = tamaño === "grande" ? 42 : 34;
  const labelSize = tamaño === "grande" ? 11 : 10.5;
  const padVertical = tamaño === "grande" ? 13 : 16;

  return (
    <div
      className="grid grid-cols-2 gap-px"
      style={{ background: "rgba(var(--t-fg-rgb),.16)" }}
    >
      {CELDAS(stats).map((c, i) => (
        <div
          key={c.label}
          style={{
            background: fondoCelda,
            padding: i % 2 === 0
              ? `${padVertical}px 4px ${i < 2 ? padVertical : 0}px 0`
              : `${padVertical}px 0 ${i < 2 ? padVertical : 0}px 20px`,
          }}
        >
          <div
            className="tabular-nums"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: cifraSize, lineHeight: 1, color: "var(--t-accent)" }}
          >
            <Cifra valor={c.valor} pad={c.pad} delayMs={i * 90} />
          </div>
          <div
            style={{ fontFamily: "var(--font-heading)", fontSize: labelSize, letterSpacing: ".12em", color: "rgba(var(--t-fg-rgb),.5)", marginTop: 5 }}
          >
            {c.label}
          </div>
        </div>
      ))}
    </div>
  );
}
