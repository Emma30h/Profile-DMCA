"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { vincularPorCuil } from "@/app/actions/legajo";

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const resultado = await vincularPorCuil(cuil);
        if (resultado.vinculado) {
          router.refresh();
          return;
        }
        setIntentosRestantes(resultado.intentosRestantes);
        setError(
          resultado.intentosRestantes > 0
            ? `No encontramos un legajo con ese CUIL. Te quedan ${resultado.intentosRestantes} intento${resultado.intentosRestantes === 1 ? "" : "s"}.`
            : "No encontramos un legajo con ese CUIL. Se agotaron los intentos."
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ocurrió un error al vincular el legajo.");
      }
    });
  }

  if (intentosRestantes <= 0) {
    return (
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
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
          className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={pending || cuil.length !== 11}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
      >
        {pending ? "Buscando…" : "Buscar mi legajo"}
      </button>
      <p className="text-xs text-slate-500">
        Intentos restantes: {intentosRestantes}
      </p>
    </form>
  );
}
