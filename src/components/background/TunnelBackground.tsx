'use client';

/**
 * <TunnelBackground /> — fondo animado para la pantalla de login/signup.
 *
 * Monta el motor de canvas y lo desmonta solo. Renderiza el canvas más el
 * velo (scrim) que baja el contraste del centro para que el panel del
 * formulario se lea sin tocar el motor.
 *
 * Uso mínimo:
 *   <div className="relative min-h-screen overflow-hidden bg-[#0e1522]">
 *     <TunnelBackground />
 *     <div className="relative">…contenido…</div>
 *   </div>
 */

import { useEffect, useRef } from 'react';
import { createTunnelBackground } from './tunnel-background';

export type TunnelPalette = 'blue' | 'blueOrange' | 'blueCyan';

export interface TunnelBackgroundProps {
  /** Cantidad de objetos en escena. 0.15 – 1.6. Por defecto 0.5 */
  density?: number;
  /** Velocidad de avance. 0.1 – 2. Por defecto 0.75 */
  speed?: number;
  /** Halo de los objetos brillantes. 0 – 1.6. Por defecto 0.7 */
  glow?: number;
  /** Paleta. 'blue' es la institucional. Por defecto 'blue' */
  palette?: TunnelPalette;
  /** Tope de cuadros por segundo. Por defecto 33 */
  fps?: number;
  /** Dibuja el velo radial encima del canvas. Por defecto true */
  scrim?: boolean;
  className?: string;
}

export default function TunnelBackground({
  density = 0.5,
  speed = 0.75,
  glow = 0.7,
  palette = 'blue',
  fps = 33,
  scrim = true,
  className = ''
}: TunnelBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createTunnelBackground> | null>(null);

  // se crea una sola vez: recrear el motor en cada cambio de prop reiniciaría la escena
  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = createTunnelBackground(canvasRef.current, { density, speed, glow, palette, fps });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // los cambios de prop se aplican en caliente
  useEffect(() => {
    engineRef.current?.setOptions({ density, speed, glow, palette, fps });
  }, [density, speed, glow, palette, fps]);

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      {scrim && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 80% at 50% 45%, rgba(14,21,34,0.62) 0%, rgba(14,21,34,0.86) 62%, rgba(11,17,28,0.95) 100%)'
          }}
        />
      )}
    </div>
  );
}
