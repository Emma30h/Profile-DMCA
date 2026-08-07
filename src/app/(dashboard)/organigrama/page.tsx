import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import OrganigramaChart from "./OrganigramaChart";
import { obtenerArbolOrganigrama } from "./lib";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function OrganigramaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [currentUser, { centro, sectores }] = await Promise.all([
    user
      ? prisma.usuario.findFirst({
          where: { OR: [{ id: user.id }, { email: user.email! }] },
          select: { rol: true },
        })
      : null,
    obtenerArbolOrganigrama(),
  ]);

  const esAdmin = Boolean(currentUser && ROLES_ADMIN.includes(currentUser.rol));

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Organigrama</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Dirección Monitoreo Cordobeses en Alerta
          </p>
        </div>
        {esAdmin && (
          <Link
            href="/configuracion/organigrama"
            className="shrink-0 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            ⚙️ Editar organigrama
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <OrganigramaChart centro={centro} sectores={sectores} />
      </div>
    </div>
  );
}
