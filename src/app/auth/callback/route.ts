import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const superadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
      const userEmail = data.user.email?.toLowerCase().trim() ?? "";

      // Si no existe aún el usuario en la DB, calculamos qué rol asignar
      const existing = await prisma.usuario.findUnique({ where: { id: data.user.id } });

      if (!existing) {
        // Es SUPERADMIN si su email coincide con SUPERADMIN_EMAIL
        // o si es el primer usuario registrado y no hay ningún SUPERADMIN todavía
        let rol: string = "READONLY";

        if (superadminEmail && userEmail === superadminEmail) {
          rol = "SUPERADMIN";
        } else {
          const haySuperadmin = await prisma.usuario.findFirst({
            where: { rol: "SUPERADMIN" },
          });
          if (!haySuperadmin) {
            // Primer usuario del sistema → SUPERADMIN automático
            rol = "SUPERADMIN";
          }
        }

        await prisma.usuario.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            rol,
            activo: true,
          },
        });
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
