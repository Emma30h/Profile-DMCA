"use client";

/**
 * LogoLoader — loader de la Dirección Monitoreo "Cordobeses en Alerta".
 * El pin del logo rebota con squash & stretch y sombra que acompaña.
 *
 * Uso:
 *  <LogoLoader />                                            // pantalla completa, fondo oscuro
 *  <LogoLoader size={64} fullScreen={false} showLabel={false} /> // inline
 *  <LogoLoader label="Cargando legajos" theme="light" />
 */

type Props = {
  /** Ancho del logo en px. Default 140. */
  size?: number;
  /** Duración de un ciclo de rebote, en segundos. Default 1.2 */
  speed?: number;
  /** Texto bajo el logo. Default "Cargando" */
  label?: string;
  showLabel?: boolean;
  /** "dark" usa el logo blanco sobre fondo oscuro (recomendado). */
  theme?: "dark" | "light";
  /** Color de fondo explícito; si se omite, lo define el theme. */
  background?: string;
  /** false = se adapta al contenedor en vez de ocupar el viewport. */
  fullScreen?: boolean;
  /** Ruta del logo dentro de /public. */
  src?: string;
  className?: string;
};

export default function LogoLoader({
  size = 140,
  speed = 1.2,
  label = "Cargando",
  showLabel = true,
  theme = "dark",
  background,
  fullScreen = true,
  src = "/logo-ojos-en-alerta.png",
  className,
}: Props) {
  const dark = theme === "dark";
  const bg = background ?? (dark ? "#1d1f20" : "#f2f2f3");
  const labelColor = dark ? "#f2f2f3" : "#3f5b78";
  const dur = `${speed}s`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        ...(fullScreen
          ? { position: "fixed", inset: 0, zIndex: 9999 }
          : { width: "100%", height: "100%", minHeight: size * 2 }),
      }}
    >
      <style>{`
        @keyframes oea-bounce {
          0%,100% { transform: translateY(0) scaleY(1) scaleX(1); }
          12%     { transform: translateY(0) scaleY(.88) scaleX(1.08); }
          45%     { transform: translateY(-24%) scaleY(1.06) scaleX(.96); }
          78%     { transform: translateY(0) scaleY(.9) scaleX(1.06); }
        }
        @keyframes oea-shadow {
          0%,100% { transform: translateX(-50%) scaleX(1); opacity: .28; }
          45%     { transform: translateX(-50%) scaleX(.6); opacity: .1; }
        }
        @keyframes oea-dots { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .oea-pin, .oea-shadow, .oea-dot { animation: none !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: Math.round(size * 1.6),
            height: Math.round(size * 1.75),
          }}
        >
          <div
            className="oea-shadow"
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              width: Math.round(size * 0.68),
              height: Math.max(6, Math.round(size * 0.085)),
              transform: "translateX(-50%)",
              borderRadius: "50%",
              background: "#28405a",
              opacity: 0.28,
              animation: `oea-shadow ${dur} cubic-bezier(.45,0,.55,1) infinite`,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- animación CSS sobre <img>, next/image no expone transformOrigin/keyframes por elemento */}
          <img
            className="oea-pin"
            src={src}
            alt=""
            style={{
              position: "relative",
              bottom: Math.round(size * 0.06),
              width: size,
              height: "auto",
              transformOrigin: "center bottom",
              animation: `oea-bounce ${dur} cubic-bezier(.45,0,.55,1) infinite`,
            }}
          />
        </div>

        {showLabel && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: '"Barlow Condensed", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: labelColor,
              }}
            >
              {label}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[0, 0.4, 0.8].map((d) => (
                <i
                  key={d}
                  className="oea-dot"
                  style={{
                    width: 4,
                    height: 4,
                    background: labelColor,
                    animation: `oea-dots 1.2s steps(1,end) ${d}s infinite`,
                  }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
