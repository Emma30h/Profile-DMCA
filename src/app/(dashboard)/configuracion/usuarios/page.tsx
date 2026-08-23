import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import GestorUsuarios from "./GestorUsuarios";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });

  if (!currentUser || !ROLES_ADMIN.includes(currentUser.rol)) {
    redirect("/dashboard");
  }

  const [usuarios, agentesSinVincular] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        agente: {
          select: { id: true, nombres: true, apellidos: true },
        },
      },
    }),
    prisma.agente.findMany({
      where: { usuarioId: null },
      select: { id: true, nombres: true, apellidos: true },
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Gestión de usuarios</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
          Asigná roles y vinculá usuarios con sus legajos de personal.
        </p>
      </div>

      {/* Leyenda de roles */}
      <div className="bg-[var(--c-blue)]/10 border border-[var(--c-blue)]/20 rounded-xl px-5 py-4 text-sm text-[var(--c-blue-soft)] space-y-1">
        <p className="font-medium mb-2">Permisos por rol</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-xs text-[var(--c-blue-soft)]">
          <span><strong>Superadmin</strong> — acceso total, gestión de usuarios</span>
          <span><strong>Administrador</strong> — gestión completa del personal</span>
          <span><strong>Supervisor</strong> — aprueba licencias, ve todo</span>
          <span><strong>Operador</strong> — carga asistencia y novedades</span>
          <span><strong>Solo lectura</strong> — solo ve su propio legajo (si está vinculado)</span>
        </div>
      </div>

      {usuarios.length === 0 ? (
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] px-6 py-12 text-center text-[var(--c-text-faint)] text-sm">
          No hay usuarios registrados aún.
        </div>
      ) : (
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] overflow-hidden">
          <GestorUsuarios
            usuarios={usuarios}
            agentesSinVincular={agentesSinVincular}
            currentUserId={user.id}
          />
        </div>
      )}
    </div>
  );
}
