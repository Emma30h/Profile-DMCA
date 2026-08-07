import Image from "next/image";
import LoginForm from "./LoginForm";

const CARACTERISTICAS = [
  "Legajos digitales con trazabilidad completa del personal",
  "Gestión de licencias, turnos y guardias",
  "Alertas y novedades administrativas en tiempo real",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="w-full max-w-md lg:max-w-4xl">
      {/* Marca: en mobile va arriba de la tarjeta (como siempre); en desktop
          se muda al panel izquierdo, así que acá solo se ve por debajo de lg. */}
      <div className="text-center mb-8 lg:hidden">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-700 mb-4">
          <Image
            src="/logo-ojos-en-alerta-blanco.png"
            alt="Ojos en Alerta"
            width={52}
            height={52}
            className="object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Policía de Córdoba</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dirección Monitoreo Cordobeses en Alerta
        </p>
        <p className="text-xs text-slate-500 mt-1">Sistema de Gestión de Personal</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1.05fr_1fr] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-slate-700 lg:shadow-2xl lg:shadow-black/40">
        {/* Panel de marca — solo desktop */}
        <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 p-10 relative overflow-hidden">
          <Image
            src="/logo-ojos-en-alerta-blanco.png"
            alt=""
            width={220}
            height={220}
            className="absolute -right-10 -bottom-10 opacity-[0.08] select-none pointer-events-none"
          />

          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 ring-1 ring-white/20 mb-6">
              <Image
                src="/logo-ojos-en-alerta-blanco.png"
                alt="Ojos en Alerta"
                width={34}
                height={34}
                className="object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-white leading-tight">Policía de Córdoba</h1>
            <p className="text-sm text-blue-200 mt-2">Dirección Monitoreo Cordobeses en Alerta</p>
          </div>

          <ul className="relative space-y-3 my-10">
            {CARACTERISTICAS.map((c) => (
              <li key={c} className="flex items-start gap-2.5 text-sm text-blue-100/90">
                <CheckIcon />
                <span>{c}</span>
              </li>
            ))}
          </ul>

          <p className="relative text-xs text-blue-300/60">Sistema de Gestión de Personal</p>
        </div>

        {/* Panel del formulario */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-sm p-8 lg:rounded-none lg:border-0 lg:shadow-none lg:p-10 flex flex-col justify-center">
          <h2 className="hidden lg:block text-xl font-semibold text-slate-100 mb-6">Iniciar sesión</h2>

          {error === "cuenta_deshabilitada" && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
              Tu cuenta fue deshabilitada. Contactá a un administrador.
            </div>
          )}

          <LoginForm />
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
