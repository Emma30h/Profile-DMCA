"use client";

import { useEffect, useRef, useState } from "react";

// Cuenta desde el valor actual (0 la primera vez que aparece, ya que arranca
// en 0) hacia el valor real, con un delay opcional (para escalonar varios
// contadores en la misma pantalla) — mismo hook que usa el panel
// institucional de /login.
//
// Si `target` cambia después del montaje (ej. el usuario cambia de período
// en un filtro), arranca desde el valor ya mostrado en pantalla en vez de
// reiniciar a 0: sube o baja hasta el nuevo valor, nunca "parpadea" a cero
// en el medio.
export function useCountUp(target: number, delayMs = 0, durationMs = 1600) {
  const [value, setValue] = useState(0);
  // Espejo del estado en un ref (sincronizado en un efecto, nunca durante el
  // render): el efecto de abajo lo lee para saber desde dónde arrancar sin
  // tener que declarar `value` en sus dependencias (eso reiniciaría el
  // efecto en cada uno de los frames que la propia animación genera).
  const valorActualRef = useRef(value);
  useEffect(() => {
    valorActualRef.current = value;
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // requestAnimationFrame en vez de setState directo: llamarlo síncrono
      // acá dispara el lint set-state-in-effect (cascading renders).
      const raf = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(raf);
    }
    const inicio = valorActualRef.current;
    if (inicio === target) return;
    let raf: number;
    const timeout = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min((now - start) / durationMs, 1);
        // Exponencial: arranca rápido y se va frenando de forma marcada
        // a medida que se acerca al valor real, en vez de una desaceleración
        // pareja (cúbica) apenas perceptible.
        const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setValue(Math.round(inicio + (target - inicio) * eased));
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
