function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--c-bg-elev-2)] ${className}`} />;
}

// Misma estructura (3 bloques con divide-y) y mismo padding p-4.5 que
// EventosAsideContent, así el layout no salta cuando los datos reales
// reemplazan al skeleton.
export default function EventosAsideSkeleton() {
  return (
    <div className="flex h-full flex-col divide-y divide-[var(--c-line)]">
      <div className="p-4.5 space-y-3">
        <Bar className="h-2.5 w-24" />
        <div className="space-y-1.5">
          <Bar className="h-2 w-16" />
          <Bar className="h-3.5 w-32" />
        </div>
        <div className="space-y-1.5">
          <Bar className="h-2 w-24" />
          <Bar className="h-3.5 w-40" />
        </div>
      </div>

      <div className="p-4.5 space-y-3">
        <Bar className="h-2.5 w-28" />
        <div className="space-y-2">
          <Bar className="h-3.5 w-full" />
          <Bar className="h-3.5 w-4/5" />
        </div>
      </div>

      {/* flex-1: misma repartición que EventosAsideContent, para que el
          skeleton no salte de tamaño cuando lo reemplaza el contenido real. */}
      <div className="flex-1 p-4.5 space-y-3">
        <Bar className="h-2.5 w-40" />
        <div className="space-y-2">
          <Bar className="h-3.5 w-3/4" />
          <Bar className="h-3.5 w-1/2" />
        </div>
      </div>
    </div>
  );
}
