"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Reveal en scroll de la landing (fade + translateY con delay escalonado),
// un hook por elemento en vez del "barrido sincrónico" global que usaba el
// prototipo original (ver README del handoff: el propio autor marca ese
// barrido como un parche a un bug del IntersectionObserver del runtime del
// prototipo, y sugiere resolverlo "en React idiomático... con un hook por
// elemento" — esto es exactamente eso).
export function useRevealOnScroll<T extends HTMLElement>(delaySeconds = 0) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    if (visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // requestAnimationFrame en vez de setState directo: llamarlo síncrono
      // acá dispara el lint set-state-in-effect (cascading renders) — mismo
      // criterio que useCountUp.ts.
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -18% 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : "translate3d(0, 38px, 0)",
    transition: `opacity .75s cubic-bezier(.22,.61,.36,1) ${delaySeconds}s, transform .7s cubic-bezier(.22,.61,.36,1) ${delaySeconds}s`,
  };

  return { ref, style };
}
