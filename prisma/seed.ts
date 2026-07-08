/**
 * Script de migración de datos
 * Lee el Excel DB__D_M_C_A.xlsx de prisma/data/ e inserta los agentes en la DB.
 *
 * Uso:
 *   npx tsx prisma/seed.ts
 *
 * Colocar el Excel en: prisma/data/DB__D_M_C_A.xlsx
 */

import { PrismaClient } from "@prisma/client";
import type { TipoPersonal } from "../src/types";
import * as ExcelJS from "exceljs";
import * as path from "path";

const prisma = new PrismaClient();

// ─── Escalafón completo ───────────────────────────────────────────────────────

const RANGOS_SEED = [
  // Cuerpo Suboficial
  { nombre: "Agente", cuerpo: "SUBOFICIAL", orden: 1 },
  { nombre: "Cabo", cuerpo: "SUBOFICIAL", orden: 2 },
  { nombre: "Cabo Primero", cuerpo: "SUBOFICIAL", orden: 3 },
  { nombre: "Sargento", cuerpo: "SUBOFICIAL", orden: 4 },
  { nombre: "Sargento Primero", cuerpo: "SUBOFICIAL", orden: 5 },
  { nombre: "Sargento Ayudante", cuerpo: "SUBOFICIAL", orden: 6 },
  { nombre: "Suboficial Principal", cuerpo: "SUBOFICIAL", orden: 7 },
  { nombre: "Suboficial Mayor", cuerpo: "SUBOFICIAL", orden: 8 },
  // Cuerpo Oficial
  { nombre: "Oficial Ayudante", cuerpo: "OFICIAL", orden: 9 },
  { nombre: "Oficial Subinspector", cuerpo: "OFICIAL", orden: 10 },
  { nombre: "Oficial Inspector", cuerpo: "OFICIAL", orden: 11 },
  { nombre: "Oficial Principal", cuerpo: "OFICIAL", orden: 12 },
  { nombre: "Subcomisario", cuerpo: "OFICIAL", orden: 13 },
  { nombre: "Comisario", cuerpo: "OFICIAL", orden: 14 },
  { nombre: "Comisario Inspector", cuerpo: "OFICIAL", orden: 15 },
  { nombre: "Comisario Mayor", cuerpo: "OFICIAL", orden: 16 },
  { nombre: "Comisario General", cuerpo: "OFICIAL", orden: 17 },
  { nombre: "Jefe", cuerpo: "OFICIAL", orden: 18 },
  // Cuerpo Técnico
  { nombre: "Agente Técnico", cuerpo: "TECNICO", orden: 19 },
  { nombre: "Cabo Técnico", cuerpo: "TECNICO", orden: 20 },
  { nombre: "Cabo Primero Técnico", cuerpo: "TECNICO", orden: 21 },
  { nombre: "Sargento Técnico", cuerpo: "TECNICO", orden: 22 },
  { nombre: "Sargento Primero Técnico", cuerpo: "TECNICO", orden: 23 },
  { nombre: "Sargento Ayudante Técnico", cuerpo: "TECNICO", orden: 24 },
  { nombre: "Principal Técnico", cuerpo: "TECNICO", orden: 25 },
  { nombre: "Mayor Técnico", cuerpo: "TECNICO", orden: 26 },
];

const SECTORES_SEED = [
  { nombre: "Dirección Monitoreo Cordobeses en Alerta", tipo: "DIRECCION" as const, padre: null },
  { nombre: "División Ayudantía Dir. Monitoreo Cordobeses en Alerta", tipo: "DIVISION" as const, padre: "Dirección Monitoreo Cordobeses en Alerta" },
  { nombre: "Departamento Alerta Ciudadana", tipo: "DEPARTAMENTO" as const, padre: "Dirección Monitoreo Cordobeses en Alerta" },
  { nombre: "División Coordinación Vecinal", tipo: "DIVISION" as const, padre: "Departamento Alerta Ciudadana" },
  { nombre: "División Alerta", tipo: "DIVISION" as const, padre: "Departamento Alerta Ciudadana" },
  { nombre: "Departamento Socio Educativo", tipo: "DEPARTAMENTO" as const, padre: "Dirección Monitoreo Cordobeses en Alerta" },
];

const TURNOS_SEED = [
  { nombre: "A", horaInicio: "07:00", horaFin: "15:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "B", horaInicio: "07:00", horaFin: "15:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "C", horaInicio: "15:00", horaFin: "23:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "D", horaInicio: "15:00", horaFin: "23:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "E", horaInicio: "23:00", horaFin: "07:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "F", horaInicio: "23:00", horaFin: "07:00", diasTrabajo: 2, diasDescanso: 2 },
  { nombre: "GUARDIA LARGA", horaInicio: "10:00", horaFin: "22:00", diasTrabajo: 1, diasDescanso: 2 },
  { nombre: "ADMINISTRATIVO", horaInicio: null, horaFin: null, diasTrabajo: 0, diasDescanso: 0 },
  { nombre: "FULL TIME", horaInicio: null, horaFin: null, diasTrabajo: 0, diasDescanso: 0 },
  { nombre: "SUPERIOR DE TURNO", horaInicio: null, horaFin: null, diasTrabajo: 0, diasDescanso: 0 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

function strUpper(val: unknown): string | null {
  const s = str(val);
  return s ? s.toUpperCase() : null;
}

function num(val: unknown): string | null {
  if (val == null) return null;
  const n = Number(val);
  if (isNaN(n)) return str(val);
  return String(Math.round(n));
}

function bool(val: unknown): boolean {
  if (val == null) return false;
  const s = String(val).trim().toLowerCase();
  return s === "sí" || s === "si" || s === "true" || s === "1";
}

function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseTipoPersonal(val: unknown): TipoPersonal {
  const s = str(val)?.toUpperCase().replace(/\s+/g, "_") ?? "";
  const map: Record<string, TipoPersonal> = {
    CIVIL_BECARIO: "CIVIL_BECARIO",
    "CIVIL BECARIO": "CIVIL_BECARIO",
    CIVIL_POLICIAL: "CIVIL_POLICIAL",
    "CIVIL POLICIAL": "CIVIL_POLICIAL",
    SEGURIDAD: "SEGURIDAD",
    TECNICO: "TECNICO",
    TÉCNICO: "TECNICO",
  };
  return map[s] ?? "CIVIL_BECARIO";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // 1. Crear Rangos
  console.log("📌 Creando rangos...");
  for (const rango of RANGOS_SEED) {
    await prisma.rango.upsert({
      where: { nombre: rango.nombre },
      update: { cuerpo: rango.cuerpo, orden: rango.orden },
      create: rango,
    });
  }
  const rangosDB = await prisma.rango.findMany();
  const rangoMap = new Map<string, string>(
    rangosDB.map((r: { id: string; nombre: string }) => [r.nombre.toLowerCase(), r.id])
  );
  console.log(`   ✅ ${rangosDB.length} rangos`);

  // 2. Crear Sectores
  console.log("🏢 Creando sectores...");
  const sectorMap = new Map<string, string>();
  for (const sector of SECTORES_SEED) {
    const padreId = sector.padre ? sectorMap.get(sector.padre) ?? null : null;
    const created = await prisma.sector.upsert({
      where: { nombre: sector.nombre },
      update: {},
      create: { nombre: sector.nombre, tipo: sector.tipo, padreId },
    });
    sectorMap.set(sector.nombre, created.id);
  }
  console.log(`   ✅ ${SECTORES_SEED.length} sectores`);

  // 3. Crear Turnos
  console.log("🕐 Creando turnos...");
  for (const turno of TURNOS_SEED) {
    await prisma.turno.upsert({
      where: { nombre: turno.nombre },
      update: {},
      create: turno,
    });
  }
  console.log(`   ✅ ${TURNOS_SEED.length} turnos`);

  // 4. Leer Excel
  const excelPath = path.join(__dirname, "data", "DB_ D.M.C.A.xlsx");
  console.log(`\n📊 Leyendo Excel: ${excelPath}`);

  let workbook: ExcelJS.Workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
  } catch {
    console.warn("⚠️  No se encontró el Excel. Saltando migración de agentes.");
    console.warn(`   Colocar el archivo en: ${excelPath}`);
    await prisma.$disconnect();
    return;
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    console.error("❌ No se encontró ninguna hoja en el Excel.");
    await prisma.$disconnect();
    return;
  }

  // Leer encabezados de la primera fila
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell) => {
    headers.push(String(cell.value ?? "").trim());
  });

  console.log(`   Columnas detectadas: ${headers.length}`);
  console.log(`   Filas de datos: ${sheet.rowCount - 1}`);

  // 5. Insertar Agentes
  console.log("\n👥 Migrando agentes...");
  let insertados = 0;
  let omitidos = 0;
  const errores: string[] = [];

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);

    // Función helper para obtener valor por nombre de columna
    const get = (colName: string) => {
      const idx = headers.indexOf(colName);
      if (idx === -1) return null;
      const cell = row.getCell(idx + 1);
      return cell.value;
    };

    const cuil = num(get("CUIL"));
    if (!cuil) {
      omitidos++;
      continue;
    }

    const apellidos = strUpper(get("APELLIDO/S")) ?? strUpper(get("APELLIDOS")) ?? "";
    const nombres = str(get("NOMBRE/S")) ?? str(get("NOMBRES")) ?? "";

    if (!apellidos && !nombres) {
      omitidos++;
      continue;
    }

    // Corrección manual conocida: Suarez, Agustina → CIVIL_BECARIO
    let tipoPersonalRaw = get("TIPO DE PERSONAL");
    if (apellidos.includes("SUAREZ") && nombres.toLowerCase().includes("agustina")) {
      tipoPersonalRaw = "CIVIL BECARIO";
    }
    const tipoPersonal = parseTipoPersonal(tipoPersonalRaw);

    // Rango solo para SEGURIDAD (y TECNICO si corresponde)
    let rangoId: string | null = null;
    if (tipoPersonal === "SEGURIDAD" || tipoPersonal === "TECNICO") {
      const jerarquia = str(get("JERARQUIA"));
      if (jerarquia) {
        rangoId = rangoMap.get(jerarquia.toLowerCase()) ?? null;
        if (!rangoId) {
          console.warn(`   ⚠️  Rango no encontrado: "${jerarquia}" (${apellidos}, ${nombres})`);
        }
      }
    }

    try {
      await prisma.agente.upsert({
        where: { cuil },
        update: {},
        create: {
          cuil,
          nombres,
          apellidos,
          sexo: str(get("SEXO")) ?? "MASCULINO",
          fechaNacimiento: parseDate(get("FECHA DE NACIMIENTO")),
          estadoCivil: str(get("ESTADO CIVIL")),
          nacionalidad: str(get("NACIONALIDAD")),
          provinciaOrigen: str(get("PROVINCIA DE ORIGEN")),
          ciudadOrigen: str(get("CIUDAD DE ORIGEN")),
          telefono: num(get("TELEFONO")),
          telefonoAlternativo: num(get("TELEFONO ALTERNATIVO")),
          contactoEmergencia: str(get("A QUIEN PERTENECE...")),
          domicilioReal: str(get("DOMICILIO REAL")),
          ciudad: str(get("CIUDAD")),
          barrio: str(get("BARRIO")),
          nroDomicilio: num(get("NRO. DE DOMICILIO")),
          piso: num(get("PISO")),
          hijosCargo: Number(get("HIJOS A CARGO") ?? 0) || 0,
          poseeSepelio: bool(get("POSEE SERVICIO DE SEPELIO")),
          empresaSepelio: str(get("Nombre de la empresa")),
          tipoPersonal,
          estado: "ACTIVO",
          turno: str(get("TURNO")),
          fechaIngreso: parseDate(get("FECHA DE INGRESO")),
          rangoId,
          anoEgreso: parseDate(get("AÑO DE EGRESO")),
          perteneceETAC:
            get("PERTENECIÓ AL E.T.A.C?") != null
              ? bool(get("PERTENECIÓ AL E.T.A.C?"))
              : null,
          tipoArma: str(get("TIPO DE ARMA")),
          marcaPistola: str(get("MARCA DE PISTOLA")),
          modeloPistola: str(get("MODELO DE PISTOLA")),
          calibre: str(get("CALIBRE")),
          chalecoProvisto: get("CHALECO PROVISTO") != null ? bool(get("CHALECO PROVISTO")) : null,
          marcaChaleco: str(get("MARCA")),
          nroSeriePlacas: num(get("N° DE SERIE (PLACAS)")),
          talleChaleco: str(get("TALLE")),
          vencimientoChaleco: parseDate(get("VENCIMIENTO")),
          grupoSanguineo: str(get("GRUPO SANGUINEO")),
          alergias: str(get("ALERGIAS")),
          enfermedadesCronicas: str(get("ENFERMEDADES CRONICAS")),
          medicamentos: str(get("MEDICAMENTOS...")),
          cirugias: str(get("CIRUJIAS")),
          nivelPrimario: str(get("NIVEL ACADEMICO [PRIMARIO]")),
          nivelSecundario: str(get("NIVEL ACADEMICO [SECUNDARIA]")),
          nivelTerciario: str(get("NIVEL ACADEMICO [TERCIARIO]")),
          nivelUniversitario: str(get("NIVEL ACADEMICO [UNIVERISTARIO]")),
          nivelSuperior: str(get("NIVEL ACADEMICO [SUPERIOR]")),
          detalleTitulos: str(get("DETALLE DE TITULO O ESTUDIOS")),
          licenciaConducir: str(get("LICENCIA DE CONDUCIR")),
          licenciaEmision: parseDate(get("FECHA DE EMISION")),
          licenciaVencimiento: parseDate(get("FECHA DE VENCIMIENTO")),
          email: str(get("Dirección de correo electrónico"))?.toLowerCase() ?? null,
          fotoUrl: str(get("FOTO")),
        },
      });
      insertados++;

      if (insertados % 50 === 0) {
        console.log(`   ... ${insertados} agentes procesados`);
      }
    } catch (err) {
      const msg = `Fila ${rowNum} (CUIL: ${cuil}): ${err instanceof Error ? err.message : String(err)}`;
      errores.push(msg);
      console.error(`   ❌ ${msg}`);
    }
  }

  console.log(`\n✅ Seed completado:`);
  console.log(`   Insertados: ${insertados}`);
  console.log(`   Omitidos (vacíos): ${omitidos}`);
  console.log(`   Errores: ${errores.length}`);

  if (errores.length > 0) {
    console.log("\n📋 Errores detallados:");
    errores.forEach((e) => console.log(`   - ${e}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
