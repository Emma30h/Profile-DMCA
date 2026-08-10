"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";

interface Props {
  onCapturar: (file: File) => void;
  onCerrar: () => void;
}

// getUserMedia falla por motivos bien distintos (permiso denegado, sin
// cámara, cámara ocupada por otra app) — el mensaje genérico no ayudaba a
// saber cuál pasó. DOMException.name es lo único estandarizado para
// distinguirlos entre navegadores.
function mensajeErrorCamara(err: unknown): string {
  const name = err instanceof DOMException ? err.name : null;
  switch (name) {
    case "NotAllowedError":
      return "El navegador bloqueó el acceso a la cámara. Revisá el ícono de cámara en la barra de direcciones y permitilo para este sitio.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No se detectó ninguna cámara en este dispositivo. Usá \"Seleccionar foto\" en su lugar.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación (Zoom, Teams, otra pestaña, etc.). Cerrala e intentá de nuevo, o usá \"Seleccionar foto\".";
    default:
      return "No pudimos acceder a la cámara. Revisá los permisos del navegador o usá \"Seleccionar foto\".";
  }
}

export default function CapturarFotoModal({ onCapturar, onCerrar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setListo(true);
      } catch (err) {
        if (cancelado) return;
        setError(mensajeErrorCamara(err));
      }
    }

    iniciar();
    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function cerrar() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCerrar();
  }

  // Escape para cerrar, igual que el resto de los paneles/overlays de la app.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // La vista previa está espejada (como un espejo real, para que se
    // sienta natural al encuadrarse) — sin esto, la foto capturada
    // saldría invertida respecto de lo que la persona ve en pantalla.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapturar(new File([blob], `foto-legajo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={cerrar} />

      <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">Tomar foto</h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cancelar"
            title="Cancelar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-700">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-400">
              {error}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover [transform:scaleX(-1)]"
              />
              {!listo && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  Iniciando cámara…
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={capturar}
            disabled={!listo}
            aria-label="Capturar foto"
            title="Capturar foto"
            className="group flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:border-blue-500"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 group-hover:bg-blue-500 group-disabled:bg-slate-700 transition-colors">
              <Camera className="w-5 h-5 text-white" strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
