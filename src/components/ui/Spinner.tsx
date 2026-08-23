"use client";

// Loader "Arco": el color sale de `currentColor`, así que se controla con
// una clase de texto (ej. text-[var(--c-blue)]) — no trae paleta propia,
// para no repetir el problema de los tokens @theme fijos en el build (ver
// nota sobre --c-* en globals.css).

type SpinnerProps = {
  /** Diámetro en px. 16 inline · 24 botón · 40 panel · 64 pantalla */
  size?: number;
  /** Texto accesible (no se muestra). */
  label?: string;
  /** El arco crece y se contrae. Por defecto a partir de 40px. */
  breathe?: boolean;
  /** Milisegundos por vuelta. */
  spinMs?: number;
  className?: string;
};

function strokeFor(size: number) {
  if (size < 20) return 12;
  if (size < 32) return 9;
  if (size < 52) return 6;
  if (size < 80) return 4;
  return 3;
}

export function Spinner({
  size = 40,
  label = "Cargando",
  breathe,
  spinMs = 1050,
  className = "",
}: SpinnerProps) {
  const sw = strokeFor(size);
  const shouldBreathe = breathe ?? size >= 40;

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block shrink-0 motion-safe:animate-spin ${className}`}
      style={{ width: size, height: size, animationDuration: `${spinMs}ms`, animationTimingFunction: "linear" }}
    >
      <svg viewBox="0 0 100 100" className="block h-full w-full">
        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.24" strokeWidth={sw} />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth={sw}
          strokeLinecap="butt"
          strokeDasharray="70 194"
          className={shouldBreathe ? "motion-safe:animate-arc-breathe" : undefined}
        />
      </svg>
    </span>
  );
}

/** Loader inline para botones: hereda el color del texto del botón. */
export function ButtonSpinner({
  label = "Procesando",
  size = 16,
  className = "",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return <Spinner size={size} label={label} breathe={false} spinMs={900} className={className} />;
}

/** Bloque centrado para paneles, tablas y tarjetas. */
export function LoadingPanel({
  label = "Cargando",
  size = 40,
  className = "",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}>
      <Spinner size={size} label={label} className="text-[var(--c-blue)]" />
      <p className="font-head text-[13px] uppercase tracking-[0.18em] text-[var(--c-text-muted)]">{label}</p>
    </div>
  );
}

/** Overlay de pantalla completa (arranque, cambio de ruta). */
export function LoadingOverlay({ label = "Cargando" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--c-bg)]"
    >
      <Spinner size={64} label={label} className="text-[var(--c-blue)]" />
      <p className="font-head text-[13px] uppercase tracking-[0.2em] text-[var(--c-text-secondary)]">{label}</p>
    </div>
  );
}

export default Spinner;
