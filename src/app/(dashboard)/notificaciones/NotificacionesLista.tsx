"use client";

import { useMemo, useState } from "react";
import { iconoNotificacion, labelNotificacion, hrefNotificacion } from "@/lib/notificaciones";
import { formatFechaHora } from "@/lib/fecha";

interface Notif {
  id: string;
  tipo: string;
  mensaje: string;
  referenciaId: string | null;
  leida: boolean;
  createdAt: string;
}

interface Props {
  notificaciones: Notif[];
}

const POR_PAGINA = 15;

export default function NotificacionesLista({ notificaciones }: Props) {
  const [filtroTipo, setFiltroTipo] = useState("");
  const [pagina, setPagina] = useState(1);

  // Solo se ofrecen como filtro los tipos que realmente aparecen en la
  // lista del usuario, no las 18 variantes posibles del sistema entero.
  const tiposDisponibles = useMemo(() => {
    const vistos = new Set(notificaciones.map((n) => n.tipo));
    return Array.from(vistos).sort((a, b) => labelNotificacion(a).localeCompare(labelNotificacion(b)));
  }, [notificaciones]);

  const filtradas = useMemo(
    () => (filtroTipo ? notificaciones.filter((n) => n.tipo === filtroTipo) : notificaciones),
    [notificaciones, filtroTipo]
  );

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA);

  function handleFiltroChange(tipo: string) {
    setFiltroTipo(tipo);
    setPagina(1);
  }

  return (
    <div className="space-y-3">
      {tiposDisponibles.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="filtro-tipo-notif" className="text-xs text-slate-500 shrink-0">
            Filtrar por tipo
          </label>
          <select
            id="filtro-tipo-notif"
            value={filtroTipo}
            onChange={(e) => handleFiltroChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los tipos</option>
            {tiposDisponibles.map((t) => (
              <option key={t} value={t}>{labelNotificacion(t)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        {paginadas.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            {filtroTipo ? "No hay notificaciones de este tipo" : "No tenés notificaciones"}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {paginadas.map((n) => {
              const href = hrefNotificacion(n.tipo, n.referenciaId);

              const inner = (
                <div className="flex gap-3 items-start">
                  <span className="shrink-0 text-lg leading-5 mt-0.5">{iconoNotificacion(n.tipo)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 leading-snug">{n.mensaje}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatFechaHora(n.createdAt)}
                    </p>
                  </div>
                  {!n.leida && (
                    <span className="shrink-0 mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  )}
                </div>
              );

              return (
                <li key={n.id} className={n.leida ? "bg-slate-900" : "bg-blue-500/10"}>
                  {href ? (
                    <a href={href} className="block px-5 py-4 hover:brightness-95 transition-all">
                      {inner}
                    </a>
                  ) : (
                    <div className="px-5 py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaSegura <= 1}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {paginaSegura} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura >= totalPaginas}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
