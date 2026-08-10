"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Se llama justo después de un login exitoso, antes de navegar a /dashboard.
// Supabase Auth no sabe nada de nuestro campo Usuario.activo, así que un
// login con credenciales correctas siempre "funciona" del lado de Supabase
// aunque el admin haya deshabilitado la cuenta acá — sin este chequeo, el
// aviso de cuenta deshabilitada dependía de que el layout de /dashboard
// alcanzara a leer la sesión recién creada (carrera con la propagación de
// las cookies), y por eso a veces no aparecía. Acá se resuelve en el mismo
// paso, sin esa carrera.
export async function verificarCuentaActiva(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { activo: true },
  });

  if (!usuario || !usuario.activo) {
    await supabase.auth.signOut();
    return false;
  }

  return true;
}
