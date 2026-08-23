"use client";

import { useState } from "react";
import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  displayName: string | null;
  email: string;
  initials: string;
  fotoUrl: string | null;
}

export default function UserMenu({ displayName, email, initials, fotoUrl }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [fotoRota, setFotoRota] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleToggleTema() {
    const actual = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nuevo = actual === "light" ? "dark" : "light";
    if (nuevo === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
    try {
      localStorage.setItem("tema", nuevo);
    } catch {
      // localStorage puede no estar disponible (modo privado estricto) — el
      // toggle sigue funcionando para la sesión actual, solo no persiste.
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center justify-center h-9 w-9 rounded-full bg-[var(--c-blue)] text-white text-sm font-bold hover:bg-[var(--c-blue-strong)] transition-colors select-none overflow-hidden border-2 border-[var(--c-blue-text)]"
        title={displayName ?? email}
      >
        {fotoUrl && !fotoRota ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="" onError={() => setFotoRota(true)} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={() => setAbierto(false)}
          />

          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-[var(--c-line)] bg-[var(--c-bg-elev)] shadow-lg overflow-hidden">
            {/* Info usuario */}
            <div className="px-4 py-4 border-b border-[var(--c-bg-elev-2)]">
              {displayName && (
                <p className="text-sm font-semibold text-[var(--c-text)] truncate">{displayName}</p>
              )}
              <p className="text-xs text-[var(--c-text-muted)] truncate">{email}</p>
            </div>

            {/* Acciones */}
            <div className="py-1">
              <Link
                href="/perfil"
                onClick={() => setAbierto(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--c-text-faint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Mi Perfil
              </Link>

              <button
                type="button"
                onClick={handleToggleTema}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-elev-2)] transition-colors"
              >
                <span className="icon-tema-oscuro">
                  <span className="flex items-center gap-3">
                    <Sun className="h-4 w-4 text-[var(--c-text-faint)]" strokeWidth={1.75} />
                    Modo claro
                  </span>
                </span>
                <span className="icon-tema-claro">
                  <span className="flex items-center gap-3">
                    <Moon className="h-4 w-4 text-[var(--c-text-faint)]" strokeWidth={1.75} />
                    Modo oscuro
                  </span>
                </span>
              </button>
            </div>

            <div className="py-1 border-t border-[var(--c-bg-elev-2)]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--c-coral)] hover:bg-[var(--c-coral)]/10 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
