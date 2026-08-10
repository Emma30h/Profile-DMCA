import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import NotificacionesLista from "./NotificacionesLista";

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

  const serialized = notificaciones.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-100">Notificaciones</h2>
      <NotificacionesLista notificaciones={serialized} />
    </div>
  );
}
