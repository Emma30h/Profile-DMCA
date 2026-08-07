import { Geist } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import NotificacionesBell from "./NotificacionesBell";
import UserMenu from "./UserMenu";
import AgenteAncladoChip from "./AgenteAncladoChip";
import MobileMenuButton from "./MobileMenuButton";

const ROLES_ADMIN = ["SUPERADMIN", "ADMIN"];

// Look técnico/geométrico solo para el título institucional del header —
// el resto de la app sigue con la tipografía por defecto.
const geist = Geist({ subsets: ["latin"], weight: ["600"] });

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let displayName: string | null = null;
  let notificaciones: { id: string; tipo: string; mensaje: string; referenciaId?: string | null; leida: boolean; createdAt: string }[] = [];
  let esAdmin = false;
  let fotoUrl: string | null = null;

  if (user) {
    const usuario = await prisma.usuario.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email! }] },
      select: {
        nombre: true,
        apellido: true,
        rol: true,
        id: true,
        agente: { select: { fotoUrl: true } },
      },
    });

    const nombre = usuario?.nombre?.trim();
    const apellido = usuario?.apellido?.trim();
    if (nombre || apellido) {
      displayName = [nombre, apellido].filter(Boolean).join(" ");
    }

    esAdmin = ROLES_ADMIN.includes(usuario?.rol ?? "");
    fotoUrl = usuario?.agente?.fotoUrl ?? null;

    if (usuario) {
      const notifs = await prisma.notificacion.findMany({
        where: { usuarioId: usuario.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, tipo: true, mensaje: true, referenciaId: true, leida: true, createdAt: true },
      });
      notificaciones = notifs.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }));
    }
  }

  const initials = displayName
    ? displayName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : (user?.email?.charAt(0).toUpperCase() ?? "?");

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 lg:px-6">
      <MobileMenuButton />
      <h1 className={`${geist.className} ml-2 lg:ml-0 text-sm lg:text-base font-semibold tracking-wide text-slate-100 truncate`}>
        Dirección Monitoreo Cordobeses en Alerta
      </h1>
      <div className="ml-auto flex items-center gap-3">
        <AgenteAncladoChip />
        <NotificacionesBell notificaciones={notificaciones} />
        {user && (
          <UserMenu
            displayName={displayName}
            email={user.email!}
            initials={initials}
            fotoUrl={fotoUrl}
          />
        )}
      </div>
    </header>
  );
}
