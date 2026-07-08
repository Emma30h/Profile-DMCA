"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { RolUsuario } from "@/types";

const navItems = [
  { href: "/dashboard", label: "Inicio", icon: "🏠" },
  { href: "/personal", label: "Personal", icon: "👥" },
  { href: "/escalafon", label: "Escalafón", icon: "⭐", disabled: true },
  { href: "/turnos", label: "Turnos", icon: "🕐", disabled: true },
  { href: "/asistencia", label: "Asistencia", icon: "✅", disabled: true },
  { href: "/licencias", label: "Licencias y Ausentismo", icon: "📋" },
];

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];

export default function Sidebar({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const esReadonly = rol === "READONLY";

  const footerItems = ROLES_ADMIN.includes(rol)
    ? [{ href: "/configuracion/usuarios", label: "Roles de Usuario", icon: "⚙️" }]
    : [];

  return (
    <aside className="w-64 min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Logo / Header */}
      <div className="px-6 py-5 border-b border-slate-700 flex items-center gap-3">
        <Image
          src="/escudo_png_2.png"
          alt="Escudo Policía de Córdoba"
          width={40}
          height={40}
          className="shrink-0"
        />
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">
            Policía de Córdoba
          </p>
          <h1 className="text-sm font-semibold leading-tight text-white">
            Dir. Monitoreo<br />Cordobeses en Alerta
          </h1>
        </div>
      </div>

      {/* Nav principal — oculto para READONLY */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {esReadonly ? null : navItems.map((item) => {
          if (item.disabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 cursor-not-allowed select-none"
                title="Próximamente"
              >
                <span className="text-base leading-none opacity-40">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <svg className="w-3.5 h-3.5 opacity-50 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer nav */}
      <div className="px-3 py-4 border-t border-slate-700 space-y-1">
        {footerItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
