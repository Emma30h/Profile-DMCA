"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePersonalNav } from "@/app/(dashboard)/personal/PersonalMasterShell";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";
import type { AgenteDetalle } from "@/app/(dashboard)/personal/[id]/LegajoTabs";
import { TIPO_LABEL, ESTADO_LABEL, SEXO_LABEL, ORIGEN_LABEL, cuilToDni, fmt } from "@/lib/personalLabels";

// ─── Íconos de sección (mismo set de líneas finas que ya usa el legajo,
// ver LegajoTabs.tsx — se duplican acá en vez de exportarlos porque son
// componentes internos de ese archivo) ─────────────────────────────────────

function IconIdCard() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 15a2 2 0 012-2h0a2 2 0 012 2M8 10h.01M13 9h5m-5 3h5" />
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

function IconPulse() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h4l2-7 4 14 2-7h6" />
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

type Linea = [string, string | null | undefined];

// Cada grupo arma sus líneas "etiqueta: valor" — las que vienen vacías se
// descartan solas al construir el mensaje, así nunca queda un "Teléfono: —"
// en un texto pensado para pegar directo en un chat de WhatsApp.
interface Grupo {
  id: string;
  titulo: string;
  /** Ícono de línea para el checkbox del modal — mismo set que el resto del legajo. */
  icono: React.ReactNode;
  /** Emoji para el encabezado de sección dentro del mensaje de WhatsApp en
   *  sí (texto plano, no hay lugar para un ícono SVG ahí). */
  emoji: string;
  /** Sólo aplica a Seguridad/Técnico (jerarquía) o sólo Seguridad (armamento). */
  disponible: (a: AgenteDetalle) => boolean;
  lineas: (a: AgenteDetalle) => Linea[];
  defaultChecked: boolean;
}

const GRUPOS: Grupo[] = [
  {
    id: "identidad",
    titulo: "Identidad",
    icono: <IconIdCard />,
    emoji: "🪪",
    disponible: () => true,
    defaultChecked: true,
    lineas: (a) => [
      ["DNI", cuilToDni(a.cuil)],
      ["CUIL", a.cuil],
      ["Sexo", SEXO_LABEL[a.sexo] ?? a.sexo],
      ["Fecha de nacimiento", fmt(a.fechaNacimiento)],
      ["Estado civil", a.estadoCivil],
      ["Nacionalidad", a.nacionalidad],
      ["Provincia de origen", a.provinciaOrigen],
      ["Ciudad de origen", a.ciudadOrigen],
    ],
  },
  {
    id: "contacto",
    titulo: "Contacto",
    icono: <IconPhoneMini />,
    emoji: "📞",
    disponible: () => true,
    defaultChecked: true,
    lineas: (a) => {
      const domicilioPartes = [
        [a.domicilioReal, a.nroDomicilio].filter(Boolean).join(" "),
        a.piso ? `piso ${a.piso}` : "",
        a.barrio,
        a.ciudad,
      ].filter(Boolean);
      return [
        ["Teléfono", a.telefono],
        ["Teléfono alternativo", a.telefonoAlternativo],
        ["Email", a.email],
        ["Domicilio", domicilioPartes.length > 0 ? domicilioPartes.join(", ") : null],
        ["Contacto de emergencia", a.contactoEmergencia],
      ];
    },
  },
  {
    id: "laboral",
    titulo: "Datos laborales",
    icono: <IconBadgeMini />,
    emoji: "💼",
    disponible: () => true,
    defaultChecked: true,
    lineas: (a) => {
      const tieneRango = a.tipoPersonal === "SEGURIDAD" || a.tipoPersonal === "TECNICO";
      const origen = a.origenInstitucional
        ? a.origenInstitucional === "OTRA_DEPENDENCIA" && a.origenInstitucionalDetalle
          ? `${ORIGEN_LABEL[a.origenInstitucional]} (${a.origenInstitucionalDetalle})`
          : ORIGEN_LABEL[a.origenInstitucional] ?? a.origenInstitucional
        : null;
      return [
        ["Tipo de personal", TIPO_LABEL[a.tipoPersonal] ?? a.tipoPersonal],
        ["Estado", ESTADO_LABEL[a.estado] ?? a.estado],
        ["Turno", a.turno],
        ["Sector", a.sector?.nombre],
        ["Origen institucional", origen],
        ...(tieneRango ? [["Jerarquía / Rango", a.rango?.nombre] as Linea] : []),
        ["Fecha de ingreso", fmt(a.fechaIngreso)],
        ...(tieneRango ? [["Año de egreso", fmt(a.anoEgreso)] as Linea] : []),
      ];
    },
  },
  {
    id: "armamento",
    titulo: "Armamento y equipo",
    icono: <IconShield />,
    emoji: "🛡️",
    disponible: (a) => a.tipoPersonal === "SEGURIDAD",
    defaultChecked: false,
    lineas: (a) => [
      ["Tipo de arma", a.tipoArma],
      ["Marca de pistola", a.marcaPistola],
      ["Modelo de pistola", a.modeloPistola],
      ["Calibre", a.calibre],
      ["Chaleco provisto", a.chalecoProvisto == null ? null : a.chalecoProvisto ? "Sí" : "No"],
      ["Marca de chaleco", a.marcaChaleco],
      ["N° de serie / Placas", a.nroSeriePlacas],
      ["Talle de chaleco", a.talleChaleco],
      ["Vencimiento de chaleco", fmt(a.vencimientoChaleco)],
    ],
  },
  {
    id: "licencia",
    titulo: "Licencia de conducir",
    icono: <IconIdCard />,
    emoji: "🚗",
    disponible: () => true,
    defaultChecked: false,
    lineas: (a) => [
      ["Categoría", a.licenciaConducir],
      ["Fecha de emisión", fmt(a.licenciaEmision)],
      ["Fecha de vencimiento", fmt(a.licenciaVencimiento)],
    ],
  },
  {
    id: "academico",
    titulo: "Nivel académico",
    icono: <IconGraduation />,
    emoji: "🎓",
    disponible: () => true,
    defaultChecked: false,
    lineas: (a) => [
      ["Primario", a.nivelPrimario],
      ["Secundario", a.nivelSecundario],
      ["Terciario", a.nivelTerciario],
      ["Universitario", a.nivelUniversitario],
      ["Superior", a.nivelSuperior],
      ["Detalle de títulos / estudios", a.detalleTitulos],
    ],
  },
  {
    id: "medico",
    titulo: "Datos médicos",
    icono: <IconPulse />,
    emoji: "🩺",
    disponible: () => true,
    defaultChecked: false,
    lineas: (a) => [
      ["Grupo sanguíneo", a.grupoSanguineo],
      ["Alergias", a.alergias],
      ["Enfermedades crónicas", a.enfermedadesCronicas],
      ["Medicamentos", a.medicamentos],
      ["Cirugías", a.cirugias],
    ],
  },
  {
    id: "familia",
    titulo: "Familia y beneficios",
    icono: <IconUsersMini />,
    emoji: "👨‍👩‍👧",
    disponible: () => true,
    defaultChecked: false,
    lineas: (a) => [
      ["Hijos a cargo", a.hijosCargo > 0 ? String(a.hijosCargo) : null],
      ["Posee servicio de sepelio", a.poseeSepelio ? (a.empresaSepelio ? `Sí (${a.empresaSepelio})` : "Sí") : null],
    ],
  },
];

function construirMensaje(agente: AgenteDetalle, seleccionados: Set<string>): string {
  const bloques: string[] = [
    `*${agente.apellidos}, ${agente.nombres}*`,
  ];

  for (const grupo of GRUPOS) {
    if (!seleccionados.has(grupo.id) || !grupo.disponible(agente)) continue;
    const lineas = grupo.lineas(agente).filter(
      (l): l is [string, string] => Boolean(l[1] && l[1].trim() !== "" && l[1] !== "—")
    );
    if (lineas.length === 0) continue;
    bloques.push([
      `${grupo.emoji} ${grupo.titulo}`,
      ...lineas.map(([label, valor]) => `${label}: ${valor}`),
    ].join("\n"));
  }

  return bloques.join("\n\n");
}

interface Props {
  href: string;
  agenteId: string;
  agente: AgenteDetalle;
  /** Operador no ve Armamento/Chaleco en el legajo — tampoco se ofrece para exportar. */
  esOperador: boolean;
}

export default function OpcionesLegajoMenu({ href, agenteId, agente, esOperador }: Props) {
  const { limpiarFicha } = usePersonalNav();
  const { anclado, desanclar } = useAgenteAnclado();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [exportarAbierto, setExportarAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const gruposDisponibles = GRUPOS.filter(
    (g) => g.disponible(agente) && !(esOperador && g.id === "armamento")
  );
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(gruposDisponibles.filter((g) => g.defaultChecked).map((g) => g.id))
  );

  useEffect(() => {
    if (!menuAbierto) return;
    function onClickFuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [menuAbierto]);

  function handleLimpiarFichero() {
    setMenuAbierto(false);
    if (anclado?.id === agenteId) desanclar();
    limpiarFicha(href);
  }

  function handleAbrirExportar() {
    setMenuAbierto(false);
    setExportarAbierto(true);
  }

  function toggleGrupo(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCompartir() {
    const mensaje = construirMensaje(agente, seleccion);
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
    setExportarAbierto(false);
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          title="Opciones"
          className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>

        {menuAbierto && (
          <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-lg border border-slate-700 bg-slate-800 py-1.5 shadow-lg shadow-black/40">
            <button
              type="button"
              onClick={handleLimpiarFichero}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Limpiar fichero
            </button>
            <button
              type="button"
              onClick={handleAbrirExportar}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Exportar para WhatsApp
            </button>
          </div>
        )}
      </div>

      {exportarAbierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setExportarAbierto(false)} />

          <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-semibold text-slate-100">Exportar para WhatsApp</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Elegí qué datos de {agente.apellidos}, {agente.nombres} incluir en el mensaje.
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-1">
              {gruposDisponibles.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={seleccion.has(g.id)}
                    onChange={() => toggleGrupo(g.id)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span className="text-slate-500 shrink-0">{g.icono}</span>
                  <span className="text-sm text-slate-200">{g.titulo}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setExportarAbierto(false)}
                className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompartir}
                disabled={seleccion.size === 0}
                className="rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                Compartir por WhatsApp
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
