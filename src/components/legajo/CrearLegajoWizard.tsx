"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearLegajoPropio, actualizarFotoLegajo, type DatosNuevoLegajo } from "@/app/actions/legajo";
import { subirFotoStorage } from "@/lib/fotoLegajo";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROVINCIAS = [
  "Buenos Aires", "Catamarca", "Chaco", "Chubut",
  "Ciudad Autónoma de Buenos Aires (CABA)", "Córdoba", "Corrientes",
  "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta",
  "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
  "Tucumán",
];

const TURNOS = ["A", "B", "C", "D", "E", "F", "ADMINISTRATIVO", "GUARDIA LARGA", "SUPERIOR DE TURNO", "FULL TIME"];
const TIPOS_PERSONAL = ["SEGURIDAD", "TECNICO", "CIVIL_POLICIAL", "CIVIL_BECARIO"];
const GRUPOS_SANGUINEOS = ["O-", "O+", "AB-", "AB+", "B-", "B+", "A-", "A+"];
const NIVELES_EDUCATIVOS = ["COMPLETADO", "EN_CURSO", "ABANDONADO"];
const LICENCIAS = [
  "NO_POSEO_LICENCIA",
  "A.1.1", "A.1.2", "A.1.3", "A.1.4", "A.2", "A.3",
  "B.1", "B.2", "C.1",
  "D.1", "D.2", "D.3", "D.4",
  "E.1", "E.2", "F", "G.1", "G.2", "G.3",
];

const PASOS = [
  "Datos Personales",
  "Contacto",
  "Laboral",
  "Médica",
  "Formación",
  "Foto",
];

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  rangos: { id: string; nombre: string; cuerpo: string }[];
  emailUsuario: string;
}

type FormData = DatosNuevoLegajo & {
  sexoPersonalizado: string;
  provinciaPersonalizada: string;
  nacionalidadPersonalizada: string;
  fotoFile: File | null;
};

const inicial: FormData = {
  apellidos: "", nombres: "", sexo: "", sexoPersonalizado: "",
  cuil: "", fechaNacimiento: "", estadoCivil: "",
  nacionalidad: "ARGENTINA", nacionalidadPersonalizada: "",
  provinciaOrigen: "", provinciaPersonalizada: "", ciudadOrigen: "",
  telefono: "", telefonoAlternativo: "",
  contactoEmergencia: "",
  domicilioReal: "", ciudad: "", barrio: "", nroDomicilio: "", piso: "",
  turno: "", fechaIngreso: "", tipoPersonal: "",
  rangoId: "", anoEgreso: "", perteneceETAC: false,
  origenInstitucional: "", origenInstitucionalDetalle: "",
  hijosCargo: 0, poseeSepelio: false, empresaSepelio: "",
  grupoSanguineo: "", alergias: "", enfermedadesCronicas: "",
  medicamentos: "", cirugias: "",
  nivelPrimario: "", nivelSecundario: "", nivelTerciario: "",
  nivelUniversitario: "", nivelSuperior: "", detalleTitulos: "",
  licenciaConducir: "", licenciaEmision: "", licenciaVencimiento: "",
  fotoUrl: "", fotoFile: null,
};

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-950 ${props.className ?? ""}`}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  const { children, ...rest } = props;
  return (
    <select
      {...rest}
      className={`w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-900 ${rest.className ?? ""}`}
    >
      {children}
    </select>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 2}
      className={`w-full border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${props.className ?? ""}`}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ─── Compresión de foto ───────────────────────────────────────────────────────

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CrearLegajoWizard({ rangos, emailUsuario }: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [form, setForm] = useState<FormData>(inicial);
  const [error, setError] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [isPending, startTransition] = useTransition();

  function set(campo: keyof FormData, valor: unknown) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  const tieneJerarquia = form.tipoPersonal === "SEGURIDAD" || form.tipoPersonal === "TECNICO";
  const tieneLicencia = form.licenciaConducir && form.licenciaConducir !== "NO_POSEO_LICENCIA";

  // ─── Validación por paso ───────────────────────────────────────────────────

  function validarPaso(): string {
    if (paso === 0) {
      if (!form.apellidos.trim()) return "El apellido es obligatorio";
      if (!form.nombres.trim()) return "El nombre es obligatorio";
      if (!form.sexo) return "El sexo es obligatorio";
      if (form.sexo === "OTRO" && !form.sexoPersonalizado.trim()) return "Especificá el sexo";
      const cuil = form.cuil.replace(/\D/g, "");
      if (cuil.length !== 11) return "El CUIL debe tener exactamente 11 dígitos";
    }
    if (paso === 2) {
      if (!form.tipoPersonal) return "El tipo de personal es obligatorio";
    }
    return "";
  }

  function avanzar() {
    const err = validarPaso();
    if (err) { setError(err); return; }
    setError("");
    setPaso((p) => p + 1);
  }

  function retroceder() {
    setError("");
    setPaso((p) => p - 1);
  }

  function onFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("fotoFile", file);
    const url = URL.createObjectURL(file);
    setFotoPreview(url);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    startTransition(async () => {
      setError("");
      try {
        const payload: DatosNuevoLegajo = {
          ...form,
          cuil: form.cuil.replace(/\D/g, ""),
          nacionalidad: form.nacionalidad === "OTRO"
            ? form.nacionalidadPersonalizada
            : form.nacionalidad,
          provinciaOrigen: form.provinciaOrigen === "Otra"
            ? form.provinciaPersonalizada
            : form.provinciaOrigen,
          fotoUrl: "",
        };

        const { agenteId } = await crearLegajoPropio(payload);

        // Upload foto si hay una seleccionada
        if (form.fotoFile) {
          const url = await subirFotoStorage(form.fotoFile, agenteId);
          if (url) {
            await actualizarFotoLegajo(agenteId, url);
          }
        }

        setListo(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al crear el legajo");
      }
    });
  }

  // ─── Pantalla de éxito ─────────────────────────────────────────────────────

  if (listo) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 px-8 py-16 text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-slate-100">¡Legajo enviado para revisión!</h2>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Tu legajo fue creado correctamente. Un administrador lo revisará y completará los datos
          restantes (sector y jerarquía). Te notificaremos cuando esté listo.
        </p>
        <button
          onClick={() => router.push("/mi-legajo")}
          className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        >
          Ir a mi legajo
        </button>
      </div>
    );
  }

  // ─── Indicador de pasos ────────────────────────────────────────────────────

  function StepIndicator() {
    return (
      <div className="flex items-center justify-between mb-6 px-1">
        {PASOS.map((nombre, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < paso
                    ? "bg-blue-600 text-white"
                    : i === paso
                    ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {i < paso ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-medium hidden sm:block ${i === paso ? "text-blue-400" : "text-slate-500"}`}>
                {nombre}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`h-0.5 w-6 sm:w-10 mx-1 mt-[-12px] ${i < paso ? "bg-blue-600" : "bg-slate-700"}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ─── Pasos ─────────────────────────────────────────────────────────────────

  function PasoDatosPersonales() {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Datos Personales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Apellido/s *">
            <Input value={form.apellidos} onChange={(e) => set("apellidos", e.target.value)} placeholder="Ej: García López" />
          </Field>
          <Field label="Nombre/s *">
            <Input value={form.nombres} onChange={(e) => set("nombres", e.target.value)} placeholder="Ej: Juan Carlos" />
          </Field>
        </div>

        <Field label="Sexo *">
          <Select value={form.sexo} onChange={(e) => set("sexo", e.target.value)}>
            <option value="">Seleccionar...</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="NO_BINARIO">No binario</option>
            <option value="PREFIERO_NO_DECIR">Prefiero no decir</option>
            <option value="OTRO">Otro (especificar)</option>
          </Select>
        </Field>
        {form.sexo === "OTRO" && (
          <Field label="Especificar sexo">
            <Input value={form.sexoPersonalizado} onChange={(e) => set("sexoPersonalizado", e.target.value)} placeholder="Especificá tu identidad de género" />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="CUIL * (solo números, sin puntos ni guiones)">
            <Input
              value={form.cuil}
              onChange={(e) => set("cuil", e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="20123456789"
              inputMode="numeric"
              maxLength={11}
            />
          </Field>
          <Field label="Fecha de nacimiento">
            <Input type="date" value={form.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Estado civil">
            <Select value={form.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="SOLTERO">Soltero/a</option>
              <option value="CASADO">Casado/a</option>
              <option value="EN_UNION_LIBRE">En unión libre</option>
              <option value="VIUDO">Viudo/a</option>
            </Select>
          </Field>
          <Field label="Nacionalidad">
            <Select value={form.nacionalidad} onChange={(e) => set("nacionalidad", e.target.value)}>
              <option value="ARGENTINA">Argentina</option>
              <option value="OTRO">Otra (especificar)</option>
            </Select>
          </Field>
        </div>
        {form.nacionalidad === "OTRO" && (
          <Field label="Especificar nacionalidad">
            <Input value={form.nacionalidadPersonalizada} onChange={(e) => set("nacionalidadPersonalizada", e.target.value)} placeholder="Ej: Brasileña" />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Provincia de origen">
            <Select value={form.provinciaOrigen} onChange={(e) => set("provinciaOrigen", e.target.value)}>
              <option value="">Seleccionar...</option>
              {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="Otra">Otra (especificar)</option>
            </Select>
          </Field>
          <Field label="Ciudad de origen">
            <Input value={form.ciudadOrigen} onChange={(e) => set("ciudadOrigen", e.target.value)} placeholder="Ej: Rosario" />
          </Field>
        </div>
        {form.provinciaOrigen === "Otra" && (
          <Field label="Especificar provincia">
            <Input value={form.provinciaPersonalizada} onChange={(e) => set("provinciaPersonalizada", e.target.value)} placeholder="Ej: Cochabamba" />
          </Field>
        )}
      </div>
    );
  }

  function PasoContacto() {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Contacto y Domicilio</h3>

        <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg px-4 py-3 text-sm text-blue-300">
          <span className="font-medium">Correo electrónico:</span> {emailUsuario}
          <span className="text-blue-500 ml-2">(tomado de tu cuenta registrada)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Teléfono personal (sin 0 ni 15)">
            <Input value={form.telefono} onChange={(e) => set("telefono", e.target.value.replace(/\D/g, ""))} placeholder="3512345678" inputMode="numeric" />
          </Field>
          <Field label="Teléfono alternativo (sin 0 ni 15)">
            <Input value={form.telefonoAlternativo} onChange={(e) => set("telefonoAlternativo", e.target.value.replace(/\D/g, ""))} placeholder="3519876543" inputMode="numeric" />
          </Field>
        </div>

        <Field label="El contacto alternativo pertenece a:">
          <Input value={form.contactoEmergencia} onChange={(e) => set("contactoEmergencia", e.target.value)} placeholder="Ej: Madre — María García" />
        </Field>

        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2 pt-2">Domicilio actual</h3>
        <Field label="Domicilio real (calle)">
          <Input value={form.domicilioReal} onChange={(e) => set("domicilioReal", e.target.value)} placeholder="Ej: Av. Colón" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Ciudad">
            <Input value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Córdoba" />
          </Field>
          <Field label="Barrio">
            <Input value={form.barrio} onChange={(e) => set("barrio", e.target.value)} placeholder="General Paz" />
          </Field>
          <Field label="Número">
            <Input value={form.nroDomicilio} onChange={(e) => set("nroDomicilio", e.target.value)} placeholder="1234" />
          </Field>
        </div>
        <Field label="Piso / Depto (opcional)">
          <Input value={form.piso} onChange={(e) => set("piso", e.target.value)} placeholder="3° B" />
        </Field>
      </div>
    );
  }

  function PasoLaboral() {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Datos Laborales</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo de personal *">
            <Select value={form.tipoPersonal} onChange={(e) => { set("tipoPersonal", e.target.value); set("rangoId", ""); }}>
              <option value="">Seleccionar...</option>
              {TIPOS_PERSONAL.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </Select>
          </Field>
          <Field label="Turno">
            <Select value={form.turno} onChange={(e) => set("turno", e.target.value)}>
              <option value="">Seleccionar...</option>
              {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Fecha de ingreso">
          <Input type="date" value={form.fechaIngreso} onChange={(e) => set("fechaIngreso", e.target.value)} />
        </Field>

        {tieneJerarquia && (
          <>
            <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2 pt-2">Personal {form.tipoPersonal === "SEGURIDAD" ? "de Seguridad" : "Técnico"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Jerarquía">
                <Select value={form.rangoId} onChange={(e) => set("rangoId", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {rangos.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Año de egreso">
                <Input
                  type="number"
                  value={form.anoEgreso}
                  onChange={(e) => set("anoEgreso", e.target.value)}
                  placeholder="2015"
                  min="1960"
                  max={new Date().getFullYear()}
                />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="etac"
                checked={form.perteneceETAC}
                onChange={(e) => set("perteneceETAC", e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-blue-400"
              />
              <label htmlFor="etac" className="text-sm text-slate-300">Perteneció al E.T.A.C.</label>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Origen institucional">
            <Select value={form.origenInstitucional} onChange={(e) => set("origenInstitucional", e.target.value)}>
              <option value="">Seleccionar...</option>
              <option value="GOBIERNO">Gobierno</option>
              <option value="DMCA">DMCA</option>
              <option value="911">911</option>
              <option value="OTRA_DEPENDENCIA">Otra dependencia (especificar)</option>
            </Select>
          </Field>
          {form.origenInstitucional === "OTRA_DEPENDENCIA" && (
            <Field label="Especificar dependencia">
              <Input value={form.origenInstitucionalDetalle} onChange={(e) => set("origenInstitucionalDetalle", e.target.value)} placeholder="Ej: Policía Caminera" />
            </Field>
          )}
        </div>

        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2 pt-2">Información Complementaria</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Hijos a cargo">
            <Select value={String(form.hijosCargo)} onChange={(e) => set("hijosCargo", parseInt(e.target.value))}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n === 5 ? "+5" : n}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-3 mt-4">
              <input
                type="checkbox"
                id="sepelio"
                checked={form.poseeSepelio}
                onChange={(e) => set("poseeSepelio", e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-blue-400"
              />
              <label htmlFor="sepelio" className="text-sm text-slate-300">Posee servicio de sepelio</label>
            </div>
          </div>
        </div>
        {form.poseeSepelio && (
          <Field label="Empresa de sepelio">
            <Input value={form.empresaSepelio} onChange={(e) => set("empresaSepelio", e.target.value)} placeholder="Ej: Coseguro" />
          </Field>
        )}
      </div>
    );
  }

  function PasoMedica() {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Información Médica</h3>
        <Field label="Grupo sanguíneo">
          <Select value={form.grupoSanguineo} onChange={(e) => set("grupoSanguineo", e.target.value)}>
            <option value="">Seleccionar...</option>
            {GRUPOS_SANGUINEOS.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </Field>
        <Field label="Alergias">
          <Textarea value={form.alergias} onChange={(e) => set("alergias", e.target.value)} placeholder="Describí tus alergias conocidas, o dejá vacío si no tenés" />
        </Field>
        <Field label="Enfermedades crónicas">
          <Textarea value={form.enfermedadesCronicas} onChange={(e) => set("enfermedadesCronicas", e.target.value)} placeholder="Ej: Hipertensión, diabetes, etc." />
        </Field>
        <Field label="Medicamentos por tratamiento prolongado">
          <Textarea value={form.medicamentos} onChange={(e) => set("medicamentos", e.target.value)} placeholder="Ej: Metformina 500mg (para diabetes)" />
        </Field>
        <Field label="Cirugías">
          <Textarea value={form.cirugias} onChange={(e) => set("cirugias", e.target.value)} placeholder="Ej: Apendicectomía (2018)" />
        </Field>
      </div>
    );
  }

  function PasoFormacion() {
    const nivelLabel: Record<string, string> = {
      COMPLETADO: "Completado", EN_CURSO: "En curso", ABANDONADO: "Abandonado",
    };
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Información Académica</h3>
        <p className="text-xs text-slate-500">Completá solo los niveles que hayas comenzado.</p>
        {(["nivelPrimario", "nivelSecundario", "nivelTerciario", "nivelUniversitario", "nivelSuperior"] as const).map((campo) => {
          const labels: Record<typeof campo, string> = {
            nivelPrimario: "Primario", nivelSecundario: "Secundario",
            nivelTerciario: "Terciario", nivelUniversitario: "Universitario", nivelSuperior: "Superior",
          };
          return (
            <Field key={campo} label={labels[campo]}>
              <Select value={form[campo]} onChange={(e) => set(campo, e.target.value)}>
                <option value="">No iniciado</option>
                {NIVELES_EDUCATIVOS.map((n) => <option key={n} value={n}>{nivelLabel[n]}</option>)}
              </Select>
            </Field>
          );
        })}
        <Field label="Detalle de títulos o estudios">
          <Textarea rows={3} value={form.detalleTitulos} onChange={(e) => set("detalleTitulos", e.target.value)} placeholder="Ej: 4to año de Psicología (en curso) — Licenciatura en Criminalística (completa)" />
        </Field>

        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2 pt-2">Licencia de Conducir</h3>
        <Field label="Categoría">
          <Select value={form.licenciaConducir} onChange={(e) => set("licenciaConducir", e.target.value)}>
            <option value="">Seleccionar...</option>
            {LICENCIAS.map((l) => (
              <option key={l} value={l}>{l === "NO_POSEO_LICENCIA" ? "No poseo licencia" : l}</option>
            ))}
          </Select>
        </Field>
        {tieneLicencia && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha de emisión">
              <Input type="date" value={form.licenciaEmision} onChange={(e) => set("licenciaEmision", e.target.value)} />
            </Field>
            <Field label="Fecha de vencimiento">
              <Input type="date" value={form.licenciaVencimiento} onChange={(e) => set("licenciaVencimiento", e.target.value)} />
            </Field>
          </div>
        )}
      </div>
    );
  }

  function PasoFoto() {
    return (
      <div className="space-y-5">
        <h3 className="text-base font-semibold text-slate-100 border-b border-slate-800 pb-2">Foto del legajo</h3>
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3 text-sm text-amber-400 space-y-1">
          <p className="font-medium">Requisitos para la foto:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-400">
            <li>Sin lentes ni gorra</li>
            <li>Preferentemente fondo blanco</li>
            <li>Espacio bien iluminado</li>
            <li>Foto reciente y de frente</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-32 h-32 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {fotoPreview ? (
              <img src={fotoPreview} alt="Vista previa" className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-500 text-3xl">👤</span>
            )}
          </div>
          <div className="space-y-2 flex-1">
            <label
              htmlFor="foto-input"
              className="inline-flex items-center gap-2 cursor-pointer bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              📎 Seleccionar foto
            </label>
            <input
              id="foto-input"
              type="file"
              accept="image/*"
              onChange={onFotoChange}
              className="hidden"
            />
            {form.fotoFile && (
              <p className="text-xs text-slate-400">{form.fotoFile.name}</p>
            )}
            <p className="text-xs text-slate-500">
              La foto es opcional. Podés subirla más tarde desde tu legajo.
              La imagen se comprimirá automáticamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stepComponents = [
    PasoDatosPersonales(),
    PasoContacto(),
    PasoLaboral(),
    PasoMedica(),
    PasoFormacion(),
    PasoFoto(),
  ];

  const esUltimoPaso = paso === PASOS.length - 1;

  return (
    <div className="space-y-5">
      <StepIndicator />

      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        {stepComponents[paso]}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={retroceder}
          disabled={paso === 0 || isPending}
          className="px-4 py-2 text-sm font-medium text-slate-400 border border-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>

        {esUltimoPaso ? (
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-6 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Enviando..." : "Enviar legajo"}
          </button>
        ) : (
          <button
            onClick={avanzar}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Siguiente →
          </button>
        )}
      </div>
    </div>
  );
}
