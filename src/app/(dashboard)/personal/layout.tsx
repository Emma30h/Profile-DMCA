import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import PersonalMasterShell from "./PersonalMasterShell";
import { getAgentesResumen, getOpcionesFiltro } from "./lib";
import type { RolUsuario } from "@/types";

// Vive en un layout (no en cada page.tsx) a propósito: es lo único que hace
// que Next.js mantenga vivo el buscador/lista entre /personal y
// /personal/[id] — si viviera en la page, cada selección de agente
// destruía y volvía a crear toda la lista (scroll, paginación y avatares
// incluidos), porque las pages no se preservan entre navegaciones como sí
// lo hacen los layouts.
export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentUser = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    select: { rol: true },
  });
  if (currentUser?.rol === "READONLY") redirect("/perfil");

  // Se trae la lista completa una sola vez (sin filtros): son ~170 agentes,
  // así que filtrar en el cliente sobre este set ya cargado es instantáneo y
  // evita tener que volver a pedirle datos al servidor en cada tecla/filtro.
  const [{ agentes }, { sectores, turnos }] = await Promise.all([
    getAgentesResumen({}),
    getOpcionesFiltro(),
  ]);

  return (
    <PersonalMasterShell
      agentesCompletos={agentes}
      sectores={sectores}
      turnos={turnos}
      rol={(currentUser?.rol ?? "READONLY") as RolUsuario}
    >
      {children}
    </PersonalMasterShell>
  );
}
