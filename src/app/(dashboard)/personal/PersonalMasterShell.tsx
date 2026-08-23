"use client";

import { createContext, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ListaAgentes from "./ListaAgentes";
import FiltrosPersonal from "./FiltrosPersonal";
import type { AgenteResumen } from "./lib";
import { buildQueryString } from "./queryString";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";
import { normalizarBusqueda } from "@/lib/personalLabels";
import type { RolUsuario } from "@/types";
import NominaBuilderBtn from "@/components/personal/NominaBuilderBtn";

const ROLES_ADMIN: RolUsuario[] = ["SUPERADMIN", "ADMIN"];

function IconImportar() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

type PersonalNavContextValue = {
  limpiarFicha: (href: string) => void;
  aplicarFiltros: (fn: () => void) => void;
  filtrosPendientes: boolean;
};

const PersonalNavContext = createContext<PersonalNavContextValue | null>(null);

export function usePersonalNav(): PersonalNavContextValue {
  const ctx = useContext(PersonalNavContext);
  if (!ctx) throw new Error("usePersonalNav debe usarse dentro de PersonalMasterShell");
  return ctx;
}

function SelectSpinner() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
      <span className="h-10 w-10 rounded-full border-2 border-[var(--c-line)] border-t-[var(--c-blue)] animate-spin" />
      <p className="text-sm text-[var(--c-text-muted)]">Cargando legajo…</p>
    </div>
  );
}

function LegajoSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-xl skeleton-shimmer shrink-0" />
          <div className="flex-1 min-w-0 space-y-2.5 pt-1">
            <div className="h-4 w-52 rounded skeleton-shimmer" />
            <div className="h-3 w-32 rounded skeleton-shimmer" />
            <div className="h-3 w-40 rounded skeleton-shimmer mt-3" />
          </div>
        </div>
      </div>
      <div className="bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] p-6">
        <div className="flex gap-6 border-b border-[var(--c-bg-elev-2)] pb-3 mb-5">
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-4 w-24 rounded skeleton-shimmer" />
          <div className="h-4 w-28 rounded skeleton-shimmer" />
          <div className="h-4 w-24 rounded skeleton-shimmer" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-full rounded skeleton-shimmer" />
          <div className="h-3 w-5/6 rounded skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ fitViewport }: { fitViewport: boolean }) {
  return (
    <div
      // min-h-[420px] siempre: red de seguridad para que la tarjeta se vea
      // aunque la cadena de h-full/flex-1 hacia arriba (main -> ... -> acá)
      // no llegue a resolver una altura real — sin esto, un h-full contra un
      // ancestro con alto "auto" colapsa a 0 y la tarjeta queda invisible.
      className={`bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] px-8 text-center flex flex-col items-center justify-center min-h-[420px] ${
        fitViewport ? "h-full" : "py-20"
      }`}
    >
      <Image
        src="/logo-ojos-en-alerta-blanco.png"
        alt=""
        width={320}
        height={245}
        className="mb-5"
      />
      <p className="text-[var(--c-text-secondary)] font-semibold">Seleccioná un agente</p>
      <p className="text-sm text-[var(--c-text-faint)] mt-1">
        Elegí un agente de la lista para ver su legajo completo.
      </p>
    </div>
  );
}

function EmptyStateSkeleton({ fitViewport }: { fitViewport: boolean }) {
  return (
    <div
      className={`bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] px-8 flex flex-col items-center justify-center min-h-[420px] ${
        fitViewport ? "h-full" : "py-20"
      }`}
    >
      <div className="h-12 w-12 rounded-full skeleton-shimmer mb-4" />
      <div className="h-4 w-40 rounded skeleton-shimmer" />
      <div className="h-3 w-56 rounded skeleton-shimmer mt-3" />
    </div>
  );
}

type PendingKind = "select" | "clear" | null;

// La mayoría de las navegaciones acá resuelven casi al instante (la lista y
// el legajo salen de la caché de Redis), así que mostrar el skeleton de
// entrada producía un parpadeo: viejo contenido -> skeleton un instante ->
// contenido nuevo. Al esperar un poco antes de mostrarlo, las transiciones
// rápidas pasan directo de un legajo al otro sin ese destello, y las lentas
// (cache fría) siguen mostrando el loading como corresponde.
function useMostrarConRetraso(activo: boolean, delayMs: number): boolean {
  const [mostrar, setMostrar] = useState(false);
  // El apagado es inmediato: se deriva durante el render (en vez de en el
  // efecto) apenas "activo" pasa a false, siguiendo el mismo patrón que ya
  // usa el resto de la app para no hacer setState directo dentro de un
  // efecto. El efecto de abajo sólo programa el *encendido* con retraso.
  const [prevActivo, setPrevActivo] = useState(activo);
  if (activo !== prevActivo) {
    setPrevActivo(activo);
    if (!activo) setMostrar(false);
  }
  useEffect(() => {
    if (!activo) return;
    const id = setTimeout(() => setMostrar(true), delayMs);
    return () => clearTimeout(id);
  }, [activo, delayMs]);
  return mostrar;
}

function parseLista(valor: string): string[] {
  return valor ? valor.split(",").filter(Boolean) : [];
}

interface SectorOption {
  id: string;
  nombre: string;
}

export default function PersonalMasterShell({
  agentesCompletos,
  sectores,
  turnos,
  rol,
  children,
}: {
  agentesCompletos: AgenteResumen[];
  sectores: SectorOption[];
  turnos: string[];
  rol: RolUsuario;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  // Vía hooks del cliente (no props del servidor): así esta pantalla no
  // depende de que la page vuelva a renderizar para enterarse del agente o
  // los filtros actuales — vive en el layout y se mantiene montada entre
  // navegaciones dentro de /personal.
  const params = useParams<{ id?: string }>();
  const selectedId = params?.id;
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const tipoValue = searchParams.get("tipo") ?? "";
  const estadoValue = searchParams.get("estado") ?? "";
  const turnoValue = searchParams.get("turno") ?? "";
  const sectorValue = searchParams.get("sector") ?? "";
  const idsValue = searchParams.get("ids") ?? "";
  const sexoValue = searchParams.get("sexo") ?? "";
  const etacValue = searchParams.get("etac") ?? "";

  const queryString = buildQueryString({
    q, tipo: tipoValue, estado: estadoValue, turno: turnoValue, sector: sectorValue, ids: idsValue, sexo: sexoValue, etac: etacValue,
  });

  // Filtrado en el cliente sobre la lista completa (ya cargada una vez desde
  // el layout): con ~170 agentes es instantáneo, y evita el viaje al
  // servidor que antes disparaba, en cada tecla/filtro, un re-render de todo
  // este árbol.
  const agentes = useMemo(() => {
    const qDigits = q.replace(/\D/g, "");
    const qLower = normalizarBusqueda(q);
    const tipos = parseLista(tipoValue);
    const estados = parseLista(estadoValue);
    const turnosSel = parseLista(turnoValue);
    const sectorIds = parseLista(sectorValue);
    const ids = parseLista(idsValue);
    const sexos = parseLista(sexoValue);
    const etac = parseLista(etacValue);

    return agentesCompletos.filter((a) => {
      if (q) {
        const matchTexto =
          normalizarBusqueda(a.nombres).includes(qLower) ||
          normalizarBusqueda(a.apellidos).includes(qLower) ||
          (qDigits.length > 0 && a.cuil.includes(qDigits));
        if (!matchTexto) return false;
      }
      if (tipos.length > 0 && !tipos.includes(a.tipoPersonal)) return false;
      if (estados.length > 0 && !estados.includes(a.estado)) return false;
      if (turnosSel.length > 0 && (!a.turno || !turnosSel.includes(a.turno))) return false;
      if (sectorIds.length > 0 && (!a.sector || !sectorIds.includes(a.sector.id))) return false;
      // Drill-down puntual desde las alertas del dashboard (ids explícitos de
      // agentes en la situación denunciada), no un filtro editable desde FiltrosPersonal.
      if (ids.length > 0 && !ids.includes(a.id)) return false;
      if (sexos.length > 0 && !sexos.includes(a.sexo)) return false;
      if (etac.length > 0) {
        const valor = a.perteneceETAC ? "SI" : "NO";
        if (!etac.includes(valor)) return false;
      }
      return true;
    });
  }, [agentesCompletos, q, tipoValue, estadoValue, turnoValue, sectorValue, idsValue, sexoValue, etacValue]);

  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<PendingKind>(null);
  // Transición separada de la de arriba: la de arriba reemplaza todo el panel
  // derecho (legajo); ésta sólo cubre la lista de agentes con un loader
  // mientras se aplican filtros, sin tocar el resto del layout.
  const [filtrosPending, startFiltrosTransition] = useTransition();

  function navigate(href: string, kind: PendingKind) {
    setPendingKind(kind);
    startTransition(() => {
      router.push(href);
    });
  }

  // Una vez que la transición de navigate() asienta, se olvida qué tipo era
  // — así un pendingKind viejo ("clear"/"select") no puede quedar pegado y
  // seguir matcheando ramas de carga si algo más adelante vuelve a poner
  // isPending en true por otro motivo. Ajuste en el render (mismo patrón que
  // useMostrarConRetraso más abajo) en vez de setState dentro de un efecto.
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    if (!isPending) setPendingKind(null);
  }

  // Si se llega "de cero" a /personal (sin un agente ya elegido por otro
  // camino: clic en la lista, o entrando directo a /personal/[id]) y hay uno
  // anclado, se abre directo su legajo en vez de la pantalla vacía. Se deriva
  // de props/estado en vez de guardarse en un setState propio, para no
  // llamar setState de forma directa dentro del efecto (el redirect en sí sí
  // necesita el efecto, por ser una llamada real al router).
  //
  // "De cero" exige además que no haya filtros en la URL (!queryString): sin
  // este chequeo, cualquier búsqueda o drill-down (ej. doble click en
  // "Activos por dependencia" del dashboard) que llegara sin un id puntual
  // rebotaba al legajo anclado en vez de mostrar la lista filtrada —y con un
  // agente anclado, esto se repetía en cada cambio de filtro/búsqueda,
  // porque el efecto vuelve a dispararse en cada cambio de queryString.
  const { anclado } = useAgenteAnclado();
  const ancladoId = anclado?.id;
  const pendienteAnclado = !selectedId && !queryString && Boolean(ancladoId);

  // Transición propia (no la de navigate()): si compartiera la misma que
  // "Limpiar fichero"/selección manual, un agente anclado DISTINTO al que se
  // acaba de dejar podía disparar este redirect justo cuando pendingKind
  // seguía en "clear" — la pantalla quedaba con el skeleton de "vacío" para
  // siempre porque isPending nunca volvía a asentarse en el par compartido.
  const [, startAncladoTransition] = useTransition();

  useEffect(() => {
    if (!pendienteAnclado) return;
    startAncladoTransition(() => {
      router.replace(`/personal/${ancladoId}${queryString ? `?${queryString}` : ""}`);
    });
  }, [pendienteAnclado, ancladoId, queryString, router]);

  const hadSelection = Boolean(selectedId);
  const fitViewport = !hadSelection;
  const mostrarPending = useMostrarConRetraso(isPending, 150);

  let contenido: React.ReactNode;
  if (mostrarPending && pendingKind === "clear") {
    contenido = <EmptyStateSkeleton fitViewport={fitViewport} />;
  } else if (mostrarPending && pendienteAnclado) {
    contenido = <LegajoSkeleton />;
  } else if (mostrarPending && pendingKind === "select") {
    contenido = hadSelection ? <LegajoSkeleton /> : <SelectSpinner />;
  } else {
    // Mientras la transición no llegue al umbral de arriba, se sigue
    // mostrando el contenido anterior (React lo mantiene vigente hasta que
    // el nuevo llega) en vez de saltar a un estado de carga intermedio.
    contenido = children ?? <EmptyState fitViewport={fitViewport} />;
  }

  return (
    <PersonalNavContext.Provider
      value={{
        limpiarFicha: (href) => navigate(href, "clear"),
        aplicarFiltros: startFiltrosTransition,
        filtrosPendientes: filtrosPending,
      }}
    >
      <div className="flex flex-col gap-5 h-full">
        <div className="shrink-0 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--c-text)]">Personal</h2>
          </div>
          <div className="flex items-center gap-2">
            <NominaBuilderBtn agentes={agentes} rol={rol} />
            {ROLES_ADMIN.includes(rol) && (
              <Link
                href="/configuracion/importar-legajos"
                className="shrink-0 inline-flex items-center gap-1.5 text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] border border-[var(--c-line)] px-3 py-1.5 rounded-lg transition-colors"
              >
                <IconImportar />
                Importar legajos
              </Link>
            )}
          </div>
        </div>

        <div
          className={`flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 ${
            fitViewport ? "lg:h-full" : "items-start"
          }`}
        >
          {/* Maestro-detalle: en mobile, la lista y el legajo elegido no
              pueden convivir en pantalla (no entran) — se muestra solo uno de
              los dos por vez, igual que cualquier patrón lista/detalle en
              mobile. En desktop (lg:) siempre conviven lado a lado, como antes. */}
          <aside
            className={`bg-[var(--c-bg-elev)] rounded-xl border border-[var(--c-line)] overflow-hidden flex-col ${
              hadSelection ? "hidden lg:flex" : "flex"
            } ${fitViewport ? "lg:h-full" : "lg:sticky lg:top-0 lg:h-[calc(100vh-6rem)]"}`}
          >
            <FiltrosPersonal
              qValue={q}
              tipoValue={tipoValue}
              estadoValue={estadoValue}
              turnoValue={turnoValue}
              sectorValue={sectorValue}
              etacValue={etacValue}
              sectores={sectores}
              turnos={turnos}
              selectedId={selectedId}
            />
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div className="px-4 py-2 text-xs text-[var(--c-text-faint)] border-b border-[var(--c-bg-elev-2)]">
                {agentes.length} {agentes.length === 1 ? "agente encontrado" : "agentes encontrados"}
              </div>
              <ListaAgentes
                key="lista-agentes"
                agentes={agentes}
                selectedId={selectedId}
                queryString={queryString}
                onSelect={(href) => navigate(href, "select")}
              />
              {filtrosPending && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--c-bg-elev)]/80">
                  <span className="h-8 w-8 rounded-full border-2 border-[var(--c-line)] border-t-[var(--c-blue)] animate-spin" />
                </div>
              )}
            </div>
          </aside>

          {/* Antes se ocultaba en mobile sin selección con "hidden lg:block"
              para no hacer scrollear al usuario 210 agentes hasta llegar a la
              tarjeta vacía — pero terminaba sin pintar nada, ni el fondo ni
              el borde de la tarjeta, en ningún tamaño de pantalla. Se muestra
              siempre: en mobile queda debajo de la lista, que es un costo
              menor comparado con el panel quedando completamente vacío. */}
          <div className={`min-w-0 ${fitViewport ? "lg:h-full" : ""}`}>{contenido}</div>
        </div>
      </div>
    </PersonalNavContext.Provider>
  );
}
