import Image from "next/image";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="auth-card-in w-full max-w-md lg:max-w-4xl">
      {/* Marca: en mobile va arriba de la tarjeta (como siempre); en desktop
          se muda al panel izquierdo, así que acá solo se ve por debajo de lg. */}
      <div className="text-center mb-8 lg:hidden">
        <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
          <span className="auth-sonar-ping absolute inset-0 rounded-full bg-blue-300/50" aria-hidden="true" />
          <span className="auth-sonar-ping auth-sonar-ping-delay absolute inset-0 rounded-full bg-blue-300/50" aria-hidden="true" />
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-700">
            <Image
              src="/logo-ojos-en-alerta-blanco.png"
              alt="Ojos en Alerta"
              width={52}
              height={52}
              className="object-contain"
            />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Policía de Córdoba</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dirección Monitoreo Cordobeses en Alerta
        </p>
        <p className="text-xs text-slate-500 mt-1">Sistema de Gestión de Personal</p>
      </div>

      <div className="lg:grid lg:grid-cols-[1.05fr_1fr] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-slate-700 lg:shadow-2xl lg:shadow-black/40">
        <AuthBrandPanel />

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
