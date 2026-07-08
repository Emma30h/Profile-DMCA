"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "personal-agente-anclado";
const EVENTO_CAMBIO = "personal-agente-anclado-cambio";

export interface AgenteAnclado {
  id: string;
  nombres: string;
  apellidos: string;
}

function leerAnclado(): AgenteAnclado | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Un solo agente anclado a la vez, persistido en localStorage. Un evento
// propio (además de "storage", que sólo avisa a otras pestañas) mantiene
// sincronizados a todos los componentes que usan este hook en la misma
// pestaña —p. ej. el botón de anclar en la lista y el chip del Header—
// sin necesidad de un Context que los conecte.
export function useAgenteAnclado() {
  const [anclado, setAnclado] = useState<AgenteAnclado | null>(() => leerAnclado());

  useEffect(() => {
    const actualizar = () => setAnclado(leerAnclado());
    window.addEventListener(EVENTO_CAMBIO, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO_CAMBIO, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  const anclar = useCallback((agente: AgenteAnclado) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agente));
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }, []);

  const desanclar = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }, []);

  const toggle = useCallback(
    (agente: AgenteAnclado) => {
      if (anclado?.id === agente.id) desanclar();
      else anclar(agente);
    },
    [anclado, anclar, desanclar]
  );

  return { anclado, anclar, desanclar, toggle };
}
