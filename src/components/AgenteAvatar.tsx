"use client";

import { useState } from "react";

// Ícono genérico de persona (silueta), usado como avatar por defecto cuando
// el agente todavía no tiene foto cargada, o cuando la que tiene cargada es
// un link roto (pasa con datos de la carga masiva original vía imgbox: hay
// bastantes fotoUrl que ya no resuelven a nada). Varía de color según el
// sexo para diferenciar de un vistazo, sin depender de imágenes externas.
const ESTILO_POR_SEXO: Record<string, { bg: string; icon: string }> = {
  MASCULINO: { bg: "bg-blue-500/15", icon: "text-blue-400" },
  FEMENINO: { bg: "bg-purple-500/15", icon: "text-purple-400" },
};
const ESTILO_DEFAULT = { bg: "bg-slate-800", icon: "text-slate-500" };

export default function AgenteAvatar({
  fotoUrl,
  sexo,
  sizeClassName,
  iconSizeClassName = "h-2/3 w-2/3",
}: {
  fotoUrl: string | null;
  sexo?: string | null;
  /** Incluye tamaño y forma, ej. "h-11 w-11 rounded-full" o "w-16 h-16 rounded-xl". */
  sizeClassName: string;
  iconSizeClassName?: string;
}) {
  const [error, setError] = useState(false);

  // Si cambia la foto (ej. se acaba de subir una nueva) hay que volver a
  // intentar cargarla en vez de seguir mostrando el ícono por el error
  // anterior. Se deriva durante el render en vez de en un efecto.
  const [prevFotoUrl, setPrevFotoUrl] = useState(fotoUrl);
  if (fotoUrl !== prevFotoUrl) {
    setPrevFotoUrl(fotoUrl);
    setError(false);
  }

  if (fotoUrl && !error) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt=""
        onError={() => setError(true)}
        className={`${sizeClassName} object-cover border border-slate-700`}
      />
    );
  }

  const estilo = (sexo && ESTILO_POR_SEXO[sexo]) || ESTILO_DEFAULT;

  return (
    <div className={`${sizeClassName} border border-slate-700 flex items-center justify-center ${estilo.bg}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" className={`${iconSizeClassName} ${estilo.icon}`}>
        <path
          fillRule="evenodd"
          d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.038zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
