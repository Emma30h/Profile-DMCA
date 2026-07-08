"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { actualizarAgentePersonal, actualizarAgenteLaboral } from "@/app/actions/agentes";
import type { DatosPersonales, DatosLaborales } from "@/app/actions/agentes";
import { crearLicencia, actualizarLicencia, eliminarLicencia } from "@/app/actions/licencias";
import {
  crearLicenciaPendiente,
  actualizarLicenciaPendiente,
  eliminarLicenciaPendiente,
  registrarUso,
  eliminarUso,
} from "@/app/actions/licenciasPendientes";
import type { TipoLicencia, TipoLicenciaPendiente, UnidadDias } from "@/types";

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
  tipoArma: string | null;
  marcaPistola: string | null;
  modeloPistola: string | null;
  calibre: string | null;
  chalecoProvisto: boolean | null;
  marcaChaleco: string | null;
  nroSeriePlacas: string | null;
  talleChaleco: string | null;
  vencimientoChaleco: string | null;
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

/** Deriva el DNI a partir del CUIL (formato XX-DNI(8)-X). */
function cuilToDni(cuil: string): string {
  const digits = cuil.replace(/\D/g, "");
  if (digits.length !== 11) return digits;
  const dniConCeros = digits.slice(2, 10);
  return dniConCeros.replace(/^0+/, "") || dniConCeros;
}

// ─── Form state ───────────────────────────────────────────────────────────────

function initPersonal(a: AgenteDetalle): DatosPersonales {
  return {
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
    tipoArma: a.tipoArma ?? "",
    marcaPistola: a.marcaPistola ?? "",
    modeloPistola: a.modeloPistola ?? "",
    calibre: a.calibre ?? "",
    chalecoProvisto: a.chalecoProvisto ?? false,
    marcaChaleco: a.marcaChaleco ?? "",
    nroSeriePlacas: a.nroSeriePlacas ?? "",
    talleChaleco: a.talleChaleco ?? "",
    vencimientoChaleco: toDateInput(a.vencimientoChaleco),
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
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">{children}</div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-sm ${value === "—" ? "text-slate-600" : "text-slate-200"}`}>{value}</p>
    </div>
  );
}

// ─── Tabs: vista (solo lectura) ───────────────────────────────────────────────

function TabPersonal({ a }: { a: AgenteDetalle }) {
  return (
    <div className="space-y-8">
      <Section title="Identidad">
        <Field label="DNI" value={cuilToDni(a.cuil)} />
        <Field label="CUIL" value={a.cuil} />
        <Field label="Sexo" value={val(a.sexo)} />
        <Field label="Fecha de nacimiento" value={fmt(a.fechaNacimiento)} />
        <Field label="Estado civil" value={val(a.estadoCivil)} />
        <Field label="Nacionalidad" value={val(a.nacionalidad)} />
        <Field label="Provincia de origen" value={val(a.provinciaOrigen)} />
        <Field label="Ciudad de origen" value={val(a.ciudadOrigen)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Salud">
        <Field label="Grupo sanguíneo" value={val(a.grupoSanguineo)} />
        <Field label="Alergias" value={val(a.alergias)} />
        <Field label="Enfermedades crónicas" value={val(a.enfermedadesCronicas)} />
        <Field label="Medicamentos" value={val(a.medicamentos)} />
        <Field label="Cirugías" value={val(a.cirugias)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Contacto">
        <Field label="Email" value={val(a.email)} />
        <Field label="Teléfono" value={val(a.telefono)} />
        <Field label="Teléfono alternativo" value={val(a.telefonoAlternativo)} />
        <Field label="Contacto de emergencia" value={val(a.contactoEmergencia)} full />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Domicilio">
        <Field label="Ciudad" value={val(a.ciudad)} />
        <Field label="Barrio" value={val(a.barrio)} />
        {/* Espaciador: fuerza el salto de fila en md:grid-cols-3 para que
            Domicilio real, Número y Piso queden alineados en la misma línea. */}
        <div className="hidden md:block" aria-hidden="true" />
        <Field label="Domicilio real" value={val(a.domicilioReal)} />
        <Field label="Número" value={val(a.nroDomicilio)} />
        <Field label="Piso" value={val(a.piso)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Familia y beneficios">
        <Field label="Hijos a cargo" value={String(a.hijosCargo)} />
        <Field label="Posee servicio de sepelio" value={boolVal(a.poseeSepelio)} />
        <Field label="Empresa de sepelio" value={val(a.empresaSepelio)} />
      </Section>
    </div>
  );
}

function TabLaboral({ a }: { a: AgenteDetalle }) {
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
  return (
    <div className="space-y-8">
      <Section title="Información laboral">
        <Field label="Tipo de personal" value={tipoLabels[a.tipoPersonal] ?? a.tipoPersonal} />
        <Field label="Estado" value={estadoLabels[a.estado] ?? a.estado} />
        <Field label="Fecha de ingreso" value={fmt(a.fechaIngreso)} />
        <Field label="Turno" value={val(a.turno)} />
        <Field label="Sector" value={val(a.sector?.nombre)} />
        {tieneRango && (
          <>
            <Field label="Jerarquía / Rango" value={val(a.rango?.nombre)} />
            <Field label="Año de egreso" value={fmt(a.anoEgreso)} />
            <Field label="Perteneció al E.T.A.C." value={boolVal(a.perteneceETAC)} />
          </>
        )}
      </Section>
      {esSeguridad && (
        <>
          <div className="border-t border-slate-800" />
          <Section title="Armamento">
            <Field label="Tipo de arma" value={val(a.tipoArma)} />
            <Field label="Marca de pistola" value={val(a.marcaPistola)} />
            <Field label="Modelo de pistola" value={val(a.modeloPistola)} />
            <Field label="Calibre" value={val(a.calibre)} />
          </Section>
          <div className="border-t border-slate-800" />
          <Section title="Chaleco">
            <Field label="Chaleco provisto" value={boolVal(a.chalecoProvisto)} />
            <Field label="Marca" value={val(a.marcaChaleco)} />
            <Field label="N° de serie / Placas" value={val(a.nroSeriePlacas)} />
            <Field label="Talle" value={val(a.talleChaleco)} />
            <Field label="Vencimiento" value={fmt(a.vencimientoChaleco)} />
          </Section>
        </>
      )}
      <div className="border-t border-slate-800" />
      <Section title="Licencia de conducir">
        <Field label="Categoría" value={val(a.licenciaConducir)} />
        <Field label="Fecha de emisión" value={fmt(a.licenciaEmision)} />
        <Field label="Fecha de vencimiento" value={fmt(a.licenciaVencimiento)} />
      </Section>
      <div className="border-t border-slate-800" />
      <Section title="Nivel académico">
        <Field label="Primario" value={val(a.nivelPrimario)} />
        <Field label="Secundario" value={val(a.nivelSecundario)} />
        <Field label="Terciario" value={val(a.nivelTerciario)} />
        <Field label="Universitario" value={val(a.nivelUniversitario)} />
        <Field label="Superior" value={val(a.nivelSuperior)} />
        {a.detalleTitulos && <Field label="Detalle de títulos / estudios" value={val(a.detalleTitulos)} full />}
      </Section>
    </div>
  );
}

function TabHistorial({ historialRangos, tipoPersonal }: {
  historialRangos: AgenteDetalle["historialRangos"]; tipoPersonal: string;
}) {
  const tieneJerarquia = tipoPersonal === "SEGURIDAD" || tipoPersonal === "TECNICO";
  if (!tieneJerarquia) {
    return <div className="py-12 text-center text-slate-500 text-sm">El personal civil no tiene historial de jerarquía.</div>;
  }
  if (historialRangos.length === 0) {
    return <div className="py-12 text-center text-slate-500 text-sm">No hay registros de ascensos cargados aún.</div>;
  }
  return (
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
  const d = new Date(iso);
  const fechaStr = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const horaStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${fechaStr} ${horaStr}`;
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

// ─── Tabs: edición ────────────────────────────────────────────────────────────

const ESTADO_CIVIL_OPTIONS = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Conviviente", "Separado/a"].map((v) => ({ value: v, label: v }));
const GRUPO_SANGUINEO_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"].map((v) => ({ value: v, label: v }));
const NIVEL_OPTIONS = ["Completo", "Incompleto", "En curso"].map((v) => ({ value: v, label: v }));
const TURNO_OPTIONS = ["A","B","C","D","E","F","ADMINISTRATIVO","FULL TIME","GUARDIA LARGA","SUPERIOR DE TURNO"].map((v) => ({ value: v, label: v }));

function EditTabPersonal({ form, setForm }: {
  form: DatosPersonales;
  setForm: React.Dispatch<React.SetStateAction<DatosPersonales>>;
}) {
  const set = <K extends keyof DatosPersonales>(key: K) => (v: DatosPersonales[K]) =>
    setForm((f) => ({ ...f, [key]: v }));

  return (
    <div className="space-y-8">
      <Section title="Identidad">
        {/* Sexo y fechaNacimiento son inmutables — solo lectura */}
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
        <InputEdit label="Ciudad" value={form.ciudad} onChange={set("ciudad")} />
        <InputEdit label="Barrio" value={form.barrio} onChange={set("barrio")} />
        {/* Espaciador: fuerza el salto de fila en md:grid-cols-3 para que
            Domicilio real, Número y Piso queden alineados en la misma línea. */}
        <div className="hidden md:block" aria-hidden="true" />
        <InputEdit label="Domicilio real" value={form.domicilioReal} onChange={set("domicilioReal")} />
        <InputEdit label="Número" value={form.nroDomicilio} onChange={set("nroDomicilio")} />
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

type TabId = "personal" | "laboral" | "historial" | "cambios" | "licencias" | "asistencia";

const TABS: { id: TabId; label: string; locked?: boolean }[] = [
  { id: "personal", label: "Datos Personales" },
  { id: "laboral", label: "Datos Laborales" },
  { id: "historial", label: "Historial de Rangos" },
  { id: "cambios", label: "Historial de Cambios" },
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
  rangos,
  sectores,
  auditLogs = [],
  historialEstados = [],
  licencias = [],
  licenciasPendientes = [],
  canManageLicencias = false,
  feriados = [],
  permisoHasta,
  tabInicial,
}: {
  agente: AgenteDetalle;
  canEdit: boolean;
  rangos: RangoOption[];
  sectores: SectorOption[];
  auditLogs?: AuditLogEntry[];
  historialEstados?: HistorialEstadoEntry[];
  licencias?: LicenciaEntry[];
  licenciasPendientes?: LicenciaPendienteEntry[];
  canManageLicencias?: boolean;
  feriados?: Feriado[];
  permisoHasta?: string | null;
  tabInicial?: TabId;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(tabInicial ?? "personal");
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
          {TABS.map((tab) => {
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
                  Los campos marcados con fondo azul son editables. Los datos de identidad no se pueden modificar.
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
            : <TabPersonal a={agente} />
        )}
        {activeTab === "laboral" && (
          editando
            ? <EditTabLaboral form={formLaboral} setForm={setFormLaboral} agente={agente} rangos={rangos} sectores={sectores} />
            : <TabLaboral a={agente} />
        )}
        {activeTab === "historial" && (
          <TabHistorial historialRangos={agente.historialRangos} tipoPersonal={agente.tipoPersonal} />
        )}
        {activeTab === "cambios" && <TabCambios auditLogs={auditLogs} historialEstados={historialEstados} />}
        {activeTab === "licencias" && (
          <TabLicencias
            agenteId={agente.id}
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

const TIPO_LICENCIA_LABELS: Record<string, string> = {
  ORDINARIA: "Ordinaria",
  MEDICA: "Licencia Médica",
  CARPETA_MEDICA: "Carpeta Médica",
  ESPECIAL: "Especial",
  SIN_GOCE_SUELDO: "Sin goce de sueldo",
  ARTICULO: "Artículo",
  SUSPENSION: "Suspensión",
  ADSCRIPCION: "Adscripción",
};

const TIPO_LICENCIA_BADGE: Record<string, string> = {
  ORDINARIA: "bg-blue-500/15 text-blue-300",
  MEDICA: "bg-red-500/15 text-red-400",
  CARPETA_MEDICA: "bg-orange-500/15 text-orange-400",
  ESPECIAL: "bg-purple-500/15 text-purple-400",
  SIN_GOCE_SUELDO: "bg-slate-800 text-slate-400",
  ARTICULO: "bg-teal-500/15 text-teal-400",
  SUSPENSION: "bg-fuchsia-500/15 text-fuchsia-400",
  ADSCRIPCION: "bg-indigo-500/15 text-indigo-400",
};

const TIPO_LICENCIA_EMOJI: Record<string, string> = {
  ORDINARIA: "🏖️",
  MEDICA: "🏥",
  CARPETA_MEDICA: "🏥",
  ESPECIAL: "⭐",
  SIN_GOCE_SUELDO: "💰",
  ARTICULO: "👨‍👩‍👧‍👦",
  SUSPENSION: "🚫",
  ADSCRIPCION: "🔄",
};

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
      <div className="grid grid-cols-2 gap-3">
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
  licencias,
  licenciasPendientes,
  canManage,
  feriados,
}: {
  agenteId: string;
  licencias: LicenciaEntry[];
  licenciasPendientes: LicenciaPendienteEntry[];
  canManage: boolean;
  feriados: Feriado[];
}) {
  const [subTab, setSubTab] = useState<"licencias" | "pendientes">("licencias");
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
      <div className="flex items-center justify-between">
        <div className="flex border border-slate-700 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (abrirFormTimeout.current) clearTimeout(abrirFormTimeout.current);
              setAbriendoFormLicencia(false);
              setSubTab("licencias"); setMostrarForm(false); setEditandoId(null); setError(null);
            }}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "licencias" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
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
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${subTab === "pendientes" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
          >
            Licencias Pendientes
            <span className="ml-1.5 text-xs opacity-70">({licenciasPendientes.length})</span>
          </button>
        </div>

        {canManage && !mostrarForm && !abriendoFormLicencia && (
          <button
            type="button"
            onClick={handleAbrirNuevo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-sm font-medium text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
              <select name="tipo" required className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(TIPO_LICENCIA_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
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
          <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">Tipo</label>
                        <select name="tipo" defaultValue={l.tipo} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {Object.entries(TIPO_LICENCIA_LABELS).map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                        </select>
                      </div>
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
                  <div className={`flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 ${pending ? "opacity-50" : ""}`}>
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`mt-0.5 inline-flex items-center justify-between gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${TIPO_LICENCIA_BADGE[l.tipo] ?? "bg-slate-800 text-slate-400"}`}>
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
                      <div className="flex items-center gap-1 shrink-0">
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
                      <div className="grid grid-cols-2 gap-3">
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${TIPO_PENDIENTE_BADGE[p.tipo] ?? "bg-slate-800 text-slate-400"}`}>
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
                        <div className="flex items-center gap-1 shrink-0">
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
                          <div className="grid grid-cols-2 gap-2">
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
