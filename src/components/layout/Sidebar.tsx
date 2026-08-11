"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Home, Users, Building2, Clock, ClipboardList, Settings, Lock, X, type LucideIcon } from "lucide-react";
import type { RolUsuario } from "@/types";
import { useMobileSidebar } from "./MobileSidebarContext";

const navItems: { href: string; label: string; icon: LucideIcon; disabled?: boolean }[] = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/personal", label: "Personal", icon: Users },
  { href: "/organigrama", label: "Organigrama", icon: Building2 },
  { href: "/turnos", label: "Turnos", icon: Clock },
  { href: "/licencias", label: "Licencias y Ausentismo", icon: ClipboardList },
];

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];
// Debe reflejar exactamente los roles permitidos en licencias/page.tsx — si
// no, un rol sin acceso ve el link en el sidebar y lo manda a un redirect
// a /dashboard en vez de a la página.
const ROLES_LICENCIAS: RolUsuario[] = ["SUPERADMIN", "ADMIN", "SUPERVISOR"];

export default function Sidebar({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();
  const { abierto, cerrar } = useMobileSidebar();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const esReadonly = rol === "READONLY";

  const footerItems = ROLES_ADMIN.includes(rol)
    ? [{ href: "/configuracion/usuarios", label: "Roles de Usuario", icon: Settings }]
    : [];

  // Al navegar a una nueva página desde el drawer mobile, se cierra solo —
  // si no, taparía el contenido recién cargado hasta que el usuario lo cierre a mano.
  useEffect(() => {
    cerrar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Fondo oscuro detrás del drawer — solo mobile, solo mientras está abierto */}
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={cerrar}
          aria-hidden="true"
        />
      )}

      <aside
        // lg:relative (no lg:static): sigue participando del flex del layout
        // en desktop igual que antes, pero mantiene un contexto de posición
        // propio para que la franja de abajo (absolute) se ancle a ESTE
        // aside y no a algún ancestro lejano.
        className={`fixed inset-y-0 left-0 z-50 w-56 min-h-screen bg-slate-950 text-white flex flex-col transition-transform duration-200 ease-out lg:relative lg:z-auto lg:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Franja del borde derecho: degradé animado (ver sidebar-edge-glow
            en globals.css) en vez de un simple border-r estático, para
            separar visualmente el menú del resto de la app con algo de vida. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-0.5 sidebar-edge-glow" />

        {/* Logo / Header — solo el escudo, grande y centrado. El botón de
            cerrar (solo mobile) va posicionado absoluto para no romper el
            centrado. */}
        <div className="relative px-5 py-5 border-b border-slate-800/70 flex items-center justify-center">
          <button
            type="button"
            onClick={cerrar}
            className="lg:hidden absolute right-3 top-3 shrink-0 rounded p-2.5 text-slate-500 hover:text-slate-300"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <Image
            src="/logo-ojos-en-alerta-blanco.png"
            alt="Ojos en Alerta"
            width={92}
            height={70}
            className="shrink-0"
          />
        </div>

      {/* Nav principal — READONLY solo ve Organigrama (consulta libre, sin
          edición); Licencias y Ausentismo se oculta para los roles que no
          tienen acceso a esa página. */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {(esReadonly
          ? navItems.filter((item) => item.href === "/organigrama")
          : navItems.filter((item) => item.href !== "/licencias" || ROLES_LICENCIAS.includes(rol))
        ).map((item) => {
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-slate-500 cursor-not-allowed select-none"
                title="Próximamente"
              >
                <Icon className="w-[17px] h-[17px] shrink-0 opacity-40" strokeWidth={1.75} />
                <span className="flex-1">{item.label}</span>
                <Lock className="w-3.5 h-3.5 opacity-50 shrink-0" strokeWidth={2} />
              </div>
            );
          }

          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-slate-800/70 text-white font-medium"
                  : "text-slate-400 font-normal hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Icon
                className={`w-[17px] h-[17px] shrink-0 ${active ? "text-blue-400" : "text-slate-500"}`}
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer nav */}
      <div className="px-2.5 py-3 border-t border-slate-800/70 space-y-0.5">
        {footerItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-2.5 py-2 text-[13px] transition-colors ${
                active
                  ? "bg-slate-800/70 text-white font-medium"
                  : "text-slate-400 font-normal hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Icon
                className={`w-[17px] h-[17px] shrink-0 ${active ? "text-blue-400" : "text-slate-500"}`}
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
      </aside>
    </>
  );
}
