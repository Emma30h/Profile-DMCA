// Cubo de datos 3D decorativo del hero: flotación vertical + cabeceo + giro
// continuo (tres animaciones anidadas, puro CSS), 6 caras blueprint
// transparentes y 7 nodos en distintas profundidades con pulso de opacidad.
// aria-hidden — puramente ambiental. data-industry-anim en los 3 niveles de
// transform para que prefers-reduced-motion los inmovilice (.dmca-face/
// .dmca-node ya están cubiertos por esa misma regla en globals.css).
//
// Las posiciones de nodos/caras están calibradas para un cubo de 210px (el
// tamaño original del handoff) — con otro `size` se escalan todas por el
// mismo factor para no perder las proporciones relativas entre nodos.
const NODOS_BASE: { x: number; y: number; z: number; delay: number }[] = [
  { x: -52, y: -46, z: 58, delay: 0 },
  { x: 44, y: -62, z: -30, delay: 0.5 },
  { x: -30, y: 55, z: -64, delay: 1 },
  { x: 62, y: 34, z: 40, delay: 1.5 },
  { x: 0, y: 0, z: 0, delay: 2 },
  { x: -66, y: 10, z: -14, delay: 2.5 },
  { x: 20, y: -20, z: 80, delay: 3 },
];
const TAMAÑO_BASE = 210;

export default function RotatingCube({ size = 150 }: { size?: number }) {
  const factor = size / TAMAÑO_BASE;
  const mitad = size / 2;
  const caras = [
    `translateZ(${mitad}px)`,
    `rotateY(180deg) translateZ(${mitad}px)`,
    `rotateY(90deg) translateZ(${mitad}px)`,
    `rotateY(-90deg) translateZ(${mitad}px)`,
    `rotateX(90deg) translateZ(${mitad}px)`,
    `rotateX(-90deg) translateZ(${mitad}px)`,
  ];

  return (
    // position+zIndex: el cabeceo (dmcaPitch) y la flotación (dmcaFloat) hacen
    // que el cubo pinte fuera de su propia caja sin cambiar el layout (los
    // transforms no afectan el alto reservado) — sin esto, el panel del
    // padrón que viene después en el DOM lo tapaba al solaparse.
    <div
      aria-hidden="true"
      style={{ position: "relative", zIndex: 1, height: Math.round(size * 1.15), display: "grid", placeItems: "center", perspective: 1000 }}
    >
      <div data-industry-anim style={{ animation: "dmcaFloat 7s ease-in-out infinite" }}>
        <div data-industry-anim style={{ transformStyle: "preserve-3d", animation: "dmcaPitch 16s ease-in-out infinite" }}>
          <div
            data-industry-anim
            style={{
              position: "relative",
              width: size,
              height: size,
              transformStyle: "preserve-3d",
              animation: "dmcaYaw 22s linear infinite",
            }}
          >
            {caras.map((transform) => (
              <div key={transform} className="dmca-face" style={{ transform }} />
            ))}
            <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
              {NODOS_BASE.map((n, i) => (
                <span
                  key={i}
                  className="dmca-node"
                  style={{
                    transform: `translate3d(${n.x * factor}px, ${n.y * factor}px, ${n.z * factor}px)`,
                    animationDelay: `${n.delay}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
