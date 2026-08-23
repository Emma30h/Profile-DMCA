import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import CrearLegajoWizard from "@/components/legajo/CrearLegajoWizard";

export default async function CrearLegajoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: { agente: { select: { id: true } } },
  });

  // Si ya tiene legajo, redirigir
  if (usuario?.agente) redirect("/mi-legajo");

  const rangos = await prisma.rango.findMany({
    select: { id: true, nombre: true, cuerpo: true },
    orderBy: { orden: "asc" },
  });

  const meta = user.user_metadata ?? {};

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-[var(--c-text)]">Cargar mi legajo</h2>
        <p className="text-sm text-[var(--c-text-muted)] mt-1">
          Completá tus datos en los siguientes pasos. Podés avanzar y volver cuando quieras.
          Un administrador revisará la información antes de validarla.
        </p>
      </div>

      <CrearLegajoWizard
        rangos={rangos}
        emailUsuario={user.email ?? ""}
        datosIniciales={{
          nombres: meta.nombre,
          apellidos: meta.apellido,
          cuil: meta.cuil,
          tipoPersonal: meta.tipoPersonal,
        }}
      />
    </div>
  );
}
