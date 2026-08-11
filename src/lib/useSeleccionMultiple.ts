"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "personal-seleccion-multiple";
const EVENTO_CAMBIO = "personal-seleccion-multiple-cambio";

export interface AgenteSeleccionado {
  id: string;
  nombres: string;
  apellidos: string;
}

function leerSeleccion(): AgenteSeleccionado[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardar(seleccion: AgenteSeleccionado[]) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seleccion));
  window.dispatchEvent(new Event(EVENTO_CAMBIO));
}

// "Lista de trabajo" temporal de agentes marcados en el buscador de
// /personal, para tenerlos a mano mientras se navega entre legajos — no es
// un dato de negocio, así que vive en sessionStorage (sobrevive mientras se
// trabaja, se resetea al cerrar la pestaña) en vez de la base de datos o la
// URL. Mismo patrón de evento propio que useAgenteAnclado, para que todos
// los componentes que usan este hook en la misma pestaña queden en sync.
export function useSeleccionMultiple() {
  const [seleccion, setSeleccion] = useState<AgenteSeleccionado[]>([]);

  useEffect(() => {
    const actualizar = () => setSeleccion(leerSeleccion());
    actualizar();
    window.addEventListener(EVENTO_CAMBIO, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO_CAMBIO, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  const toggle = useCallback((agente: AgenteSeleccionado) => {
    const actual = leerSeleccion();
    const nueva = actual.some((a) => a.id === agente.id)
      ? actual.filter((a) => a.id !== agente.id)
      : [...actual, agente];
    guardar(nueva);
  }, []);

  const limpiar = useCallback(() => {
    guardar([]);
  }, []);

  return { seleccion, toggle, limpiar };
}
