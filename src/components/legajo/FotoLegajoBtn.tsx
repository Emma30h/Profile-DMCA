"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarFotoLegajoAdmin, eliminarFotoLegajoAdmin, subirFotoLegajoDesdeUrl } from "@/app/actions/legajo";
import { subirFotoStorage } from "@/lib/fotoLegajo";
import { ButtonSpinner } from "@/components/ui/Spinner";

interface Props {
  agenteId: string;
  fotoUrlActual: string | null;
}

type Modo = "archivo" | "link";

function RotarIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

type Rotacion = 0 | 90 | 180 | 270;

export default function FotoLegajoBtn({ agenteId, fotoUrlActual }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<Modo>("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewArchivo, setPreviewArchivo] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [linkRoto, setLinkRoto] = useState(false);
  const [previewCargada, setPreviewCargada] = useState(false);
  const [rotacion, setRotacion] = useState<Rotacion>(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRotar() {
    setRotacion((r) => ((r + 90) % 360) as Rotacion);
  }

  function limpiarPreviewArchivo() {
    if (previewArchivo) URL.revokeObjectURL(previewArchivo);
    setPreviewArchivo(null);
  }

  function handleArchivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    limpiarPreviewArchivo();
    setPreviewCargada(false);
    setRotacion(0);
    setArchivo(file);
    setPreviewArchivo(file ? URL.createObjectURL(file) : null);
  }

  function handleQuitarArchivo() {
    limpiarPreviewArchivo();
    setArchivo(null);
    setRotacion(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAbrir() {
    setModo("archivo");
    setArchivo(null);
    limpiarPreviewArchivo();
    setLink("");
    setLinkRoto(false);
    setPreviewCargada(false);
    setRotacion(0);
    setError(null);
    setAbierto(true);
  }

  function handleCerrar() {
    if (pending) return;
    setAbierto(false);
    limpiarPreviewArchivo();
    setError(null);
  }

  function handleConfirmar() {
    setError(null);

    if (modo === "archivo") {
      if (!archivo) {
        setError("Elegí un archivo de imagen.");
        return;
      }
      startTransition(async () => {
        const url = await subirFotoStorage(archivo, agenteId, rotacion);
        if (!url) {
          setError("No se pudo subir la imagen.");
          return;
        }
        const res = await actualizarFotoLegajoAdmin(agenteId, url);
        if (res.ok) {
          setAbierto(false);
          router.refresh();
        } else {
          setError(res.error);
        }
      });
    } else {
      if (!link.trim()) {
        setError("Pegá el link de la imagen.");
        return;
      }
      startTransition(async () => {
        const res = await subirFotoLegajoDesdeUrl(agenteId, link.trim(), rotacion);
        if (res.ok) {
          setAbierto(false);
          router.refresh();
        } else {
          setError(res.error);
        }
      });
    }
  }

  function handleQuitarFotoActual() {
    setError(null);
    startTransition(async () => {
      const res = await eliminarFotoLegajoAdmin(agenteId);
      if (res.ok) {
        setAbierto(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleAbrir}
        title="Cambiar foto"
        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-[var(--c-bg-elev-2)] border border-[var(--c-line-strong)] flex items-center justify-center text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-white transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCerrar} />

          <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--c-text)]">Cambiar foto del legajo</h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
                Subí un archivo desde tu equipo o pegá el link directo de la imagen.
              </p>
            </div>

            <div className="flex gap-1 rounded-lg bg-[var(--c-bg)] border border-[var(--c-line)] p-1 text-sm">
              <button
                type="button"
                onClick={() => { setModo("archivo"); setError(null); }}
                className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                  modo === "archivo" ? "bg-[var(--c-blue)] text-white" : "text-[var(--c-text-muted)] hover:text-[var(--c-text)]"
                }`}
              >
                Subir archivo
              </button>
              <button
                type="button"
                onClick={() => { setModo("link"); setError(null); }}
                className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                  modo === "link" ? "bg-[var(--c-blue)] text-white" : "text-[var(--c-text-muted)] hover:text-[var(--c-text)]"
                }`}
              >
                Desde un link
              </button>
            </div>

            {modo === "archivo" ? (
              <div key="archivo" className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--c-text-muted)] mb-1">Imagen</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleArchivoChange}
                    className="w-full text-sm text-[var(--c-text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--c-bg-elev-2)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--c-text)] hover:file:bg-[var(--c-line)]"
                  />
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
                      className={`w-24 h-24 rounded-lg object-cover border border-[var(--c-line)] transition-opacity transition-transform duration-200 ${
                        previewCargada ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {pending && (
                      <div className="absolute inset-0 rounded-lg bg-[var(--c-bg)]/70 flex items-center justify-center">
                        <ButtonSpinner size={24} className="text-white" />
                      </div>
                    )}
                    {!pending && previewCargada && (
                      <>
                        <button
                          type="button"
                          onClick={handleRotar}
                          title="Rotar foto"
                          className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-[var(--c-bg-elev-2)] border border-[var(--c-line-strong)] flex items-center justify-center text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-white transition-colors"
                        >
                          <RotarIcon />
                        </button>
                        <button
                          type="button"
                          onClick={handleQuitarArchivo}
                          title="Quitar foto"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[var(--c-bg-elev-2)] border border-[var(--c-line-strong)] flex items-center justify-center text-[var(--c-text-secondary)] hover:bg-[var(--c-coral-strong)] hover:text-white hover:border-[var(--c-coral-strong)] transition-colors"
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
            ) : (
              <div key="link" className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--c-text-muted)] mb-1">Link directo a la imagen</label>
                  <input
                    type="text"
                    value={link}
                    onChange={(e) => { setLink(e.target.value); setLinkRoto(false); setPreviewCargada(false); setRotacion(0); }}
                    placeholder="https://images2.imgbox.com/.../foto.jpg"
                    className="w-full rounded-lg border border-[var(--c-line)] px-3 py-2 text-sm text-[var(--c-text)] placeholder-[var(--c-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)] focus:border-transparent"
                  />
                </div>
                {link.trim() && !linkRoto && (
                  <div className="relative w-24 h-24">
                    {!previewCargada && (
                      <div className="absolute inset-0 rounded-lg skeleton-shimmer" />
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={link.trim()}
                      alt=""
                      onLoad={() => setPreviewCargada(true)}
                      onError={() => setLinkRoto(true)}
                      style={{ transform: `rotate(${rotacion}deg)` }}
                      className={`w-24 h-24 rounded-lg object-cover border border-[var(--c-line)] transition-opacity transition-transform duration-200 ${
                        previewCargada ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {pending && (
                      <div className="absolute inset-0 rounded-lg bg-[var(--c-bg)]/70 flex items-center justify-center">
                        <ButtonSpinner size={24} className="text-white" />
                      </div>
                    )}
                    {!pending && previewCargada && (
                      <>
                        <button
                          type="button"
                          onClick={handleRotar}
                          title="Rotar foto"
                          className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-[var(--c-bg-elev-2)] border border-[var(--c-line-strong)] flex items-center justify-center text-[var(--c-text-secondary)] hover:bg-[var(--c-line)] hover:text-white transition-colors"
                        >
                          <RotarIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setLink(""); setLinkRoto(false); setRotacion(0); }}
                          title="Quitar foto"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[var(--c-bg-elev-2)] border border-[var(--c-line-strong)] flex items-center justify-center text-[var(--c-text-secondary)] hover:bg-[var(--c-coral-strong)] hover:text-white hover:border-[var(--c-coral-strong)] transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                )}
                {link.trim() && linkRoto && (
                  <p className="text-xs text-[var(--c-text-faint)]">No se pudo cargar una vista previa de ese link.</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-[var(--c-coral)]">{error}</p>}

            <div className="flex justify-between items-center gap-2 pt-1">
              {fotoUrlActual ? (
                <button
                  type="button"
                  onClick={handleQuitarFotoActual}
                  disabled={pending}
                  className="rounded-lg border border-[var(--c-coral)]/30 bg-transparent hover:bg-[var(--c-coral)]/10 px-3 py-2 text-sm font-medium text-[var(--c-coral)] transition-colors disabled:opacity-50"
                >
                  Quitar foto actual
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCerrar}
                  disabled={pending}
                  className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmar}
                  disabled={pending}
                  className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {pending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
