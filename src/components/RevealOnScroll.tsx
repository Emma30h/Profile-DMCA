"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Difiere el montaje de contenido pesado (gráficos con useMemo caro, listas
// con fotos) hasta que está por entrar en pantalla, en vez de montar las 4
// tarjetas del dashboard todas juntas al cargar la página — evita el pico
// de cálculo + descargas de imagen simultáneas que causaba baches al hacer
// scroll. rootMargin dispara el montaje un poco antes de que sea visible,
// para que el fade ya haya terminado cuando el ojo llega. minHeight reserva
// el alto aproximado de la tarjeta real para que el salto al aparecer sea
// mínimo (no es necesario que sea exacto).
export default function RevealOnScroll({
  children,
  minHeight,
  className,
}: {
  children: ReactNode;
  minHeight: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className} style={visible ? undefined : { minHeight }}>
      {visible && <div className="reveal-fade-in">{children}</div>}
    </div>
  );
}
