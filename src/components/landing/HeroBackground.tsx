// Fondo decorativo del hero: grilla técnica en loop, banda de barrido y 4
// nodos que titilan, con un velo encima para que el texto siga legible.
// aria-hidden — puramente ambiental, sin información. Las animaciones llevan
// data-industry-anim para que la regla de prefers-reduced-motion en
// globals.css las desactive.
export default function HeroBackground() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: "-80px 0", pointerEvents: "none", opacity: 0.5 }}>
      <svg
        width="100%"
        height="100%"
        data-industry-anim
        style={{ position: "absolute", inset: 0, animation: "dmcaGrid 14s linear infinite" }}
      >
        <defs>
          <pattern id="dmcaG" width={60} height={60} patternUnits="userSpaceOnUse">
            <path d="M60 0H0V60" fill="none" stroke="var(--t-grid)" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dmcaG)" />
      </svg>
      <div
        data-industry-anim
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 150,
          background: "linear-gradient(180deg, rgba(var(--t-accent-rgb),0), rgba(var(--t-accent-rgb),.10), rgba(var(--t-accent-rgb),0))",
          animation: "dmcaSweep 7s ease-in-out infinite",
        }}
      />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <g fill="var(--t-accent)">
          <circle cx="14%" cy="30%" r={3} data-industry-anim style={{ animation: "dmcaBlip 3.2s ease-in-out infinite" }} />
          <circle cx="63%" cy="18%" r={3} data-industry-anim style={{ animation: "dmcaBlip 4.1s ease-in-out .6s infinite" }} />
          <circle cx="86%" cy="62%" r={3} data-industry-anim style={{ animation: "dmcaBlip 3.6s ease-in-out 1.2s infinite" }} />
          <circle cx="38%" cy="78%" r={3} data-industry-anim style={{ animation: "dmcaBlip 4.6s ease-in-out .3s infinite" }} />
        </g>
      </svg>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, var(--t-veil-a), var(--t-veil-b))" }} />
    </div>
  );
}
