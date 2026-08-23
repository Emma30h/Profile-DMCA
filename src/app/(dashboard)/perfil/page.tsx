import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import type { RolUsuario } from "@/types";
import FotoPerfilBtn from "@/components/legajo/FotoPerfilBtn";
import AvatarConVerFoto from "@/components/legajo/AvatarConVerFoto";
import EventosResumenMobile from "@/app/(dashboard)/dashboard/EventosResumenMobile";
import VerLegajoBtn from "./VerLegajoBtn";

const ROL_LABELS: Record<RolUsuario, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  OPERADOR: "Operador",
  READONLY: "Solo lectura",
};

const ROL_BADGE: Record<RolUsuario, string> = {
  SUPERADMIN: "bg-[var(--c-coral)]/15 text-[var(--c-coral)]",
  ADMIN: "bg-[var(--c-blue)]/15 text-[var(--c-blue-soft)]",
  SUPERVISOR: "bg-purple-500/15 text-purple-400",
  OPERADOR: "bg-[var(--c-green)]/15 text-[var(--c-green)]",
  READONLY: "bg-[var(--c-bg-elev-2)] text-[var(--c-text-muted)]",
};

const ESTADO_CIVIL_LABELS: Record<string, string> = {
  SOLTERO: "Soltero/a",
  CASADO: "Casado/a",
  DIVORCIADO: "Divorciado/a",
  VIUDO: "Viudo/a",
  UNION_CONVIVENCIAL: "Unión convivencial",
  SEPARADO: "Separado/a",
};

const SEXO_LABELS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  NO_BINARIO: "No binario",
  PREFIERO_NO_DECIR: "Prefiero no decir",
  OTRO: "Otro",
};

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ id: user.id }, { email: user.email! }] },
    include: {
      agente: {
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          cuil: true,
          tipoPersonal: true,
          fotoUrl: true,
          sexo: true,
          sexoPersonalizado: true,
          fechaNacimiento: true,
          estadoCivil: true,
          nacionalidad: true,
          provinciaOrigen: true,
          ciudadOrigen: true,
          ciudad: true,
          barrio: true,
          grupoSanguineo: true,
          hijosCargo: true,
          telefono: true,
          fechaIngreso: true,
          turno: true,
          rango: { select: { nombre: true } },
          sector: { select: { nombre: true } },
        },
      },
    },
  });

  const rol = (usuario?.rol ?? "READONLY") as RolUsuario;
  const esAdmin = rol === "SUPERADMIN" || rol === "ADMIN";
  const meta = user.user_metadata ?? {};
  const agente = usuario?.agente;

  const solicitudFotoPendiente = agente
    ? await prisma.solicitudFoto.findFirst({
        where: { agenteId: agente.id, estado: "PENDIENTE" },
        select: { tipo: true },
      })
    : null;

  const nombreCompleto = agente
    ? `${agente.apellidos}, ${agente.nombres}`
    : [meta.apellido, meta.nombre].filter(Boolean).join(", ") || user.email!;

  const jerarquia = meta.jerarquia as string | undefined;
  const tipoPersonal = agente?.tipoPersonal ?? (meta.tipoPersonal as string | undefined);
  const subtitulo = [jerarquia, tipoPersonal].filter(Boolean).join(" · ");

  const inicial = (
    agente?.nombres ?? meta.nombre ?? user.email ?? "?"
  ).charAt(0).toUpperCase();

  const esEmailProvider = user.app_metadata?.provider !== "google";

  // Datos personales calculados
  const ubicacionActual = [agente?.ciudad, agente?.barrio].filter(Boolean).join(", ");
  const origen = [agente?.ciudadOrigen, agente?.provinciaOrigen].filter(Boolean).join(", ");

  const fechaNacimientoFmt = agente?.fechaNacimiento
    ? new Date(agente.fechaNacimiento).toLocaleDateString("es-AR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const fechaIngresoFmt = agente?.fechaIngreso
    ? new Date(agente.fechaIngreso).toLocaleDateString("es-AR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const sexoLabel = agente?.sexo === "OTRO"
    ? (agente.sexoPersonalizado ?? "Otro")
    : (agente?.sexo ? (SEXO_LABELS[agente.sexo] ?? agente.sexo) : null);

  return (
    <div className="space-y-4">

      <EventosResumenMobile />

      {/* Hero — estilo LinkedIn */}
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)]">

        {/* Banner + avatar: wrapper relativo para el overlap */}
        <div className="relative">
          <div className="h-36 bg-gradient-to-br from-[var(--c-blue-strong)] via-[var(--c-blue-strong)] to-[var(--c-blue-strong)] rounded-t-xl overflow-hidden">
            <Image
              src="/logo-ojos-en-alerta-blanco.png"
              alt=""
              width={140}
              height={140}
              className="absolute right-8 top-1/2 -translate-y-1/2 opacity-[0.15] select-none pointer-events-none"
            />
          </div>

          {/* Avatar posicionado absolutamente sobre el borde inferior del banner */}
          <div className="absolute left-6 bottom-0 translate-y-1/2 z-10">
            <div className="relative">
              <AvatarConVerFoto
                fotoUrl={agente?.fotoUrl ?? null}
                sexo={agente?.sexo}
                inicial={!agente ? inicial : undefined}
                nombreCompleto={nombreCompleto}
              />
              {agente && (
                <FotoPerfilBtn
                  agenteId={agente.id}
                  fotoUrlActual={agente.fotoUrl}
                  esAdmin={esAdmin}
                  tieneSolicitudPendiente={Boolean(solicitudFotoPendiente)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Datos — pt para dejar espacio al avatar */}
        <div className="px-6 pb-6 pt-14">
          <h1 className="text-xl font-bold text-[var(--c-text)] leading-tight">{nombreCompleto}</h1>

          {subtitulo && (
            <p className="text-sm text-[var(--c-text-muted)] mt-0.5">{subtitulo}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROL_BADGE[rol]}`}>
              {ROL_LABELS[rol]}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              usuario?.activo !== false ? "bg-[var(--c-green)]/15 text-[var(--c-green)]" : "bg-[var(--c-coral)]/15 text-[var(--c-coral)]"
            }`}>
              {usuario?.activo !== false ? "Cuenta activa" : "Cuenta inactiva"}
            </span>
            {solicitudFotoPendiente && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--c-amber)]/15 text-[var(--c-amber)]">
                <span className="hourglass-flip">⏳</span> {solicitudFotoPendiente.tipo === "SUBIR" ? "Foto nueva en revisión" : "Solicitud para sacar tu foto en revisión"}
              </span>
            )}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--c-text-faint)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {user.email}
          </p>
        </div>
      </div>

      {/* Sin legajo vinculado: única forma de llegar a /mi-legajo para un
          READONLY, porque el Sidebar le oculta toda la navegación. */}
      {!agente && (
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--c-amber)]/10 border border-[var(--c-amber)]/20 flex items-center justify-center text-[var(--c-amber)] shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--c-text)]">Todavía no tenés un legajo vinculado</p>
              <p className="text-xs text-[var(--c-text-muted)] mt-0.5">
                Vinculalo con un legajo ya cargado o cargá tus datos desde cero.
              </p>
            </div>
          </div>
          <a
            href="/mi-legajo"
            className="shrink-0 rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            Ir a Mi Legajo
          </a>
        </div>
      )}

      {/* Datos personales + Información laboral — lado a lado solo desde lg;
          en mobile, 2 columnas dejaba cada tarjeta con ~160px de ancho y
          todas las etiquetas partidas en 2-4 líneas. */}
      {agente && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Datos personales */}
          <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
            <p className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-5">Datos personales</p>
            <div className="space-y-4">

              {ubicacionActual && (
                <FilaDato
                  icon={<IconMapPin />}
                  label={<>Vive en <span className="font-medium text-[var(--c-text)]">{ubicacionActual}</span></>}
                />
              )}

              {origen && (
                <FilaDato
                  icon={<IconHome />}
                  label={<>De <span className="font-medium text-[var(--c-text)]">{origen}</span></>}
                />
              )}

              {agente.nacionalidad && (
                <FilaDato
                  icon={<IconFlag />}
                  label={<span className="font-medium text-[var(--c-text)]">{agente.nacionalidad}</span>}
                />
              )}

              {fechaNacimientoFmt && (
                <FilaDato
                  icon={<IconCake />}
                  label={<>Nacido/a el <span className="font-medium text-[var(--c-text)]">{fechaNacimientoFmt}</span></>}
                />
              )}

              {agente.estadoCivil && (
                <FilaDato
                  icon={<IconHeart />}
                  label={<span className="font-medium text-[var(--c-text)]">{ESTADO_CIVIL_LABELS[agente.estadoCivil] ?? agente.estadoCivil}</span>}
                />
              )}

              {(agente.hijosCargo ?? 0) > 0 && (
                <FilaDato
                  icon={<IconUsers />}
                  label={<><span className="font-medium text-[var(--c-text)]">{agente.hijosCargo}</span> {agente.hijosCargo === 1 ? "hijo a cargo" : "hijos a cargo"}</>}
                />
              )}

              {sexoLabel && (
                <FilaDato
                  icon={<IconPerson />}
                  label={<span className="font-medium text-[var(--c-text)]">{sexoLabel}</span>}
                />
              )}

              {agente.grupoSanguineo && (
                <FilaDato
                  icon={<IconDrop />}
                  label={<>Grupo sanguíneo <span className="font-medium text-[var(--c-text)]">{agente.grupoSanguineo}</span></>}
                />
              )}

              {agente.telefono && (
                <FilaDato
                  icon={<IconPhone />}
                  label={<span className="font-medium text-[var(--c-text)]">{agente.telefono}</span>}
                />
              )}

            </div>
          </div>

          {/* Columna derecha: Información laboral + Legajo vinculado */}
          <div className="flex flex-col gap-4">

            {(agente.sector || fechaIngresoFmt || agente.turno || agente.rango) && (
              <div className="flex-1 bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
                <p className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-5">Información laboral</p>
                <div className="space-y-4">

                  {agente.sector && (
                    <FilaDato
                      icon={<IconBuilding />}
                      label={<span className="font-medium text-[var(--c-text)]">{agente.sector.nombre}</span>}
                    />
                  )}

                  {agente.rango && (
                    <FilaDato
                      icon={<IconBadge />}
                      label={<span className="font-medium text-[var(--c-text)]">{agente.rango.nombre}</span>}
                    />
                  )}

                  {fechaIngresoFmt && (
                    <FilaDato
                      icon={<IconCalendar />}
                      label={<>Ingresó el <span className="font-medium text-[var(--c-text)]">{fechaIngresoFmt}</span></>}
                    />
                  )}

                  {agente.turno && (
                    <FilaDato
                      icon={<IconClock />}
                      label={<>Turno <span className="font-medium text-[var(--c-text)]">{agente.turno}</span></>}
                    />
                  )}

                </div>
              </div>
            )}

            {/* Legajo vinculado — alineado al bottom de la columna */}
            <div className="mt-auto bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
              <p className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-4">Legajo vinculado</p>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--c-blue)]/10 border border-[var(--c-blue)]/20 flex items-center justify-center text-[var(--c-blue-text)] shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--c-text)]">
                      {agente.apellidos}, {agente.nombres}
                    </p>
                    <p className="text-xs text-[var(--c-text-muted)] mt-0.5">
                      CUIL: <span className="font-mono">{agente.cuil}</span>
                      {agente.rango && (
                        <span className="ml-2 text-[var(--c-text-faint)]">· {agente.rango.nombre}</span>
                      )}
                    </p>
                  </div>
                </div>
                <VerLegajoBtn />
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Seguridad */}
      {esEmailProvider && (
        <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
          <p className="text-xs font-semibold text-[var(--c-text-faint)] uppercase tracking-wide mb-4">Seguridad</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--c-bg)] border border-[var(--c-line)] flex items-center justify-center text-[var(--c-text-muted)] shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--c-text)]">Contraseña</p>
                <p className="text-xs text-[var(--c-text-muted)] mt-0.5">Enviamos un código a tu email para que puedas cambiarla</p>
              </div>
            </div>
            <a
              href="/cambiar-contrasena"
              className="shrink-0 rounded-lg border border-[var(--c-line)] hover:bg-[var(--c-bg-elev-2)] text-[var(--c-text-secondary)] text-sm font-medium px-4 py-2 transition-colors"
            >
              Cambiar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente fila estilo Facebook ──────────────────────────────────────────

function FilaDato({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[var(--c-text-faint)] shrink-0">{icon}</span>
      <p className="text-sm text-[var(--c-text-muted)]">{label}</p>
    </div>
  );
}

// ─── Íconos ───────────────────────────────────────────────────────────────────

function IconMapPin() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21V4m0 0l9-1 9 1v13l-9-1-9 1V4z" />
    </svg>
  );
}

function IconCake() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 15a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9V5m0 0a2 2 0 010-4 2 2 0 010 4z" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconPerson() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconDrop() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 2C8 7 5 11 5 14a7 7 0 0014 0c0-3-3-7-7-12z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconBadge() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
