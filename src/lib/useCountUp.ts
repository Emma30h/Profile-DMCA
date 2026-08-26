"use client";

import { useEffect, useState } from "react";

// Cuenta de 0 al valor real con un delay opcional (para escalonar varios
// contadores en la misma pantalla) — mismo hook que usa el panel
// institucional de /login.
export function useCountUp(target: number, delayMs = 0, durationMs = 1600) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // requestAnimationFrame en vez de setState directo: llamarlo síncrono
      // acá dispara el lint set-state-in-effect (cascading renders).
      const raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    let raf: number;
    const timeout = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / durationMs, 1);
        // Exponencial: arranca rápido y se va frenando de forma marcada
        // a medida que se acerca al valor real, en vez de una desaceleración
        // pareja (cúbica) apenas perceptible.
        const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setValue(Math.round(eased * target));
        if (t < 1) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, durationMs]);

  return value;
}
