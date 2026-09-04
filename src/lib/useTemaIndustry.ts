"use client";

const CLAVE = "dmca-tema";

// Tema de la landing pública y de Acceso — independiente del toggle
// data-theme/"tema" del dashboard (ver globals.css): atributo (data-tema) y
// clave de localStorage ("dmca-tema") propios, para no interferir con ese
// sistema ni depender de él.
//
// A propósito NO guarda el tema actual en un useState: el valor real ya lo
// aplicó el <Script beforeInteractive> de layout.tsx antes del primer paint,
// así que leerlo de nuevo en un efecto solo para decidir qué ícono mostrar
// reintroduciría el flash de hidratación que ese script ya evita. En vez de
// eso, qué ícono se ve lo decide CSS puro (.t-icon-oscuro/.t-icon-claro en
// globals.css, gateado por [data-tema="claro"]) — mismo patrón que
// .icon-tema-oscuro/.icon-tema-claro del toggle del dashboard.
export function useTemaIndustry() {
  function alternar() {
    const actual = document.documentElement.getAttribute("data-tema") === "claro" ? "claro" : "oscuro";
    const siguiente = actual === "claro" ? "oscuro" : "claro";
    document.documentElement.setAttribute("data-tema", siguiente);
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // localStorage puede no estar disponible (modo privado estricto) — el
      // toggle sigue funcionando en memoria para la sesión actual.
    }
  }

  return { alternar };
}
