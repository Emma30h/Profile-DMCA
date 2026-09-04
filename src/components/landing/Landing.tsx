"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, ClipboardList, Clock, FileText, LineChart, Moon, ShieldCheck, Sun } from "lucide-react";
import { useTemaIndustry } from "@/lib/useTemaIndustry";
import { useTypewriter } from "@/lib/useTypewriter";
import { useRevealOnScroll } from "@/lib/useRevealOnScroll";
import BlueprintFrame from "./BlueprintFrame";
import PadronStats, { type StatsPublicas } from "./PadronStats";
import HeroBackground from "./HeroBackground";
import RotatingCube from "./RotatingCube";

const TITULO_HERO = "Sistema\nde Gestión\nde Personal";

// Alto real del header sticky en una sola fila (padding 14px arriba/abajo +
// caja de logo de 34px + 1px de borde inferior) — se resta del 100dvh del
// hero para que header+hero ocupen exactamente un viewport, ver más abajo.
// En mobile el header puede pasar a 2 filas (ver className del header) y
// termina siendo más alto que esto — se acepta ese margen de más como
// trade-off simple frente a medir el alto real con un ref.
const ALTO_HEADER = 63;

const MODULOS = [
  { icon: FileText, titulo: "Legajos", fase: "FASE 1–2", desc: "Alta, baja y modificación de agentes. Datos personales, laborales, médicos y de armamento según el tipo de personal." },
  { icon: ShieldCheck, titulo: "Escalafón", fase: "FASE 2", desc: "Tres cuerpos y 26 rangos. Historial de ascensos. Aplica a personal de Seguridad y Técnico." },
  { icon: Clock, titulo: "Turnos y horarios", fase: "FASE 3", desc: "Horario fijo con excepciones. Turnos A–F, administrativo, full time, guardia larga y superior de turno." },
  { icon: CalendarCheck, titulo: "Asistencia", fase: "FASE 4", desc: "Registro diario que se cierra al final del día, con reportes de ausentismo y presentismo por sector." },
  { icon: ClipboardList, titulo: "Licencias y francos", fase: "FASE 5", desc: "Solicitud, aprobación y seguimiento. Francos ordinarios, compensatorios y especiales, sin superposición de fechas." },
  { icon: LineChart, titulo: "Padrón y reportes", fase: "FASE 1", desc: "Panel con conteos por tipo y estado, listado completo con filtros, búsqueda y paginación del lado del servidor." },
] as const;

const ROLES = [
  { rol: "SUPERADMIN", alcance: "Administrador total del sistema", permisos: "Todo, incluida la configuración" },
  { rol: "ADMIN", alcance: "Jefatura de área / responsable de RRHH", permisos: "Gestión completa del personal" },
  { rol: "SUPERVISOR", alcance: "Jefe de turno o superior intermedio", permisos: "Aprobar licencias, gestionar su grupo" },
  { rol: "OPERADOR", alcance: "Carga de datos y asistencia", permisos: "Cargar; no borra ni aprueba" },
  { rol: "READONLY", alcance: "Auditoría y consulta", permisos: "Solo visualización" },
] as const;

const FASES = [
  { estado: "EN CURSO", titulo: "Fase 1", desc: "Login, dashboard y listado de personal.", enCurso: true },
  { estado: "PLANIFICADA", titulo: "Fase 2", desc: "Legajos completos y escalafón.", enCurso: false },
  { estado: "PLANIFICADA", titulo: "Fase 3", desc: "Turnos y horarios.", enCurso: false },
  { estado: "PLANIFICADA", titulo: "Fase 4", desc: "Asistencia y presentismo.", enCurso: false },
  { estado: "PLANIFICADA", titulo: "Fase 5", desc: "Licencias y francos.", enCurso: false },
] as const;

// Listener de scroll pasivo compartido por las dos columnas del hero — factor
// negativo para la columna de texto, positivo para la del cubo, igual que el
// prototipo. Se desactiva entero con prefers-reduced-motion.
function useParallax(factor: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function onScroll() {
      if (ref.current) ref.current.style.transform = `translate3d(0, ${window.scrollY * factor}px, 0)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [factor]);
  return ref;
}

export function ThemeToggle({ alternar, size }: { alternar: () => void; size: number }) {
  return (
    <button type="button" onClick={alternar} aria-label="Cambiar tema" className="t-icon-btn" style={{ width: size, height: size }}>
      <span className="t-icon-oscuro"><Sun size={16} strokeWidth={1.5} /></span>
      <span className="t-icon-claro"><Moon size={16} strokeWidth={1.5} /></span>
    </button>
  );
}

function SeccionHeading({ numero, titulo }: { numero: string; titulo: string }) {
  const { ref, style } = useRevealOnScroll<HTMLDivElement>(0);
  return (
    <div ref={ref} style={{ ...style, display: "flex", alignItems: "baseline", gap: 16, marginBottom: 34 }}>
      <span style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".16em", color: "var(--t-accent)" }}>{numero}</span>
      <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 34, margin: 0 }}>{titulo}</h2>
    </div>
  );
}

function ModuloCard({ modulo, delay }: { modulo: (typeof MODULOS)[number]; delay: number }) {
  const { ref, style } = useRevealOnScroll<HTMLDivElement>(delay);
  const Icon = modulo.icon;
  return (
    <BlueprintFrame
      ref={ref}
      className="flex flex-col gap-2.5"
      style={{ ...style, padding: "22px 20px", minHeight: 172 }}
    >
      <div className="flex items-center justify-between">
        <Icon size={22} strokeWidth={1.5} color="var(--t-accent)" />
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 10.5, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.4)" }}>{modulo.fase}</span>
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19 }}>{modulo.titulo}</div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "rgba(var(--t-fg-rgb),.6)" }}>{modulo.desc}</p>
    </BlueprintFrame>
  );
}

function RolRow({ fila, delay }: { fila: (typeof ROLES)[number]; delay: number }) {
  const { ref, style } = useRevealOnScroll<HTMLTableRowElement>(delay);
  return (
    <tr ref={ref} style={style}>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.1)" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 11.5, letterSpacing: ".1em", border: "1px solid rgba(var(--t-accent-rgb),.5)", color: "var(--t-accent)", padding: "3px 9px" }}>
          {fila.rol}
        </span>
      </td>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.1)", color: "rgba(var(--t-fg-rgb),.8)" }}>{fila.alcance}</td>
      <td style={{ padding: "11px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.1)", color: "rgba(var(--t-fg-rgb),.6)", fontSize: 13 }}>{fila.permisos}</td>
    </tr>
  );
}

function FaseCard({ fase, delay }: { fase: (typeof FASES)[number]; delay: number }) {
  const { ref, style } = useRevealOnScroll<HTMLDivElement>(delay);
  return (
    <div ref={ref} style={{ ...style, padding: "20px 18px 22px", borderRight: "1px solid rgba(var(--t-fg-rgb),.14)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 7, height: 7, background: fase.enCurso ? "var(--t-accent)" : "rgba(var(--t-fg-rgb),.3)", display: "block" }} />
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 10.5, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.5)" }}>{fase.estado}</span>
      </div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17 }}>{fase.titulo}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(var(--t-fg-rgb),.55)" }}>{fase.desc}</div>
    </div>
  );
}

export default function Landing({ stats }: { stats: StatsPublicas }) {
  const { alternar } = useTemaIndustry();
  const { texto: tituloTipeado, cursorVisible } = useTypewriter(TITULO_HERO);
  const refParallaxTexto = useParallax(-0.06);
  const refParallaxCubo = useParallax(0.05);
  const { ref: refParrafo, style: styleParrafo } = useRevealOnScroll<HTMLParagraphElement>(0.06);
  const { ref: refOrganigrama, style: styleOrganigrama } = useRevealOnScroll<HTMLDivElement>(0.08);
  const { ref: refCta, style: styleCta } = useRevealOnScroll<HTMLDivElement>(0);

  return (
    <div style={{ minHeight: "100vh", background: "var(--t-bg)", color: "var(--t-fg)", fontFamily: "var(--font-body)" }}>
      {/* ── Header ── */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 20,
          background: "rgba(var(--t-bg-rgb),.92)", backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(var(--t-fg-rgb),.12)",
        }}
      >
        <div
          style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 20px" }}
          className="flex items-center gap-x-4 gap-y-2 flex-wrap sm:flex-nowrap sm:gap-7 sm:px-7"
        >
          <div className="flex items-center gap-2.5" style={{ marginRight: "auto" }}>
            <div style={{ width: 34, height: 34, flex: "none", display: "grid", placeItems: "center" }}>
              <Image src="/logo-ojos-en-alerta-blanco.png" alt="" width={30} height={24} />
            </div>
            <div className="flex flex-col" style={{ lineHeight: 1.1 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 14, letterSpacing: ".04em" }}>POLICÍA DE CÓRDOBA</span>
              <span className="hidden sm:inline" style={{ fontFamily: "var(--font-heading)", fontSize: 10.5, letterSpacing: ".16em", color: "rgba(var(--t-fg-rgb),.5)" }}>
                DIRECCIÓN MONITOREO CORDOBESES EN ALERTA
              </span>
            </div>
          </div>
          <nav className="hidden lg:flex" style={{ gap: 26, fontSize: 13.5, letterSpacing: ".02em", whiteSpace: "nowrap", flex: "none" }}>
            {[["#modulos", "Módulos"], ["#estructura", "Estructura"], ["#roles", "Roles"], ["#hoja-de-ruta", "Hoja de ruta"]].map(([href, label]) => (
              <a key={href} href={href} className="t-navlink">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-2.5 ml-auto sm:ml-0">
            <ThemeToggle alternar={alternar} size={34} />
            <Link
              href="/login"
              className="t-btn t-btn-outline px-2.5 py-1.5 text-[11px] tracking-[.06em] sm:px-3.5 sm:py-2 sm:text-[13px]"
            >
              INGRESAR
            </Link>
            <Link
              href="/login?tab=signup"
              className="t-btn t-btn-solid px-2.5 py-1.5 text-[11px] tracking-[.06em] sm:px-3.5 sm:py-2 sm:text-[13px]"
            >
              CREAR CUENTA
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      {/* La "primera pantalla" (header + hero) ocupa exactamente un viewport:
          minHeight resta el alto real del header (ALTO_HEADER) para que no
          haga falta scrollear ni un poco para ver el final del hero. */}
      <section
        style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: `calc(100dvh - ${ALTO_HEADER}px)` }}
      >
        <HeroBackground />
        <div
          style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "48px 28px 36px", gap: 56, width: "100%" }}
          className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr] items-center"
        >
          <div ref={refParallaxTexto}>
            <h1
              style={{
                fontFamily: "var(--font-heading)", fontWeight: 600, lineHeight: 0.98,
                letterSpacing: "-.02em", margin: "0 0 20px", whiteSpace: "pre-line",
              }}
              className="text-[40px] sm:text-[56px] lg:text-[72px] min-h-[120px] sm:min-h-[168px] lg:min-h-[212px]"
            >
              {tituloTipeado}
              <span
                style={{
                  display: "inline-block", width: ".5em", height: ".82em", marginLeft: ".06em",
                  background: "var(--t-accent)", verticalAlign: -2, opacity: cursorVisible ? 1 : 0,
                }}
              />
            </h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "rgba(var(--t-fg-rgb),.66)", maxWidth: "46ch", margin: "0 0 30px" }}>
              Registro único del personal de la Dirección Monitoreo Cordobeses en Alerta: legajos, escalafón, turnos, asistencia y licencias en un solo lugar.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/login" className="t-btn t-btn-solid">INGRESAR AL SISTEMA</Link>
              <Link href="/login?tab=signup" className="t-btn t-btn-outline">SOLICITAR ACCESO</Link>
            </div>
          </div>

          <div ref={refParallaxCubo} className="flex flex-col gap-10">
            <RotatingCube />
            <BlueprintFrame style={{ padding: "18px 22px", background: "rgba(var(--t-bg-rgb),.72)", backdropFilter: "blur(3px)" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".16em", color: "rgba(var(--t-fg-rgb),.45)", marginBottom: 14 }}>
                PADRÓN AL {String(new Date().getMonth() + 1).padStart(2, "0")} · {new Date().getFullYear()}
              </div>
              <PadronStats stats={stats} tamaño="grande" fondoCelda="var(--t-bg)" />
            </BlueprintFrame>
          </div>
        </div>
      </section>

      {/* ── 01 · Módulos ── */}
      <section id="modulos" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "66px 28px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <SeccionHeading numero="01" titulo="Módulos del sistema" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULOS.map((m, i) => (
              <ModuloCard key={m.titulo} modulo={m} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 02 · Estructura ── */}
      <section id="estructura" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "66px 28px", background: "var(--t-bg-alt)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", gap: 52 }} className="grid grid-cols-1 lg:grid-cols-[.8fr_1.2fr] items-start">
          <div>
            <SeccionHeading numero="02" titulo="Estructura" />
            <p ref={refParrafo} style={{ ...styleParrafo, margin: 0, fontSize: 15, lineHeight: 1.65, color: "rgba(var(--t-fg-rgb),.62)" }}>
              Cada agente pertenece a un sector del organigrama oficial. El sistema replica la jerarquía Dirección → Departamento → División para filtrar padrones, turnos y reportes por sector.
            </p>
          </div>
          <div ref={refOrganigrama} style={{ ...styleOrganigrama, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: "1px solid var(--t-accent)", padding: "14px 18px", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 17, letterSpacing: ".02em", color: "var(--t-accent)" }}>
              DIRECCIÓN MONITOREO CORDOBESES EN ALERTA
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div style={{ border: "1px solid rgba(var(--t-fg-rgb),.22)", padding: "13px 15px" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.42)", marginBottom: 6 }}>DIVISIÓN</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>Ayudantía</div>
              </div>
              <div style={{ border: "1px solid rgba(var(--t-fg-rgb),.22)", padding: "13px 15px" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.42)", marginBottom: 6 }}>DEPARTAMENTO</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>Alerta Ciudadana</div>
                <div
                  style={{
                    marginTop: 10, display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5,
                    color: "rgba(var(--t-fg-rgb),.58)", borderLeft: "1px solid rgba(var(--t-fg-rgb),.22)", paddingLeft: 10,
                  }}
                >
                  <span>División Alerta y Coordinación Vecinal</span>
                </div>
              </div>
              <div style={{ border: "1px solid rgba(var(--t-fg-rgb),.22)", padding: "13px 15px" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 10, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.42)", marginBottom: 6 }}>DIVISIÓN</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 15 }}>Socio Educativa</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · Roles ── */}
      <section id="roles" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "66px 28px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", overflowX: "auto" }}>
          <SeccionHeading numero="03" titulo="Roles y permisos" />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".12em", color: "rgba(var(--t-fg-rgb),.5)", padding: "9px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.28)", width: 170 }}>ROL</th>
                <th style={{ textAlign: "left", fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".12em", color: "rgba(var(--t-fg-rgb),.5)", padding: "9px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.28)" }}>ALCANCE</th>
                <th style={{ textAlign: "left", fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".12em", color: "rgba(var(--t-fg-rgb),.5)", padding: "9px 10px", borderBottom: "1px solid rgba(var(--t-fg-rgb),.28)", width: 250 }}>PERMISOS CLAVE</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r, i) => (
                <RolRow key={r.rol} fila={r} delay={i * 0.06} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 04 · Hoja de ruta ── */}
      <section id="hoja-de-ruta" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "66px 28px", background: "var(--t-bg-alt)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <SeccionHeading numero="04" titulo="Hoja de ruta" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.22)" }}>
            {FASES.map((f, i) => (
              <FaseCard key={f.titulo} fase={f} delay={i * 0.07} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "74px 28px" }}>
        <div
          ref={refCta}
          style={{ ...styleCta, maxWidth: 1180, margin: "0 auto", gap: 40 }}
          className="flex items-center justify-between flex-wrap"
        >
          <div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 38, margin: "0 0 10px" }}>¿Ya tenés cuenta habilitada?</h2>
            <p style={{ margin: 0, fontSize: 15, color: "rgba(var(--t-fg-rgb),.6)", maxWidth: "52ch" }}>
              Las cuentas nuevas se crean con rol de solo lectura hasta que un administrador las habilite.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/login" className="t-btn t-btn-solid">INGRESAR</Link>
            <Link href="/login?tab=signup" className="t-btn t-btn-outline">CREAR CUENTA</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(var(--t-fg-rgb),.12)", padding: "22px 28px" }}>
        <div
          style={{ maxWidth: 1180, margin: "0 auto", gap: 20, fontFamily: "var(--font-heading)", fontSize: 11, letterSpacing: ".14em", color: "rgba(var(--t-fg-rgb),.4)" }}
          className="flex justify-between flex-wrap"
        >
          <span>DMCA · V1.0 · USO OFICIAL — ACCESO AUDITADO</span>
          <span>POLICÍA DE CÓRDOBA</span>
        </div>
      </footer>
    </div>
  );
}
