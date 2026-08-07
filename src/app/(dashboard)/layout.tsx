import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { MobileSidebarProvider } from "@/components/layout/MobileSidebarContext";
import EventosAsideShell from "@/components/layout/EventosAsideShell";
import EventosAsideContent from "./dashboard/EventosAsideContent";
import EventosAsideSkeleton from "./dashboard/EventosAsideSkeleton";
import type { RolUsuario } from "@/types";

async function ensureUsuario(): Promise<RolUsuario> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Buscar por ID (caso normal) o por email (usuario recreado tras borrar de Supabase)
  const existing = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
  });

  if (existing) {
    // Cuenta deshabilitada por un admin → forzar cierre de sesión
    if (!existing.activo) {
      redirect("/api/auth/force-logout");
    }

    // Si el registro existe pero con un ID viejo (cuenta recreada), actualizar el ID y metadata
    if (existing.id !== user.id) {
      const meta = user.user_metadata ?? {};
      try {
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
      } catch (e: unknown) {
        // Carrera entre requests concurrentes (el layout puede correr más de
        // una vez en paralelo para la misma navegación): otra ya migró este
        // mismo id viejo. Si el error no es "registro no encontrado", sí es
        // un problema real.
        if (
          typeof e === "object" &&
          e !== null &&
          "code" in e &&
          (e as { code: string }).code !== "P2025"
        ) {
          throw e;
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

  return rol;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const rol = await ensureUsuario();

  return (
    <MobileSidebarProvider>
      <div className="flex h-full min-h-screen">
        <Sidebar rol={rol} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6">{children}</main>
        </div>
        <EventosAsideShell>
          <Suspense fallback={<EventosAsideSkeleton />}>
            <EventosAsideContent />
          </Suspense>
        </EventosAsideShell>
      </div>
    </MobileSidebarProvider>
  );
}
