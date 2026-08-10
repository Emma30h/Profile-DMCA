import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { obtenerMesTurno, obtenerElegiblesTurno } from "@/app/actions/turnos";
import VistaTurnos from "./VistaTurnos";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function TurnosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (currentUser?.rol === "READONLY") redirect("/perfil");

  const canEdit = ROLES_ADMIN.includes(currentUser?.rol ?? "");

  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;

  const [dias, elegibles] = await Promise.all([
    obtenerMesTurno(anio, mes),
    obtenerElegiblesTurno(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Turnos</h2>
        <p className="text-sm text-slate-400 mt-0.5">Calendario de guardias, superior de turno y jefe de fin de semana</p>
      </div>

      <VistaTurnos anioInicial={anio} mesInicial={mes} diasInicial={dias} elegibles={elegibles} canEdit={canEdit} />
    </div>
  );
}
