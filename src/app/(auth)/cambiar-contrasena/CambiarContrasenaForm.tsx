"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  solicitarCodigo,
  verificarCodigo,
  cambiarContrasenaAction,
} from "@/app/actions/reset-password";

type Step = "email" | "codigo" | "nueva-contrasena" | "exito";

const REQUISITOS: { label: string; test: (p: string) => boolean }[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Al menos una letra mayúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Al menos una letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Al menos un número", test: (p) => /[0-9]/.test(p) },
];

const RESEND_COOLDOWN = 60; // segundos

export default function CambiarContrasenaForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Cooldown para reenviar código
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function iniciarCooldown() {
    setCooldown(RESEND_COOLDOWN);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSolicitarCodigo(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await solicitarCodigo(email.trim().toLowerCase());
      if (!res.ok) { setError(res.error ?? "Error inesperado."); return; }
      setStep("codigo");
      iniciarCooldown();
    });
  }

  function handleReenviar() {
    if (cooldown > 0 || pending) return;
    setError(null);
    setCodigo("");
    startTransition(async () => {
      const res = await solicitarCodigo(email.trim().toLowerCase());
      if (!res.ok) { setError(res.error ?? "Error inesperado."); return; }
      iniciarCooldown();
    });
  }

  function handleVerificarCodigo(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verificarCodigo(email, codigo);
      if (!res.ok) { setError(res.error ?? "Error inesperado."); return; }
      setStep("nueva-contrasena");
    });
  }

  function handleCambiarContrasena(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    if (nuevaContrasena !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const incumplidos = REQUISITOS.filter((r) => !r.test(nuevaContrasena));
    if (incumplidos.length > 0) {
      setError("La contraseña no cumple con todos los requisitos.");
      return;
    }
    startTransition(async () => {
      const res = await cambiarContrasenaAction(email, codigo, nuevaContrasena);
      if (!res.ok) { setError(res.error ?? "Error inesperado."); return; }
      setStep("exito");
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === "exito") {
    return (
      <div className="text-center space-y-4 py-4">
        <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
          <CheckIcon className="w-7 h-7 text-green-400" />
        </div>
        <p className="font-semibold text-slate-100">¡Contraseña actualizada!</p>
        <p className="text-sm text-slate-400">Ya podés iniciar sesión con tu nueva contraseña.</p>
        <a
          href="/login"
          className="inline-block mt-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
        >
          Ir al inicio de sesión
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Indicador de pasos */}
      <Stepper step={step} />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Paso 1: Email ── */}
      {step === "email" && (
        <form onSubmit={handleSolicitarCodigo} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <p className="text-xs text-slate-400">
            Te enviaremos un código de 8 dígitos a este correo.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
          >
            {pending ? "Enviando..." : "Enviar código"}
          </button>
        </form>
      )}

      {/* ── Paso 2: Código ── */}
      {step === "codigo" && (
        <form onSubmit={handleVerificarCodigo} className="space-y-4">
          <p className="text-sm text-slate-400">
            Ingresá el código de 8 dígitos enviado a{" "}
            <span className="font-medium text-slate-100">{email}</span>.
          </p>
          <div>
            <label htmlFor="codigo" className="block text-sm font-medium text-slate-300 mb-1">
              Código de verificación
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{8}"
              maxLength={8}
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="00000000"
              className="w-full rounded-lg border border-slate-700 px-3 py-2.5 text-sm text-center tracking-[0.3em] font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <button
            type="submit"
            disabled={pending || codigo.length !== 8}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
          >
            {pending ? "Verificando..." : "Verificar código"}
          </button>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>¿No llegó el correo?</span>
            <button
              type="button"
              onClick={handleReenviar}
              disabled={cooldown > 0 || pending}
              className="text-blue-400 hover:text-blue-300 disabled:text-slate-500 disabled:cursor-not-allowed font-medium transition-colors"
            >
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
            </button>
          </div>
        </form>
      )}

      {/* ── Paso 3: Nueva contraseña ── */}
      {step === "nueva-contrasena" && (
        <form onSubmit={handleCambiarContrasena} className="space-y-4">
          <div>
            <label htmlFor="nueva" className="block text-sm font-medium text-slate-300 mb-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="nueva"
                type={showNueva ? "text" : "password"}
                autoComplete="new-password"
                required
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowNueva((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                tabIndex={-1}
              >
                {showNueva ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {nuevaContrasena.length > 0 && (
              <ul className="mt-2 space-y-1">
                {REQUISITOS.filter((r) => !r.test(nuevaContrasena)).map((r) => (
                  <li key={r.label} className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                    {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="confirmar" className="block text-sm font-medium text-slate-300 mb-1">
              Confirmar contraseña
            </label>
            <div className="relative">
              <input
                id="confirmar"
                type={showConfirmar ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repetí la contraseña"
                className="w-full rounded-lg border border-slate-700 px-3 py-2.5 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirmar((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
                tabIndex={-1}
              >
                {showConfirmar ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {confirmar.length > 0 && nuevaContrasena !== confirmar && (
              <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-colors"
          >
            {pending ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </form>
      )}

      <p className="text-center text-xs text-slate-500">
        <a href="/login" className="hover:text-slate-400 transition-colors">
          Volver al inicio de sesión
        </a>
      </p>
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: "email", label: "Correo" },
  { key: "codigo", label: "Código" },
  { key: "nueva-contrasena", label: "Contraseña" },
];

function stepIndex(step: Step) {
  return STEPS.findIndex((s) => s.key === step);
}

function Stepper({ step }: { step: Step }) {
  const current = stepIndex(step);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-500/20"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {done ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs ${active ? "text-slate-100 font-medium" : "text-slate-500"}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px flex-1 mb-4 ${i < current ? "bg-blue-600" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}
