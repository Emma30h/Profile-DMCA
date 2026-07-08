"use client";

import { useEffect } from "react";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

// Ver el legajo de un agente distinto al anclado invalida ese anclaje previo
// (para no dejar el acceso rápido apuntando a alguien que ya no se está
// viendo). Nunca ancla al agente que se está viendo: fijar sigue siendo una
// acción manual e independiente del usuario (botón de pin).
export default function InvalidarAnclajeAnterior({ id }: { id: string }) {
  const { anclado, desanclar } = useAgenteAnclado();

  useEffect(() => {
    if (anclado && anclado.id !== id) {
      desanclar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return null;
}
