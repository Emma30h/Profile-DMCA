import type { CumpleanosHoy } from "@/lib/cumpleanosPersonal";

export default function CumpleanosGardenCard({ cumpleanos }: { cumpleanos: CumpleanosHoy[] }) {
  return (
    <div className="p-4.5">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2.5">
        Cumpleaños de personal del Garden
      </h3>
      {cumpleanos.length === 0 ? (
        <p className="text-[13px] text-slate-500">Sin cumpleaños hoy.</p>
      ) : (
        <ul className="space-y-2">
          {cumpleanos.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-[13px] text-slate-200">
              <span className="shrink-0">🎂</span>
              <span>
                {c.nombreCompleto}
                {c.area && <span className="text-slate-500"> · {c.area}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
