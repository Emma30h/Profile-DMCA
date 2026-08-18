"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import {
  actualizarAgentePersonal,
  actualizarAgenteLaboral,
  marcarEnCursoAscenso,
  cancelarCursoAscenso,
  confirmarAscenso,
} from "@/app/actions/agentes";
import type { DatosPersonales, DatosLaborales } from "@/app/actions/agentes";
import { crearLicencia, actualizarLicencia, eliminarLicencia } from "@/app/actions/licencias";
import { crearComentario, eliminarComentario } from "@/app/actions/comentarios";
import {
  crearLicenciaPendiente,
  actualizarLicenciaPendiente,
  eliminarLicenciaPendiente,
  registrarUso,
  eliminarUso,
} from "@/app/actions/licenciasPendientes";
import type { TipoLicencia, TipoLicenciaPendiente, UnidadDias, OrigenInstitucional, CategoriaLicencia } from "@/types";
import {
  ORIGENES_INSTITUCIONALES,
  CATEGORIAS_LICENCIA,
  LICENCIA_TIPOS_POR_CATEGORIA,
  LICENCIA_CATEGORIA_DE_TIPO,
  CATEGORIA_LICENCIA_INFO,
  TIPO_LICENCIA_LABELS,
} from "@/types";
import EstadisticasLicencias, { type AgenteInfoInforme } from "./EstadisticasLicencias";
import { formatFechaHora } from "@/lib/fecha";
import { cuilToDni } from "@/lib/personalLabels";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AgenteDetalle {
  id: string;
  cuil: string;
  nombres: string;
  apellidos: string;
  sexo: string;
  fechaNacimiento: string | null;
  estadoCivil: string | null;
  nacionalidad: string | null;
  provinciaOrigen: string | null;
  ciudadOrigen: string | null;
  grupoSanguineo: string | null;
  alergias: string | null;
  enfermedadesCronicas: string | null;
  medicamentos: string | null;
  cirugias: string | null;
  hijosCargo: number;
  poseeSepelio: boolean;
  empresaSepelio: string | null;
  email: string | null;
  telefono: string | null;
  telefonoAlternativo: string | null;
  contactoEmergencia: string | null;
  domicilioReal: string | null;
  ciudad: string | null;
  barrio: string | null;
  nroDomicilio: string | null;
  piso: string | null;
  tipoPersonal: string;
  estado: string;
  fechaIngreso: string | null;
  turno: string | null;
  rangoId: string | null;
  sectorId: string | null;
  anoEgreso: string | null;
  perteneceETAC: boolean | null;
  fechaInicioCursoAscenso: string | null;
  origenInstitucional: string | null;
  origenInstitucionalDetalle: string | null;
  tipoArma: string | null;
  marcaPistola: string | null;
  modeloPistola: string | null;
  calibre: string | null;
  chalecoProvisto: boolean | null;
  marcaChaleco: string | null;
  nroSeriePlacas: string | null;
  talleChaleco: string | null;
  vencimientoChaleco: string | null;
  enTNO: boolean | null;
  motivoTNO: string | null;
  fechaInicioTNO: string | null;
  licenciaConducir: string | null;
  licenciaEmision: string | null;
  licenciaVencimiento: string | null;
  nivelPrimario: string | null;
  nivelSecundario: string | null;
  nivelTerciario: string | null;
  nivelUniversitario: string | null;
  nivelSuperior: string | null;
  detalleTitulos: string | null;
  fotoUrl: string | null;
  rango: { nombre: string; cuerpo: string; orden: number } | null;
  sector: { nombre: string; tipo: string } | null;
  historialRangos: Array<{
    id: string;
    fechaDesde: string;
    fechaHasta: string | null;
    observacion: string | null;
    rango: { nombre: string; cuerpo: string };
  }>;
}

interface RangoOption { id: string; nombre: string; cuerpo: string }
interface SectorOption { id: string; nombre: string }
export interface Feriado { id: string; fecha: string; nombre: string; aplica: boolean }

export interface AuditLogEntry {
  id: string;
  usuarioNombre: string | null;
  seccion: string;
  cambios: string;
  createdAt: string;
}

export interface HistorialEstadoEntry {
  id: string;
  estadoAnterior: string;
  estadoNuevo: string;
  motivo: string | null;
  usuarioNombre: string | null;
  createdAt: string;
}

export interface ComentarioEntry {
  id: string;
  texto: string;
  usuarioNombre: string | null;
  createdAt: string;
}

export interface LicenciaEntry {
  id: string;
  tipo: string;
  estado: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  motivo: string | null;
  observacion: string | null;
  createdAt: string;
}

export interface UsoLicenciaPendienteEntry {
  id: string;
  fecha: string;
  cantidadDias: number;
  referencia: string | null;
  createdAt: string;
}

export interface LicenciaPendienteEntry {
  id: string;
  tipo: string;
  tipoOtroDetalle: string | null;
  unidad: string;
  anio: number;
  cantidadDias: number;
  referencia: string | null;
  createdAt: string;
  usos: UsoLicenciaPendienteEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function val(v: string | null | undefined): string {
  if (!v || v.trim() === "") return "—";
  return v;
}

function boolVal(v: boolean | null | undefined): string {
  if (v == null) return "—";
  return v ? "Sí" : "No";
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

// ─── Form state ───────────────────────────────────────────────────────────────

function initPersonal(a: AgenteDetalle): DatosPersonales {
  return {
    nombres: a.nombres,
    apellidos: a.apellidos,
    estadoCivil: a.estadoCivil ?? "",
    nacionalidad: a.nacionalidad ?? "",
    provinciaOrigen: a.provinciaOrigen ?? "",
    ciudadOrigen: a.ciudadOrigen ?? "",
    grupoSanguineo: a.grupoSanguineo ?? "",
    alergias: a.alergias ?? "",
    enfermedadesCronicas: a.enfermedadesCronicas ?? "",
    medicamentos: a.medicamentos ?? "",
    cirugias: a.cirugias ?? "",
    email: a.email ?? "",
    telefono: a.telefono ?? "",
    telefonoAlternativo: a.telefonoAlternativo ?? "",
    contactoEmergencia: a.contactoEmergencia ?? "",
    domicilioReal: a.domicilioReal ?? "",
    ciudad: a.ciudad ?? "",
    barrio: a.barrio ?? "",
    nroDomicilio: a.nroDomicilio ?? "",
    piso: a.piso ?? "",
    hijosCargo: a.hijosCargo,
    poseeSepelio: a.poseeSepelio,
    empresaSepelio: a.empresaSepelio ?? "",
  };
}

function initLaboral(a: AgenteDetalle): DatosLaborales {
  return {
    turno: a.turno ?? "",
    sectorId: a.sectorId ?? "",
    rangoId: a.rangoId ?? "",
    perteneceETAC: a.perteneceETAC ?? false,
    origenInstitucional: a.origenInstitucional ?? "",
    origenInstitucionalDetalle: a.origenInstitucionalDetalle ?? "",
    tipoArma: a.tipoArma ?? "",
    marcaPistola: a.marcaPistola ?? "",
    modeloPistola: a.modeloPistola ?? "",
    calibre: a.calibre ?? "",
    chalecoProvisto: a.chalecoProvisto ?? false,
    marcaChaleco: a.marcaChaleco ?? "",
    nroSeriePlacas: a.nroSeriePlacas ?? "",
    talleChaleco: a.talleChaleco ?? "",
    vencimientoChaleco: toDateInput(a.vencimientoChaleco),
    enTNO: a.enTNO ?? false,
    motivoTNO: a.motivoTNO ?? "",
    fechaInicioTNO: toDateInput(a.fechaInicioTNO),
    licenciaConducir: a.licenciaConducir ?? "",
    licenciaEmision: toDateInput(a.licenciaEmision),
    licenciaVencimiento: toDateInput(a.licenciaVencimiento),
    nivelPrimario: a.nivelPrimario ?? "",
    nivelSecundario: a.nivelSecundario ?? "",
    nivelTerciario: a.nivelTerciario ?? "",
    nivelUniversitario: a.nivelUniversitario ?? "",
    nivelSuperior: a.nivelSuperior ?? "",
    detalleTitulos: a.detalleTitulos ?? "",
  };
}

// ─── Inputs de edición ────────────────────────────────────────────────────────

function InputEdit({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
    </div>
  );
}

function SelectEdit({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100 bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function CheckEdit({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-700 text-blue-400 focus:ring-blue-500"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function NumEdit({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={0}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full rounded-md border border-slate-700 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
    </div>
  );
}

// ─── Componentes de visualización ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">{children}</div>
    </div>
  );
}

/** wa.me necesita el número completo con código de país — acá se guardan
 *  como código de área + número, sin 0 ni 15 (ej. "3516815808"), así que
 *  alcanza con anteponerle el 549 de Argentina/celular. */
function whatsappUrl(numero: string, mensaje?: string): string {
  const digitos = numero.replace(/\D/g, "");
  const base = `https://wa.me/549${digitos}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}

export interface RemitenteWhatsapp {
  nombre: string;
  jerarquia: string | null;
  sexo: string | null;
}

function saludoSegunHora(): string {
  const hora = new Date().getHours();
  if (hora >= 6 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "Buenas tardes! Le habla el/la {jerarquía} {nombre}." — se arma en el
 *  momento (no server-side) porque el saludo depende de la hora local de
 *  quien hace click, no de cuándo se renderizó la página. */
function mensajeSaludoWhatsapp(remitente: RemitenteWhatsapp | undefined): string | undefined {
  if (!remitente?.nombre) return undefined;
  const articulo = remitente.sexo === "FEMENINO" ? "la" : "el";
  const cargo = remitente.jerarquia ? `${remitente.jerarquia} ` : "";
  return `${saludoSegunHora()}! Le habla ${articulo} ${cargo}${remitente.nombre}.`;
}

function Field({ label, value, full, icon, whatsapp, whatsappMensaje }: {
  label: string; value: string; full?: boolean; icon?: React.ReactNode;
  /** Si viene y `value` no es "—", agrega un ícono de WhatsApp que abre un chat con ese número. */
  whatsapp?: string | null;
  whatsappMensaje?: string;
}) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
        {icon && <span className="text-slate-600 shrink-0">{icon}</span>}
        {label}
      </p>
      <p className={`flex items-center gap-2 text-sm ${value === "—" ? "text-slate-600" : "text-slate-200"}`}>
        {value}
        {whatsapp && value !== "—" && (
          <a
            href={whatsappUrl(whatsapp, whatsappMensaje)}
            target="_blank"
            rel="noopener noreferrer"
            title="Escribir por WhatsApp"
            className="text-green-500 hover:text-green-400 transition-colors"
          >
            <IconWhatsApp />
          </a>
        )}
      </p>
    </div>
  );
}

// ─── Íconos de campo (mismo estilo que /perfil, en tamaño chico) ──────────────

function IconIdCard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 15a2 2 0 012-2h0a2 2 0 012 2M8 10h.01M13 9h5m-5 3h5" />
    </svg>
  );
}

function IconPersonMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconCakeMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 15a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9V5m0 0a2 2 0 010-4 2 2 0 010 4z" />
    </svg>
  );
}

function IconHeartMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function IconFlagMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21V4m0 0l9-1 9 1v13l-9-1-9 1V4z" />
    </svg>
  );
}

function IconHomeMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function IconDropMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2C8 7 5 11 5 14a7 7 0 0014 0c0-3-3-7-7-12z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

function IconPill() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.5 17.5l11-11a4.243 4.243 0 10-6-6l-11 11a4.243 4.243 0 106 6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 6.5l9 9" />
    </svg>
  );
}

function IconCross() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.121.553 4.113 1.523 5.845L0 24l6.317-1.657A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.837 0-3.554-.51-5.024-1.393l-.36-.214-3.734.98.999-3.635-.235-.373A9.716 9.716 0 012.25 12c0-5.376 4.374-9.75 9.75-9.75s9.75 4.374 9.75 9.75-4.374 9.75-9.75 9.75z" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IconPhoneMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function IconUsersMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconMapPinMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconGift() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8M22 7H2v4h20V7zM12 22V7m0 0c-1.5 0-4-1-4-3.5S9.5 1 12 3s4-1.5 4 1S13.5 7 12 7z" />
    </svg>
  );
}

function IconBuildingMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconCalendarMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconClockMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconBadgeMini() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconGraduation() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.741-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443" />
    </svg>
  );
}

// ─── Tabs: vista (solo lectura) ───────────────────────────────────────────────

function TabPersonal({ a, remitenteWhatsapp }: { a: AgenteDetalle; remitenteWhatsapp?: RemitenteWhatsapp }) {
  const mensajeWhatsapp = mensajeSaludoWhatsapp(remitenteWhatsapp);
  return (
    <div className="space-y-8">
      <Section title="Identidad">
        <Field icon={<IconIdCard />} label="DNI" value={cuilToDni(a.cuil)} />
        <Field icon={<IconIdCard />} label="CUIL" value={a.cuil} />
        <Field icon={<IconPersonMini />} label="Sexo" value={val(a.sexo)} />
        <Field icon={<IconCakeMini />} label="Fecha de nacimiento" value={fmt(a.fechaNacimiento)} />
        <Field icon={<IconHeartMini />} label="Estado civil" value={val(a.estadoCivil)} />
        <Field icon={<IconFlagMini />} label="Nacionalidad" value={val(a.nacionalidad)} />
        <Field icon={<IconHomeMini />} label="Provincia de origen" value={val(a.provinciaOrigen)} />
        <Field icon={<IconHomeMini />} label="Ciudad de origen" value={val(a.ciudadOrigen)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Salud">
        <Field icon={<IconDropMini />} label="Grupo sanguíneo" value={val(a.grupoSanguineo)} />
        <Field icon={<IconAlert />} label="Alergias" value={val(a.alergias)} />
        <Field icon={<IconPulse />} label="Enfermedades crónicas" value={val(a.enfermedadesCronicas)} />
        <Field icon={<IconPill />} label="Medicamentos" value={val(a.medicamentos)} />
        <Field icon={<IconCross />} label="Cirugías" value={val(a.cirugias)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Contacto">
        <Field icon={<IconMail />} label="Email" value={val(a.email)} />
        <Field icon={<IconPhoneMini />} label="Teléfono" value={val(a.telefono)} whatsapp={a.telefono} whatsappMensaje={mensajeWhatsapp} />
        <Field icon={<IconPhoneMini />} label="Teléfono alternativo" value={val(a.telefonoAlternativo)} whatsapp={a.telefonoAlternativo} whatsappMensaje={mensajeWhatsapp} />
        <Field icon={<IconUsersMini />} label="Contacto de emergencia" value={val(a.contactoEmergencia)} full />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Domicilio">
        <Field icon={<IconMapPinMini />} label="Domicilio real" value={val(a.domicilioReal)} />
        {/* Espaciadores: fuerzan el salto de fila en md:grid-cols-3 para que
            Domicilio real quede solo en su línea y Número/Barrio/Ciudad
            queden alineados juntos en la siguiente. */}
        <div className="hidden md:block" aria-hidden="true" />
        <div className="hidden md:block" aria-hidden="true" />
        <Field icon={<IconMapPinMini />} label="Número" value={val(a.nroDomicilio)} />
        <Field icon={<IconMapPinMini />} label="Barrio" value={val(a.barrio)} />
        <Field icon={<IconMapPinMini />} label="Ciudad" value={val(a.ciudad)} />
        <Field icon={<IconMapPinMini />} label="Piso" value={val(a.piso)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Familia y beneficios">
        <Field icon={<IconUsersMini />} label="Hijos a cargo" value={String(a.hijosCargo)} />
        <Field icon={<IconGift />} label="Posee servicio de sepelio" value={boolVal(a.poseeSepelio)} />
        <Field icon={<IconBuildingMini />} label="Empresa de sepelio" value={val(a.empresaSepelio)} />
      </Section>
    </div>
  );
}

const ORIGEN_LABEL: Record<OrigenInstitucional, string> = {
  GOBIERNO: "Gobierno",
  DMCA: "DMCA",
  "911": "911",
  OTRA_DEPENDENCIA: "Otra dependencia",
};

function TabLaboral({ a, esOperador = false }: { a: AgenteDetalle; esOperador?: boolean }) {
  const esSeguridad = a.tipoPersonal === "SEGURIDAD";
  const esTecnico = a.tipoPersonal === "TECNICO";
  const tieneRango = esSeguridad || esTecnico;
  const tipoLabels: Record<string, string> = {
    SEGURIDAD: "Seguridad", TECNICO: "Técnico",
    CIVIL_BECARIO: "Civil Becario", CIVIL_POLICIAL: "Civil Policial",
  };
  const estadoLabels: Record<string, string> = {
    PENDIENTE: "Pendiente", ACTIVO: "Activo", BAJA: "Baja", PASE: "Pase",
  };
  const origen = a.origenInstitucional as OrigenInstitucional | null;
  const origenValue = origen
    ? origen === "OTRA_DEPENDENCIA" && a.origenInstitucionalDetalle
      ? `${ORIGEN_LABEL[origen]} (${a.origenInstitucionalDetalle})`
      : ORIGEN_LABEL[origen]
    : "—";
  return (
    <div className="space-y-8">
      <Section title="Información laboral">
        <Field icon={<IconBadgeMini />} label="Tipo de personal" value={tipoLabels[a.tipoPersonal] ?? a.tipoPersonal} />
        <Field icon={<IconCheckCircle />} label="Estado" value={estadoLabels[a.estado] ?? a.estado} />
        <Field icon={<IconCalendarMini />} label="Fecha de ingreso a Ojos en Alerta" value={fmt(a.fechaIngreso)} />
        <Field icon={<IconClockMini />} label="Turno" value={val(a.turno)} />
        <Field icon={<IconBuildingMini />} label="Sector" value={val(a.sector?.nombre)} />
        <Field icon={<IconFlagMini />} label="Origen institucional" value={origenValue} />
        {tieneRango && (
          <>
            <Field icon={<IconBadgeMini />} label="Jerarquía / Rango" value={val(a.rango?.nombre)} />
            <Field icon={<IconCalendarMini />} label="Año de egreso" value={fmt(a.anoEgreso)} />
            <Field icon={<IconCheckCircle />} label="Perteneció al E.T.A.C." value={boolVal(a.perteneceETAC)} />
          </>
        )}
      </Section>
      {esSeguridad && (
        <>
          {/* Operador puede ver Datos Laborales de Seguridad, pero no el
              detalle del armamento ni del chaleco asignado. */}
          {!esOperador && (
            <>
              <div className="border-t border-slate-800" />
              <Section title="Armamento">
                <Field icon={<IconShield />} label="Tipo de arma" value={val(a.tipoArma)} />
                <Field icon={<IconShield />} label="Marca de pistola" value={val(a.marcaPistola)} />
                <Field icon={<IconShield />} label="Modelo de pistola" value={val(a.modeloPistola)} />
                <Field icon={<IconShield />} label="Calibre" value={val(a.calibre)} />
              </Section>
              <div className="border-t border-slate-800" />
              <Section title="Chaleco">
                <Field icon={<IconShield />} label="Chaleco provisto" value={boolVal(a.chalecoProvisto)} />
                <Field icon={<IconShield />} label="Marca" value={val(a.marcaChaleco)} />
                <Field icon={<IconShield />} label="N° de serie / Placas" value={val(a.nroSeriePlacas)} />
                <Field icon={<IconShield />} label="Talle" value={val(a.talleChaleco)} />
                <Field icon={<IconCalendarMini />} label="Vencimiento" value={fmt(a.vencimientoChaleco)} />
              </Section>
            </>
          )}
          <div className="border-t border-slate-800" />
          <Section title="Situación de revista">
            <Field icon={<IconShield />} label="Tarea No Operativa (TNO)" value={boolVal(a.enTNO)} />
            {a.enTNO && (
              <>
                <Field icon={<IconShield />} label="Motivo" value={val(a.motivoTNO)} />
                <Field icon={<IconCalendarMini />} label="Desde" value={fmt(a.fechaInicioTNO)} />
              </>
            )}
          </Section>
        </>
      )}
      <div className="border-t border-slate-800" />
      <Section title="Licencia de conducir">
        <Field icon={<IconIdCard />} label="Categoría" value={val(a.licenciaConducir)} />
        <Field icon={<IconCalendarMini />} label="Fecha de emisión" value={fmt(a.licenciaEmision)} />
        <Field icon={<IconCalendarMini />} label="Fecha de vencimiento" value={fmt(a.licenciaVencimiento)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Nivel académico">
        <Field icon={<IconGraduation />} label="Primario" value={val(a.nivelPrimario)} />
        <Field icon={<IconGraduation />} label="Secundario" value={val(a.nivelSecundario)} />
        <Field icon={<IconGraduation />} label="Terciario" value={val(a.nivelTerciario)} />
        <Field icon={<IconGraduation />} label="Universitario" value={val(a.nivelUniversitario)} />
        <Field icon={<IconGraduation />} label="Superior" value={val(a.nivelSuperior)} />
        {a.detalleTitulos && <Field icon={<IconGraduation />} label="Detalle de títulos / estudios" value={val(a.detalleTitulos)} full />}
      </Section>
    </div>
  );
}

function CondicionAscenso({ agenteId, fechaInicioCursoAscenso, canEdit }: {
  agenteId: string; fechaInicioCursoAscenso: string | null; canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  function handleMarcar() {
    setError(null);
    startTransition(async () => {
      try {
        await marcarEnCursoAscenso(agenteId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al marcar el curso de ascenso");
      }
    });
  }

  function handleCancelar() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelarCursoAscenso(agenteId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cancelar el curso de ascenso");
      }
    });
  }

  function handleConfirmar() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmarAscenso(agenteId);
        setConfirmando(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al confirmar el ascenso");
      }
    });
  }

  return (
    <div className="mb-6 pb-6 border-b border-slate-800">
      {fechaInicioCursoAscenso ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-400 px-3 py-1 text-xs font-medium">
            🎓 En curso de ascenso desde {fmt(fechaInicioCursoAscenso)}
          </span>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelar}
                disabled={pending}
                className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
              >
                Cancelar curso
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                disabled={pending}
                className="rounded-lg bg-green-600 hover:bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
              >
                Confirmar ascenso
              </button>
            </div>
          )}
        </div>
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={handleMarcar}
            disabled={pending}
            className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
          >
            🎓 Marcar en curso de ascenso
          </button>
        )
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setConfirmando(false)} />
          <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-100">Confirmar ascenso</h3>
            <p className="text-sm text-slate-400">
              El agente va a pasar al siguiente rango de su cuerpo y se va a cerrar el curso de ascenso. Esta acción queda registrada en el historial.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                disabled={pending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                disabled={pending}
                className="rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {pending ? "Confirmando..." : "Sí, ascender"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabHistorial({ agenteId, historialRangos, tipoPersonal, fechaInicioCursoAscenso, canEdit }: {
  agenteId: string;
  historialRangos: AgenteDetalle["historialRangos"];
  tipoPersonal: string;
  fechaInicioCursoAscenso: string | null;
  canEdit: boolean;
}) {
  const tieneJerarquia = tipoPersonal === "SEGURIDAD" || tipoPersonal === "TECNICO";
  if (!tieneJerarquia) {
    return <div className="py-12 text-center text-slate-500 text-sm">El personal civil no tiene historial de jerarquía.</div>;
  }
  return (
    <div>
      <CondicionAscenso agenteId={agenteId} fechaInicioCursoAscenso={fechaInicioCursoAscenso} canEdit={canEdit} />
      {historialRangos.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">No hay registros de ascensos cargados aún.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Rango", "Cuerpo", "Desde", "Hasta", "Observación"].map((h) => (
                  <th key={h} className="text-left py-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {historialRangos.map((h) => (
                <tr key={h.id}>
                  <td className="py-3 pr-6 font-medium text-slate-200">{h.rango.nombre}</td>
                  <td className="py-3 pr-6 text-slate-400 capitalize">{h.rango.cuerpo.toLowerCase()}</td>
                  <td className="py-3 pr-6 text-slate-400">{fmt(h.fechaDesde)}</td>
                  <td className="py-3 pr-6 text-slate-400">
                    {h.fechaHasta ? fmt(h.fechaHasta) : (
                      <span className="inline-flex items-center rounded-full bg-green-500/15 text-green-400 px-2 py-0.5 text-xs font-medium">Actual</span>
                    )}
                  </td>
                  <td className="py-3 text-slate-400">{val(h.observacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabProximamente({ label }: { label: string }) {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-4">
        <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-400">{label}</p>
      <p className="text-xs text-slate-500 mt-1">Esta sección estará disponible próximamente.</p>
    </div>
  );
}

const ESTADO_BADGE_SMALL: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  ACTIVO: "bg-green-500/15 text-green-400",
  BAJA: "bg-slate-800 text-slate-400",
  PASE: "bg-blue-500/15 text-blue-300",
};
const ESTADO_LABEL_MAP: Record<string, string> = {
  PENDIENTE: "Pendiente", ACTIVO: "Activo", BAJA: "Baja", PASE: "Pase",
};

function fmtFechaHora(iso: string) {
  return formatFechaHora(iso, { utc: true, separador: " " });
}

function TabCambios({ auditLogs, historialEstados }: { auditLogs: AuditLogEntry[]; historialEstados: HistorialEstadoEntry[] }) {
  const sinDatos = auditLogs.length === 0 && historialEstados.length === 0;
  if (sinDatos) {
    return (
      <div className="py-16 text-center">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-sm font-medium text-slate-400">Sin historial de cambios</p>
        <p className="text-xs text-slate-500 mt-1">Los cambios que se realicen en este legajo aparecerán aquí.</p>
      </div>
    );
  }

  const SECCION_BADGE: Record<string, string> = {
    PERSONAL: "bg-blue-500/15 text-blue-300",
    LABORAL: "bg-purple-500/15 text-purple-400",
  };
  const SECCION_LABEL: Record<string, string> = {
    PERSONAL: "Datos Personales",
    LABORAL: "Datos Laborales",
  };

  return (
    <div className="space-y-6">
      {/* Historial de estados */}
      {historialEstados.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cambios de estado</h3>
          <div className="space-y-3">
            {historialEstados.map((h) => (
              <div key={h.id} className="border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE_SMALL[h.estadoAnterior] ?? "bg-slate-800 text-slate-400"}`}>
                      {ESTADO_LABEL_MAP[h.estadoAnterior] ?? h.estadoAnterior}
                    </span>
                    <span className="text-slate-600 text-xs">→</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE_SMALL[h.estadoNuevo] ?? "bg-slate-800 text-slate-400"}`}>
                      {ESTADO_LABEL_MAP[h.estadoNuevo] ?? h.estadoNuevo}
                    </span>
                    <span className="text-sm text-slate-400">{h.usuarioNombre ?? "Usuario desconocido"}</span>
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{fmtFechaHora(h.createdAt)}</span>
                </div>
                {h.motivo && (
                  <p className="mt-2 text-sm text-slate-400 border-t border-slate-800 pt-2">{h.motivo}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de cambios en datos */}
      {auditLogs.length > 0 && (
        <div>
          {historialEstados.length > 0 && (
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cambios en datos</h3>
          )}
          <div className="space-y-4">
            {auditLogs.map((log) => {
              const cambios: { campo: string; anterior: string; nuevo: string }[] = JSON.parse(log.cambios);
              return (
                <div key={log.id} className="border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SECCION_BADGE[log.seccion] ?? "bg-slate-800 text-slate-400"}`}>
                        {SECCION_LABEL[log.seccion] ?? log.seccion}
                      </span>
                      <span className="text-sm font-medium text-slate-200">
                        {log.usuarioNombre ?? "Usuario desconocido"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">{fmtFechaHora(log.createdAt)}</span>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {cambios.map((c, i) => (
                      <div key={i} className="py-2 grid grid-cols-[1fr_auto_1fr] gap-3 items-start text-sm">
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">{c.campo}</p>
                          <p className="text-slate-400 line-through">{c.anterior}</p>
                        </div>
                        <span className="text-slate-600 mt-5">→</span>
                        <div className="mt-5">
                          <p className="text-slate-200 font-medium">{c.nuevo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Comentarios ──────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-.867 12.142A2 2 0 0115.138 21H8.862a2 2 0 01-1.995-1.858L6 7" />
    </svg>
  );
}

function TabComentarios({ agenteId, comentarios, canEdit }: {
  agenteId: string;
  comentarios: ComentarioEntry[];
  canEdit: boolean;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAgregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const textoLimpio = texto.trim();
    if (!textoLimpio) return;
    startTransition(async () => {
      try {
        await crearComentario(agenteId, textoLimpio);
        setTexto("");
        setMostrarForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al agregar la constancia");
      }
    });
  }

  function handleEliminar(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarComentario(id);
        setConfirmarEliminarId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar la constancia");
      }
    });
  }

  return (
    <div className="space-y-6">
      {canEdit && (
        mostrarForm ? (
          <form onSubmit={handleAgregar} className="space-y-2">
            <textarea
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Dejá una constancia sobre este legajo (ej. alta médica, cambio de situación, etc.)"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setMostrarForm(false); setTexto(""); setError(null); }}
                disabled={pending}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !texto.trim()}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Agregar constancia"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors group"
          >
            <span className="w-8 h-8 rounded-full border border-slate-700 flex items-center justify-center shrink-0 transition-colors group-hover:border-blue-500 group-hover:text-blue-400">
              <PlusIcon />
            </span>
            Agregar constancia
          </button>
        )
      )}

      {comentarios.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-4">📝</p>
          <p className="text-sm font-medium text-slate-400">Sin constancias</p>
          <p className="text-xs text-slate-500 mt-1">Las constancias que se dejen sobre este legajo aparecerán acá.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comentarios.map((c) => (
            <div key={c.id} className="border border-slate-800 rounded-lg p-4">
              {confirmarEliminarId === c.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarId(null)} />
                  <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                    <h2 className="text-base font-semibold text-slate-100">Eliminar constancia</h2>
                    <p className="text-sm text-slate-400">¿Eliminás esta constancia? No se puede deshacer.</p>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setConfirmarEliminarId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                      <button type="button" onClick={() => handleEliminar(c.id)} disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Eliminando..." : "Sí, eliminar"}</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-medium text-slate-200">{c.usuarioNombre ?? "Usuario desconocido"}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 tabular-nums">{fmtFechaHora(c.createdAt)}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setConfirmarEliminarId(c.id)}
                      aria-label="Eliminar constancia"
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-300 whitespace-pre-wrap">{c.texto}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tabs: edición ────────────────────────────────────────────────────────────

const ESTADO_CIVIL_OPTIONS = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Conviviente", "Separado/a"].map((v) => ({ value: v, label: v }));
const GRUPO_SANGUINEO_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"].map((v) => ({ value: v, label: v }));
const NIVEL_OPTIONS = ["Completo", "Incompleto", "En curso"].map((v) => ({ value: v, label: v }));
const TURNO_OPTIONS = ["A","B","C","D","E","F","ADMINISTRATIVO","FULL TIME","GUARDIA LARGA","SUPERIOR DE TURNO","PERSONAL INGRESANTE"].map((v) => ({ value: v, label: v }));

function EditTabPersonal({ form, setForm }: {
  form: DatosPersonales;
  setForm: React.Dispatch<React.SetStateAction<DatosPersonales>>;
}) {
  const set = <K extends keyof DatosPersonales>(key: K) => (v: DatosPersonales[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  return (
    <div className="space-y-8">
      <Section title="Identidad">
        {/* CUIL, sexo y fechaNacimiento son inmutables — solo lectura */}
        <InputEdit label="Nombres" value={form.nombres} onChange={set("nombres")} />
        <InputEdit label="Apellidos" value={form.apellidos} onChange={set("apellidos")} />
        <SelectEdit label="Estado civil" value={form.estadoCivil} onChange={set("estadoCivil")} options={ESTADO_CIVIL_OPTIONS} />
        <InputEdit label="Nacionalidad" value={form.nacionalidad} onChange={set("nacionalidad")} />
        <InputEdit label="Provincia de origen" value={form.provinciaOrigen} onChange={set("provinciaOrigen")} />
        <InputEdit label="Ciudad de origen" value={form.ciudadOrigen} onChange={set("ciudadOrigen")} />
      </Section>

      <div className="border-t border-slate-800" />

      <Section title="Salud">
        <SelectEdit label="Grupo sanguíneo" value={form.grupoSanguineo} onChange={set("grupoSanguineo")} options={GRUPO_SANGUINEO_OPTIONS} />
        <InputEdit label="Alergias" value={form.alergias} onChange={set("alergias")} />
        <InputEdit label="Enfermedades crónicas" value={form.enfermedadesCronicas} onChange={set("enfermedadesCronicas")} />
        <InputEdit label="Medicamentos" value={form.medicamentos} onChange={set("medicamentos")} />
        <InputEdit label="Cirugías" value={form.cirugias} onChange={set("cirugias")} />
      </Section>

      <div className="border-t border-slate-800" />

      <Section title="Contacto">
        <InputEdit label="Email" value={form.email} onChange={set("email")} type="email" />
        <InputEdit label="Teléfono" value={form.telefono} onChange={set("telefono")} />
        <InputEdit label="Teléfono alternativo" value={form.telefonoAlternativo} onChange={set("telefonoAlternativo")} />
        <div className="col-span-full">
          <InputEdit label="Contacto de emergencia" value={form.contactoEmergencia} onChange={set("contactoEmergencia")} />
        </div>
      </Section>

      <div className="border-t border-slate-800" />

      <Section title="Domicilio">
        <InputEdit label="Domicilio real" value={form.domicilioReal} onChange={set("domicilioReal")} />
        {/* Espaciadores: fuerzan el salto de fila en md:grid-cols-3 para que
            Domicilio real quede solo en su línea y Número/Barrio/Ciudad
            queden alineados juntos en la siguiente. */}
        <div className="hidden md:block" aria-hidden="true" />
        <div className="hidden md:block" aria-hidden="true" />
        <InputEdit label="Número" value={form.nroDomicilio} onChange={set("nroDomicilio")} />
        <InputEdit label="Barrio" value={form.barrio} onChange={set("barrio")} />
        <InputEdit label="Ciudad" value={form.ciudad} onChange={set("ciudad")} />
        <InputEdit label="Piso" value={form.piso} onChange={set("piso")} />
      </Section>

      <div className="border-t border-slate-800" />

      <Section title="Familia y beneficios">
        <NumEdit label="Hijos a cargo" value={form.hijosCargo} onChange={set("hijosCargo")} />
        <CheckEdit label="Posee servicio de sepelio" checked={form.poseeSepelio} onChange={set("poseeSepelio")} />
        {form.poseeSepelio && (
          <InputEdit label="Empresa de sepelio" value={form.empresaSepelio} onChange={set("empresaSepelio")} />
        )}
      </Section>
    </div>
  );
}

function EditTabLaboral({ form, setForm, agente, rangos, sectores }: {
  form: DatosLaborales;
  setForm: React.Dispatch<React.SetStateAction<DatosLaborales>>;
  agente: AgenteDetalle;
  rangos: RangoOption[];
  sectores: SectorOption[];
}) {
  const set = <K extends keyof DatosLaborales>(key: K) => (v: DatosLaborales[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  const esSeguridad = agente.tipoPersonal === "SEGURIDAD";
  const esTecnico = agente.tipoPersonal === "TECNICO";
  const tieneRango = esSeguridad || esTecnico;

  const cuerposValidos = esSeguridad ? ["SUBOFICIAL", "OFICIAL"] : esTecnico ? ["TECNICO"] : [];
  const rangosFiltrados = rangos.filter((r) => cuerposValidos.includes(r.cuerpo));

  return (
    <div className="space-y-8">
      <Section title="Información laboral">
        {/* tipoPersonal, fechaIngreso y estado son inmutables en este formulario */}
        <SelectEdit label="Turno" value={form.turno} onChange={set("turno")} options={TURNO_OPTIONS} />
        <SelectEdit
          label="Sector"
          value={form.sectorId}
          onChange={set("sectorId")}
          options={sectores.map((s) => ({ value: s.id, label: s.nombre }))}
        />
        {tieneRango && (
          <>
            <SelectEdit
              label="Jerarquía / Rango"
              value={form.rangoId}
              onChange={set("rangoId")}
              options={rangosFiltrados.map((r) => ({ value: r.id, label: r.nombre }))}
            />
            <CheckEdit
              label="Perteneció al E.T.A.C."
              checked={form.perteneceETAC}
              onChange={set("perteneceETAC")}
            />
          </>
        )}
        <SelectEdit
          label="Origen institucional"
          value={form.origenInstitucional}
          onChange={set("origenInstitucional")}
          options={ORIGENES_INSTITUCIONALES.map((o) => ({ value: o, label: ORIGEN_LABEL[o] }))}
        />
        {form.origenInstitucional === "OTRA_DEPENDENCIA" && (
          <InputEdit
            label="Especificar dependencia"
            value={form.origenInstitucionalDetalle}
            onChange={set("origenInstitucionalDetalle")}
          />
        )}
      </Section>

      {esSeguridad && (
        <>
          <div className="border-t border-slate-800" />
          <Section title="Armamento">
            <InputEdit label="Tipo de arma" value={form.tipoArma} onChange={set("tipoArma")} />
            <InputEdit label="Marca de pistola" value={form.marcaPistola} onChange={set("marcaPistola")} />
            <InputEdit label="Modelo de pistola" value={form.modeloPistola} onChange={set("modeloPistola")} />
            <InputEdit label="Calibre" value={form.calibre} onChange={set("calibre")} />
          </Section>

          <div className="border-t border-slate-800" />
          <Section title="Chaleco">
            <CheckEdit label="Chaleco provisto" checked={form.chalecoProvisto} onChange={set("chalecoProvisto")} />
            <InputEdit label="Marca" value={form.marcaChaleco} onChange={set("marcaChaleco")} />
            <InputEdit label="N° de serie / Placas" value={form.nroSeriePlacas} onChange={set("nroSeriePlacas")} />
            <InputEdit label="Talle" value={form.talleChaleco} onChange={set("talleChaleco")} />
            <InputEdit label="Vencimiento del chaleco" value={form.vencimientoChaleco} onChange={set("vencimientoChaleco")} type="date" />
          </Section>

          <div className="border-t border-slate-800" />
          <Section title="Situación de revista">
            <CheckEdit label="Tarea No Operativa (TNO)" checked={form.enTNO} onChange={set("enTNO")} />
            {form.enTNO && (
              <>
                <InputEdit label="Motivo" value={form.motivoTNO} onChange={set("motivoTNO")} />
                <InputEdit label="Desde" value={form.fechaInicioTNO} onChange={set("fechaInicioTNO")} type="date" />
              </>
            )}
          </Section>
        </>
      )}

      <div className="border-t border-slate-800" />

      <Section title="Licencia de conducir">
        <InputEdit label="Categoría" value={form.licenciaConducir} onChange={set("licenciaConducir")} />
        <InputEdit label="Fecha de emisión" value={form.licenciaEmision} onChange={set("licenciaEmision")} type="date" />
        <InputEdit label="Fecha de vencimiento" value={form.licenciaVencimiento} onChange={set("licenciaVencimiento")} type="date" />
      </Section>

      <div className="border-t border-slate-800" />

      <Section title="Nivel académico">
        <SelectEdit label="Primario" value={form.nivelPrimario} onChange={set("nivelPrimario")} options={NIVEL_OPTIONS} />
        <SelectEdit label="Secundario" value={form.nivelSecundario} onChange={set("nivelSecundario")} options={NIVEL_OPTIONS} />
        <SelectEdit label="Terciario" value={form.nivelTerciario} onChange={set("nivelTerciario")} options={NIVEL_OPTIONS} />
        <SelectEdit label="Universitario" value={form.nivelUniversitario} onChange={set("nivelUniversitario")} options={NIVEL_OPTIONS} />
        <SelectEdit label="Superior" value={form.nivelSuperior} onChange={set("nivelSuperior")} options={NIVEL_OPTIONS} />
        <div className="col-span-full">
          <InputEdit label="Detalle de títulos / estudios" value={form.detalleTitulos} onChange={set("detalleTitulos")} />
        </div>
      </Section>
    </div>
  );
}

// ─── Tabs navigation ──────────────────────────────────────────────────────────

type TabId = "personal" | "laboral" | "historial" | "cambios" | "comentarios" | "licencias" | "asistencia";

const TABS: { id: TabId; label: string; locked?: boolean }[] = [
  { id: "personal", label: "Datos Personales" },
  { id: "laboral", label: "Datos Laborales" },
  { id: "historial", label: "Historial de Rangos" },
  { id: "cambios", label: "Historial de Cambios" },
  { id: "comentarios", label: "Constancias" },
  { id: "licencias", label: "Licencias y Ausentismo" },
  { id: "asistencia", label: "Asistencia", locked: true },
];

const TABS_EDITABLES: TabId[] = ["personal", "laboral"];

// ─── Contador de permiso temporal ─────────────────────────────────────────────

const TOTAL_MS = 48 * 60 * 60 * 1000;
const R = 14;
const CIRCUNFERENCIA = 2 * Math.PI * R;

function ContadorPermiso({ permisoHasta }: { permisoHasta: string }) {
  const calcMs = () => Math.max(0, new Date(permisoHasta).getTime() - Date.now());
  const [msRestantes, setMsRestantes] = useState(calcMs);

  useEffect(() => {
    const interval = setInterval(() => setMsRestantes(calcMs()), 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisoHasta]);

  const fraccion = Math.min(1, msRestantes / TOTAL_MS);
  const horas = Math.floor(msRestantes / (60 * 60 * 1000));
  const minutos = Math.floor((msRestantes % (60 * 60 * 1000)) / 60_000);
  const dashoffset = CIRCUNFERENCIA * (1 - fraccion);

  const color =
    fraccion > 0.33 ? "#16a34a" : fraccion > 0.1 ? "#d97706" : "#dc2626";

  const label =
    horas > 0 ? `${horas}h ${minutos}m` : `${minutos}m`;

  return (
    <div
      className="flex items-center gap-2"
      title={`Permiso de edición vence el ${new Date(permisoHasta).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
    >
      <svg width="34" height="34" viewBox="0 0 36 36" className="shrink-0">
        {/* Pista */}
        <circle cx="18" cy="18" r={R} fill="none" stroke="#334155" strokeWidth="3" />
        {/* Progreso */}
        <circle
          cx="18" cy="18" r={R}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
        {/* Manecilla horaria (decorativa) */}
        <line
          x1="18" y1="18"
          x2={18 + 6 * Math.cos((fraccion * 2 * Math.PI) - Math.PI / 2)}
          y2={18 + 6 * Math.sin((fraccion * 2 * Math.PI) - Math.PI / 2)}
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Punto central */}
        <circle cx="18" cy="18" r="1.5" fill={color} />
      </svg>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LegajoTabs({
  agente,
  canEdit,
  esOperador = false,
  rangos,
  sectores,
  auditLogs = [],
  historialEstados = [],
  comentarios = [],
  licencias = [],
  licenciasPendientes = [],
  canManageLicencias = false,
  feriados = [],
  permisoHasta,
  tabInicial,
  remitenteWhatsapp,
}: {
  agente: AgenteDetalle;
  canEdit: boolean;
  /** Rol OPERADOR viendo el legajo de otra persona (nunca el propio, ver
   * /mi-legajo): puede ver todos los legajos, pero con pestañas y secciones
   * restringidas para cuidar datos sensibles (licencias, historial,
   * armamento de Seguridad). No afecta a otros roles. */
  esOperador?: boolean;
  rangos: RangoOption[];
  sectores: SectorOption[];
  auditLogs?: AuditLogEntry[];
  historialEstados?: HistorialEstadoEntry[];
  comentarios?: ComentarioEntry[];
  licencias?: LicenciaEntry[];
  licenciasPendientes?: LicenciaPendienteEntry[];
  canManageLicencias?: boolean;
  feriados?: Feriado[];
  permisoHasta?: string | null;
  tabInicial?: TabId;
  remitenteWhatsapp?: RemitenteWhatsapp;
}) {
  // Seguridad y Técnico (personal con jerarquía/uniformado): para un
  // Operador, solo se ven Datos Personales y Datos Laborales — ni siquiera
  // Asistencia. Civil Becario/Policial: se ve todo excepto Historial de
  // Rangos, Historial de Cambios, Constancias y Licencias y Ausentismo.
  const tipoRestringido = agente.tipoPersonal === "SEGURIDAD" || agente.tipoPersonal === "TECNICO";
  const tabsOcultas: TabId[] = esOperador
    ? tipoRestringido
      ? ["historial", "cambios", "comentarios", "licencias", "asistencia"]
      : ["historial", "cambios", "comentarios", "licencias"]
    : [];
  const tabsVisibles = TABS.filter((tab) => !tabsOcultas.includes(tab.id));
  const tabInicialSegura: TabId =
    tabInicial && !tabsOcultas.includes(tabInicial) ? tabInicial : "personal";

  const [activeTab, setActiveTab] = useState<TabId>(tabInicialSegura);
  const [editando, setEditando] = useState(false);
  const [formPersonal, setFormPersonal] = useState<DatosPersonales>(() => initPersonal(agente));
  const [formLaboral, setFormLaboral] = useState<DatosLaborales>(() => initLaboral(agente));
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tabsNavRef = useRef<HTMLElement>(null);
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });
  const tabButtonRefs = useRef<Partial<Record<TabId, HTMLButtonElement>>>({});
  const [indicador, setIndicador] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    function actualizarIndicador() {
      const btn = tabButtonRefs.current[activeTab];
      if (btn) setIndicador({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
    actualizarIndicador();
    window.addEventListener("resize", actualizarIndicador);
    return () => window.removeEventListener("resize", actualizarIndicador);
  }, [activeTab]);

  function actualizarTabScroll() {
    const el = tabsNavRef.current;
    if (!el) return;
    setTabScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    actualizarTabScroll();
    const el = tabsNavRef.current;
    if (!el) return;
    const ro = new ResizeObserver(actualizarTabScroll);
    ro.observe(el);
    window.addEventListener("resize", actualizarTabScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", actualizarTabScroll);
    };
  }, []);

  function desplazarTabs(direccion: 1 | -1) {
    const el = tabsNavRef.current;
    if (!el) return;
    el.scrollBy({ left: direccion * Math.round(el.clientWidth * 0.7), behavior: "smooth" });
  }

  const tabEditable = TABS_EDITABLES.includes(activeTab);

  function handleCambiarTab(tabId: TabId) {
    if (editando) {
      setEditando(false);
      setErrorEdit(null);
    }
    setActiveTab(tabId);
  }

  function handleEditar() {
    setFormPersonal(initPersonal(agente));
    setFormLaboral(initLaboral(agente));
    setErrorEdit(null);
    setEditando(true);
  }

  function handleCancelar() {
    setFormPersonal(initPersonal(agente));
    setFormLaboral(initLaboral(agente));
    setErrorEdit(null);
    setEditando(false);
  }

  function handleGuardar() {
    setErrorEdit(null);
    startTransition(async () => {
      try {
        if (activeTab === "personal") {
          await actualizarAgentePersonal(agente.id, formPersonal);
        } else if (activeTab === "laboral") {
          await actualizarAgenteLaboral(agente.id, formLaboral);
        }
        setEditando(false);
      } catch {
        setErrorEdit("Ocurrió un error al guardar. Intentá de nuevo.");
      }
    });
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-slate-700 flex items-stretch">
        {tabScroll.left && (
          <button
            type="button"
            onClick={() => desplazarTabs(-1)}
            aria-label="Desplazar pestañas hacia la izquierda"
            className="shrink-0 flex items-center justify-center w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <ChevronLeftIcon />
          </button>
        )}

        <nav
          ref={tabsNavRef}
          onScroll={actualizarTabScroll}
          className={`relative -mb-px flex gap-0 overflow-x-auto no-scrollbar scroll-smooth ${
            tabScroll.left ? "" : "pl-6"
          } ${tabScroll.right ? "" : "pr-6"}`}
        >
          {tabsVisibles.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el ?? undefined;
                }}
                onClick={() => !tab.locked && handleCambiarTab(tab.id)}
                disabled={tab.locked}
                className={`
                  flex items-center gap-1.5 whitespace-nowrap px-4 py-3.5 text-sm font-medium border-b-2 border-transparent transition-colors
                  ${isActive
                    ? "text-blue-400"
                    : tab.locked
                      ? "text-slate-600 cursor-not-allowed"
                      : "text-slate-400 hover:text-slate-300 hover:border-slate-700 cursor-pointer"
                  }
                `}
              >
                {tab.label}
                {tab.locked && (
                  <svg className="w-3 h-3 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
          {indicador && (
            <span
              className="absolute bottom-0 h-0.5 bg-blue-500 transition-all duration-300 ease-out"
              style={{ left: indicador.left, width: indicador.width }}
            />
          )}
        </nav>

        {tabScroll.right && (
          <button
            type="button"
            onClick={() => desplazarTabs(1)}
            aria-label="Desplazar pestañas hacia la derecha"
            className="shrink-0 flex items-center justify-center w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <ChevronRightIcon />
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">

        {/* Barra de edición — solo en tabs editables y para admins */}
        {canEdit && tabEditable && (
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              {errorEdit && <p className="text-sm text-red-400">{errorEdit}</p>}
              {editando && !errorEdit && (
                <p className="text-xs text-slate-500">
                  El CUIL, sexo y fecha de nacimiento no se pueden modificar.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!editando ? (
                <button
                  type="button"
                  onClick={handleEditar}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors"
                >
                  <PencilIcon />
                  Editar
                </button>
              ) : (
                <>
                  {permisoHasta && <ContadorPermiso permisoHasta={permisoHasta} />}
                  <button
                    type="button"
                    onClick={handleCancelar}
                    disabled={pending}
                    className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardar}
                    disabled={pending}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  >
                    {pending ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Contenido del tab */}
        {activeTab === "personal" && (
          editando
            ? <EditTabPersonal form={formPersonal} setForm={setFormPersonal} />
            : <TabPersonal a={agente} remitenteWhatsapp={remitenteWhatsapp} />
        )}
        {activeTab === "laboral" && (
          editando
            ? <EditTabLaboral form={formLaboral} setForm={setFormLaboral} agente={agente} rangos={rangos} sectores={sectores} />
            : <TabLaboral a={agente} esOperador={esOperador} />
        )}
        {activeTab === "historial" && (
          <TabHistorial
            agenteId={agente.id}
            historialRangos={agente.historialRangos}
            tipoPersonal={agente.tipoPersonal}
            fechaInicioCursoAscenso={agente.fechaInicioCursoAscenso}
            canEdit={canEdit}
          />
        )}
        {activeTab === "cambios" && <TabCambios auditLogs={auditLogs} historialEstados={historialEstados} />}
        {activeTab === "comentarios" && (
          <TabComentarios agenteId={agente.id} comentarios={comentarios} canEdit={canEdit} />
        )}
        {activeTab === "licencias" && (
          <TabLicencias
            agenteId={agente.id}
            agenteInfo={{
              nombreCompleto: `${agente.apellidos}, ${agente.nombres}`,
              cuil: agente.cuil,
              rango: agente.rango?.nombre ?? null,
              sector: agente.sector?.nombre ?? null,
              fotoUrl: agente.fotoUrl,
              sexo: agente.sexo,
            }}
            licencias={licencias}
            licenciasPendientes={licenciasPendientes}
            canManage={canManageLicencias}
            feriados={feriados}
          />
        )}
        {activeTab === "asistencia" && <TabProximamente label="Asistencia" />}
      </div>
    </div>
  );
}

// ─── Tab Licencias y Ausentismo ───────────────────────────────────────────────

const TIPO_LICENCIA_BADGE: Record<string, string> = Object.fromEntries(
  Object.entries(LICENCIA_CATEGORIA_DE_TIPO).map(([tipo, categoria]) => [tipo, CATEGORIA_LICENCIA_INFO[categoria].badge])
);

const TIPO_LICENCIA_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(LICENCIA_CATEGORIA_DE_TIPO).map(([tipo, categoria]) => [tipo, CATEGORIA_LICENCIA_INFO[categoria].emoji])
);

// Selector en cascada (categoría → subtipo) para el <select name="tipo"> de
// los formularios de licencia. El segundo select sigue siendo *uncontrolled*
// (se lee por FormData en el submit, igual que el resto del form) — el
// key={categoria} fuerza a React a remontarlo y reaplicar su defaultValue
// cada vez que cambia la categoría elegida.
function SelectorTipoLicencia({ defaultValue }: { defaultValue?: TipoLicencia }) {
  const [categoria, setCategoria] = useState<CategoriaLicencia>(
    defaultValue ? LICENCIA_CATEGORIA_DE_TIPO[defaultValue] : CATEGORIAS_LICENCIA[0].value
  );

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Categoría</label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaLicencia)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CATEGORIAS_LICENCIA.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
        <select
          key={categoria}
          name="tipo"
          required
          defaultValue={defaultValue && LICENCIA_CATEGORIA_DE_TIPO[defaultValue] === categoria ? defaultValue : undefined}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {LICENCIA_TIPOS_POR_CATEGORIA[categoria].map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}

const TIPO_PENDIENTE_LABELS: Record<string, string> = {
  ANUAL_ORDINARIA: "Anual Ordinaria",
  DIA_ESTIMULO: "Día Estímulo",
  OTRO: "Otro",
};

const TIPO_PENDIENTE_BADGE: Record<string, string> = {
  ANUAL_ORDINARIA: "bg-blue-500/15 text-blue-300",
  DIA_ESTIMULO: "bg-pink-500/15 text-pink-400",
  OTRO: "bg-slate-800 text-slate-400",
};

function labelUnidad(unidad: string, cantidad: number): string {
  const esHabiles = unidad === "HABILES";
  if (cantidad === 1) return esHabiles ? "día hábil" : "día corrido";
  return esHabiles ? "días hábiles" : "días corridos";
}

function labelDias(cantidad: number): string {
  return cantidad === 1 ? "día" : "días";
}

function estadoPendiente(cantidadDias: number, usos: UsoLicenciaPendienteEntry[]): "PENDIENTE" | "PARCIAL" | "USADA" {
  const usado = usos.reduce((acc, u) => acc + u.cantidadDias, 0);
  if (usado <= 0) return "PENDIENTE";
  if (usado >= cantidadDias) return "USADA";
  return "PARCIAL";
}

const ESTADO_PENDIENTE_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Usada parcial",
  USADA: "Usada",
};

const ESTADO_PENDIENTE_BADGE: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/15 text-yellow-400",
  PARCIAL: "bg-orange-500/15 text-orange-400",
  USADA: "bg-green-500/15 text-green-400",
};

function NuevaLicenciaSkeleton() {
  return (
    <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 space-y-3">
      <div className="h-4 w-28 rounded skeleton-shimmer" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <div className="h-3 w-10 rounded skeleton-shimmer mb-1" />
          <div className="h-[38px] rounded-lg border border-slate-800 skeleton-shimmer" />
        </div>
        <div>
          <div className="h-3 w-16 rounded skeleton-shimmer mb-1" />
          <div className="h-[38px] rounded-lg border border-slate-800 skeleton-shimmer" />
        </div>
        <div>
          <div className="h-3 w-14 rounded skeleton-shimmer mb-1" />
          <div className="h-[38px] rounded-lg border border-slate-800 skeleton-shimmer" />
        </div>
        <div>
          <div className="h-3 w-12 rounded skeleton-shimmer mb-1" />
          <div className="h-[38px] rounded-lg border border-slate-800 skeleton-shimmer" />
        </div>
        <div>
          <div className="h-3 w-32 rounded skeleton-shimmer mb-1" />
          <div className="h-[38px] rounded-lg border border-slate-800 skeleton-shimmer" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <div className="h-9 w-24 rounded-lg border border-slate-800 skeleton-shimmer" />
        <div className="h-9 w-24 rounded-lg skeleton-shimmer" />
      </div>
    </div>
  );
}

// Calcula la fecha de fin sumando `dias` días hábiles a partir de fechaInicio
// (el propio día de inicio cuenta como el primer día), salteando sábados,
// domingos y los feriados marcados con aplica=true.
function calcularFechaFinHabil(fechaInicioISO: string, dias: number, feriadosAplican: Set<string>): string {
  if (!fechaInicioISO || dias < 1) return "";
  const [anio, mes, dia] = fechaInicioISO.split("-").map(Number);
  let cursor = Date.UTC(anio, mes - 1, dia);
  let contados = 0;
  while (contados < dias) {
    const fecha = new Date(cursor);
    const esFinde = fecha.getUTCDay() === 0 || fecha.getUTCDay() === 6;
    const iso = fecha.toISOString().slice(0, 10);
    if (!esFinde && !feriadosAplican.has(iso)) {
      contados++;
      if (contados === dias) return iso;
    }
    cursor += 86_400_000;
  }
  return "";
}

// Calcula la fecha de fin sumando `dias` días corridos a partir de
// fechaInicio (sin saltear fines de semana ni feriados), con el mismo
// criterio que diasCorridos() en app/actions/licencias.ts: fechaInicio
// cuenta como el primer día, así que se suman (dias - 1) días de calendario.
function calcularFechaFinCorrida(fechaInicioISO: string, dias: number): string {
  if (!fechaInicioISO || dias < 1) return "";
  const [anio, mes, dia] = fechaInicioISO.split("-").map(Number);
  const cursor = Date.UTC(anio, mes - 1, dia) + (dias - 1) * 86_400_000;
  return new Date(cursor).toISOString().slice(0, 10);
}

function TabLicencias({
  agenteId,
  agenteInfo,
  licencias,
  licenciasPendientes,
  canManage,
  feriados,
}: {
  agenteId: string;
  agenteInfo: AgenteInfoInforme;
  licencias: LicenciaEntry[];
  licenciasPendientes: LicenciaPendienteEntry[];
  canManage: boolean;
  feriados: Feriado[];
}) {
  const [subTab, setSubTab] = useState<"licencias" | "pendientes" | "estadisticas">("licencias");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [abriendoFormLicencia, setAbriendoFormLicencia] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState<string | null>(null);
  const [usoFormId, setUsoFormId] = useState<string | null>(null);
  const [confirmarEliminarUsoId, setConfirmarEliminarUsoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const abrirFormTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contador automático de días para "Nueva licencia": al activarlo, se
  // calcula Fecha fin sumando días (hábiles o corridos, según el modo
  // elegido) a Fecha inicio en vez de tenerlo que contar a mano en un
  // calendario.
  const [contadorActivo, setContadorActivo] = useState(false);
  const [modoConteo, setModoConteo] = useState<"habiles" | "corridos">("habiles");
  const [diasVacaciones, setDiasVacaciones] = useState("");
  const [fechaInicioForm, setFechaInicioForm] = useState("");
  const [fechaFinForm, setFechaFinForm] = useState("");
  const feriadosAplican = useMemo(
    () => new Set(feriados.filter((f) => f.aplica).map((f) => f.fecha.slice(0, 10))),
    [feriados]
  );

  function calcularFechaFin(fechaInicioISO: string, dias: number, modo: "habiles" | "corridos"): string {
    return modo === "habiles"
      ? calcularFechaFinHabil(fechaInicioISO, dias, feriadosAplican)
      : calcularFechaFinCorrida(fechaInicioISO, dias);
  }

  function actualizarFechaInicioForm(valor: string) {
    setFechaInicioForm(valor);
    if (contadorActivo) {
      const dias = parseInt(diasVacaciones, 10);
      if (dias > 0) setFechaFinForm(calcularFechaFin(valor, dias, modoConteo));
    }
  }

  function actualizarDiasVacaciones(valor: string) {
    setDiasVacaciones(valor);
    const dias = parseInt(valor, 10);
    if (dias > 0 && fechaInicioForm) setFechaFinForm(calcularFechaFin(fechaInicioForm, dias, modoConteo));
  }

  function cambiarModoConteo(modo: "habiles" | "corridos") {
    setModoConteo(modo);
    const dias = parseInt(diasVacaciones, 10);
    if (dias > 0 && fechaInicioForm) setFechaFinForm(calcularFechaFin(fechaInicioForm, dias, modo));
  }

  function toggleContador() {
    setContadorActivo((v) => {
      const activando = !v;
      if (activando) {
        const dias = parseInt(diasVacaciones, 10);
        if (dias > 0 && fechaInicioForm) setFechaFinForm(calcularFechaFin(fechaInicioForm, dias, modoConteo));
      }
      return activando;
    });
  }

  useEffect(() => {
    return () => {
      if (abrirFormTimeout.current) clearTimeout(abrirFormTimeout.current);
    };
  }, []);

  function handleAbrirNuevo() {
    setEditandoId(null);
    setError(null);
    setContadorActivo(false);
    setModoConteo("habiles");
    setDiasVacaciones("");
    setFechaInicioForm("");
    setFechaFinForm("");
    if (subTab === "licencias") {
      setAbriendoFormLicencia(true);
      abrirFormTimeout.current = setTimeout(() => {
        setMostrarForm(true);
        setAbriendoFormLicencia(false);
      }, 350);
    } else {
      setMostrarForm(true);
    }
  }

  function handleCrearLicencia(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await crearLicencia({
          agenteId,
          tipo: fd.get("tipo") as TipoLicencia,
          fechaInicio: fd.get("fechaInicio") as string,
          fechaFin: fd.get("fechaFin") as string,
          motivo: fd.get("motivo") as string,
          observacion: fd.get("observacion") as string,
        });
        setMostrarForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear la licencia");
      }
    });
  }

  function handleEditarLicencia(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await actualizarLicencia(id, {
          tipo: fd.get("tipo") as TipoLicencia,
          fechaInicio: fd.get("fechaInicio") as string,
          fechaFin: fd.get("fechaFin") as string,
          motivo: fd.get("motivo") as string,
          observacion: fd.get("observacion") as string,
        });
        setEditandoId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar la licencia");
      }
    });
  }

  function handleEliminarLicencia(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarLicencia(id);
        setConfirmarEliminarId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar la licencia");
      }
    });
  }

  function handleCrearPendiente(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await crearLicenciaPendiente({
          agenteId,
          tipo: fd.get("tipo") as TipoLicenciaPendiente,
          tipoOtroDetalle: fd.get("tipoOtroDetalle") as string,
          unidad: fd.get("unidad") as UnidadDias,
          anio: parseInt(fd.get("anio") as string),
          cantidadDias: parseInt(fd.get("cantidadDias") as string),
          referencia: fd.get("referencia") as string,
        });
        setMostrarForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el registro");
      }
    });
  }

  function handleEditarPendiente(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await actualizarLicenciaPendiente(id, {
          tipo: fd.get("tipo") as TipoLicenciaPendiente,
          tipoOtroDetalle: fd.get("tipoOtroDetalle") as string,
          unidad: fd.get("unidad") as UnidadDias,
          anio: parseInt(fd.get("anio") as string),
          cantidadDias: parseInt(fd.get("cantidadDias") as string),
          referencia: fd.get("referencia") as string,
        });
        setEditandoId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al actualizar el registro");
      }
    });
  }

  function handleEliminarPendiente(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarLicenciaPendiente(id);
        setConfirmarEliminarId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar el registro");
      }
    });
  }

  function handleRegistrarUso(e: React.FormEvent<HTMLFormElement>, licenciaPendienteId: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await registrarUso(licenciaPendienteId, {
          fecha: fd.get("fecha") as string,
          cantidadDias: parseInt(fd.get("cantidadDias") as string),
          referencia: fd.get("referencia") as string,
        });
        setUsoFormId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al registrar el uso");
      }
    });
  }

  function handleEliminarUso(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await eliminarUso(id);
        setConfirmarEliminarUsoId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar el uso");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Sub-pestañas */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex border border-slate-700 rounded-lg overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              if (abrirFormTimeout.current) clearTimeout(abrirFormTimeout.current);
              setAbriendoFormLicencia(false);
              setSubTab("licencias"); setMostrarForm(false); setEditandoId(null); setError(null);
            }}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "licencias" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
          >
            Licencias
            <span className="ml-1.5 text-xs opacity-70">({licencias.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (abrirFormTimeout.current) clearTimeout(abrirFormTimeout.current);
              setAbriendoFormLicencia(false);
              setSubTab("pendientes"); setMostrarForm(false); setEditandoId(null); setError(null);
            }}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "pendientes" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
          >
            Licencias Pendientes
            <span className="ml-1.5 text-xs opacity-70">({licenciasPendientes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (abrirFormTimeout.current) clearTimeout(abrirFormTimeout.current);
              setAbriendoFormLicencia(false);
              setSubTab("estadisticas"); setMostrarForm(false); setEditandoId(null); setError(null);
            }}
            className={`shrink-0 whitespace-nowrap px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "estadisticas" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
          >
            Estadísticas
          </button>
        </div>

        {canManage && !mostrarForm && !abriendoFormLicencia && subTab !== "estadisticas" && (
          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors w-full sm:w-auto shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {subTab === "licencias" ? "Nueva licencia" : "Nuevo pendiente"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {abriendoFormLicencia && subTab === "licencias" && <NuevaLicenciaSkeleton />}

      {/* Formulario nueva licencia */}
      {mostrarForm && subTab === "licencias" && (
        <form onSubmit={handleCrearLicencia} className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-300">Nueva licencia</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectorTipoLicencia />
            <div className="col-span-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
              <button
                type="button"
                role="switch"
                aria-checked={contadorActivo}
                onClick={toggleContador}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  contadorActivo ? "bg-green-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    contadorActivo ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-slate-300">Contador automático de días</span>
              {contadorActivo && (
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => cambiarModoConteo("habiles")}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        modoConteo === "habiles" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      Hábiles
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarModoConteo("corridos")}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                        modoConteo === "corridos" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      Corridos
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    Días de vacaciones
                    <input
                      type="number"
                      min={1}
                      value={diasVacaciones}
                      onChange={(e) => actualizarDiasVacaciones(e.target.value)}
                      className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                name="fechaInicio"
                required
                value={fechaInicioForm}
                onChange={(e) => actualizarFechaInicioForm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha fin</label>
              <input
                type="date"
                name="fechaFin"
                required
                readOnly={contadorActivo}
                value={fechaFinForm}
                onChange={(e) => setFechaFinForm(e.target.value)}
                className={`w-full rounded-lg border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  contadorActivo ? "bg-slate-800 text-slate-400" : "bg-slate-900"
                }`}
              />
              {contadorActivo && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Calculada automáticamente ({modoConteo === "habiles" ? "días hábiles" : "días corridos"})
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Motivo</label>
              <input type="text" name="motivo" placeholder="Opcional" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Observación interna</label>
              <input type="text" name="observacion" placeholder="Opcional" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setMostrarForm(false); setError(null); }} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      )}

      {/* Formulario nuevo pendiente */}
      {mostrarForm && subTab === "pendientes" && (
        <form onSubmit={handleCrearPendiente} className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-300">Nuevo pendiente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
              <select name="tipo" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(TIPO_PENDIENTE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Detalle (si el tipo es &quot;Otro&quot;)</label>
              <input type="text" name="tipoOtroDetalle" placeholder="Ej: Licencia por estudio" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Unidad</label>
              <select name="unidad" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="HABILES">Días hábiles</option>
                <option value="CORRIDOS">Días corridos</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Año</label>
              <input type="number" name="anio" required defaultValue={new Date().getFullYear()} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cantidad de días</label>
              <input type="number" name="cantidadDias" min="1" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Referencia</label>
              <input type="text" name="referencia" placeholder="Opcional, ej: Día de la mujer 2025" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setMostrarForm(false); setError(null); }} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Guardando..." : "Guardar"}</button>
          </div>
        </form>
      )}

      {/* Lista licencias */}
      {subTab === "licencias" && (
        licencias.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No hay licencias registradas.</p>
        ) : (
          <div className="space-y-2">
            {licencias.map((l) => (
              <div key={l.id}>
                {confirmarEliminarId === l.id && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarId(null)} />
                    <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                      <h2 className="text-base font-semibold text-slate-100">Eliminar licencia</h2>
                      <p className="text-sm text-slate-400">¿Eliminás esta licencia {TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}?</p>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setConfirmarEliminarId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                        <button type="button" onClick={() => handleEliminarLicencia(l.id)} disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Eliminando..." : "Sí, eliminar"}</button>
                      </div>
                    </div>
                  </div>
                )}
                {editandoId === l.id ? (
                  <form onSubmit={(e) => handleEditarLicencia(e, l.id)} className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-300">Editar licencia</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SelectorTipoLicencia defaultValue={l.tipo as TipoLicencia} />
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fecha inicio</label>
                        <input type="date" name="fechaInicio" defaultValue={l.fechaInicio.slice(0, 10)} required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Fecha fin</label>
                        <input type="date" name="fechaFin" defaultValue={l.fechaFin.slice(0, 10)} required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Motivo</label>
                        <input type="text" name="motivo" defaultValue={l.motivo ?? ""} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Observación interna</label>
                        <input type="text" name="observacion" defaultValue={l.observacion ?? ""} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditandoId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                      <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Guardando..." : "Guardar"}</button>
                    </div>
                  </form>
                ) : (
                  <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 ${pending ? "opacity-50" : ""}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 min-w-0">
                      <span className={`mt-0.5 inline-flex items-center justify-between gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 self-start ${TIPO_LICENCIA_BADGE[l.tipo] ?? "bg-slate-800 text-slate-400"}`}>
                        {TIPO_LICENCIA_LABELS[l.tipo] ?? l.tipo}
                        <span>{TIPO_LICENCIA_EMOJI[l.tipo]}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">
                          {fmt(l.fechaInicio)} → {fmt(l.fechaFin)}
                          <span className="ml-2 text-xs text-slate-400">{l.diasHabiles} {labelDias(l.diasHabiles)}</span>
                        </p>
                        {l.motivo && <p className="text-xs text-slate-400 mt-0.5">{l.motivo}</p>}
                        {l.observacion && <p className="text-xs text-slate-500 italic mt-0.5">{l.observacion}</p>}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                        <button type="button" onClick={() => { setEditandoId(l.id); setMostrarForm(false); setError(null); }} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-700 transition-colors" title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button type="button" onClick={() => setConfirmarEliminarId(l.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {subTab === "estadisticas" && <EstadisticasLicencias licencias={licencias} agente={agenteInfo} />}

      {/* Lista licencias pendientes */}
      {subTab === "pendientes" && (
        licenciasPendientes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">No hay licencias pendientes registradas.</p>
        ) : (
          <div className="space-y-2">
            {licenciasPendientes.map((p) => {
              const diasUsados = p.usos.reduce((acc, u) => acc + u.cantidadDias, 0);
              const diasRestantes = p.cantidadDias - diasUsados;
              const estado = estadoPendiente(p.cantidadDias, p.usos);
              const tipoLabel = p.tipo === "OTRO" && p.tipoOtroDetalle ? p.tipoOtroDetalle : TIPO_PENDIENTE_LABELS[p.tipo] ?? p.tipo;

              return (
                <div key={p.id}>
                  {confirmarEliminarId === p.id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarId(null)} />
                      <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                        <h2 className="text-base font-semibold text-slate-100">Eliminar pendiente</h2>
                        <p className="text-sm text-slate-400">¿Eliminás este registro {tipoLabel} de {p.anio}? Se borra también su historial de usos.</p>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setConfirmarEliminarId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                          <button type="button" onClick={() => handleEliminarPendiente(p.id)} disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Eliminando..." : "Sí, eliminar"}</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {confirmarEliminarUsoId && p.usos.some((u) => u.id === confirmarEliminarUsoId) && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarEliminarUsoId(null)} />
                      <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
                        <h2 className="text-base font-semibold text-slate-100">Eliminar uso</h2>
                        <p className="text-sm text-slate-400">¿Eliminás este registro de uso? Los días vuelven a quedar disponibles.</p>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setConfirmarEliminarUsoId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                          <button type="button" onClick={() => handleEliminarUso(confirmarEliminarUsoId)} disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Eliminando..." : "Sí, eliminar"}</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {editandoId === p.id ? (
                    <form onSubmit={(e) => handleEditarPendiente(e, p.id)} className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-4 space-y-3">
                      <p className="text-sm font-medium text-slate-300">Editar pendiente</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
                          <select name="tipo" defaultValue={p.tipo} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {Object.entries(TIPO_PENDIENTE_LABELS).map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Detalle (si el tipo es &quot;Otro&quot;)</label>
                          <input type="text" name="tipoOtroDetalle" defaultValue={p.tipoOtroDetalle ?? ""} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Unidad</label>
                          <select name="unidad" defaultValue={p.unidad} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="HABILES">Días hábiles</option>
                            <option value="CORRIDOS">Días corridos</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Año</label>
                          <input type="number" name="anio" defaultValue={p.anio} required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Cantidad de días</label>
                          <input type="number" name="cantidadDias" defaultValue={p.cantidadDias} min="1" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Referencia</label>
                          <input type="text" name="referencia" defaultValue={p.referencia ?? ""} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setEditandoId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50">{pending ? "Guardando..." : "Guardar"}</button>
                      </div>
                    </form>
                  ) : (
                    <div className={`rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 ${pending ? "opacity-50" : ""}`}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-3 min-w-0">
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 self-start ${TIPO_PENDIENTE_BADGE[p.tipo] ?? "bg-slate-800 text-slate-400"}`}>
                            {tipoLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200">
                              {p.anio} — {p.cantidadDias} {labelUnidad(p.unidad, p.cantidadDias)}
                              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_PENDIENTE_BADGE[estado]}`}>
                                {ESTADO_PENDIENTE_LABELS[estado]}
                              </span>
                            </p>
                            {estado !== "PENDIENTE" && (
                              <p className="text-xs text-slate-400 mt-0.5">{diasUsados} usados · {diasRestantes} restantes</p>
                            )}
                            {p.referencia && <p className="text-xs text-slate-400 mt-0.5">{p.referencia}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                          {canManage && estado !== "USADA" && (
                            <button type="button" onClick={() => { setUsoFormId(usoFormId === p.id ? null : p.id); setError(null); }} className="rounded-lg px-2 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors">
                              Registrar uso
                            </button>
                          )}
                          {canManage && (
                            <>
                              <button type="button" onClick={() => { setEditandoId(p.id); setMostrarForm(false); setUsoFormId(null); setError(null); }} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-700 transition-colors" title="Editar">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button type="button" onClick={() => setConfirmarEliminarId(p.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mini-form registrar uso */}
                      {usoFormId === p.id && (
                        <form onSubmit={(e) => handleRegistrarUso(e, p.id)} className="mt-3 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">Fecha</label>
                              <input type="date" name="fecha" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-400 mb-1">Cantidad de días (máx. {diasRestantes})</label>
                              <input type="number" name="cantidadDias" min="1" max={diasRestantes} required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-slate-400 mb-1">Referencia</label>
                              <input type="text" name="referencia" placeholder="Opcional" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setUsoFormId(null)} disabled={pending} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50">Cancelar</button>
                            <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50">{pending ? "Guardando..." : "Guardar"}</button>
                          </div>
                        </form>
                      )}

                      {/* Historial de usos */}
                      {p.usos.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5">
                          {p.usos.map((u) => (
                            <div key={u.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="text-slate-400">
                                {fmt(u.fecha)} — {u.cantidadDias} {labelUnidad(p.unidad, u.cantidadDias)}
                                {u.referencia && <span className="text-slate-500"> · {u.referencia}</span>}
                              </span>
                              {canManage && (
                                <button type="button" onClick={() => setConfirmarEliminarUsoId(u.id)} className="text-slate-500 hover:text-red-400 transition-colors shrink-0" title="Eliminar uso">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
