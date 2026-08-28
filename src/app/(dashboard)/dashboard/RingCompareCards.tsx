"use client";

// Extraído de page.tsx (Server Component async, no puede tener hooks):
// estas dos tarjetas necesitan estado propio (tema/modoExport) para el
// botón de descarga como imagen, así que pasan a ser client components acá.
import RingCompare from "./RingCompare";
import { buildQueryString } from "../personal/queryString";
import { TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import GraficoDescargable from "@/components/charts/GraficoDescargable";
import type { ConteoLabel, PadresMadresStats, RingStats } from "./stats";

// Gris neutro para el bucket "Otros" (No binario / Otro / Prefiero no
// decir) — no es identidad de serie, queda fijo sin importar el tema
// elegido (mismo criterio que el resto de los grises de estado del
// dashboard).
const OTROS_COLOR = "#7c8aa8";

const SEXO_LABEL: Record<string, string> = {
  NO_BINARIO: "No binario",
  PREFIERO_NO_DECIR: "Prefiero no decir",
  OTRO: "Otro",
};

function IconoMarte() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="8" cy="12" r="5" />
      <line x1="11.7" y1="8.3" x2="17" y2="3" />
      <polyline points="11.5 3 17 3 17 8.5" />
    </svg>
  );
}

function IconoVenus() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <circle cx="10" cy="7" r="5" />
      <line x1="10" y1="12" x2="10" y2="17.5" />
      <line x1="6.5" y1="14.7" x2="13.5" y2="14.7" />
    </svg>
  );
}

function IconoPersona() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
    </svg>
  );
}

export function SexoRingCard({
  sexo,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  sexo: { masculino: RingStats; femenino: RingStats; otros: ConteoLabel[] };
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Activos por sexo</h3>
        {!modoExport && (
          <GraficoDescargable nombreArchivo="activos-por-sexo">
            {(t) => <SexoRingCard sexo={sexo} modoExport tema={t} />}
          </GraficoDescargable>
        )}
      </div>
      <RingCompare
        iconSize={78}
        left={{
          value: sexo.masculino.count,
          label: "Masculino",
          pct: sexo.masculino.pct,
          color: tema.sexoMasc,
          icon: <IconoMarte />,
          href: "/personal?estado=ACTIVO&sexo=MASCULINO",
        }}
        right={{
          value: sexo.femenino.count,
          label: "Femenino",
          pct: sexo.femenino.pct,
          color: tema.sexoFem,
          icon: <IconoVenus />,
          href: "/personal?estado=ACTIVO&sexo=FEMENINO",
        }}
        delayMs={150}
      />
      <div className="flex items-center justify-center gap-2.5 flex-wrap mt-1">
        {sexo.otros.length > 0 ? (
          sexo.otros.map((o) => (
            <span
              key={o.label}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--c-text-secondary)] bg-[var(--c-bg)] border border-[var(--c-bg-elev-2)] pl-2 pr-2.5 py-1 rounded-full"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: OTROS_COLOR }} />
              {SEXO_LABEL[o.label] ?? o.label}
              <b className="text-[var(--c-text)] font-bold">{o.count}</b>
            </span>
          ))
        ) : (
          <span className="text-[11px] text-[var(--c-text-faint)] text-center">
            Sin registros en No binario / Otro / Prefiero no decir entre el personal activo.
          </span>
        )}
      </div>
    </div>
  );
}

export function PadresMadresRingCard({
  padresMadres,
  tema = TEMA_INSTITUCIONAL,
  modoExport = false,
}: {
  padresMadres: PadresMadresStats;
  tema?: ChartTheme;
  modoExport?: boolean;
}) {
  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-[var(--c-text)]">Padres y madres</h3>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[var(--c-text-faint)] tabular-nums">
            {padresMadres.totalConHijos} con hijos a cargo
          </span>
          {!modoExport && (
            <GraficoDescargable nombreArchivo="padres-y-madres">
              {(t) => <PadresMadresRingCard padresMadres={padresMadres} modoExport tema={t} />}
            </GraficoDescargable>
          )}
        </div>
      </div>
      <RingCompare
        left={{
          value: padresMadres.padres.count,
          label: "Padres",
          pct: padresMadres.padres.pct,
          color: tema.sexoMasc,
          icon: <IconoPersona />,
          href: padresMadres.padresIds.length > 0
            ? `/personal?${buildQueryString({ ids: padresMadres.padresIds.join(",") })}`
            : "/personal",
        }}
        right={{
          value: padresMadres.madres.count,
          label: "Madres",
          pct: padresMadres.madres.pct,
          color: tema.sexoFem,
          icon: <IconoPersona />,
          href: padresMadres.madresIds.length > 0
            ? `/personal?${buildQueryString({ ids: padresMadres.madresIds.join(",") })}`
            : "/personal",
        }}
        delayMs={300}
      />
    </div>
  );
}
