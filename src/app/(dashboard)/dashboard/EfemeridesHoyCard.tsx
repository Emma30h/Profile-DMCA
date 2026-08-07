import type { EfemerideHoy, TipoEfemeride } from "@/lib/calendarioGarden";

const TIPO_EMOJI: Record<TipoEfemeride, string> = {
  cumpleanos: "🎂",
  aniversario: "🎉",
  dia: "📅",
  otro: "✨",
};

export default function EfemeridesHoyCard({ eventos }: { eventos: EfemerideHoy[] }) {
  return (
    <div className="p-4.5">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2.5">Efemérides de hoy</h3>
      {eventos.length === 0 ? (
        <p className="text-[13px] text-slate-500">Sin novedades hoy.</p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((e) => (
            <li key={e.id} className="flex items-start gap-2 text-[13px] text-slate-200">
              <span className="shrink-0">{TIPO_EMOJI[e.tipo]}</span>
              <span>{e.titulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
