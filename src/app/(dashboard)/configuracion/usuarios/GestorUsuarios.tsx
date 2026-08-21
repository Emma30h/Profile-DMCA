"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import {
  actualizarRol,
  toggleActivoConfirmado,
  vincularAgente,
  solicitarCodigoEliminarUsuario,
  verificarCodigoEliminarUsuario,
  confirmarEliminarUsuario,
} from "@/app/actions/usuarios";
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
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Acciones
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
  // Transición propia para el toggle de estado: así el spinner de la celda
  // "Estado" solo aparece cuando se cambia activo/inactivo, no cuando lo que
  // está en curso es un cambio de rol o de vinculación en la misma fila.
  const [pendingEstado, startEstadoTransition] = useTransition();
  // Ídem para vincular/desvincular agente: la barra de carga de esa celda
  // no debe encenderse por un cambio de rol o de estado en la misma fila.
  const [pendingVincular, startVincularTransition] = useTransition();
  const [pendingEliminar, startEliminarTransition] = useTransition();
  const [bloqueado, setBloqueado] = useState(true);
  // Activar y desactivar piden confirmar y luego la contraseña del admin —
  // null = modal cerrado. Dos pasos, igual criterio que "Eliminar usuario".
  const [confirmarEstado, setConfirmarEstado] = useState<{ activar: boolean; paso: "confirmar" | "password" } | null>(null);
  const [passwordEstado, setPasswordEstado] = useState("");
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [mostrarPasswordEstado, setMostrarPasswordEstado] = useState(false);
  // Eliminar es irreversible: confirmar → código de 8 dígitos (al mail del
  // admin) → contraseña del admin. null = modal cerrado.
  const [pasoEliminar, setPasoEliminar] = useState<"confirmar" | "codigo" | "password" | null>(null);
  const [codigoEliminar, setCodigoEliminar] = useState("");
  const [passwordEliminar, setPasswordEliminar] = useState("");
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [mostrarPasswordEliminar, setMostrarPasswordEliminar] = useState(false);
  const [cooldownEliminar, setCooldownEliminar] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rol = usuario.rol as RolUsuario;

  useEffect(() => () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); }, []);

  function iniciarCooldownEliminar() {
    setCooldownEliminar(60);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownEliminar((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleRol(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevoRol = e.target.value as RolUsuario;
    startTransition(async () => { await actualizarRol(usuario.id, nuevoRol); });
  }

  function handleToggle() {
    setErrorEstado(null);
    setPasswordEstado("");
    setMostrarPasswordEstado(false);
    setConfirmarEstado({ activar: !usuario.activo, paso: "confirmar" });
  }

  function handleCerrarEstado() {
    if (pendingEstado) return;
    setConfirmarEstado(null);
  }

  function handleAvanzarEstado() {
    if (!confirmarEstado) return;
    setErrorEstado(null);
    setConfirmarEstado({ ...confirmarEstado, paso: "password" });
  }

  function handleConfirmarEstado() {
    if (!confirmarEstado) return;
    setErrorEstado(null);
    startEstadoTransition(async () => {
      const res = await toggleActivoConfirmado(usuario.id, confirmarEstado.activar, passwordEstado);
      if (!res.ok) { setErrorEstado(res.error ?? "Error inesperado."); return; }
      setConfirmarEstado(null);
      setPasswordEstado("");
    });
  }

  function handleVincular(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startVincularTransition(async () => { await vincularAgente(usuario.id, val === "" ? null : val); });
  }

  function handleAbrirEliminar() {
    setErrorEliminar(null);
    setCodigoEliminar("");
    setPasswordEliminar("");
    setMostrarPasswordEliminar(false);
    setPasoEliminar("confirmar");
  }

  function handleCerrarEliminar() {
    if (pendingEliminar) return;
    setPasoEliminar(null);
  }

  function handleSolicitarCodigo() {
    setErrorEliminar(null);
    startEliminarTransition(async () => {
      const res = await solicitarCodigoEliminarUsuario(usuario.id);
      if (!res.ok) { setErrorEliminar(res.error ?? "Error inesperado."); return; }
      setPasoEliminar("codigo");
      iniciarCooldownEliminar();
    });
  }

  function handleReenviarCodigo() {
    if (cooldownEliminar > 0 || pendingEliminar) return;
    setErrorEliminar(null);
    setCodigoEliminar("");
    startEliminarTransition(async () => {
      const res = await solicitarCodigoEliminarUsuario(usuario.id);
      if (!res.ok) { setErrorEliminar(res.error ?? "Error inesperado."); return; }
      iniciarCooldownEliminar();
    });
  }

  function handleVerificarCodigo() {
    setErrorEliminar(null);
    startEliminarTransition(async () => {
      const res = await verificarCodigoEliminarUsuario(usuario.id, codigoEliminar);
      if (!res.ok) { setErrorEliminar(res.error ?? "Error inesperado."); return; }
      setPasoEliminar("password");
    });
  }

  function handleConfirmarPassword() {
    setErrorEliminar(null);
    startEliminarTransition(async () => {
      const res = await confirmarEliminarUsuario(usuario.id, passwordEliminar);
      if (!res.ok) { setErrorEliminar(res.error ?? "Error inesperado."); return; }
      setPasoEliminar(null);
    });
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
    {confirmarEstado && (
      <tr>
        <td colSpan={6} className="p-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={handleCerrarEstado} />
            <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-100">
                  {confirmarEstado.activar ? "Activar usuario" : "Desactivar usuario"}
                </h2>
                <span className="text-xs text-slate-500">
                  Paso {confirmarEstado.paso === "confirmar" ? 1 : 2} de 2
                </span>
              </div>

              {confirmarEstado.paso === "confirmar" && (
                <>
                  <div>
                    <p className="text-sm text-slate-400">
                      ¿Estás seguro de que querés {confirmarEstado.activar ? "activar" : "desactivar"} a{" "}
                      <span className="font-medium text-slate-200">{nombreMostrado}</span>?
                    </p>
                    {!confirmarEstado.activar && (
                      <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-3">
                        Su sesión se cerrará inmediatamente y no podrá volver a ingresar al sistema.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCerrarEstado}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAvanzarEstado}
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                        confirmarEstado.activar ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {confirmarEstado.activar ? "Sí, activar" : "Sí, desactivar"}
                    </button>
                  </div>
                </>
              )}

              {confirmarEstado.paso === "password" && (
                <>
                  <div>
                    <label htmlFor={`password-estado-${usuario.id}`} className="block text-xs font-medium text-slate-300 mb-1">
                      Confirmá tu contraseña para {confirmarEstado.activar ? "activar" : "desactivar"} a{" "}
                      <span className="font-medium text-slate-300">{nombreMostrado}</span>
                    </label>
                    <div className="relative">
                      <input
                        id={`password-estado-${usuario.id}`}
                        type={mostrarPasswordEstado ? "text" : "password"}
                        autoComplete="current-password"
                        autoFocus
                        value={passwordEstado}
                        onChange={(e) => setPasswordEstado(e.target.value)}
                        placeholder="Tu contraseña"
                        className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPasswordEstado((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                        tabIndex={-1}
                      >
                        {mostrarPasswordEstado ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>
                  {errorEstado && <p className="text-xs text-red-400">{errorEstado}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCerrarEstado}
                      disabled={pendingEstado}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarEstado}
                      disabled={pendingEstado || passwordEstado.length === 0}
                      className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 ${
                        confirmarEstado.activar ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      {pendingEstado && <Spinner className="h-3.5 w-3.5" />}
                      {pendingEstado
                        ? confirmarEstado.activar ? "Activando..." : "Desactivando..."
                        : confirmarEstado.activar ? "Sí, activar" : "Sí, desactivar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
    {pasoEliminar && (
      <tr>
        <td colSpan={6} className="p-0">
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={handleCerrarEliminar} />
            <div className="relative bg-slate-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-100">Eliminar usuario</h2>
                <span className="text-xs text-slate-500">
                  Paso {pasoEliminar === "confirmar" ? 1 : pasoEliminar === "codigo" ? 2 : 3} de 3
                </span>
              </div>

              {pasoEliminar === "confirmar" && (
                <>
                  <div>
                    <p className="text-sm text-slate-400">
                      ¿Estás seguro de que querés eliminar definitivamente a{" "}
                      <span className="font-medium text-slate-200">{nombreMostrado}</span>?
                    </p>
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 mt-3">
                      Esta acción no se puede deshacer. Se borran sus notificaciones y solicitudes.
                      {usuario.agente && " Su legajo NO se borra, solo queda sin vincular a ninguna cuenta."}
                      {" "}Te vamos a pedir un código enviado a tu correo y tu contraseña para confirmar.
                    </p>
                  </div>
                  {errorEliminar && <p className="text-xs text-red-400">{errorEliminar}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCerrarEliminar}
                      disabled={pendingEliminar}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSolicitarCodigo}
                      disabled={pendingEliminar}
                      className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {pendingEliminar && <Spinner className="h-3.5 w-3.5" />}
                      {pendingEliminar ? "Enviando..." : "Enviar código de confirmación"}
                    </button>
                  </div>
                </>
              )}

              {pasoEliminar === "codigo" && (
                <>
                  <p className="text-sm text-slate-400">
                    Ingresá el código de 8 dígitos que enviamos a tu correo para confirmar la eliminación de{" "}
                    <span className="font-medium text-slate-200">{nombreMostrado}</span>.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    autoFocus
                    value={codigoEliminar}
                    onChange={(e) => setCodigoEliminar(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000000"
                    className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-center tracking-[0.3em] font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition"
                  />
                  {errorEliminar && <p className="text-xs text-red-400">{errorEliminar}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>¿No llegó el correo?</span>
                    <button
                      type="button"
                      onClick={handleReenviarCodigo}
                      disabled={cooldownEliminar > 0 || pendingEliminar}
                      className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                      {cooldownEliminar > 0 ? `Reenviar en ${cooldownEliminar}s` : "Reenviar código"}
                    </button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCerrarEliminar}
                      disabled={pendingEliminar}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleVerificarCodigo}
                      disabled={pendingEliminar || codigoEliminar.length !== 8}
                      className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {pendingEliminar && <Spinner className="h-3.5 w-3.5" />}
                      {pendingEliminar ? "Verificando..." : "Verificar código"}
                    </button>
                  </div>
                </>
              )}

              {pasoEliminar === "password" && (
                <>
                  <p className="text-sm text-slate-400">
                    Por último, confirmá tu contraseña para eliminar definitivamente a{" "}
                    <span className="font-medium text-slate-200">{nombreMostrado}</span>.
                  </p>
                  <div className="relative">
                    <input
                      type={mostrarPasswordEliminar ? "text" : "password"}
                      autoComplete="current-password"
                      autoFocus
                      value={passwordEliminar}
                      onChange={(e) => setPasswordEliminar(e.target.value)}
                      placeholder="Tu contraseña"
                      className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPasswordEliminar((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                      tabIndex={-1}
                    >
                      {mostrarPasswordEliminar ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errorEliminar && <p className="text-xs text-red-400">{errorEliminar}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCerrarEliminar}
                      disabled={pendingEliminar}
                      className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarPassword}
                      disabled={pendingEliminar || passwordEliminar.length === 0}
                      className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {pendingEliminar && <Spinner className="h-3.5 w-3.5" />}
                      {pendingEliminar ? "Eliminando..." : "Eliminar definitivamente"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
    <tr className={`transition-colors ${pending || pendingEstado || pendingVincular || pendingEliminar ? "opacity-50" : "hover:bg-slate-800"}`}>
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
        ) : pending ? (
          // Mientras se guarda el nuevo rol, en vez de dejar el <select>
          // interactuable con el valor viejo, se lo reemplaza por unos
          // puntos suspensivos centrados — misma señal de "carga en curso"
          // que .loading-dots usa en el resto de la app, sin texto porque acá
          // no hay lugar para un label al lado.
          <div className="flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-2 py-1 h-[30px] min-w-[130px]">
            {/* Los "." se apoyan en la línea de base del texto, así que con
                text-2xl quedan visualmente pegados abajo del box — se
                compensa subiéndolos con -translate-y en vez de perseguir el
                centrado con más padding. */}
            <span className="loading-dots inline-flex items-center gap-0.5 text-2xl leading-none text-slate-500 -translate-y-1.5" aria-hidden="true">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
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
        <div className="flex items-center gap-1.5 h-7">
          {pendingVincular ? (
            <div className="progress-bar-track h-7 w-full max-w-[220px] rounded-md border border-slate-700">
              <div className="progress-bar-fill" />
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </td>

      {/* Estado activo / inactivo */}
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2 h-5 ${pendingEstado ? "justify-center" : ""}`}>
          {pendingEstado ? (
            <Spinner className="h-4 w-4 text-slate-400" />
          ) : (
            <>
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
            </>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={handleAbrirEliminar}
          disabled={pending || pendingEstado || pendingVincular || esPropioUsuario || usuario.activo}
          title={
            esPropioUsuario
              ? "No podés eliminar tu propia cuenta"
              : usuario.activo
              ? "Desactivá la cuenta antes de eliminarla"
              : "Eliminar usuario"
          }
          className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-slate-500"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
    </>
  );
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`spinner shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
    </svg>
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

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
