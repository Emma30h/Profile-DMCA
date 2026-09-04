import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-dvh flex [align-items:safe_center] justify-center overflow-y-auto bg-slate-800 py-4 px-4 sm:px-6 sm:py-8 lg:px-8 lg:py-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* blob-a: en mobile se centra detrás del logo (más chico y más
            cerca) porque ahí es donde está la atención; en desktop vuelve a
            su posición original en la esquina, detrás del panel de marca. */}
        <div className="aurora-blob aurora-blob-a top-[-8rem] left-[calc(50%-13rem)] h-[26rem] w-[26rem] bg-blue-600 lg:top-[-10rem] lg:left-[-8rem] lg:h-[32rem] lg:w-[32rem]" />
        <div className="aurora-blob aurora-blob-b top-1/3 -right-40 h-[36rem] w-[36rem] bg-indigo-500" />
        <div className="aurora-blob aurora-blob-c -bottom-48 left-1/4 h-[30rem] w-[30rem] bg-blue-900" />
      </div>
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
      {children}
    </div>
  );
}
