import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { autoVincularLegajo } from "@/lib/vincularLegajoAuto";

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
      let rol: string;

      if (existing) {
        rol = existing.rol;
      } else {
        // Es SUPERADMIN si su email coincide con SUPERADMIN_EMAIL
        // o si es el primer usuario registrado y no hay ningún SUPERADMIN todavía
        rol = "READONLY";

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

        const meta = data.user.user_metadata ?? {};
        await prisma.usuario.create({
          data: {
            id: data.user.id,
            email: data.user.email!,
            rol,
            activo: true,
            nombre: meta.nombre ?? null,
            apellido: meta.apellido ?? null,
            tipoPersonal: meta.tipoPersonal ?? null,
            jerarquia: meta.jerarquia ?? null,
          },
        });

        // Legajo cargado antes (ej. Excel) con el mismo CUIL declarado en el
        // registro o, si no matchea, con el mismo email → vincular solo.
        await autoVincularLegajo(data.user.id, {
          cuil: meta.cuil,
          email: userEmail,
          nombre: meta.nombre,
          apellido: meta.apellido,
        });
      }

      // Una cuenta recién creada (READONLY, sin rol asignado por un admin
      // todavía) va sí o sí a /perfil — ahí puede vincular o cargar su
      // legajo. El resto de la app queda para cuando un admin le asigne rol.
      return NextResponse.redirect(`${origin}${rol === "READONLY" ? "/perfil" : "/dashboard"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
