"use client";

import { useEffect, useState } from "react";

interface Props {
  src: string;
  label: string;
  onCerrar: () => void;
}

export default function PreviewFoto({ src, label, onCerrar }: Props) {
  // AgenteAvatar ya sabe recuperarse de un link roto (foto vieja de imgbox
  // que dejó de resolver, o dato corrupto de la carga masiva original) y
  // cae al ícono genérico — acá, en cambio, no había ningún resguardo: un
  // <img> con src inválido rompía el modal mostrando el ícono nativo de
  // imagen rota más el alt a tamaño completo.
  const [error, setError] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onCerrar} />
      <div className="relative max-w-lg w-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--c-text-secondary)]">{label}</span>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            title="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--c-bg-elev)]/80 text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error ? (
          <div className="w-full h-64 rounded-xl border border-[var(--c-line)] bg-[var(--c-bg)] flex flex-col items-center justify-center gap-2 text-[var(--c-text-faint)]">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p className="text-sm">No se pudo cargar la foto</p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            onError={() => setError(true)}
            className="w-full max-h-[75vh] rounded-xl border border-[var(--c-line)] object-contain bg-[var(--c-bg)]"
          />
        )}
      </div>
    </div>
  );
}
