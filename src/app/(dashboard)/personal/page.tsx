import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import PersonalMaster from "./PersonalMaster";
import type { FiltrosPersonalParams } from "./lib";

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosPersonalParams>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (currentUser?.rol === "READONLY") redirect("/mi-legajo");

  const params = await searchParams;

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="shrink-0">
        <h2 className="text-xl font-semibold text-slate-100">Personal</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Buscá y seleccioná un agente para ver su legajo completo
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <PersonalMaster searchParams={params} fitViewport />
      </div>
    </div>
  );
}
