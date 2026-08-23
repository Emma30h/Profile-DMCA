import type { CumpleanosHoy } from "@/lib/cumpleanosPersonal";

export default function CumpleanosGardenCard({ cumpleanos }: { cumpleanos: CumpleanosHoy[] }) {
  return (
    <div className="p-4.5">
      <h3 className="text-[11px] font-semibold text-[var(--c-text-muted)] uppercase tracking-wide mb-2.5">
        Cumpleaños de personal del Garden
      </h3>
      {cumpleanos.length === 0 ? (
        <p className="text-[13px] text-[var(--c-text-faint)]">Sin cumpleaños hoy.</p>
      ) : (
        <ul className="space-y-2">
          {cumpleanos.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[13px] text-[var(--c-text)]">
              <span className="shrink-0">🎂</span>
              <span>
                {c.nombreCompleto}
                {c.area && <span className="text-[var(--c-text-faint)]"> · {c.area}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
