"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TipoPersonal } from "@/types";

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return (
    url.startsWith("https://") &&
    !url.includes("[project-ref]") &&
    key.length > 20
  );
}

interface Rango {
  nombre: string;
  cuerpo: string;
}

const CUERPOS_POR_TIPO: Record<string, string[]> = {
  SEGURIDAD: ["SUBOFICIAL", "OFICIAL"],
  TECNICO: ["TECNICO"],
};

const REQUISITOS: { label: string; test: (p: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Al menos una letra mayúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Al menos una letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Al menos un número", test: (p) => /[0-9]/.test(p) },
];

export default function SignupForm({ rangos }: { rangos: Rango[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonal | "">("");
  const [jerarquia, setJerarquia] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const cuerposValidos = tipoPersonal ? (CUERPOS_POR_TIPO[tipoPersonal] ?? []) : [];
  const rangosFiltrados = rangos.filter((r) => cuerposValidos.includes(r.cuerpo));
  const requiereJerarquia = rangosFiltrados.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Supabase no está configurado en este entorno. Completá las variables de entorno.");
      return;
    }

    const requisitosIncumplidos = REQUISITOS.filter((r) => !r.test(password));
    if (requisitosIncumplidos.length > 0) {
      setError("La contraseña no cumple con todos los requisitos.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nombre: capitalizar(nombre),
          apellido: capitalizar(apellido),
          tipoPersonal: tipoPersonal || null,
          jerarquia: jerarquia.trim() || null,
        },
      },
    });

    if (authError) {
      setError(mapError(authError.message));
      setLoading(false);
      return;
    }

    router.push(`/verificar-cuenta?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {!isSupabaseConfigured() && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-sm text-amber-400">
          Supabase no está configurado. El registro no está disponible en este entorno.
        </div>
      )}

      {/* Nombre y Apellido */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-slate-300 mb-1">
            Nombre
          </label>
          <input
            id="nombre"
            type="text"
            autoComplete="given-name"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan"
            className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
        <div>
          <label htmlFor="apellido" className="block text-sm font-medium text-slate-300 mb-1">
            Apellido
          </label>
          <input
            id="apellido"
            type="text"
            autoComplete="family-name"
            required
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            placeholder="García"
            className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Tipo de personal */}
      <div>
        <label htmlFor="tipoPersonal" className="block text-sm font-medium text-slate-300 mb-1">
          Tipo de personal
        </label>
        <select
          id="tipoPersonal"
          required
          value={tipoPersonal}
          onChange={(e) => {
            setTipoPersonal(e.target.value as TipoPersonal | "");
            setJerarquia("");
          }}
          className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-slate-900"
        >
          <option value="">Seleccioná una opción</option>
          {(Object.keys(TIPO_LABELS) as TipoPersonal[]).map((t) => (
            <option key={t} value={t}>{TIPO_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Jerarquía — solo para Seguridad y Técnico */}
      {requiereJerarquia && (
        <div>
          <label htmlFor="jerarquia" className="block text-sm font-medium text-slate-300 mb-1">
            Jerarquía
          </label>
          <select
            id="jerarquia"
            required
            value={jerarquia}
            onChange={(e) => setJerarquia(e.target.value)}
            className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-slate-900"
          >
            <option value="">Seleccioná una jerarquía</option>
            {rangosFiltrados.map((r) => (
              <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
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

      {/* Contraseña */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
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

        {/* Requisitos — aparecen al escribir, desaparecen al cumplirse */}
        {password.length > 0 && (
          <ul className="mt-2 space-y-1">
            {REQUISITOS.filter((r) => !r.test(password)).map((r) => (
              <li key={r.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmar contraseña */}
      <div>
        <label htmlFor="confirmar" className="block text-sm font-medium text-slate-300 mb-1">
          Confirmar contraseña
        </label>
        <div className="relative">
          <input
            id="confirmar"
            type={showConfirmar ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repetí la contraseña"
            className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={() => setShowConfirmar((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
            tabIndex={-1}
          >
            {showConfirmar ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !isSupabaseConfigured()}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
      >
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-slate-400">
        ¿Ya tenés cuenta?{" "}
        <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
          Iniciá sesión
        </a>
      </p>
    </form>
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

function capitalizar(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function mapError(message: string): string {
  if (message.includes("already registered") || message.includes("User already registered"))
    return "Ya existe una cuenta con ese email.";
  if (message.includes("invalid email") || message.includes("Invalid email"))
    return "El email ingresado no es válido.";
  if (message.includes("Password should be"))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (message.includes("rate limit"))
    return "Se superó el límite de emails de confirmación. Esperá unos minutos y volvé a intentar.";
  return "Ocurrió un error al crear la cuenta. Intentá de nuevo.";
}
