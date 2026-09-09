import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TunnelBackground from "@/components/background/TunnelBackground";

// Fondo animado del túnel de datos — vive acá (no en cada page) para que
// sobreviva a la navegación entre login/signup y no se reinicie al cambiar
// de pestaña. #0e1522 es el mismo token que usa TunnelBackground.tsx como
// color de fondo del contenedor: si se lo cambia, cambiar en los dos lados.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-dvh flex [align-items:safe_center] justify-center overflow-y-auto overflow-x-hidden bg-[#0e1522] py-4 px-4 sm:px-6 sm:py-8 lg:px-8 lg:py-6">
      <TunnelBackground />
      {/* Único enlace de vuelta a la landing pública desde login/signup y
          verificar-cuenta/cambiar-contrasena (comparten este layout) — sin
          esto no había forma de volver a "/" salvo el botón atrás del
          navegador. */}
      <Link
        href="/"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 inline-flex items-center gap-1.5 font-head text-xs font-semibold uppercase tracking-[0.1em] text-[#93a0b8] hover:text-[#e8edf6] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Volver
      </Link>
      {/* El wrapper "relative" es obligatorio: TunnelBackground no lleva
          z-index (queda en el layer de "position:auto"), así que sin esto
          el canvas pinta por encima del formulario aunque vaya antes en el DOM. */}
      <div className="relative">{children}</div>
    </div>
  );
}
