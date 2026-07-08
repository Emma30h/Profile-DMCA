import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import type { RolUsuario } from "@/types";

async function ensureUsuario(): Promise<RolUsuario> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Buscar por ID (caso normal) o por email (usuario recreado tras borrar de Supabase)
  const existing = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true } } },
  });

  if (existing) {
    // Cuenta deshabilitada por un admin → forzar cierre de sesión
    if (!existing.activo) {
      redirect("/api/auth/force-logout");
    }

    // Si el registro existe pero con un ID viejo (cuenta recreada), actualizar el ID y metadata
    if (existing.id !== user.id) {
      const meta = user.user_metadata ?? {};
      await prisma.usuario.update({
        where: { id: existing.id },
        data: {
          id: user.id,
          nombre: meta.nombre ?? existing.nombre,
          apellido: meta.apellido ?? existing.apellido,
          tipoPersonal: meta.tipoPersonal ?? existing.tipoPersonal,
          jerarquia: meta.jerarquia ?? existing.jerarquia,
        },
      });

      // Intentar vinculación automática si aún no tiene agente vinculado
      if (!existing.agente) {
        const agente = await prisma.agente.findFirst({
          where: { email: user.email!, usuarioId: null },
        });
        if (agente) {
          await prisma.agente.update({
            where: { id: agente.id },
            data: { usuarioId: user.id },
          });
        }
      }
    }
    return existing.rol as RolUsuario;
  }

  // Primera vez que llega al dashboard — crear registro en Prisma
  const superadminEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const userEmail = user.email?.toLowerCase().trim() ?? "";

  let rol: RolUsuario = "READONLY";
  if (superadminEmail && userEmail === superadminEmail) {
    rol = "SUPERADMIN";
  } else {
    const haySuperadmin = await prisma.usuario.findFirst({ where: { rol: "SUPERADMIN" } });
    if (!haySuperadmin) rol = "SUPERADMIN";
  }

  const meta = user.user_metadata ?? {};
  try {
    await prisma.usuario.create({
      data: {
        id: user.id,
        email: user.email!,
        rol,
        activo: true,
        nombre: meta.nombre ?? null,
        apellido: meta.apellido ?? null,
        tipoPersonal: meta.tipoPersonal ?? null,
        jerarquia: meta.jerarquia ?? null,
      },
    });
  } catch (e: unknown) {
    // Carrera entre requests concurrentes — ignorar duplicado
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code !== "P2002"
    ) {
      throw e;
    }
    // Si hubo P2002, releer el registro que ganó la carrera
    const created = await prisma.usuario.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email! }] },
    });
    return (created?.rol ?? "READONLY") as RolUsuario;
  }

  // Vinculación automática: si hay un agente con el mismo email y sin usuario, conectarlo
  const agente = await prisma.agente.findFirst({
    where: { email: user.email!, usuarioId: null },
  });
  if (agente) {
    await prisma.agente.update({
      where: { id: agente.id },
      data: { usuarioId: user.id },
    });
  }

  return rol;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rol = await ensureUsuario();

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar rol={rol} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
