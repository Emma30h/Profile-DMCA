"use client";

import { useEffect } from "react";

interface Props {
  src: string;
  label: string;
  onCerrar: () => void;
}

export default function PreviewFoto({ src, label, onCerrar }: Props) {
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
          <span className="text-sm font-medium text-slate-300">{label}</span>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            title="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          className="w-full max-h-[75vh] rounded-xl border border-slate-700 object-contain bg-slate-950"
        />
      </div>
    </div>
  );
}
