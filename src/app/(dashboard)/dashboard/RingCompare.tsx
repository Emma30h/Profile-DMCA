"use client";

// Comparación de dos anillos enfrentados (p. ej. Masculino vs Femenino, o Con
// hijos a cargo vs Sin hijos a cargo). Reutilizado por el panel de sexo y el
// de padres/madres; cuando un lado trae `href`, se agranda al pasar el mouse
// y el doble click navega ahí (p. ej. a /personal ya filtrado).

import { useRouter } from "next/navigation";

const R = 58;
const CIRCUNFERENCIA = 2 * Math.PI * R;

export interface RingSide {
  value: number;
  label: string;
  pct: number;
  color: string;
  icon: React.ReactNode;
  /** Si se provee, el anillo se agranda al hover y el doble click navega acá. */
  href?: string;
}

function Ring({ side, iconSize }: { side: RingSide; iconSize: number }) {
  const router = useRouter();
  const largo = (side.pct / 100) * CIRCUNFERENCIA;
  const clickable = Boolean(side.href);

  return (
    <div className="flex flex-col items-center gap-3.5 flex-1 min-w-0">
      <div
        className={`relative w-24 h-24 sm:w-[124px] sm:h-[124px] transition-transform duration-150 ${
          clickable ? "cursor-pointer hover:scale-110" : ""
        }`}
        onDoubleClick={() => {
          if (side.href) router.push(side.href);
        }}
      >
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="70" cy="70" r={R} fill="none" stroke={side.color} strokeOpacity={0.16} strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={side.color}
            strokeWidth="10"
            strokeLinecap="square"
            strokeDasharray={`${largo} ${CIRCUNFERENCIA}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ color: side.color, width: iconSize, height: iconSize }}>{side.icon}</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-xl font-semibold tracking-tight text-[var(--c-text)] tabular-nums">{side.value}</div>
        <div className="text-xs font-medium text-[var(--c-text-secondary)] mt-0.5">{side.label}</div>
        <div className="text-[11px] text-[var(--c-text-faint)] mt-px tabular-nums">{side.pct}%</div>
      </div>
    </div>
  );
}

export default function RingCompare({
  left,
  right,
  iconSize = 42,
}: {
  left: RingSide;
  right: RingSide;
  iconSize?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center py-1.5">
      <Ring side={left} iconSize={iconSize} />
      <div className="flex flex-col items-center gap-2.5 px-2 sm:px-5 self-stretch">
        <span className="w-px flex-1 bg-[var(--c-bg-elev-2)]" />
        <span className="w-8 h-8 rounded-full bg-[var(--c-bg)] border border-[var(--c-line)] flex items-center justify-center text-[10px] font-bold text-[var(--c-text-faint)] tracking-wide shrink-0">
          VS
        </span>
        <span className="w-px flex-1 bg-[var(--c-bg-elev-2)]" />
      </div>
      <Ring side={right} iconSize={iconSize} />
    </div>
  );
}
