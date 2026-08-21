"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { enviarCodigoEliminarUsuario } from "@/lib/email";
import { verificarPassword } from "@/lib/verificarPassword";
import type { RolUsuario, ResultadoAccion } from "@/types";

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];

async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const current = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true, email: true, rol: true, activo: true },
  });

  if (!current || !current.activo || !ROLES_ADMIN.includes(current.rol as RolUsuario)) {
    throw new Error("Sin permiso");
  }
  return current;
}

export async function actualizarRol(usuarioId: string, rol: RolUsuario): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { rol },
    });
    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar el rol" };
  }
}

// Activar/desactivar exige la contraseña del admin — desactivar corta el
// acceso de alguien al toque (ver ensureUsuario/force-logout) y reactivar
// se lo devuelve, así que las dos direcciones son igual de sensibles.
export async function toggleActivoConfirmado(
  usuarioId: string,
  activo: boolean,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await verificarAdmin();
    if (current.id === usuarioId) throw new Error("No podés cambiar el estado de tu propia cuenta");

    const passwordOk = await verificarPassword(current.email, password);
    if (!passwordOk) return { ok: false, error: "Contraseña incorrecta." };

    await prisma.usuario.update({ where: { id: usuarioId }, data: { activo } });
    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al cambiar el estado." };
  }
}

// Borrar de Supabase Auth (panel de Authentication) no borra nada acá — son
// dos bases separadas. Este flujo limpia esa fila huérfana cuando un admin
// borró la cuenta directo en Supabase (o simplemente quiere eliminar a
// alguien en vez de solo desactivarlo). Al ser irreversible, exige tres
// pasos: confirmar → código de 8 dígitos enviado al mail del ADMIN que pide
// el borrado (no al del usuario objetivo, que puede no tener ya ni cuenta)
// → contraseña del admin. El legajo vinculado, si tiene uno, se desvincula
// en vez de borrarse: los datos del agente son valiosos y no dependen de
// que exista una cuenta. Los pedidos/notificaciones de esa cuenta sí se
// borran (son propios de la cuenta, no del legajo). El audit log NO tiene
// FK a Usuario a propósito (usuarioNombre queda como snapshot), así que
// sobrevive intacto.

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_INTENTOS = 5;

function generarCodigo(): string {
  return Math.floor(10_000_000 + Math.random() * 90_000_000).toString();
}

async function validarObjetivoEliminable(current: { id: string }, usuarioId: string) {
  if (current.id === usuarioId) throw new Error("No podés eliminar tu propia cuenta");

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { activo: true, nombre: true, apellido: true, email: true },
  });
  if (!usuario) throw new Error("Usuario no encontrado");
  if (usuario.activo) throw new Error("Desactivá la cuenta antes de eliminarla");
  return usuario;
}

/** Paso 1: pedir código de confirmación (va al mail del admin) */
export async function solicitarCodigoEliminarUsuario(
  usuarioId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await verificarAdmin();
    const objetivo = await validarObjetivoEliminable(current, usuarioId);

    const code = generarCodigo();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.confirmacionEliminarUsuario.deleteMany({
      where: { adminId: current.id, objetivoId: usuarioId },
    });
    await prisma.confirmacionEliminarUsuario.create({
      data: { adminId: current.id, objetivoId: usuarioId, code, expiresAt },
    });

    const nombreObjetivo =
      [objetivo.apellido, objetivo.nombre].filter(Boolean).join(", ") || objetivo.email;
    await enviarCodigoEliminarUsuario(current.email, code, nombreObjetivo);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo enviar el código." };
  }
}

/** Paso 2: verificar el código de 8 dígitos */
export async function verificarCodigoEliminarUsuario(
  usuarioId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await verificarAdmin();

    const confirmacion = await prisma.confirmacionEliminarUsuario.findFirst({
      where: { adminId: current.id, objetivoId: usuarioId },
    });

    if (!confirmacion || confirmacion.expiresAt < new Date()) {
      if (confirmacion) await prisma.confirmacionEliminarUsuario.delete({ where: { id: confirmacion.id } });
      return { ok: false, error: "El código expiró o es inválido. Solicitá uno nuevo." };
    }

    if (confirmacion.attempts >= MAX_INTENTOS) {
      await prisma.confirmacionEliminarUsuario.delete({ where: { id: confirmacion.id } });
      return { ok: false, error: "Demasiados intentos fallidos. Solicitá un nuevo código." };
    }

    if (confirmacion.code !== code.trim()) {
      const nuevosIntentos = confirmacion.attempts + 1;
      await prisma.confirmacionEliminarUsuario.update({
        where: { id: confirmacion.id },
        data: { attempts: nuevosIntentos },
      });
      const restantes = MAX_INTENTOS - nuevosIntentos;
      return {
        ok: false,
        error: restantes > 0
          ? `Código incorrecto. Te quedan ${restantes} intento${restantes !== 1 ? "s" : ""}.`
          : "Sin intentos restantes. Solicitá un nuevo código.",
      };
    }

    await prisma.confirmacionEliminarUsuario.update({
      where: { id: confirmacion.id },
      data: { verified: true },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al verificar el código." };
  }
}

/** Paso 3: confirmar con contraseña y ejecutar el borrado */
export async function confirmarEliminarUsuario(
  usuarioId: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await verificarAdmin();
    // Re-validar (no solo confiar en lo que ya se chequeó en el paso 1: el
    // estado pudo cambiar mientras el admin completaba el flujo).
    await validarObjetivoEliminable(current, usuarioId);

    const confirmacion = await prisma.confirmacionEliminarUsuario.findFirst({
      where: { adminId: current.id, objetivoId: usuarioId },
    });
    if (!confirmacion || confirmacion.expiresAt < new Date() || !confirmacion.verified) {
      return { ok: false, error: "Verificación inválida o expirada. Empezá el proceso de nuevo." };
    }

    if (confirmacion.intentosPassword >= MAX_INTENTOS) {
      await prisma.confirmacionEliminarUsuario.delete({ where: { id: confirmacion.id } });
      return { ok: false, error: "Demasiados intentos fallidos. Empezá el proceso de nuevo." };
    }

    const passwordOk = await verificarPassword(current.email, password);

    if (!passwordOk) {
      const nuevosIntentos = confirmacion.intentosPassword + 1;
      await prisma.confirmacionEliminarUsuario.update({
        where: { id: confirmacion.id },
        data: { intentosPassword: nuevosIntentos },
      });
      const restantes = MAX_INTENTOS - nuevosIntentos;
      return {
        ok: false,
        error: restantes > 0
          ? `Contraseña incorrecta. Te quedan ${restantes} intento${restantes !== 1 ? "s" : ""}.`
          : "Sin intentos restantes. Empezá el proceso de nuevo.",
      };
    }

    await prisma.$transaction([
      prisma.agente.updateMany({ where: { usuarioId }, data: { usuarioId: null } }),
      prisma.notificacion.deleteMany({ where: { usuarioId } }),
      prisma.solicitudFoto.deleteMany({ where: { usuarioId } }),
      prisma.solicitudEdicion.deleteMany({ where: { usuarioId } }),
      prisma.solicitudVinculacion.deleteMany({ where: { usuarioId } }),
      prisma.confirmacionEliminarUsuario.delete({ where: { id: confirmacion.id } }),
      prisma.usuario.delete({ where: { id: usuarioId } }),
    ]);

    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al eliminar el usuario." };
  }
}

export async function vincularAgente(usuarioId: string, agenteId: string | null): Promise<ResultadoAccion> {
  try {
    await verificarAdmin();
    if (agenteId) {
      // Desvincular si ese agente ya tenía otro usuario asignado
      await prisma.agente.updateMany({
        where: { usuarioId, NOT: { id: agenteId } },
        data: { usuarioId: null },
      });
      await prisma.agente.update({
        where: { id: agenteId },
        data: { usuarioId },
      });
    } else {
      // Desvincular
      await prisma.agente.updateMany({
        where: { usuarioId },
        data: { usuarioId: null },
      });
    }
    revalidatePath("/configuracion/usuarios");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al vincular el agente" };
  }
}
