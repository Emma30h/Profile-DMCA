"use client";

import { useEffect, useState } from "react";

// Gate booleano para animaciones de entrada por CSS (barras que crecen,
// arcos que se completan): arranca en `false` (el estado inicial que deben
// pintar los consumidores, ej. width/strokeDasharray en 0) y pasa a `true`
// recién después de montar, para que el navegador llegue a pintar ese
// estado inicial y la transición se dispare de verdad — si arrancara en
// `true` directo, no habría cambio de estado que animar. Con
// prefers-reduced-motion no hay estado intermedio: pasa a `true` en el
// primer frame posible. Mismo criterio que useCountUp.ts (que anima los
// números; este hook anima la geometría).
export function useEntrada(delayMs = 0): boolean {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setListo(true));
      return () => cancelAnimationFrame(raf);
    }
    let raf: number;
    const timeout = setTimeout(() => {
      raf = requestAnimationFrame(() => setListo(true));
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [delayMs]);

  return listo;
}
