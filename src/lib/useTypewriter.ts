"use client";

import { useEffect, useState } from "react";

const MS_POR_CARACTER = 62;
const MS_PARPADEO_CURSOR = 520;

// Efecto máquina de escribir del H1 del hero. El estado inicial asume "sin
// reducir" (igual que el primer render del servidor, que no conoce
// prefers-reduced-motion) y recién en el efecto — solo cliente — se decide
// si de verdad tipea o muestra el texto completo de una — mismo criterio que
// useCountUp.ts para no arriesgar un mismatch de hidratación. El llamador es
// responsable de reservar la altura final del título (min-height fijo) para
// que no haya reflow mientras tipea.
export function useTypewriter(texto: string) {
  const [tipeado, setTipeado] = useState(0);
  const [cursor, setCursor] = useState(true);
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReducido(true);
      setTipeado(texto.length);
      return;
    }
    setTipeado(0);
    setCursor(true);
    const intervaloTipeo = setInterval(() => {
      setTipeado((n) => {
        const siguiente = n + 1;
        if (siguiente >= texto.length) clearInterval(intervaloTipeo);
        return Math.min(siguiente, texto.length);
      });
    }, MS_POR_CARACTER);
    const intervaloCursor = setInterval(() => setCursor((c) => !c), MS_PARPADEO_CURSOR);
    return () => {
      clearInterval(intervaloTipeo);
      clearInterval(intervaloCursor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arranca una sola vez al montar; texto es fijo para este hero
  }, []);

  return {
    texto: texto.slice(0, tipeado),
    cursorVisible: !reducido && (tipeado < texto.length || cursor),
  };
}
