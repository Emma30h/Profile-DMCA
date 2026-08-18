"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const CARACTERISTICAS = [
  "Legajos digitales con trazabilidad completa del personal",
  "Gestión de licencias, turnos y guardias",
  "Alertas y novedades administrativas en tiempo real",
];

// Panel de marca compartido por /login y /signup (desktop only — en mobile
// cada página muestra su propio encabezado). Idéntico en ambas pantallas,
// por eso vive acá en vez de duplicarse.
export default function AuthBrandPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 p-10 relative overflow-hidden">
      <div className="auth-radar-sweep" />
      <AuthRadarBlips />

      <Image
        src="/logo-ojos-en-alerta-blanco.png"
        alt=""
        width={220}
        height={220}
        className="absolute -right-10 -bottom-10 opacity-[0.08] select-none pointer-events-none"
      />

      <div className="relative">
        <div className="relative inline-flex items-center justify-center w-14 h-14 mb-6">
          <span className="auth-sonar-ping absolute inset-0 rounded-full bg-blue-300/50" aria-hidden="true" />
          <span className="auth-sonar-ping auth-sonar-ping-delay absolute inset-0 rounded-full bg-blue-300/50" aria-hidden="true" />
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 ring-1 ring-white/20">
            <Image
              src="/logo-ojos-en-alerta-blanco.png"
              alt="Ojos en Alerta"
              width={34}
              height={34}
              className="object-contain"
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white leading-tight">Policía de Córdoba</h1>
        <p className="text-sm text-blue-200 mt-2">Dirección Monitoreo Cordobeses en Alerta</p>
      </div>

      <ul className="relative space-y-3 my-10">
        {CARACTERISTICAS.map((c, i) => (
          <li
            key={c}
            className="auth-item-in flex items-start gap-2.5 text-sm text-blue-100/90"
            style={{ animationDelay: `${0.2 + i * 0.12}s` }}
          >
            <CheckIcon />
            <span>{c}</span>
          </li>
        ))}
      </ul>

      <p className="relative text-xs text-blue-300/60">Sistema de Gestión de Personal</p>
    </div>
  );
}

// Debe coincidir con la duración de auth-radar-sweep en globals.css: es el
// período que se usa para saber en qué ángulo está el barrido en cada
// instante.
const DURACION_BARRIDO_S = 10;

interface RadarBlip {
  id: number;
  top: string;
  left: string;
}

// Genera contactos de radar al azar (posición e intervalo entre uno y el
// siguiente), pero siempre sobre el ángulo por el que va pasando el barrido
// en ese momento — con un poco de jitter angular y un radio aleatorio desde
// el centro del panel — para que parezca que el radar "detecta" algo real
// en vez de tildes fijos que se repiten idénticos en cada vuelta.
function AuthRadarBlips() {
  const [blips, setBlips] = useState<RadarBlip[]>([]);
  const inicioRef = useRef<number | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    inicioRef.current = Date.now();

    let timeoutId: ReturnType<typeof setTimeout>;

    function programarSiguiente(delayMs: number) {
      timeoutId = setTimeout(spawn, delayMs);
    }

    function spawn() {
      const segundos = (Date.now() - (inicioRef.current ?? Date.now())) / 1000;
      const anguloBarrido = ((segundos % DURACION_BARRIDO_S) / DURACION_BARRIDO_S) * 360;
      const jitter = (Math.random() - 0.5) * 26; // ±13° respecto al barrido
      const angulo = ((anguloBarrido + jitter) % 360 + 360) % 360;
      const radio = 12 + Math.random() * 32; // 12%–44% desde el centro del panel
      const rad = (angulo * Math.PI) / 180;
      const left = 50 + radio * Math.sin(rad);
      const top = 50 - radio * Math.cos(rad);

      idRef.current += 1;
      const id = idRef.current;
      setBlips((prev) => [...prev, { id, top: `${top}%`, left: `${left}%` }]);
      setTimeout(() => setBlips((prev) => prev.filter((b) => b.id !== id)), 3600);

      programarSiguiente(6000 + Math.random() * 6000);
    }

    programarSiguiente(600);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      {blips.map((b) => (
        <span
          key={b.id}
          className="auth-radar-blip-pop absolute h-1.5 w-1.5 rounded-full bg-cyan-300"
          style={{ top: b.top, left: b.left }}
          aria-hidden="true"
        />
      ))}
    </>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
