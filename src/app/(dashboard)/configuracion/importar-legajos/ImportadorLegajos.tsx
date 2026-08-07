"use client";

import { useState, useTransition, useRef } from "react";
import {
  previsualizarImportacion,
  confirmarImportacion,
  type PrevisualizacionImport,
  type ResultadoImport,
} from "@/app/actions/importarLegajos";

const TIPO_PERSONAL_LABEL: Record<string, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil becario",
  CIVIL_POLICIAL: "Civil policial",
};

export default function ImportadorLegajos() {
  const [preview, setPreview] = useState<PrevisualizacionImport | null>(null);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [cargando, startCarga] = useTransition();
  const [confirmando, startConfirmacion] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function procesarArchivo(archivo: File) {
    setError(null);
    setResultado(null);
    setPreview(null);
    startCarga(async () => {
      try {
        const formData = new FormData();
        formData.set("archivo", archivo);
        const res = await previsualizarImportacion(formData);
        setPreview(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo procesar el archivo");
      }
    });
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastrando(false);
    const archivo = e.dataTransfer.files?.[0];
    if (archivo) procesarArchivo(archivo);
  }

  function onSeleccionar(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) procesarArchivo(archivo);
    e.target.value = "";
  }

  function onConfirmar() {
    if (!preview || preview.nuevos.length === 0) return;
    startConfirmacion(async () => {
      try {
        const res = await confirmarImportacion(preview.nuevos.map((f) => f.datos));
        setResultado(res);
        setPreview(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la importación");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          arrastrando ? "border-blue-400 bg-blue-500/5" : "border-slate-700 hover:border-slate-600"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx" onChange={onSeleccionar} className="hidden" />
        <p className="text-slate-300 text-sm font-medium">Arrastrá acá el archivo .csv o .xlsx</p>
        <p className="text-slate-500 text-xs mt-1">o hacé clic para elegirlo desde tu computadora</p>
        {cargando && <p className="text-blue-300 text-xs mt-3 animate-pulse">Procesando archivo…</p>}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {resultado && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-lg px-4 py-3 space-y-1">
          <p className="font-medium">Se crearon {resultado.creados} legajos como pendientes de validación.</p>
          {resultado.fallidos.length > 0 && (
            <ul className="text-red-300 text-xs list-disc pl-4">
              {resultado.fallidos.map((f) => (
                <li key={f.cuil}>CUIL {f.cuil}: {f.motivo}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Se van a crear ({preview.nuevos.length})
            </h3>
            {preview.nuevos.length > 0 && (
              <button
                onClick={onConfirmar}
                disabled={confirmando}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {confirmando ? "Creando…" : `Confirmar creación de ${preview.nuevos.length} legajos`}
              </button>
            )}
          </div>

          {preview.nuevos.length === 0 ? (
            <p className="text-slate-500 text-sm">
              No hay legajos nuevos para crear — todos los CUIL del archivo ya existen en la app.
            </p>
          ) : (
            <div className="border border-slate-700 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wide border-b border-slate-700">
                    <th className="px-3 py-2">CUIL</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Advertencias</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.nuevos.map((f) => (
                    <tr key={f.datos.cuil} className="border-b border-slate-800 last:border-0">
                      <td className="px-3 py-2 text-slate-300 tabular-nums">{f.datos.cuil}</td>
                      <td className="px-3 py-2 text-slate-200">{f.datos.apellidos}, {f.datos.nombres}</td>
                      <td className="px-3 py-2 text-slate-400">{TIPO_PERSONAL_LABEL[f.datos.tipoPersonal] ?? f.datos.tipoPersonal}</td>
                      <td className="px-3 py-2 text-amber-300 text-xs">
                        {f.advertencias.length > 0 ? f.advertencias.join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errores.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-100">Con errores ({preview.errores.length})</h3>
              <div className="border border-slate-700 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-slate-500 uppercase tracking-wide border-b border-slate-700">
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">CUIL</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errores.map((e, i) => (
                      <tr key={i} className="border-b border-slate-800 last:border-0">
                        <td className="px-3 py-2 text-slate-500 tabular-nums">{e.fila}</td>
                        <td className="px-3 py-2 text-slate-400 tabular-nums">{e.cuil || "—"}</td>
                        <td className="px-3 py-2 text-slate-300">{e.nombre}</td>
                        <td className="px-3 py-2 text-red-300 text-xs">{e.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
