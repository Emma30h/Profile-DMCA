"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Recién a partir de acá se muestra el texto "Cargando..." con los puntos
// animados — antes de eso alcanza con el spinner (ver LoginForm.tsx).
const MS_ANTES_DE_AVISAR_DEMORA = 15000;

export default function CargarMisDatosBtn() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tardando, setTardando] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setTardando(true), MS_ANTES_DE_AVISAR_DEMORA);
    return () => clearTimeout(timer);
  }, [pending]);

  function handleClick() {
    setTardando(false);
    startTransition(() => router.push("/mi-legajo/crear"));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
    >
      {pending ? (
        <>
          <Spinner />
          {tardando ? (
            <span className="inline-flex items-center">
              Cargando
              <span className="loading-dots inline-flex" aria-hidden="true">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
          ) : (
            "Cargando"
          )}
        </>
      ) : (
        "Cargar mis datos →"
      )}
    </button>
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
