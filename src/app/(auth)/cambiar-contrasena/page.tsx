import CambiarContrasenaForm from "./CambiarContrasenaForm";

export default function CambiarContrasenaPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-700 text-white text-2xl mb-4">
          🔒
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Cambiar contraseña</h1>
        <p className="text-sm text-slate-400 mt-1">
          Te enviaremos un código a tu correo para confirmar el cambio
        </p>
      </div>
      <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-8">
        <CambiarContrasenaForm />
      </div>
    </div>
  );
}
