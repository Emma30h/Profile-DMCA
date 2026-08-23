// Reemplaza al spinner genérico de (dashboard)/loading.tsx solo para esta
// ruta (Next.js usa el loading.tsx más específico del segmento). Repite la
// forma real de las tarjetas de stats (KpiTile, Donut+TurnoDependencia,
// Activos por sexo, HijosACargo+Padres, FlujoPersonalCard) con bloques
// skeleton-shimmer — mismo patrón que ya usa LegajoSkeleton en
// personal/PersonalMasterShell.tsx — para que no haya salto de layout
// cuando llegan los datos reales.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />;
}

function KpiTileSkeleton() {
  return (
    <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Bar className="h-3 w-20" />
        <div className="w-7 h-7 rounded-lg skeleton-shimmer" />
      </div>
      <Bar className="h-6 w-12" />
      <Bar className="h-3 w-28" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
        <KpiTileSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 flex flex-col items-center gap-4">
          <Bar className="h-4 w-40 self-start" />
          <div className="w-36 h-36 rounded-full skeleton-shimmer" />
          <div className="w-full space-y-2">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-5/6" />
          </div>
        </div>
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 space-y-3">
          <Bar className="h-4 w-44" />
          <Bar className="h-3 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Bar className="h-3 w-16 shrink-0" />
              <Bar className="h-2 flex-1" />
              <Bar className="h-3 w-6 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 mb-4 flex flex-col items-center gap-3">
        <Bar className="h-4 w-32 self-start" />
        <div className="flex items-center justify-center gap-10 py-2">
          <div className="w-20 h-20 rounded-full skeleton-shimmer" />
          <div className="w-20 h-20 rounded-full skeleton-shimmer" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 items-stretch">
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 space-y-3">
          <Bar className="h-4 w-36" />
          <div className="flex items-center justify-center py-2">
            <div className="w-24 h-24 rounded-full skeleton-shimmer" />
          </div>
        </div>
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 space-y-3">
          <div className="flex items-baseline justify-between">
            <Bar className="h-4 w-28" />
            <Bar className="h-3 w-20" />
          </div>
          <div className="flex items-center justify-center gap-10 py-2">
            <div className="w-20 h-20 rounded-full skeleton-shimmer" />
            <div className="w-20 h-20 rounded-full skeleton-shimmer" />
          </div>
        </div>
      </div>

      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-4.5 space-y-3">
        <Bar className="h-4 w-48" />
        <Bar className="h-40 w-full" />
      </div>
    </div>
  );
}
