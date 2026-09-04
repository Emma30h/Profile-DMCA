"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCountUp } from "@/lib/useCountUp";
import { verificarCuentaActiva } from "@/app/actions/auth";
import { ButtonSpinner } from "@/components/ui/Spinner";
import type { TipoPersonal } from "@/types";

interface Rango {
  nombre: string;
  cuerpo: string;
}

interface Stats {
  agentes: number;
  turnos: number;
  tipos: number;
  rangos: number;
}

type Props = {
  initialTab: "login" | "signup";
  initialError: string | null;
  rangos: Rango[];
  stats: Stats;
};

const TIPO_LABELS: Record<TipoPersonal, string> = {
  SEGURIDAD: "Seguridad",
  TECNICO: "Técnico",
  CIVIL_BECARIO: "Civil Becario",
  CIVIL_POLICIAL: "Civil Policial",
};

const CUERPOS_POR_TIPO: Record<string, string[]> = {
  SEGURIDAD: ["SUBOFICIAL", "OFICIAL"],
  TECNICO: ["TECNICO"],
};

const REQUISITOS: { label: string; test: (p: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Al menos una letra mayúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Al menos una letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Al menos un número", test: (p) => /[0-9]/.test(p) },
];

// Recién a partir de acá se muestra el texto "Ingresando..." con los puntos
// animados — antes de eso alcanza con el spinner, mostrar texto para una
// espera normal de menos de 15s solo agrega ruido visual.
const MS_ANTES_DE_AVISAR_DEMORA = 15000;

function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return url.startsWith("https://") && !url.includes("[project-ref]") && key.length > 20;
}

function capitalizar(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

function mapLoginError(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Credenciales incorrectas. Verificá tu email y contraseña.";
  if (message.includes("Email not confirmed"))
    return "Cuenta no verificada. Revisá tu correo electrónico.";
  if (message.includes("User not found"))
    return "No existe una cuenta con ese email.";
  return "Ocurrió un error al iniciar sesión. Intentá de nuevo.";
}

function mapSignupError(message: string): string {
  if (message.includes("already registered") || message.includes("User already registered"))
    return "Ya existe una cuenta con ese email.";
  if (message.includes("invalid email") || message.includes("Invalid email"))
    return "El email ingresado no es válido.";
  if (message.includes("Password should be"))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (message.includes("rate limit"))
    return "Se superó el límite de emails de confirmación. Esperá unos minutos y volvé a intentar.";
  return "Ocurrió un error al crear la cuenta. Intentá de nuevo.";
}

const label = "block text-[12.5px] text-[#93a0b8] mb-1.5";
const input =
  "w-full min-h-[44px] px-3 py-2.5 text-sm font-body text-[#e8edf6] bg-[#232c40] " +
  "border border-white/10 rounded-md placeholder:text-[#6b7893] " +
  "hover:border-white/20 focus:outline-none focus:border-[#2f6fed] focus:ring-[3px] focus:ring-[#2f6fed]/25 transition-colors";
const btn =
  "inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-md border-0 " +
  "font-head text-sm font-semibold tracking-[0.04em] text-white bg-[#2f6fed] " +
  "hover:bg-[#2560d8] active:bg-[#1f52ba] disabled:opacity-45 disabled:pointer-events-none transition-colors";
const tab = (on: boolean) =>
  "font-head text-xs font-semibold uppercase tracking-[0.06em] px-[13px] py-1.5 rounded-[5px] " +
  "border-0 cursor-pointer whitespace-nowrap transition-colors " +
  (on ? "bg-[#2f6fed] text-white" : "bg-transparent text-[#93a0b8] hover:text-[#e8edf6]");

function Eye() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function StatNumber({ target, delayMs, pad }: { target: number; delayMs: number; pad?: boolean }) {
  const value = useCountUp(target, delayMs);
  return <span className="tabular-nums">{pad ? String(value).padStart(2, "0") : String(value)}</span>;
}

export default function AuthScreen({ initialTab, initialError, rangos, stats }: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<"login" | "signup">(initialTab);

  function cambiarVista(v: "login" | "signup") {
    setVista(v);
    router.replace(v === "signup" ? "/login?tab=signup" : "/login", { scroll: false });
  }

  // ── Login ────────────────────────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginTardando, setLoginTardando] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(initialError);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    if (!loginLoading) return;
    const timer = setTimeout(() => setLoginTardando(true), MS_ANTES_DE_AVISAR_DEMORA);
    return () => clearTimeout(timer);
  }, [loginLoading]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginTardando(false);
    setLoginError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (authError) {
      setLoginError(mapLoginError(authError.message));
      setLoginLoading(false);
      return;
    }

    const activa = await verificarCuentaActiva();
    if (!activa) {
      setLoginError("Tu cuenta fue deshabilitada. Contactá a un administrador.");
      setLoginLoading(false);
      return;
    }

    // Navegación completa (no router.push + router.refresh): esa combinación
    // justo después de esperar una Server Action a veces quedaba en un estado
    // intermedio del router y el usuario tenía que refrescar a mano para
    // entrar. Una recarga real no depende de esa mecánica — siempre entra.
    window.location.href = "/dashboard";
  }

  // ── Signup ───────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [cuil, setCuil] = useState("");
  const [tipoPersonal, setTipoPersonal] = useState<TipoPersonal | "">("");
  const [jerarquia, setJerarquia] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);

  const cuerposValidos = tipoPersonal ? (CUERPOS_POR_TIPO[tipoPersonal] ?? []) : [];
  const rangosFiltrados = rangos.filter((r) => cuerposValidos.includes(r.cuerpo));
  const requiereJerarquia = rangosFiltrados.length > 0;

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSignupError(null);

    if (!isSupabaseConfigured()) {
      setSignupError("Supabase no está configurado en este entorno. Completá las variables de entorno.");
      return;
    }
    if (cuil.length !== 11) {
      setSignupError("El CUIL debe tener exactamente 11 dígitos.");
      return;
    }
    const requisitosIncumplidos = REQUISITOS.filter((r) => !r.test(signupPassword));
    if (requisitosIncumplidos.length > 0) {
      setSignupError("La contraseña no cumple con todos los requisitos.");
      return;
    }
    if (signupPassword !== confirmar) {
      setSignupError("Las contraseñas no coinciden.");
      return;
    }

    setSignupLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: signupEmail.trim().toLowerCase(),
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          nombre: capitalizar(nombre),
          apellido: capitalizar(apellido),
          cuil,
          tipoPersonal: tipoPersonal || null,
          jerarquia: jerarquia.trim() || null,
        },
      },
    });

    if (authError) {
      setSignupError(mapSignupError(authError.message));
      setSignupLoading(false);
      return;
    }

    router.push(`/verificar-cuenta?email=${encodeURIComponent(signupEmail.trim().toLowerCase())}`);
  }

  const error = vista === "login" ? loginError : signupError;

  return (
    <div className="auth-card-in w-[1180px] max-w-full h-[700px] max-h-full grid grid-cols-2 border border-white/[0.12] bg-[#1e2637] font-body text-[#e8edf6] max-[900px]:grid-cols-1 max-[900px]:h-auto max-[900px]:max-h-none max-[900px]:w-full">

      {/* Panel institucional */}
      <aside className="flex flex-col overflow-y-auto p-11 bg-[#182031] border-r border-white/10 max-[900px]:border-r-0 max-[900px]:border-b max-[900px]:p-5">
        <div className="flex items-center gap-4 max-[900px]:gap-3">
          <div className="relative inline-flex items-center justify-center w-16 h-16 shrink-0 max-[900px]:w-11 max-[900px]:h-11">
            <span className="auth-sonar-ping absolute inset-0 rounded-full bg-[#2f6fed]/40" aria-hidden="true" />
            <span className="auth-sonar-ping auth-sonar-ping-delay absolute inset-0 rounded-full bg-[#2f6fed]/40" aria-hidden="true" />
            <div className="relative grid place-items-center w-16 h-16 rounded-full bg-[#2f6fed]/15 ring-1 ring-white/15 max-[900px]:w-11 max-[900px]:h-11">
              <Image src="/logo-ojos-en-alerta-blanco.png" alt="" width={36} height={36} className="object-contain max-[900px]:w-[26px] max-[900px]:h-[26px]" />
            </div>
          </div>
          <div>
            <div className="font-head text-base font-semibold leading-[1.1] tracking-[0.02em] text-white max-[900px]:text-sm">POLICÍA DE CÓRDOBA</div>
            <div className="text-[11px] uppercase tracking-[0.09em] text-[#93a0b8] max-[900px]:text-[10px]">Dirección Monitoreo Cordobeses en Alerta</div>
          </div>
        </div>

        <h1 className="font-head text-[52px] leading-[1.06] text-white mt-[54px] mb-2.5 max-[900px]:text-[26px] max-[900px]:leading-[1.1] max-[900px]:mt-5 max-[900px]:mb-1.5">
          Sistema<br className="max-[900px]:hidden" /> de Gestión<br className="max-[900px]:hidden" /> de Personal
        </h1>
        <p className="max-w-[38ch] text-sm text-[#93a0b8] max-[900px]:text-[12.5px] max-[900px]:max-w-none">
          Registro único del personal de la Dirección: legajos, escalafón, turnos, asistencia y licencias.
        </p>

        <div className="mt-auto grid grid-cols-2 border-t border-white/10 max-[900px]:mt-4">
          {[
            { n: stats.agentes, pad: false, l: "Agentes registrados" },
            { n: stats.turnos, pad: true, l: "Turnos operativos" },
            { n: stats.tipos, pad: true, l: "Tipos de personal" },
            { n: stats.rangos, pad: false, l: "Rangos del escalafón" },
          ].map(({ n, pad, l }, i) => (
            <div key={l} className={"p-[18px] max-[900px]:p-2.5 " + (i % 2 === 0 ? "border-r border-white/10 " : "") + (i < 2 ? "border-b border-white/10" : "")}>
              <div className="font-head text-[32px] font-semibold leading-none text-[#6fa0ff] max-[900px]:text-[22px]">
                <StatNumber target={n} pad={pad} delayMs={i * 90} />
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.1em] text-[#93a0b8] max-[900px]:text-[9.5px]">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 text-[10.5px] uppercase tracking-[0.09em] text-[#6b7893] max-[900px]:hidden">
          DMCA · v1.0 · Uso oficial — acceso auditado
        </div>
      </aside>

      {/* Panel de acceso */}
      <main className="flex flex-col justify-center overflow-y-auto p-11 max-[900px]:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-[26px] max-[900px]:mb-4">
          <h2 key={vista} className="auth-view-in font-head text-[22px] sm:text-[26px] text-white">
            {vista === "login" ? "Acceso al sistema" : "Crear cuenta"}
          </h2>
          <div role="tablist" className="inline-flex shrink-0 p-[3px] rounded-[7px] bg-white/5 border border-white/10">
            <button role="tab" type="button" aria-selected={vista === "login"} onClick={() => cambiarVista("login")} className={tab(vista === "login")}>
              Ingresar
            </button>
            <button role="tab" type="button" aria-selected={vista === "signup"} onClick={() => cambiarVista("signup")} className={tab(vista === "signup")}>
              Crear cuenta
            </button>
          </div>
        </div>

        {error ? (
          <p role="alert" className="mb-4 max-w-[460px] px-3 py-2.5 rounded-md text-[13px] text-[#ffb4b4] bg-[#c96f6f]/15 border border-[#c96f6f]/35">
            {error}
          </p>
        ) : null}

        {vista === "login" ? (
          <form key="login" onSubmit={handleLogin} className="auth-view-in flex flex-col gap-4 max-w-[420px]">
            <div>
              <label className={label} htmlFor="l-email">Correo electrónico</label>
              <input
                className={input}
                id="l-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
              />
            </div>
            <div>
              <label className={label} htmlFor="l-pass">Contraseña</label>
              <div className="relative">
                <input
                  className={`${input} pr-10`}
                  id="l-pass"
                  name="password"
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7893] hover:text-[#93a0b8]"
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end text-[13px] text-[#93a0b8]">
              <a href="/cambiar-contrasena" className="text-[#6fa0ff] hover:text-[#8fb6ff] whitespace-nowrap underline-offset-[3px] hover:underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
            <button className={btn} type="submit" disabled={loginLoading}>
              {loginLoading ? (
                <>
                  <ButtonSpinner className="text-white" />
                  {loginTardando && (
                    <span className="inline-flex items-center">
                      INGRESANDO
                      <span className="loading-dots inline-flex" aria-hidden="true">
                        <span>.</span><span>.</span><span>.</span>
                      </span>
                    </span>
                  )}
                </>
              ) : (
                "INGRESAR"
              )}
            </button>
            <p className="mt-1 text-[12.5px] text-[#93a0b8]">
              Las cuentas nuevas se crean con rol de solo lectura hasta que un administrador las habilite.
            </p>
          </form>
        ) : (
          <form key="signup" onSubmit={handleSignup} className="auth-view-in grid grid-cols-2 gap-3.5 max-w-[460px] max-[900px]:grid-cols-1">
            <div>
              <label className={label} htmlFor="s-nombre">Nombre</label>
              <input className={input} id="s-nombre" name="nombre" autoComplete="given-name" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan" />
            </div>
            <div>
              <label className={label} htmlFor="s-apellido">Apellido</label>
              <input className={input} id="s-apellido" name="apellido" autoComplete="family-name" required value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="García" />
            </div>

            <div className="col-span-full">
              <label className={label} htmlFor="s-cuil">CUIL</label>
              <input
                className={input}
                id="s-cuil"
                name="cuil"
                inputMode="numeric"
                autoComplete="off"
                required
                maxLength={11}
                value={cuil}
                onChange={(e) => setCuil(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Sin puntos ni guiones"
              />
              <p className="mt-1 text-[12.5px] text-[#93a0b8]">
                Si ya tenías un legajo cargado, lo vinculamos automáticamente a tu cuenta.
              </p>
            </div>

            <div className="col-span-full">
              <label className={label} htmlFor="s-tipo">Tipo de personal</label>
              <select
                className={input}
                id="s-tipo"
                name="tipoPersonal"
                required
                value={tipoPersonal}
                onChange={(e) => {
                  setTipoPersonal(e.target.value as TipoPersonal | "");
                  setJerarquia("");
                }}
              >
                <option value="" disabled>Seleccioná una opción</option>
                {(Object.keys(TIPO_LABELS) as TipoPersonal[]).map((t) => (
                  <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {requiereJerarquia && (
              <div className="col-span-full">
                <label className={label} htmlFor="s-jerarquia">Jerarquía</label>
                <select className={input} id="s-jerarquia" name="jerarquia" required value={jerarquia} onChange={(e) => setJerarquia(e.target.value)}>
                  <option value="" disabled>Seleccioná una jerarquía</option>
                  {rangosFiltrados.map((r) => (
                    <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-full">
              <label className={label} htmlFor="s-email">Correo institucional</label>
              <input
                className={input}
                id="s-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="apellido@policiacordoba.gob.ar"
              />
            </div>

            <div>
              <label className={label} htmlFor="s-pass">Contraseña</label>
              <div className="relative">
                <input
                  className={`${input} pr-10`}
                  id="s-pass"
                  name="password"
                  type={showSignupPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7893] hover:text-[#93a0b8]"
                  tabIndex={-1}
                >
                  {showSignupPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {signupPassword.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {REQUISITOS.filter((r) => !r.test(signupPassword)).map((r) => (
                    <li key={r.label} className="flex items-center gap-1.5 text-[11.5px] text-[#93a0b8]">
                      <span className="w-1 h-1 rounded-full bg-[#6b7893] shrink-0" />
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className={label} htmlFor="s-pass2">Repetir</label>
              <div className="relative">
                <input
                  className={`${input} pr-10`}
                  id="s-pass2"
                  name="password2"
                  type={showConfirmar ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7893] hover:text-[#93a0b8]"
                  tabIndex={-1}
                >
                  {showConfirmar ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </div>

            <button className={`${btn} col-span-full mt-1`} type="submit" disabled={signupLoading || !isSupabaseConfigured()}>
              {signupLoading ? (
                <>
                  <ButtonSpinner className="text-white" />
                  CREANDO…
                </>
              ) : (
                "CREAR CUENTA"
              )}
            </button>
            <p className="col-span-full text-[12.5px] text-[#93a0b8]">
              Vas a recibir un correo de verificación antes de poder ingresar.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
