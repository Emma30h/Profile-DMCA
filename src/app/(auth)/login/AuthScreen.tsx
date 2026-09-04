"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { verificarCuentaActiva } from "@/app/actions/auth";
import { ButtonSpinner } from "@/components/ui/Spinner";
import { useTemaIndustry } from "@/lib/useTemaIndustry";
import BlueprintFrame from "@/components/landing/BlueprintFrame";
import PadronStats, { type StatsPublicas } from "@/components/landing/PadronStats";
import { ThemeToggle } from "@/components/landing/Landing";
import type { TipoPersonal } from "@/types";

interface Rango {
  nombre: string;
  cuerpo: string;
}

type Props = {
  initialTab: "login" | "signup";
  initialError: string | null;
  rangos: Rango[];
  stats: StatsPublicas;
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

const etiqueta = "block text-[12px] mb-1.5" as const;
const etiquetaStyle: React.CSSProperties = { color: "rgba(var(--t-fg-rgb),.6)" };

export default function AuthScreen({ initialTab, initialError, rangos, stats }: Props) {
  const router = useRouter();
  const { alternar } = useTemaIndustry();
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
    <div className="auth-card-in relative w-[1180px] max-w-full">
      <div className="flex items-center justify-between mb-3.5">
        <Link href="/" className="t-link flex items-center gap-2" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 12, letterSpacing: ".14em" }}>
          <ArrowLeft size={14} strokeWidth={1.5} />
          VOLVER
        </Link>
        <ThemeToggle alternar={alternar} size={32} />
      </div>

      <BlueprintFrame
        className="grid grid-cols-1 min-[900px]:grid-cols-2"
        style={{ background: "var(--t-panel)" }}
      >
        {/* Panel institucional */}
        <aside
          className="flex flex-col p-11 max-[900px]:p-5"
          style={{ borderRight: "1px solid rgba(var(--t-fg-rgb),.16)" }}
        >
          <Link href="/" className="flex items-center gap-3.5 mb-11 max-[900px]:mb-6">
            <div
              style={{ width: 52, height: 52, flex: "none", display: "grid", placeItems: "center" }}
              className="max-[900px]:w-11 max-[900px]:h-11"
            >
              <Image src="/logo-ojos-en-alerta-blanco.png" alt="" width={44} height={35} />
            </div>
            <div className="flex flex-col" style={{ lineHeight: 1.15 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15, letterSpacing: ".04em" }}>POLICÍA DE CÓRDOBA</span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".15em", color: "rgba(var(--t-fg-rgb),.5)" }}>
                DIRECCIÓN MONITOREO CORDOBESES EN ALERTA
              </span>
            </div>
          </Link>

          <h1
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 44, lineHeight: 1, margin: "0 0 16px" }}
            className="sm:text-[56px]"
          >
            Sistema<br />de Gestión<br />de Personal
          </h1>
          <p style={{ margin: "0 0 30px", fontSize: 14.5, lineHeight: 1.6, color: "rgba(var(--t-fg-rgb),.6)", maxWidth: "42ch" }}>
            Registro único del personal de la Dirección: legajos, escalafón, turnos, asistencia y licencias.
          </p>

          <div className="mt-auto" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.16)" }}>
            <PadronStats stats={stats} tamaño="chica" fondoCelda="var(--t-panel)" />
          </div>
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 10.5, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.35)", marginTop: 30 }}>
            DMCA · V1.0 · USO OFICIAL — ACCESO AUDITADO
          </div>
        </aside>

        {/* Panel de acceso */}
        <main className="flex flex-col justify-center p-11 max-[900px]:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-[26px] max-[900px]:mb-4">
            <h2 key={vista} className="auth-view-in" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 27, margin: 0 }}>
              {vista === "login" ? "Acceso al sistema" : "Solicitar acceso"}
            </h2>
            <div style={{ display: "inline-flex", border: "1px solid rgba(var(--t-fg-rgb),.24)" }}>
              <button type="button" role="tab" aria-selected={vista === "login"} onClick={() => cambiarVista("login")} className="t-tab">
                INGRESAR
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vista === "signup"}
                onClick={() => cambiarVista("signup")}
                className="t-tab"
                style={{ borderLeft: "1px solid rgba(var(--t-fg-rgb),.24)" }}
              >
                CREAR CUENTA
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mb-4 max-w-[460px] px-3 py-2.5 text-[13px]"
              style={{ color: "#ffb4b4", background: "rgba(201,111,111,.15)", border: "1px solid rgba(201,111,111,.35)" }}
            >
              {error}
            </p>
          ) : null}

          {vista === "login" ? (
            <form key="login" onSubmit={handleLogin} className="auth-view-in flex flex-col gap-4 max-w-[420px]">
              <div>
                <label className={etiqueta} style={etiquetaStyle} htmlFor="l-email">Correo electrónico</label>
                <input
                  className="t-input"
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
                <label className={etiqueta} style={etiquetaStyle} htmlFor="l-pass">Contraseña</label>
                <div className="relative">
                  <input
                    className="t-input"
                    style={{ paddingRight: 40 }}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(var(--t-fg-rgb),.55)" }}
                    tabIndex={-1}
                  >
                    {showLoginPassword ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-end text-[13px]">
                <Link href="/cambiar-contrasena" className="t-link whitespace-nowrap">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <button className="t-btn t-btn-solid t-btn-block" type="submit" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <ButtonSpinner />
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
              <p className="mt-1 text-[12.5px]" style={{ color: "rgba(var(--t-fg-rgb),.5)" }}>
                Las cuentas nuevas se crean con rol de solo lectura hasta que un administrador las habilite.
              </p>
            </form>
          ) : (
            <form key="signup" onSubmit={handleSignup} className="auth-view-in grid grid-cols-2 gap-3.5 max-w-[460px] max-[900px]:grid-cols-1">
              <div>
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-nombre">Nombre</label>
                <input className="t-input" id="s-nombre" name="nombre" autoComplete="given-name" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan" />
              </div>
              <div>
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-apellido">Apellido</label>
                <input className="t-input" id="s-apellido" name="apellido" autoComplete="family-name" required value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="García" />
              </div>

              <div className="col-span-full">
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-cuil">CUIL</label>
                <input
                  className="t-input"
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
                <p className="mt-1 text-[12.5px]" style={{ color: "rgba(var(--t-fg-rgb),.5)" }}>
                  Si ya tenías un legajo cargado, lo vinculamos automáticamente a tu cuenta.
                </p>
              </div>

              <div className="col-span-full">
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-tipo">Tipo de personal</label>
                <select
                  className="t-input"
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
                  <label className={etiqueta} style={etiquetaStyle} htmlFor="s-jerarquia">Jerarquía</label>
                  <select className="t-input" id="s-jerarquia" name="jerarquia" required value={jerarquia} onChange={(e) => setJerarquia(e.target.value)}>
                    <option value="" disabled>Seleccioná una jerarquía</option>
                    {rangosFiltrados.map((r) => (
                      <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-span-full">
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-email">Correo institucional</label>
                <input
                  className="t-input"
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
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-pass">Contraseña</label>
                <div className="relative">
                  <input
                    className="t-input"
                    style={{ paddingRight: 40 }}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(var(--t-fg-rgb),.55)" }}
                    tabIndex={-1}
                  >
                    {showSignupPassword ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                  </button>
                </div>
                {signupPassword.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {REQUISITOS.filter((r) => !r.test(signupPassword)).map((r) => (
                      <li key={r.label} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "rgba(var(--t-fg-rgb),.6)" }}>
                        <span className="w-1 h-1 shrink-0" style={{ background: "rgba(var(--t-fg-rgb),.5)" }} />
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label className={etiqueta} style={etiquetaStyle} htmlFor="s-pass2">Repetir</label>
                <div className="relative">
                  <input
                    className="t-input"
                    style={{ paddingRight: 40 }}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(var(--t-fg-rgb),.55)" }}
                    tabIndex={-1}
                  >
                    {showConfirmar ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div className="col-span-full flex items-start gap-2.5 text-[13px]" style={{ color: "rgba(var(--t-fg-rgb),.6)", lineHeight: 1.5 }}>
                <span style={{ width: 15, height: 15, flex: "none", border: "1px solid rgba(var(--t-fg-rgb),.35)", marginTop: 2 }} />
                <span>Declaro que los datos son correctos y acepto el uso auditado del sistema.</span>
              </div>

              <button className="t-btn t-btn-solid t-btn-block col-span-full" type="submit" disabled={signupLoading || !isSupabaseConfigured()}>
                {signupLoading ? (
                  <>
                    <ButtonSpinner />
                    CREANDO…
                  </>
                ) : (
                  "CREAR CUENTA"
                )}
              </button>
              <p className="col-span-full text-[12.5px]" style={{ color: "rgba(var(--t-fg-rgb),.5)" }}>
                Al crear la cuenta recibirás un correo de verificación antes de poder ingresar.
              </p>
            </form>
          )}
        </main>
      </BlueprintFrame>
    </div>
  );
}
