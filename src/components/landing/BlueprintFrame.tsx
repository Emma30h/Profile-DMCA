import { forwardRef, type CSSProperties, type ReactNode } from "react";

// Marco "blueprint" del sistema Industry: caja transparente hairline con 4
// marcas de registro "+" en las esquinas (.blueprint/.corner en globals.css,
// tal como los define styles.css del handoff). Se usa para toda tarjeta,
// figura o panel del diseño de landing/Acceso — nunca un fondo sólido ni
// esquinas redondeadas, ver readme-industry.md ("Do/Don't"). forwardRef para
// que useRevealOnScroll pueda observar el nodo real directamente (sin un div
// intermedio solo para tener dónde enganchar el ref).
const BlueprintFrame = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string; style?: CSSProperties }
>(function BlueprintFrame({ children, className, style }, ref) {
  return (
    <div ref={ref} className={`blueprint ${className ?? ""}`} style={style}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {children}
    </div>
  );
});

export default BlueprintFrame;
