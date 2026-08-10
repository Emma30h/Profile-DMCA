"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import PreviewFoto from "@/components/PreviewFoto";

interface Props {
  fotoUrl: string | null;
  nombreCompleto: string;
  children: React.ReactNode;
}

/** Envuelve un avatar para que al hacer click se abra la foto en grande, sin
 *  interferir con botones hermanos posicionados encima (ej. el lápiz de
 *  editar foto), ya que estos quedan fuera de este wrapper. */
export default function VerFotoTrigger({ fotoUrl, nombreCompleto, children }: Props) {
  const [previewAbierto, setPreviewAbierto] = useState(false);

  if (!fotoUrl) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewAbierto(true)}
        title="Ver foto"
        className="block rounded-xl cursor-pointer"
      >
        {children}
      </button>

      {previewAbierto && createPortal(
        <PreviewFoto src={fotoUrl} label={nombreCompleto} onCerrar={() => setPreviewAbierto(false)} />,
        document.body
      )}
    </>
  );
}
