"use client";

import { Menu } from "lucide-react";
import { useMobileSidebar } from "./MobileSidebarContext";

export default function MobileMenuButton() {
  const { toggle } = useMobileSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      className="lg:hidden -ml-1.5 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
      aria-label="Abrir menú"
    >
      <Menu className="w-5 h-5" strokeWidth={1.75} />
    </button>
  );
}
