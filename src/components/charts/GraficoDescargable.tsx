"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import { CHART_THEMES, TEMA_INSTITUCIONAL, type ChartTheme } from "@/lib/chartThemes";
import { descargarNodoComoImagen } from "@/lib/exportarImagen";

// Botón de descarga + modal de vista previa para cualquier gráfico del
// dashboard/licencias. `children` es un render-prop que arma SOLO la parte
// exportable de la tarjeta (título + bajada + gráfico + leyenda, sin
// controles interactivos) parametrizada por el tema elegido — cada tarjeta
// se auto-renderiza en "modo export" acá adentro (ver AGENTS del plan:
// LicenciasPorTurnoCard.tsx etc. reciben `modoExport`/`tema` y se pasan a
// sí mismas como children).
//
// El portal va directo a document.body en el render (createPortal), nunca
// vía useState(() => document.createElement(...)) — ese patrón ya causó un
// bug de hidratación en este proyecto (ver memoria
// feedback_portal_hydration_document_check).
export default function GraficoDescargable({
  nombreArchivo,
  children,
  sinPaletas,
}: {
  nombreArchivo: string;
  children: (tema: ChartTheme) => ReactNode;
  sinPaletas?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [temaId, setTemaId] = useState(TEMA_INSTITUCIONAL.id);
  const [descargando, setDescargando] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const tema = CHART_THEMES.find((t) => t.id === temaId) ?? TEMA_INSTITUCIONAL;

  async function descargar() {
    if (!previewRef.current) return;
    setDescargando(true);
    try {
      await descargarNodoComoImagen(previewRef.current, nombreArchivo, tema.fondo);
      setAbierto(false);
    } catch {
      alert("No se pudo descargar la imagen.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Descargar como imagen"
        className="rounded-lg p-1.5 text-[var(--c-text-muted)] hover:text-[var(--c-text)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
      >
        <Download className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} />

          <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-semibold text-[var(--c-text)]">Descargar como imagen</h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">Vista previa — así se ve el archivo que se va a descargar.</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6">
              {/* overflow-x-auto (no overflow-hidden): algunas tarjetas
                  (ausentismo, flujo de personal) pueden ser más anchas que
                  el modal cuando el historial es largo — con overflow-hidden
                  quedarían recortadas tanto acá como en la imagen final.
                  data-theme + fondo dependen del tema elegido (algunos son
                  oscuros) en vez de forzar claro siempre. */}
              <div className="rounded-lg border border-[var(--c-line)] overflow-x-auto" data-theme={tema.modo}>
                <div ref={previewRef} className="p-5 inline-block min-w-full" style={{ background: tema.fondo }}>
                  {children(tema)}
                </div>
              </div>

              {!sinPaletas && (
                <div className="flex items-center gap-2 flex-wrap mt-4">
                  {CHART_THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemaId(t.id)}
                      title={t.nombre}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        t.id === temaId
                          ? "border-[var(--c-blue)] ring-2 ring-[var(--c-blue)]/30"
                          : "border-[var(--c-line)] hover:border-[var(--c-line-strong)]"
                      }`}
                      style={{ background: t.fondo, color: t.modo === "dark" ? "#e6edf7" : "#1d1f20" }}
                    >
                      <span className="flex -space-x-1">
                        {[t.categorico[0], t.categorico[2], t.categorico[3], t.categorico[5]].map((hex, i) => (
                          <span
                            key={i}
                            className="w-2.5 h-2.5 rounded-full border"
                            style={{ background: hex, borderColor: t.fondo }}
                          />
                        ))}
                      </span>
                      {t.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--c-bg-elev-2)] mt-4">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={descargar}
                disabled={descargando}
                className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {descargando ? "Generando…" : "Descargar PNG"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
