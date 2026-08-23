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
          <h2 className="text-xl font-semibold text-[var(--c-text)]">Organigrama</h2>
        </div>
        {esAdmin && (
          <Link
            href="/configuracion/organigrama"
            className="shrink-0 inline-flex items-center gap-1.5 text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] border border-[var(--c-line)] px-3 py-1.5 rounded-lg transition-colors"
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
