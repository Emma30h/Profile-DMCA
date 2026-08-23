import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import ImportadorLegajos from "./ImportadorLegajos";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function ImportarLegajosPage() {
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Importar legajos desde el Sheet</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
          Subí el CSV o XLSX exportado del Google Sheet. Se crean como legajos pendientes de validación
          solo los agentes cuyo CUIL todavía no existe en la app — los que ya están se ignoran.
        </p>
      </div>

      <ImportadorLegajos />
    </div>
  );
}
