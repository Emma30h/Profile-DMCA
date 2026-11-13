"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Mail, Copy, Check, ImagePlus, X, Paperclip } from "lucide-react";
import { enviarCarpetaMedicaMail, obtenerConfigCarpetaMedica, verCertificadoCarpetaMedica } from "@/app/actions/carpetaMedica";
import {
  armarTextoCarpetaMedica,
  diagnosticoDesdeMotivo,
  doctorDesdeObservacion,
  DESTINATARIO_CARPETA_MEDICA_DEFAULT,
  DIAS_RETENCION_CERTIFICADO,
} from "@/lib/carpetaMedica";
import { cuilToDni } from "@/lib/personalLabels";

export interface EnvioCarpetaMedicaEntry {
  id: string;
  createdAt: string;
  destinatario: string;
  enviadoPor: string | null;
  certificadoDisponible: boolean;
}

const TZ = "America/Argentina/Cordoba";

function hoyISO(): string {
  // en-CA da aaaa-mm-dd
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}
function ahoraHHmm(): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}
function isoADdMmAaaa(iso: string): string {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : "";
}
function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// Los certificados se leen bien a ~1800 px; achicarlos evita pasar el límite
// del body de la Server Action y llenar el bucket.
async function comprimirCertificado(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1800;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.82);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}

const inputCls =
  "w-full rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-3 py-2 text-sm text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-blue)]";
const labelCls = "block text-xs font-medium text-[var(--c-text-muted)] mb-1";

export default function EnviarCarpetaMedicaModal({
  licencia,
  agente,
  envios,
  onClose,
}: {
  licencia: { id: string; motivo: string | null; observacion: string | null; diasHabiles: number };
  agente: { apellidos: string; nombres: string; cuil: string; turno: string | null };
  envios: EnvioCarpetaMedicaEntry[];
  onClose: () => void;
}) {
  // Arranca con la dirección de fábrica para no mostrar el campo vacío
  // mientras llega la predeterminada guardada (si la cambiaron).
  const [destinatario, setDestinatario] = useState(DESTINATARIO_CARPETA_MEDICA_DEFAULT);
  const [puedeCambiarPredeterminado, setPuedeCambiarPredeterminado] = useState(false);
  const [guardarPredeterminado, setGuardarPredeterminado] = useState(false);
  const [destinatarioDefault, setDestinatarioDefault] = useState(DESTINATARIO_CARPETA_MEDICA_DEFAULT);
  const doctorObs = doctorDesdeObservacion(licencia.observacion);

  const [turno, setTurno] = useState(agente.turno ?? "");
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState(ahoraHHmm());
  const [diagnostico, setDiagnostico] = useState(diagnosticoDesdeMotivo(licencia.motivo));
  const [doctor, setDoctor] = useState(doctorObs.doctor);
  const [matricula, setMatricula] = useState(doctorObs.matricula);
  const [reposo, setReposo] = useState(`${licencia.diasHabiles * 24} HS`);

  const [certificado, setCertificado] = useState<Blob | null>(null);
  const [certificadoPreview, setCertificadoPreview] = useState<string | null>(null);
  const [procesandoImg, setProcesandoImg] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    obtenerConfigCarpetaMedica().then((res) => {
      if (res.ok) {
        setDestinatario((d) => (d === DESTINATARIO_CARPETA_MEDICA_DEFAULT ? res.destinatario : d));
        setDestinatarioDefault(res.destinatario);
        setPuedeCambiarPredeterminado(res.puedeCambiarPredeterminado);
      } else setError(res.error);
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  useEffect(() => () => { if (certificadoPreview) URL.revokeObjectURL(certificadoPreview); }, [certificadoPreview]);

  const texto = useMemo(
    () =>
      armarTextoCarpetaMedica({
        turno, fecha: isoADdMmAaaa(fecha), hora,
        apellidos: agente.apellidos, nombres: agente.nombres, dni: cuilToDni(agente.cuil),
        diagnostico, doctor, matricula, reposo,
      }),
    [turno, fecha, hora, agente, diagnostico, doctor, matricula, reposo]
  );

  async function elegirImagen(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProcesandoImg(true);
    try {
      const blob = await comprimirCertificado(file);
      setCertificado(blob);
      setCertificadoPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la imagen");
    } finally {
      setProcesandoImg(false);
    }
  }

  function quitarImagen() {
    setCertificado(null);
    setCertificadoPreview(null);
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setError("No se pudo copiar el texto");
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("licenciaId", licencia.id);
    fd.set("destinatario", destinatario);
    if (guardarPredeterminado) fd.set("guardarPredeterminado", "1");
    fd.set("turno", turno);
    fd.set("fecha", isoADdMmAaaa(fecha));
    fd.set("hora", hora);
    fd.set("diagnostico", diagnostico);
    fd.set("doctor", doctor);
    fd.set("matricula", matricula);
    fd.set("reposo", reposo);
    if (certificado) fd.set("certificado", new File([certificado], "certificado.jpg", { type: "image/jpeg" }));
    startTransition(async () => {
      const res = await enviarCarpetaMedicaMail(fd);
      if (res.ok) setEnviado(true);
      else setError(res.error);
    });
  }

  async function abrirCertificado(envioId: string) {
    // La ventana se abre en el mismo click (si se abre después del await,
    // los bloqueadores de popups la frenan) y se le carga la URL al llegar.
    const ventana = window.open("about:blank", "_blank");
    const res = await verCertificadoCarpetaMedica(envioId);
    if (res.ok) {
      if (ventana) ventana.location.href = res.url;
      else window.location.href = res.url;
    } else {
      ventana?.close();
      setError(res.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !pending && onClose()} />
      <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--c-line)] bg-[var(--c-bg-elev)] px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 text-[var(--c-blue-text)] shrink-0" strokeWidth={1.8} />
            <h2 className="text-base font-semibold text-[var(--c-text)] truncate">Enviar Carpeta Médica por mail</h2>
          </div>
          <button type="button" onClick={onClose} disabled={pending} className="rounded-lg p-1.5 text-[var(--c-text-faint)] hover:text-[var(--c-text)] hover:bg-[var(--c-line)] disabled:opacity-50" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {enviado ? (
          <div className="p-6 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--c-green)]/15">
              <Check className="h-6 w-6 text-[var(--c-green)]" />
            </div>
            <p className="text-sm text-[var(--c-text)]">
              Mail enviado a <strong>{destinatario}</strong>
              {certificado ? " con el certificado adjunto." : "."}
            </p>
            {certificado && (
              <p className="text-xs text-[var(--c-text-faint)]">La imagen se conserva {DIAS_RETENCION_CERTIFICADO} días y después se borra sola.</p>
            )}
            <div className="flex justify-center gap-2">
              <button type="button" onClick={copiarTexto} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-line)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)]">
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado" : "Copiar para WhatsApp"}
              </button>
              <button type="button" onClick={onClose} className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white">Cerrar</button>
            </div>
          </div>
        ) : (
          <form onSubmit={enviar} className="p-5 grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Destinatario</label>
                <input type="email" required value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className={inputCls} />
                {destinatarioDefault && destinatario.trim() !== destinatarioDefault && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--c-text-faint)]">
                    <button type="button" onClick={() => setDestinatario(destinatarioDefault)} className="underline hover:text-[var(--c-text-muted)]">
                      Volver a la predeterminada ({destinatarioDefault})
                    </button>
                    {puedeCambiarPredeterminado && (
                      <label className="inline-flex items-center gap-1.5">
                        <input type="checkbox" checked={guardarPredeterminado} onChange={(e) => setGuardarPredeterminado(e.target.checked)} />
                        Usar como predeterminada
                      </label>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Turno</label>
                  <input required value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="C" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Fecha</label>
                  <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Diagnóstico</label>
                <input required value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="Rinofaringitis" className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Doctor</label>
                  <input required value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="Apellido Nombre" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>MP</label>
                  <input required value={matricula} onChange={(e) => setMatricula(e.target.value)} inputMode="numeric" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Reposo</label>
                <input required value={reposo} onChange={(e) => setReposo(e.target.value)} placeholder="24 HS" className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Certificado médico (imagen, opcional)</label>
                {certificadoPreview ? (
                  <div className="relative rounded-lg border border-[var(--c-line)] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={certificadoPreview} alt="Certificado" className="max-h-48 w-full object-contain bg-black/20" />
                    <button type="button" onClick={quitarImagen} className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white hover:bg-black/80" title="Quitar imagen">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--c-line-strong)] px-3 py-4 text-sm text-[var(--c-text-muted)] hover:bg-[var(--c-bg-elev-2)]">
                    <ImagePlus className="h-4 w-4" />
                    {procesandoImg ? "Procesando…" : "Adjuntar foto del certificado"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => elegirImagen(e.target.files?.[0])} />
                  </label>
                )}
                <p className="mt-1 text-[11px] text-[var(--c-text-faint)]">Se guarda {DIAS_RETENCION_CERTIFICADO} días y después se borra sola.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={labelCls + " mb-0"}>Vista previa del mail</span>
                <button type="button" onClick={copiarTexto} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--c-text-muted)] hover:bg-[var(--c-bg-elev-2)]">
                  {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-[var(--c-line)] bg-[var(--c-bg)] p-3 text-[13px] leading-relaxed text-[var(--c-text)] font-sans">{texto}</pre>
              {certificado && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--c-text-muted)]"><Paperclip className="h-3.5 w-3.5" /> Certificado adjunto</p>
              )}

              {envios.length > 0 && (
                <div className="rounded-lg border border-[var(--c-line)] p-3 space-y-1.5">
                  <p className="text-xs font-medium text-[var(--c-text-muted)]">Envíos anteriores</p>
                  {envios.map((env) => (
                    <div key={env.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--c-text-faint)]">
                      <span>{fmtFechaHora(env.createdAt)} → {env.destinatario}{env.enviadoPor ? ` (${env.enviadoPor})` : ""}</span>
                      {env.certificadoDisponible && (
                        <button type="button" onClick={() => abrirCertificado(env.id)} className="underline hover:text-[var(--c-text-muted)]">Ver certificado</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-[var(--c-coral)]/10 border border-[var(--c-coral)]/25 px-3 py-2 text-sm text-[var(--c-coral)]">{error}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={pending || procesandoImg || !destinatario} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  <Mail className="h-4 w-4" /> {pending ? "Enviando…" : "Enviar mail"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
