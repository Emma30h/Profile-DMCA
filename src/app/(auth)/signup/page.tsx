import Image from "next/image";
import { prisma } from "@/lib/prisma";
import SignupForm from "./SignupForm";

export default async function SignupPage() {
  const rangos = await prisma.rango.findMany({
    select: { nombre: true, cuerpo: true },
    orderBy: { orden: "asc" },
  });

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
        <h1 className="text-2xl font-bold text-slate-100">Crear cuenta</h1>
        <p className="text-sm text-slate-400 mt-1">
          Dirección Monitoreo Cordobeses en Alerta
        </p>
        <p className="text-xs text-slate-500 mt-1">Sistema de Gestión de Personal</p>
      </div>

      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-8">
        <SignupForm rangos={rangos} />
      </div>
    </div>
  );
}
