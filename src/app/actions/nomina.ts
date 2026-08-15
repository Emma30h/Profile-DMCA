"use server";

import { obtenerFilasNomina, type FilaNomina } from "@/lib/nomina";

/** Usada por CSV, Copiar e Imprimir del lado cliente — valores sanitizados
 *  contra CSV/TSV injection (ver src/lib/nomina.ts). El Excel se genera
 *  aparte, en el Route Handler /api/personal/nomina/excel (sin sanitizar:
 *  no aplica al formato .xlsx real, ver comentario ahí). */
export async function obtenerDatosNomina(ids: string[], campos: string[]): Promise<FilaNomina> {
  return obtenerFilasNomina(ids, campos);
}
