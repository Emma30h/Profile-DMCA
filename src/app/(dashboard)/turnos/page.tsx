import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { obtenerMesTurno, obtenerElegiblesTurno } from "@/app/actions/turnos";
import { obtenerCoberturas, obtenerElegiblesCobertura } from "@/app/actions/coberturas";
import { obtenerFeriadosMes } from "@/app/actions/feriados";
import TurnosTabs from "./TurnosTabs";

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

  const [dias, elegibles, jefaturas, lineales, elegiblesCobertura, feriados] = await Promise.all([
    obtenerMesTurno(anio, mes),
    obtenerElegiblesTurno(),
    obtenerCoberturas("JEFATURA", anio, mes),
    obtenerCoberturas("LINEAL", anio, mes),
    obtenerElegiblesCobertura(),
    obtenerFeriadosMes(anio, mes),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Turnos</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-0.5">Calendario de guardias, cobertura de jefaturas y lineales</p>
      </div>

      <TurnosTabs
        anio={anio}
        mes={mes}
        dias={dias}
        elegibles={elegibles}
        jefaturas={jefaturas}
        lineales={lineales}
        elegiblesCobertura={elegiblesCobertura}
        feriados={feriados}
        canEdit={canEdit}
      />
    </div>
  );
}
