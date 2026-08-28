"use client";

import { useEffect, useState } from "react";

// Reactiva la transición CSS que ya dispara la animación de "entrada" de un
// gráfico (crecer desde 0) cada vez que cambia `dep`, no solo la primera vez
// que el componente entra en pantalla. Sin esto, cambiar de período/rango/
// granularidad hace que barras y líneas salten directo al valor nuevo, ya
// que React solo re-renderiza con el valor final y la transición de "listo"
// ya se disparó una única vez al montar.
//
// Colapsa a 0 y vuelve a crecer con la MISMA transición que cada gráfico ya
// declara para su barra/línea — no agrega ninguna animación nueva. El doble
// requestAnimationFrame es necesario porque un solo rAF puede coalescerse
// con el mismo frame que pintó el estado colapsado, y la transición nunca
// llega a verse (el navegador nunca pinta el paso intermedio en 0).
export function useReplayOnChange(dep: unknown): boolean {
  const [listo, setListo] = useState(true);

  useEffect(() => {
    let raf2 = 0;
    // El primer setState también va dentro de un rAF (no sincrónico en el
    // cuerpo del efecto): mismo motivo que el tween de los radares — evita
    // el error de lint set-state-in-effect, y de paso es lo que garantiza
    // que el navegador llegue a pintar el paso colapsado antes de crecer.
    const raf1 = requestAnimationFrame(() => {
      setListo(false);
      raf2 = requestAnimationFrame(() => setListo(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [dep]);

  return listo;
}
