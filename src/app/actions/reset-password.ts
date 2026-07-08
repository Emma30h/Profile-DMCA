"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { enviarCodigoReset } from "@/lib/email";

// ─── Configuración ───────────────────────────────────────────────────────────

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutos en ms
const MAX_INTENTOS = 5;

function generarCodigo(): string {
  return Math.floor(10_000_000 + Math.random() * 90_000_000).toString();
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/** Paso 1: solicitar código de verificación */
export async function solicitarCodigo(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const emailNorm = email.trim().toLowerCase();

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { email: emailNorm },
      select: { id: true, activo: true },
    });

    // Respuesta genérica: no revelar si el email existe o no
    if (!usuario || !usuario.activo) {
      return { ok: true };
    }

    const code = generarCodigo();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Eliminar tokens anteriores del mismo email y crear uno nuevo
    await prisma.resetToken.deleteMany({ where: { email: emailNorm } });
    await prisma.resetToken.create({
      data: { email: emailNorm, code, expiresAt },
    });

    await enviarCodigoReset(emailNorm, code);

    return { ok: true };
  } catch (err) {
    console.error("[solicitarCodigo]", err);
    return { ok: false, error: "No se pudo enviar el código. Intentá de nuevo." };
  }
}

/** Paso 2: verificar el código de 8 dígitos */
export async function verificarCodigo(
  email: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const emailNorm = email.trim().toLowerCase();

  try {
    const token = await prisma.resetToken.findFirst({
      where: { email: emailNorm },
    });

    if (!token || token.expiresAt < new Date()) {
      if (token) await prisma.resetToken.delete({ where: { id: token.id } });
      return { ok: false, error: "El código expiró o es inválido. Solicitá uno nuevo." };
    }

    if (token.attempts >= MAX_INTENTOS) {
      await prisma.resetToken.delete({ where: { id: token.id } });
      return { ok: false, error: "Demasiados intentos fallidos. Solicitá un nuevo código." };
    }

    if (token.code !== code.trim()) {
      const nuevosIntentos = token.attempts + 1;
      await prisma.resetToken.update({
        where: { id: token.id },
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

    // Código correcto — marcar como verificado
    await prisma.resetToken.update({
      where: { id: token.id },
      data: { verified: true },
    });

    return { ok: true };
  } catch (err) {
    console.error("[verificarCodigo]", err);
    return { ok: false, error: "Error al verificar el código. Intentá de nuevo." };
  }
}

/** Paso 3: cambiar la contraseña */
export async function cambiarContrasenaAction(
  email: string,
  code: string,
  nuevaContrasena: string
): Promise<{ ok: boolean; error?: string }> {
  const emailNorm = email.trim().toLowerCase();

  try {
    const token = await prisma.resetToken.findFirst({
      where: { email: emailNorm },
    });

    if (!token || token.expiresAt < new Date() || !token.verified || token.code !== code.trim()) {
      return { ok: false, error: "Verificación inválida o expirada. Solicitá un nuevo código." };
    }

    // Validar requisitos de contraseña
    if (
      nuevaContrasena.length < 8 ||
      !/[A-Z]/.test(nuevaContrasena) ||
      !/[a-z]/.test(nuevaContrasena) ||
      !/[0-9]/.test(nuevaContrasena)
    ) {
      return { ok: false, error: "La contraseña no cumple con todos los requisitos." };
    }

    // Obtener el ID del usuario desde Prisma (coincide con el UID de Supabase Auth)
    const usuario = await prisma.usuario.findFirst({
      where: { email: emailNorm },
      select: { id: true },
    });
    if (!usuario) {
      return { ok: false, error: "Usuario no encontrado." };
    }

    // Actualizar la contraseña con el cliente admin de Supabase
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      usuario.id,
      { password: nuevaContrasena }
    );

    if (updateError) {
      console.error("[cambiarContrasenaAction] Supabase error:", updateError);
      return { ok: false, error: "No se pudo actualizar la contraseña. Intentá de nuevo." };
    }

    // Invalidar el token una vez usado
    await prisma.resetToken.delete({ where: { id: token.id } });

    return { ok: true };
  } catch (err) {
    console.error("[cambiarContrasenaAction]", err);
    return { ok: false, error: "Error inesperado. Intentá de nuevo." };
  }
}
