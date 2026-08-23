"use client";

import { useEffect, useRef } from "react";
import { mountGloboRed, type GloboRedColors } from "@/lib/globo-red/globo-red";

// Puramente decorativo: gira solo, sin interacción. Se monta con
// next/dynamic({ ssr: false }) desde PersonalMasterShell porque WebGL no
// existe en el servidor.

// Los materiales del globo son colores fijos de three.js (no pueden leer
// las variables CSS --c-* del tema): el mismo océano oscuro que se ve bien
// sobre la tarjeta dark se ve como una mancha gris opaca sobre la tarjeta
// light, así que necesita su propia paleta por tema.
const COLORES_OSCURO: GloboRedColors = { oceano: "#16232f", tierra: "#cfdce7", red: "#2f7cf6", nodo: "#8fbcff" };
const COLORES_CLARO: GloboRedColors = { oceano: "#e7eef8", tierra: "#7a8ca6", red: "#2f7cf6", nodo: "#5b8de0", resplandor: "#a9c8f2" };

function esTemaClaro(): boolean {
  return document.documentElement.dataset.theme === "light";
}

export default function GloboDecorativo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function montar() {
      return mountGloboRed(el!, {
        background: "transparent",
        spinSpeed: 0.05,
        zoom: 1.15,
        colors: esTemaClaro() ? COLORES_CLARO : COLORES_OSCURO,
      });
    }

    let globo = montar();

    // El toggle de tema (UserMenu) cambia data-theme en <html> directamente,
    // sin pasar por React — se re-arma el globo con la paleta que corresponda
    // si el usuario lo togglea mientras esta pantalla sigue montada.
    const observer = new MutationObserver(() => {
      globo.dispose();
      el.replaceChildren();
      globo = montar();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
      globo.dispose();
    };
  }, []);

  return <div ref={ref} aria-hidden="true" className="absolute inset-0" />;
}
