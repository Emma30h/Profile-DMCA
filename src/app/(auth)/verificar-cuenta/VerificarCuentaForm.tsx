"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VerificarCuentaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerificar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: codigo.trim(),
      type: "signup",
    });

    if (authError) {
      setError("Código inválido o expirado. Solicitá uno nuevo.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleVerificar} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {email && (
        <p className="text-sm text-slate-400">
          Enviamos un código a <span className="font-medium">{email}</span>. El código vence en 15 minutos.
        </p>
      )}

      <div>
        <label htmlFor="codigo" className="block text-sm font-medium text-slate-300 mb-1">
          Código de verificación
        </label>
        <input
          id="codigo"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{8}"
          maxLength={8}
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-center tracking-widest text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>

      <button
        type="submit"
        disabled={loading || codigo.length !== 8}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
      >
        {loading ? "Verificando..." : "Verificar cuenta"}
      </button>

      <p className="text-center text-sm text-slate-400">
        <a href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
          Volver al inicio de sesión
        </a>
      </p>
    </form>
  );
}
