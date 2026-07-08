import { Suspense } from "react";
import Image from "next/image";
import VerificarCuentaForm from "./VerificarCuentaForm";

export default function VerificarCuentaPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-700 mb-4">
          <Image
            src="/logo-ojos-en-alerta-blanco.png"
            alt="Ojos en Alerta"
            width={52}
            height={52}
            className="object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Verificá tu cuenta</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dirección Monitoreo Cordobeses en Alerta
        </p>
        <p className="text-xs text-slate-500 mt-1">Ingresá el código enviado a tu correo</p>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-8">
        <Suspense fallback={<div className="text-sm text-slate-500 text-center">Cargando...</div>}>
          <VerificarCuentaForm />
        </Suspense>
      </div>
    </div>
  );
}
