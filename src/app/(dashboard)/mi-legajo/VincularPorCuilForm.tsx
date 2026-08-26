"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vincularPorCuil } from "@/app/actions/legajo";

// Recién a partir de acá se muestra el texto "Buscando..." con los puntos
// animados — antes de eso alcanza con el spinner (ver AuthScreen.tsx).
const MS_ANTES_DE_AVISAR_DEMORA = 15000;

export default function VincularPorCuilForm({
  intentosRestantesInicial,
}: {
  intentosRestantesInicial: number;
}) {
  const router = useRouter();
  const [cuil, setCuil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [intentosRestantes, setIntentosRestantes] = useState(intentosRestantesInicial);
  const [pending, startTransition] = useTransition();
  const [tardando, setTardando] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setTardando(true), MS_ANTES_DE_AVISAR_DEMORA);
    return () => clearTimeout(timer);
  }, [pending]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setTardando(false);
    startTransition(async () => {
      const resultado = await vincularPorCuil(cuil);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      if (resultado.pendiente) {
        router.refresh();
        return;
      }
      setIntentosRestantes(resultado.intentosRestantes);
      setError(
        resultado.intentosRestantes > 0
          ? `No encontramos un legajo con ese CUIL. Te quedan ${resultado.intentosRestantes} intento${resultado.intentosRestantes === 1 ? "" : "s"}.`
          : "No encontramos un legajo con ese CUIL. Se agotaron los intentos."
      );
    });
  }

  if (intentosRestantes <= 0) {
    return (
      <p className="text-sm text-[var(--c-text-muted)] max-w-sm mx-auto">
        Se agotaron los intentos para vincular por CUIL. Cargá tus datos manualmente más abajo.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-xs mx-auto">
      <div>
        <label htmlFor="cuil-vinculo" className="sr-only">
          CUIL
        </label>
        <input
          id="cuil-vinculo"
          type="text"
          inputMode="numeric"
          maxLength={11}
          value={cuil}
          onChange={(e) => setCuil(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="CUIL sin puntos ni guiones"
          className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2.5 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] text-center focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent transition"
        />
      </div>
      {error && <p className="text-xs text-[var(--c-coral)]">{error}</p>}
      <button
        type="submit"
        disabled={pending || cuil.length !== 11}
        className="w-full rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <Spinner />
            {tardando ? (
              <span className="inline-flex items-center">
                Buscando
                <span className="loading-dots inline-flex" aria-hidden="true">
                  <span>.</span><span>.</span><span>.</span>
                </span>
              </span>
            ) : (
              "Buscando"
            )}
          </>
        ) : (
          "Buscar mi legajo"
        )}
      </button>
      <p className="text-xs text-[var(--c-text-faint)]">
        Intentos restantes: {intentosRestantes}
      </p>
    </form>
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
