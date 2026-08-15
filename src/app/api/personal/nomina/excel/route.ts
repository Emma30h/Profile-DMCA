import ExcelJS from "exceljs";
import { obtenerFilasNomina } from "@/lib/nomina";

// Route Handler (no Server Action) a propósito: generar un archivo binario
// descargable con headers propios (Content-Disposition) es exactamente el
// caso de uso de los Route Handlers en esta versión de Next.js — las Server
// Actions están pensadas para mutaciones y se encolan, no para servir
// contenido no-HTML. Es un endpoint público: repite la verificación de
// sesión/rol de obtenerFilasNomina() en vez de heredarla del árbol de React.
export async function POST(request: Request) {
  let body: { ids?: unknown; campos?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Body inválido", { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string") : [];
  const campos = Array.isArray(body.campos) ? body.campos.filter((v): v is string => typeof v === "string") : [];

  let datos;
  try {
    // sanitizar: false — el anti-CSV-injection es específico de texto plano
    // reparseado (CSV/TSV); en una celda .xlsx real ensuciaría el dato.
    datos = await obtenerFilasNomina(ids, campos, { sanitizar: false });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "No se pudo generar la nómina";
    const status = mensaje === "No autenticado" || mensaje === "Sin permiso" ? 403 : 400;
    return new Response(mensaje, { status });
  }

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Nómina");
  hoja.columns = datos.columnas.map((c) => ({ header: c.label, key: c.id, width: Math.max(c.label.length + 2, 14) }));
  hoja.addRows(datos.filas);
  hoja.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `nomina_${fecha}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="nomina.xlsx"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    },
  });
}
