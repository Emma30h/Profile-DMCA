"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { actualizarRol, toggleActivo, vincularAgente } from "@/app/actions/usuarios";
import type { RolUsuario } from "@/types";
import { ROLES_USUARIO } from "@/types";

const ROL_LABELS: Record<RolUsuario, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  OPERADOR: "Operador",
  READONLY: "Solo lectura",
};

const ROL_BADGE: Record<RolUsuario, string> = {
  SUPERADMIN: "bg-red-500/15 text-red-400",
  ADMIN: "bg-blue-500/15 text-blue-300",
  SUPERVISOR: "bg-purple-500/15 text-purple-400",
  OPERADOR: "bg-green-500/15 text-green-400",
  READONLY: "bg-slate-800 text-slate-400",
};


interface UsuarioFila {
  id: string;
  email: string;
  rol: string;
  activo: boolean;
  nombre: string | null;
  apellido: string | null;
  tipoPersonal: string | null;
  jerarquia: string | null;
  agente: { id: string; nombres: string; apellidos: string } | null;
}

interface AgenteSinVincular {
  id: string;
  nombres: string;
  apellidos: string;
}

const ROLES_PRIVILEGIADOS: RolUsuario[] = ["SUPERADMIN", "ADMIN", "SUPERVISOR", "OPERADOR"];

function TablaUsuarios({
  usuarios,
  agentesSinVincular,
  currentUserId,
}: {
  usuarios: UsuarioFila[];
  agentesSinVincular: AgenteSinVincular[];
  currentUserId: string | null;
}) {
  if (usuarios.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-slate-500 text-sm">
        No hay usuarios en esta categoría.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-950 border-b border-slate-700">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Personal
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Email
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Rol
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Agente vinculado
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {usuarios.map((u) => (
            <FilaUsuario
              key={u.id}
              usuario={u}
              agentesSinVincular={agentesSinVincular}
              esPropioUsuario={u.id === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GestorUsuarios({
  usuarios,
  agentesSinVincular,
  currentUserId,
}: {
  usuarios: UsuarioFila[];
  agentesSinVincular: AgenteSinVincular[];
  currentUserId: string | null;
}) {
  const [tab, setTab] = useState<"privilegiados" | "readonly">("privilegiados");

  const tabButtonRefs = useRef<Partial<Record<"privilegiados" | "readonly", HTMLButtonElement>>>({});
  const [indicador, setIndicador] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const btn = tabButtonRefs.current[tab];
    if (btn) setIndicador({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [tab]);

  const privilegiados = usuarios.filter((u) =>
    ROLES_PRIVILEGIADOS.includes(u.rol as RolUsuario)
  );
  const soloLectura = usuarios.filter((u) => u.rol === "READONLY");

  return (
    <div>
      {/* Pestañas */}
      <div className="relative flex border-b border-slate-700 mb-0">
        <button
          type="button"
          ref={(el) => { tabButtonRefs.current.privilegiados = el ?? undefined; }}
          onClick={() => setTab("privilegiados")}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 border-transparent -mb-px ${
            tab === "privilegiados"
              ? "text-blue-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          Administradores
          <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
            {privilegiados.length}
          </span>
        </button>
        <button
          type="button"
          ref={(el) => { tabButtonRefs.current.readonly = el ?? undefined; }}
          onClick={() => setTab("readonly")}
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 border-transparent -mb-px ${
            tab === "readonly"
              ? "text-blue-400"
              : "text-slate-400 hover:text-slate-300"
          }`}
        >
          Solo lectura
          <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
            {soloLectura.length}
          </span>
        </button>
        {indicador && (
          <span
            className="absolute bottom-0 h-0.5 bg-blue-500 transition-all duration-300 ease-out"
            style={{ left: indicador.left, width: indicador.width }}
          />
        )}
      </div>

      {tab === "privilegiados" && (
        <TablaUsuarios
          usuarios={privilegiados}
          agentesSinVincular={agentesSinVincular}
          currentUserId={currentUserId}
        />
      )}
      {tab === "readonly" && (
        <TablaUsuarios
          usuarios={soloLectura}
          agentesSinVincular={agentesSinVincular}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

function FilaUsuario({
  usuario,
  agentesSinVincular,
  esPropioUsuario,
}: {
  usuario: UsuarioFila;
  agentesSinVincular: AgenteSinVincular[];
  esPropioUsuario: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [bloqueado, setBloqueado] = useState(true);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState(false);
  const rol = usuario.rol as RolUsuario;

  function handleRol(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevoRol = e.target.value as RolUsuario;
    startTransition(() => actualizarRol(usuario.id, nuevoRol));
  }

  function handleToggle() {
    if (usuario.activo) {
      // Desactivar requiere confirmación
      setConfirmarDesactivar(true);
    } else {
      // Reactivar: sin confirmación
      startTransition(() => toggleActivo(usuario.id, true));
    }
  }

  function handleConfirmarDesactivar() {
    setConfirmarDesactivar(false);
    startTransition(() => toggleActivo(usuario.id, false));
  }

  function handleVincular(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startTransition(() => vincularAgente(usuario.id, val === "" ? null : val));
  }

  // Opciones de agentes disponibles: los sin vincular + el actualmente vinculado a este usuario
  const opcionesAgentes: AgenteSinVincular[] = usuario.agente
    ? [usuario.agente, ...agentesSinVincular]
    : agentesSinVincular;

  const nombreMostrado =
    [usuario.jerarquia, usuario.apellido, usuario.nombre].filter(Boolean).join(" ") ||
    usuario.email;

  return (
    <>
    {confirmarDesactivar && (
      <tr>
        <td colSpan={5} className="p-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmarDesactivar(false)} />
            <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Desactivar usuario</h2>
                <p className="text-sm text-slate-400 mt-1">
                  ¿Estás seguro de que querés desactivar a{" "}
                  <span className="font-medium text-slate-200">{nombreMostrado}</span>?
                </p>
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-3">
                  Su sesión se cerrará inmediatamente y no podrá volver a ingresar al sistema.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarDesactivar(false)}
                  disabled={pending}
                  className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarDesactivar}
                  disabled={pending}
                  className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {pending ? "Desactivando..." : "Sí, desactivar"}
                </button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    )}
    <tr className={`transition-colors ${pending ? "opacity-50" : "hover:bg-slate-800"}`}>
      {/* Identidad */}
      <td className="px-4 py-3">
        {(usuario.jerarquia || usuario.apellido || usuario.nombre) ? (
          <p className="font-medium text-slate-100">
            {[usuario.jerarquia, usuario.apellido, usuario.nombre].filter(Boolean).join(" ")}
            {esPropioUsuario && <span className="ml-1 text-xs text-slate-500">(vos)</span>}
          </p>
        ) : (
          <p className="text-slate-400 italic text-xs">
            Sin nombre{esPropioUsuario && <span className="ml-1">(vos)</span>}
          </p>
        )}
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-400">{usuario.email}</p>
      </td>

      {/* Rol */}
      <td className="px-4 py-3">
        {esPropioUsuario ? (
          // No puede cambiarse su propio rol
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROL_BADGE[rol] ?? "bg-slate-800 text-slate-400"}`}>
            {ROL_LABELS[rol] ?? rol}
          </span>
        ) : (
          <select
            value={usuario.rol}
            onChange={handleRol}
            disabled={pending}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {ROLES_USUARIO.map((r) => (
              <option key={r} value={r}>
                {ROL_LABELS[r]}
              </option>
            ))}
          </select>
        )}
      </td>

      {/* Agente vinculado */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <select
            value={usuario.agente?.id ?? ""}
            onChange={handleVincular}
            disabled={pending || bloqueado}
            className={`rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px] ${bloqueado ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <option value="">— Sin vincular —</option>
            {opcionesAgentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.apellidos}, {a.nombres}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setBloqueado((v) => !v)}
            title={bloqueado ? "Desbloquear" : "Bloquear"}
            className="text-slate-500 hover:text-slate-400 transition-colors flex-shrink-0"
          >
            {bloqueado ? <LockIcon /> : <UnlockIcon />}
          </button>
        </div>
      </td>

      {/* Estado activo / inactivo */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={usuario.activo}
            onClick={esPropioUsuario ? undefined : handleToggle}
            disabled={pending || esPropioUsuario}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              esPropioUsuario ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${usuario.activo ? "bg-green-500" : "bg-slate-600"}`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                usuario.activo ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${usuario.activo ? "text-green-400" : "text-slate-500"}`}>
            {usuario.activo ? "Activo" : "Inactivo"}
          </span>
        </div>
      </td>
    </tr>
    </>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  );
}
