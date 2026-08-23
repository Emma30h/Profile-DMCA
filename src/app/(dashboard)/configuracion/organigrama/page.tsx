import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { obtenerSectoresConRoles, obtenerAgentesParaPicker } from "../../organigrama/lib";
import GestorOrganigrama from "./GestorOrganigrama";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

export default async function ConfiguracionOrganigramaPage() {
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

  const [sectores, agentes] = await Promise.all([
    obtenerSectoresConRoles(),
    obtenerAgentesParaPicker(),
  ]);

  return (
    <div className="space-y-5">
      {/* Sticky: la lista de sectores puede quedar larga, así que el link para
          volver no puede depender de estar arriba de todo — si no, scrolleando
          un poco ya no hay forma de volver a /organigrama sin usar el botón
          "atrás" del navegador. */}
      <div className="sticky top-0 z-10 bg-[var(--c-bg)]/75 backdrop-blur-sm -mt-4 pt-4 lg:-mt-6 lg:pt-6 -mx-4 px-4 lg:-mx-6 lg:px-6 pb-3">
        <Link
          href="/organigrama"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-text-muted)] hover:text-[var(--c-text)] transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Volver al organigrama
        </Link>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Editar organigrama</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
          Asigná quién ocupa cada puesto en cada sector. La estructura de sectores no se edita acá.
        </p>
      </div>

      <GestorOrganigrama sectores={sectores} agentes={agentes} />
    </div>
  );
}
