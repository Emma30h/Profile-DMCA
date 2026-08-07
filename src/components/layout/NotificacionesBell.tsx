"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marcarNotificacionesLeidas } from "@/app/actions/solicitudes";
import { createClient } from "@/lib/supabase/client";

interface Notif {
  id: string;
  tipo: string;
  mensaje: string;
  referenciaId?: string | null;
  leida: boolean;
  createdAt: string;
}

interface Props {
  notificaciones: Notif[];
}

const TIPO_ICON: Record<string, string> = {
  SOLICITUD_NUEVA: "📋",
  APROBADA: "✅",
  RECHAZADA: "❌",
  PERMISO_VENCIDO: "⏰",
  LEGAJO_NUEVO: "🔔",
  LEGAJO_APROBADO: "✅",
  LEGAJO_RECHAZADO: "❌",
  LEGAJO_VINCULADO_AUTO: "🔗",
  ESTADO_CAMBIADO: "🔄",
  LICENCIA_NUEVA: "📅",
  LICENCIA_PENDIENTE_NUEVA: "🏖️",
  SOLICITUD_FOTO_NUEVA: "🖼️",
  FOTO_APROBADA: "✅",
  FOTO_RECHAZADA: "❌",
};

const TIPO_HREF: Record<string, string> = {
  SOLICITUD_NUEVA: "/configuracion/solicitudes",
  LEGAJO_NUEVO: "/personal",
  APROBADA: "/mi-legajo",
  RECHAZADA: "/mi-legajo",
  PERMISO_VENCIDO: "/mi-legajo",
  LEGAJO_APROBADO: "/mi-legajo",
  LEGAJO_RECHAZADO: "/mi-legajo",
  LEGAJO_VINCULADO_AUTO: "/personal",
  ESTADO_CAMBIADO: "/mi-legajo",
  LICENCIA_NUEVA: "/mi-legajo",
  LICENCIA_PENDIENTE_NUEVA: "/mi-legajo",
  SOLICITUD_FOTO_NUEVA: "/configuracion/solicitudes",
  FOTO_APROBADA: "/perfil",
  FOTO_RECHAZADA: "/perfil",
};

export default function NotificacionesBell({ notificaciones: inicial }: Props) {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<Notif[]>(inicial);
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();

  const fetchNotificaciones = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones");
      if (res.ok) {
        const data: Notif[] = await res.json();
        setNotificaciones(data);
      }
    } catch {
      // silenciar errores de red
    }
  }, []);

  // SSE: recibe notificaciones en tiempo real y forzar logout si la cuenta es deshabilitada
  useEffect(() => {
    const es = new EventSource("/api/notificaciones/stream");

    es.onmessage = (e) => {
      const incoming: Notif[] = JSON.parse(e.data as string);
      setNotificaciones((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        const nuevas = incoming.filter((n) => !ids.has(n.id));
        return nuevas.length > 0 ? [...nuevas, ...prev].slice(0, 30) : prev;
      });
      if (incoming.some((n) => n.tipo === "ESTADO_CAMBIADO")) {
        router.refresh();
      }
    };

    es.addEventListener("forzarLogout", async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login?error=cuenta_deshabilitada";
    });

    return () => es.close();
  }, [router]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  function handleAbrir() {
    const nuevoEstado = !abierto;
    setAbierto(nuevoEstado);
    if (nuevoEstado) {
      // Refrescar al abrir para mostrar las más recientes
      fetchNotificaciones();
      if (noLeidas > 0) {
        startTransition(async () => {
          await marcarNotificacionesLeidas();
          setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
        });
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleAbrir}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        title="Notificaciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={() => setAbierto(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-100">Notificaciones</span>
              {noLeidas > 0 && !pending && (
                <span className="text-xs text-slate-500">{noLeidas} sin leer</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
              {notificaciones.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  Sin notificaciones
                </div>
              ) : (
                notificaciones.map((n) => {
                  const href = n.referenciaId && (n.tipo === "LEGAJO_NUEVO" || n.tipo === "LEGAJO_VINCULADO_AUTO")
                    ? `/personal/${n.referenciaId}`
                    : TIPO_HREF[n.tipo];
                  const inner = (
                    <>
                      <span className="shrink-0 text-base leading-5">{TIPO_ICON[n.tipo] ?? "🔔"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 leading-snug">{n.mensaje}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </>
                  );

                  return href ? (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => setAbierto(false)}
                      className={`px-4 py-3 flex gap-3 text-sm hover:brightness-95 transition-all ${n.leida ? "bg-slate-900" : "bg-blue-500/10"}`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div
                      key={n.id}
                      className={`px-4 py-3 flex gap-3 text-sm ${n.leida ? "bg-slate-900" : "bg-blue-500/10"}`}
                    >
                      {inner}
                    </div>
                  );
                })
              )}
            </div>

            <Link
              href="/notificaciones"
              onClick={() => setAbierto(false)}
              className="block px-4 py-3 text-center text-xs font-medium text-blue-400 hover:bg-slate-800 border-t border-slate-800 transition-colors"
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
