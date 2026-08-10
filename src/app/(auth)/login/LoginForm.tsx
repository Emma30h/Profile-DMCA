"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { verificarCuentaActiva } from "@/app/actions/auth";

// Recién a partir de acá se muestra el texto "Ingresando..." con los puntos
// animados — antes de eso alcanza con el spinner, mostrar texto para una
// espera normal de menos de 15s solo agrega ruido visual.
const MS_ANTES_DE_AVISAR_DEMORA = 15000;

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tardando, setTardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTardando(true), MS_ANTES_DE_AVISAR_DEMORA);
    return () => clearTimeout(timer);
  }, [loading]);

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setTardando(false);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(mapAuthError(authError.message));
      setLoading(false);
      return;
    }

    const activa = await verificarCuentaActiva();
    if (!activa) {
      setError("Tu cuenta fue deshabilitada. Contactá a un administrador.");
      setLoading(false);
      return;
    }

    // Navegación completa (no router.push + router.refresh): esa combinación
    // justo después de esperar una Server Action a veces quedaba en un estado
    // intermedio del router y el usuario tenía que refrescar a mano para
    // entrar. Una recarga real no depende de esa mecánica — siempre entra.
    window.location.href = "/dashboard";
  }

  return (
    <div className="space-y-5">
      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Formulario email + contraseña */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@ejemplo.com"
            className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <a
            href="/cambiar-contrasena"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Spinner />
              {tardando && (
                <span className="inline-flex items-center">
                  Ingresando
                  <span className="loading-dots inline-flex" aria-hidden="true">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </span>
              )}
            </>
          ) : (
            "Ingresar"
          )}
        </button>
      </form>

      <p className="text-center text-sm text-slate-400">
        ¿No tenés cuenta?{" "}
        <a href="/signup" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Registrate
        </a>
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="spinner h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Eye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Credenciales incorrectas. Verificá tu email y contraseña.";
  if (message.includes("Email not confirmed"))
    return "Cuenta no verificada. Revisá tu correo electrónico.";
  if (message.includes("User not found"))
    return "No existe una cuenta con ese email.";
  return "Ocurrió un error al iniciar sesión. Intentá de nuevo.";
}
