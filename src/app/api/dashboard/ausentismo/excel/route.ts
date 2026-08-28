import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario } from "@/types";

// Route Handler (no Server Action) — mismo motivo que
// /api/personal/nomina/excel: generar un .xlsx descargable con headers
// propios (Content-Disposition) es el caso de uso de los Route Handlers en
// esta versión de Next.js. Es un endpoint público, repite la verificación
// de sesión/rol en vez de heredarla del árbol de React.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("No autenticado", { status: 403 });

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true, activo: true },
  });
  if (!usuario?.activo) return new Response("Sin permiso", { status: 403 });

  // Mismo criterio que el dashboard: Operador y Readonly no ven la tarjeta
  // "Ausentismo por causa" en pantalla, tampoco pueden pedir su Excel
  // pegándole directo a este endpoint.
  const rol = usuario.rol as RolUsuario;
  if (rol === "OPERADOR" || rol === "READONLY") return new Response("Sin permiso", { status: 403 });

  let body: { columnas?: unknown; filas?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Body inválido", { status: 400 });
  }

  const columnas = Array.isArray(body.columnas)
    ? body.columnas.filter(
        (c): c is { id: string; label: string } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as { id?: unknown }).id === "string" &&
          typeof (c as { label?: unknown }).label === "string"
      )
    : [];
  const filas = Array.isArray(body.filas)
    ? body.filas.filter((f): f is Record<string, string> => typeof f === "object" && f !== null)
    : [];
  if (columnas.length === 0 || filas.length === 0) return new Response("Sin datos para exportar", { status: 400 });

  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Ausentismo por causa");
  hoja.columns = columnas.map((c) => ({ header: c.label, key: c.id, width: Math.max(c.label.length + 2, 14) }));
  hoja.addRows(filas);
  hoja.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();

  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `ausentismo_por_causa_${fecha}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ausentismo.xlsx"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
    },
  });
}
