"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { actualizarFotoLegajo, eliminarFotoLegajo } from "@/app/actions/legajo";
import { solicitarCambioFoto, solicitarQuitarFoto } from "@/app/actions/solicitudesFoto";
import { subirFotoStorage } from "@/lib/fotoLegajo";
import { esDispositivoMobil } from "@/lib/device";
import CapturarFotoModal from "./CapturarFotoModal";

interface Props {
  agenteId: string;
  fotoUrlActual: string | null;
  /** Los admins cambian su propia foto al instante; el resto pasa por revisión. */
  esAdmin: boolean;
  /** Si ya hay una solicitud en curso, no se puede abrir el modal hasta que se resuelva. */
  tieneSolicitudPendiente: boolean;
}

type Rotacion = 0 | 90 | 180 | 270;

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function RotarIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

export default function FotoPerfilBtn({ agenteId, fotoUrlActual, esAdmin, tieneSolicitudPendiente }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewArchivo, setPreviewArchivo] = useState<string | null>(null);
  const [previewCargada, setPreviewCargada] = useState(false);
  const [rotacion, setRotacion] = useState<Rotacion>(0);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<"subir" | "quitar" | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRotar() {
    setRotacion((r) => ((r + 90) % 360) as Rotacion);
  }

  function limpiarPreview() {
    if (previewArchivo) URL.revokeObjectURL(previewArchivo);
    setPreviewArchivo(null);
  }

  function aplicarArchivo(file: File | null) {
    limpiarPreview();
    setPreviewCargada(false);
    setRotacion(0);
    setArchivo(file);
    setPreviewArchivo(file ? URL.createObjectURL(file) : null);
  }

  function handleArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    aplicarArchivo(e.target.files?.[0] ?? null);
  }

  function handleFotoCapturada(file: File) {
    aplicarArchivo(file);
    setCamaraAbierta(false);
  }

  // En mobile dispara el input oculto (cámara nativa del SO, vía
  // capture="user"); en desktop abre el modal con getUserMedia, porque ahí
  // el atributo capture no hace nada.
  function handleTomarFoto() {
    if (esDispositivoMobil()) {
      inputCamaraRef.current?.click();
    } else {
      setCamaraAbierta(true);
    }
  }

  function handleQuitarArchivo() {
    limpiarPreview();
    setArchivo(null);
    setRotacion(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAbrir() {
    if (tieneSolicitudPendiente) return;
    setArchivo(null);
    limpiarPreview();
    setPreviewCargada(false);
    setRotacion(0);
    setError(null);
    setEnviado(null);
    setCamaraAbierta(false);
    setAbierto(true);
  }

  function handleCerrar() {
    if (pending) return;
    setAbierto(false);
    setCamaraAbierta(false);
    limpiarPreview();
    setError(null);
    if (enviado) router.refresh();
  }

  function handleConfirmar() {
    if (!archivo) {
      setError("Elegí un archivo de imagen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (esAdmin) {
        const url = await subirFotoStorage(archivo, agenteId, rotacion);
        if (!url) {
          setError("No se pudo subir la imagen.");
          return;
        }
        const res = await actualizarFotoLegajo(agenteId, url);
        if (res.ok) {
          setAbierto(false);
          router.refresh();
        } else {
          setError(res.error);
        }
      } else {
        const path = `${agenteId}/pendiente-${Date.now()}.jpg`;
        const url = await subirFotoStorage(archivo, agenteId, rotacion, path);
        if (!url) {
          setError("No se pudo subir la imagen.");
          return;
        }
        const res = await solicitarCambioFoto(agenteId, url, path);
        if (res.ok) setEnviado("subir");
        else setError(res.error);
      }
    });
  }

  function handleQuitarFotoActual() {
    setError(null);
    startTransition(async () => {
      if (esAdmin) {
        const res = await eliminarFotoLegajo(agenteId);
        if (res.ok) {
          setAbierto(false);
          router.refresh();
        } else {
          setError(res.error);
        }
      } else {
        const res = await solicitarQuitarFoto(agenteId);
        if (res.ok) setEnviado("quitar");
        else setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        title={tieneSolicitudPendiente ? "Ya tenés una solicitud de foto en revisión" : "Cambiar mi foto"}
        disabled={tieneSolicitudPendiente}
        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-blue-600 border-2 border-slate-900 flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 disabled:cursor-not-allowed"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCerrar} />

          <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            {enviado ? (
              <div className="text-center space-y-3 py-4">
                <div className="text-4xl envelope-fly">📨</div>
                <h2 className="text-base font-semibold text-slate-100">Solicitud enviada</h2>
                <p className="text-sm text-slate-400">
                  {enviado === "subir"
                    ? "Un administrador va a revisar tu foto antes de que se publique en tu perfil y tu legajo."
                    : "Un administrador va a confirmar que se saque tu foto de perfil."}
                </p>
                <button
                  type="button"
                  onClick={handleCerrar}
                  className="mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors"
                >
                  Listo
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Cambiar mi foto de perfil</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {esAdmin
                      ? "Subí una foto desde tu equipo. Se va a ver en tu perfil y en tu legajo."
                      : "Subí una foto desde tu equipo. Antes de publicarse, un administrador la revisa para confirmar que cumple los estándares del legajo (sin lentes ni gorra, fondo preferentemente blanco, foto reciente y de frente)."}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Imagen</label>
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor="foto-perfil-input"
                        className="inline-flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        📎 Seleccionar foto
                      </label>
                      <input
                        ref={fileInputRef}
                        id="foto-perfil-input"
                        type="file"
                        accept="image/*"
                        onChange={handleArchivoChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={handleTomarFoto}
                        className="inline-flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        📷 Tomar foto
                      </button>
                      <input
                        ref={inputCamaraRef}
                        id="foto-perfil-camara-input"
                        type="file"
                        accept="image/*"
                        capture="user"
                        onChange={handleArchivoChange}
                        className="hidden"
                      />
                    </div>
                  </div>
                  {previewArchivo && (
                    <div className="relative w-24 h-24">
                      {!previewCargada && (
                        <div className="absolute inset-0 rounded-lg skeleton-shimmer" />
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewArchivo}
                        alt=""
                        onLoad={() => setPreviewCargada(true)}
                        style={{ transform: `rotate(${rotacion}deg)` }}
                        className={`w-24 h-24 rounded-lg object-cover border border-slate-700 transition-opacity transition-transform duration-200 ${
                          previewCargada ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {pending && (
                        <div className="absolute inset-0 rounded-lg bg-slate-950/70 flex items-center justify-center">
                          <Spinner className="h-6 w-6 text-white" />
                        </div>
                      )}
                      {!pending && previewCargada && (
                        <>
                          <button
                            type="button"
                            onClick={handleRotar}
                            title="Rotar foto"
                            className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            <RotarIcon />
                          </button>
                          <button
                            type="button"
                            onClick={handleQuitarArchivo}
                            title="Quitar foto"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <div className="flex justify-between items-center gap-2 pt-1">
                  {fotoUrlActual ? (
                    <button
                      type="button"
                      onClick={handleQuitarFotoActual}
                      disabled={pending}
                      className="rounded-lg border border-red-500/30 bg-transparent hover:bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors disabled:opacity-50"
                    >
                      {esAdmin ? "Quitar foto actual" : "Solicitar sacar mi foto"}
                    </button>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCerrar}
                      disabled={pending}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmar}
                      disabled={pending}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                    >
                      {pending ? "Guardando..." : esAdmin ? "Guardar" : "Enviar para aprobación"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {camaraAbierta && createPortal(
        <CapturarFotoModal
          onCapturar={handleFotoCapturada}
          onCerrar={() => setCamaraAbierta(false)}
        />,
        document.body
      )}
    </>
  );
}
