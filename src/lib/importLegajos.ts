import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { DatosNuevoLegajo } from "@/app/actions/legajo";

export type DatosImportLegajo = DatosNuevoLegajo & { email: string };

export interface FilaImportOk {
  ok: true;
  datos: DatosImportLegajo;
  advertencias: string[];
  contexto: { funciones: string; status: string; detalle: string };
}

export interface FilaImportError {
  ok: false;
  fila: number;
  cuil: string;
  nombre: string;
  motivo: string;
}

const TIPO_PERSONAL_MAP: Record<string, string> = {
  "SEGURIDAD": "SEGURIDAD",
  "TECNICO": "TECNICO",
  "CIVIL BECARIO": "CIVIL_BECARIO",
  "CIVIL POLICIAL": "CIVIL_POLICIAL",
};

const DEPENDENCIA_MAP: Record<string, string> = {
  "DIRECCION MONITOREO CORDOBESES EN ALERTA": "DMCA",
  "BECARIO DE GOBIERNO": "GOBIERNO",
  "911": "911",
};

const VALORES_VACIOS = new Set(["", "N/A", "NA", "-", "NO POSEO LICENCIA", "SIN NOVEDAD"]);

// Detecta el mojibake típico de un CSV UTF-8 leído/guardado como Latin-1
// (p. ej. "DirecciÃ³n" en vez de "Dirección") y lo revierte cuando corresponde.
export function repararMojibakeSiHaceFalta(s: string): string {
  if (!s || !/Ã[\x80-\xBF]/.test(s)) return s;
  try {
    const reparado = Buffer.from(s, "latin1").toString("utf8");
    return reparado.includes("�") ? s : reparado;
  } catch {
    return s;
  }
}

function limpiar(v: string | undefined | null): string {
  if (!v) return "";
  return repararMojibakeSiHaceFalta(v).trim();
}

// El Sheet trae los nombres en cualquier capitalización (todo mayúsculas, todo
// minúsculas, etc.) — se normaliza a "Primera Letra De Cada Palabra".
export function capitalizarNombre(s: string): string {
  if (!s) return s;
  return s
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s-])([a-záéíóúñü])/g, (_, sep, letra) => sep + letra.toLocaleUpperCase("es-AR"));
}

function limpiarONull(v: string | undefined | null): string {
  const s = limpiar(v);
  return VALORES_VACIOS.has(s.toUpperCase()) ? "" : s;
}

export function limpiarCuil(v: string | undefined | null): string {
  return limpiar(v).replace(/\D/g, "");
}

export function parseFechaArgentina(v: string | undefined | null): string {
  const s = limpiar(v);
  if (!s) return "";
  const soloFecha = s.split(/\s+/)[0] ?? s;
  const partes = soloFecha.split("/");
  if (partes.length !== 3) return "";
  const [dStr, mStr, yStr] = partes;
  const d = parseInt(dStr, 10);
  const m = parseInt(mStr, 10);
  const y = parseInt(yStr, 10);
  const anioActual = new Date().getFullYear();
  if (!d || !m || !y || d > 31 || m > 12 || y < 1920 || y > anioActual + 1) return "";
  const fecha = new Date(Date.UTC(y, m - 1, d));
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return "";
  return fecha.toISOString();
}

export function parseBooleano(v: string | undefined | null): boolean {
  const s = limpiar(v).toUpperCase();
  return s === "SI" || s === "SÍ" || s === "YES" || s === "TRUE";
}

export async function parseArchivo(buffer: Buffer, nombreArchivo: string): Promise<Record<string, string>[]> {
  const ext = nombreArchivo.toLowerCase().split(".").pop();

  if (ext === "csv") {
    const texto = repararMojibakeSiHaceFalta(buffer.toString("utf8"));
    const resultado = Papa.parse<Record<string, string>>(texto, {
      header: true,
      skipEmptyLines: true,
    });
    return resultado.data;
  }

  if (ext === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? "").trim();
    });

    const filas: Record<string, string>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const fila: Record<string, string> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (!header) return;
        const valor = cell.value;
        if (valor instanceof Date) {
          fila[header] = `${valor.getDate()}/${valor.getMonth() + 1}/${valor.getFullYear()}`;
        } else if (valor && typeof valor === "object" && "text" in valor) {
          fila[header] = String((valor as { text: unknown }).text ?? "");
        } else {
          fila[header] = valor == null ? "" : String(valor);
        }
      });
      filas.push(fila);
    });
    return filas;
  }

  throw new Error(`Formato de archivo no soportado: .${ext ?? "?"} (usá .csv o .xlsx)`);
}

export function mapearFila(
  row: Record<string, string>,
  numeroFila: number,
  rangosPorNombre: Map<string, string>,
  emailsExistentes: Set<string>
): FilaImportOk | FilaImportError | null {
  const cuil = limpiarCuil(row["CUIL"]);
  const nombres = capitalizarNombre(limpiar(row["NOMBRE/S"]));
  // En mayúsculas para que coincida con la convención ya usada en el resto de los legajos
  const apellidos = (limpiar(row["APELLIDO/S"]) || limpiar(row["APELLIDO"])).toUpperCase();

  // Fila completamente vacía (ej. filas en blanco al final del sheet) — se descarta en silencio
  if (!cuil && !nombres && !apellidos) return null;

  const nombreCompleto = `${apellidos} ${nombres}`.trim() || "(sin nombre)";

  if (cuil.length !== 11) {
    return { ok: false, fila: numeroFila, cuil: row["CUIL"] ?? "", nombre: nombreCompleto, motivo: "CUIL inválido (debe tener 11 dígitos)" };
  }
  if (!nombres) {
    return { ok: false, fila: numeroFila, cuil, nombre: nombreCompleto, motivo: "Falta el nombre" };
  }
  if (!apellidos) {
    return { ok: false, fila: numeroFila, cuil, nombre: nombreCompleto, motivo: "Falta el apellido" };
  }

  const sexo = limpiar(row["SEXO"]).toUpperCase();
  if (!["MASCULINO", "FEMENINO", "NO_BINARIO", "PREFIERO_NO_DECIR", "OTRO"].includes(sexo)) {
    return { ok: false, fila: numeroFila, cuil, nombre: nombreCompleto, motivo: `Sexo no reconocido: "${row["SEXO"]}"` };
  }

  const tipoPersonalRaw = limpiar(row["TIPO DE PERSONAL"]).toUpperCase();
  const tipoPersonal = TIPO_PERSONAL_MAP[tipoPersonalRaw];
  if (!tipoPersonal) {
    return { ok: false, fila: numeroFila, cuil, nombre: nombreCompleto, motivo: `Tipo de personal no reconocido: "${row["TIPO DE PERSONAL"]}"` };
  }

  const advertencias: string[] = [];

  const email = limpiar(row["Dirección de correo electrónico"]).toLowerCase();
  const emailFinal = email && !emailsExistentes.has(email) ? email : "";
  if (email && !emailFinal) advertencias.push(`El email ${email} ya está en uso por otro legajo — se omitió`);

  const dependenciaRaw = limpiar(row["DEPENDENCIA"]).toUpperCase();
  const origenInstitucional = DEPENDENCIA_MAP[dependenciaRaw] ?? (dependenciaRaw ? "OTRA_DEPENDENCIA" : "");

  const tieneJerarquia = tipoPersonal === "SEGURIDAD" || tipoPersonal === "TECNICO";
  const jerarquiaRaw = limpiar(row["JERARQUIA"]).toUpperCase();
  let rangoId = "";
  if (tieneJerarquia && jerarquiaRaw) {
    // El sheet nunca trae la palabra "Técnico" en JERARQUIA (solo "AGENTE",
    // "CABO", etc.), así que para personal técnico hay que probar primero el
    // rango homónimo del cuerpo técnico — si se matcheara por nombre plano a
    // secas, cae en el rango de Suboficial con el mismo nombre (mismo grado,
    // cuerpo equivocado).
    const candidatos = tipoPersonal === "TECNICO" ? [`${jerarquiaRaw} TÉCNICO`, jerarquiaRaw] : [jerarquiaRaw];
    for (const candidato of candidatos) {
      rangoId = rangosPorNombre.get(candidato) ?? "";
      if (rangoId) break;
    }
    if (!rangoId) advertencias.push(`No se encontró el rango "${row["JERARQUIA"]}" — queda sin asignar`);
  }

  const fechaNacimiento = parseFechaArgentina(row["FECHA DE NACIMIENTO"]);
  if (limpiar(row["FECHA DE NACIMIENTO"]) && !fechaNacimiento) {
    advertencias.push(`Fecha de nacimiento inválida: "${row["FECHA DE NACIMIENTO"]}"`);
  }

  const poseeSepelio = parseBooleano(row["POSEE SERVICIO DE SEPELIO"]);
  const hijosCargoNum = parseInt(limpiar(row["HIJOS A CARGO"]), 10);

  const datos: DatosImportLegajo = {
    email: emailFinal,
    apellidos,
    nombres,
    sexo,
    sexoPersonalizado: "",
    cuil,
    fechaNacimiento,
    estadoCivil: limpiarONull(row["ESTADO CIVIL"]),
    nacionalidad: limpiarONull(row["NACIONALIDAD"]),
    provinciaOrigen: limpiarONull(row["PROVINCIA DE ORIGEN"]),
    ciudadOrigen: limpiarONull(row["CIUDAD DE ORIGEN"]),
    telefono: limpiarONull(row["TELEFONO"]),
    telefonoAlternativo: limpiarONull(row["TELEFONO ALTERNATIVO"]),
    contactoEmergencia: limpiarONull(row["A QUIEN PERTENECE EL CONTACTO DE EMERGENCIA APORTADO?"]),
    domicilioReal: limpiarONull(row["DOMICILIO REAL"]),
    ciudad: limpiarONull(row["CIUDAD"]),
    barrio: limpiarONull(row["BARRIO"]),
    nroDomicilio: limpiarONull(row["NRO. DE DOMICILIO"]),
    piso: limpiarONull(row["PISO"]),
    turno: limpiarONull(row["TURNO"]),
    fechaIngreso: parseFechaArgentina(row["FECHA DE INGRESO"]),
    tipoPersonal,
    rangoId,
    anoEgreso: parseFechaArgentina(row["AÑO DE EGRESO"]) ? String(new Date(parseFechaArgentina(row["AÑO DE EGRESO"])).getUTCFullYear()) : "",
    perteneceETAC: parseBooleano(row["PERTENECIÓ AL E.T.A.C?"]),
    origenInstitucional,
    origenInstitucionalDetalle: origenInstitucional === "OTRA_DEPENDENCIA" ? limpiar(row["DEPENDENCIA"]) : "",
    hijosCargo: Number.isFinite(hijosCargoNum) ? hijosCargoNum : 0,
    poseeSepelio,
    empresaSepelio: poseeSepelio ? limpiarONull(row["Nombre de la empresa"]) : "",
    grupoSanguineo: limpiarONull(row["GRUPO SANGUINEO"]),
    alergias: limpiarONull(row["ALERGIAS"]),
    enfermedadesCronicas: limpiarONull(row["ENFERMEDADES CRONICAS"]),
    medicamentos: limpiarONull(row["MEDICAMENTOS POR TRATAMIENTOS PROLONGADOS"]),
    cirugias: limpiarONull(row["CIRUJIAS"]),
    nivelPrimario: limpiarONull(row["NIVEL ACADEMICO [PRIMARIO]"]),
    nivelSecundario: limpiarONull(row["NIVEL ACADEMICO [SECUNDARIA]"]),
    nivelTerciario: limpiarONull(row["NIVEL ACADEMICO [TERCIARIO]"]),
    nivelUniversitario: limpiarONull(row["NIVEL ACADEMICO [UNIVERISTARIO]"]),
    nivelSuperior: limpiarONull(row["NIVEL ACADEMICO [SUPERIOR]"]),
    detalleTitulos: limpiarONull(row["DETALLE DE TITULO O ESTUDIOS"]),
    licenciaConducir: limpiarONull(row["LICENCIA DE CONDUCIR"]),
    licenciaEmision: parseFechaArgentina(row["FECHA DE EMISION "]) || parseFechaArgentina(row["FECHA DE EMISION"]),
    licenciaVencimiento: parseFechaArgentina(row["FECHA DE VENCIMIENTO"]),
    fotoUrl: limpiarONull(row["FOTO"]),
  };

  return {
    ok: true,
    datos,
    advertencias,
    contexto: {
      funciones: limpiar(row["FUNCIONES"]),
      status: limpiar(row["Status"]),
      detalle: limpiar(row["Detalle"]),
    },
  };
}
