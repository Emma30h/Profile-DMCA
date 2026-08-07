import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const TIPO_ICON: Record<string, string> = {
  SOLICITUD_NUEVA: "📋",
  APROBADA: "✅",
  RECHAZADA: "❌",
  PERMISO_VENCIDO: "⏰",
  LEGAJO_NUEVO: "🔔",
  LEGAJO_APROBADO: "✅",
  LEGAJO_RECHAZADO: "❌",
  LEGAJO_VINCULADO_AUTO: "🔗",
  SOLICITUD_FOTO_NUEVA: "🖼️",
  FOTO_APROBADA: "✅",
  FOTO_RECHAZADA: "❌",
};

const TIPO_HREF: Record<string, string> = {
  SOLICITUD_NUEVA: "/configuracion/solicitudes",
  LEGAJO_NUEVO: "/personal",
  APROBADA: "/mi-legajo",
  RECHAZADA: "/mi-legajo",
  PERMISO_VENCIDO: "/mi-legajo",
  LEGAJO_APROBADO: "/mi-legajo",
  LEGAJO_RECHAZADO: "/mi-legajo",
  LEGAJO_VINCULADO_AUTO: "/personal",
  SOLICITUD_FOTO_NUEVA: "/configuracion/solicitudes",
  FOTO_APROBADA: "/perfil",
  FOTO_RECHAZADA: "/perfil",
};

export default async function NotificacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { id: true },
  });
  if (!usuario) redirect("/login");

  const notificaciones = await prisma.notificacion.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, tipo: true, mensaje: true, referenciaId: true, leida: true, createdAt: true },
  });

  await prisma.notificacion.updateMany({
    where: { usuarioId: usuario.id, leida: false },
    data: { leida: true },
  });

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-100">Notificaciones</h2>

      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        {notificaciones.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            No tenés notificaciones
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {notificaciones.map((n) => {
              const href = n.referenciaId && (n.tipo === "LEGAJO_NUEVO" || n.tipo === "LEGAJO_VINCULADO_AUTO")
                ? `/personal/${n.referenciaId}`
                : TIPO_HREF[n.tipo];

              const inner = (
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 text-lg leading-5 mt-0.5">{TIPO_ICON[n.tipo] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 leading-snug">{n.mensaje}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {!n.leida && (
                    <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
              );

              return (
                <li key={n.id} className={n.leida ? "bg-slate-900" : "bg-blue-500/10"}>
                  {href ? (
                    <a href={href} className="block px-5 py-4 hover:brightness-95 transition-all">
                      {inner}
                    </a>
                  ) : (
                    <div className="px-5 py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
