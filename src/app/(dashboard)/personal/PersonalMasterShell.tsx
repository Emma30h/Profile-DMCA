"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ListaAgentes from "./ListaAgentes";
import type { AgenteResumen } from "./lib";
import { useAgenteAnclado } from "@/lib/useAgenteAnclado";

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
      <span className="h-10 w-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
      <p className="text-sm text-slate-400">Cargando legajo…</p>
    </div>
  );
}

function LegajoSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start gap-5">
          <div className="h-16 w-16 rounded-xl skeleton-shimmer shrink-0" />
          <div className="flex-1 min-w-0 space-y-2.5 pt-1">
            <div className="h-4 w-52 rounded skeleton-shimmer" />
            <div className="h-3 w-32 rounded skeleton-shimmer" />
            <div className="h-3 w-40 rounded skeleton-shimmer mt-3" />
          </div>
        </div>
      </div>
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex gap-6 border-b border-slate-800 pb-3 mb-5">
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
      className={`bg-slate-900 rounded-xl border border-slate-700 px-8 text-center flex flex-col items-center justify-center ${
        fitViewport ? "h-full" : "py-20"
      }`}
    >
      <p className="text-5xl mb-4">👤</p>
      <p className="text-slate-300 font-semibold">Seleccioná un agente</p>
      <p className="text-sm text-slate-500 mt-1">
        Elegí un agente de la lista para ver su legajo completo.
      </p>
    </div>
  );
}

function EmptyStateSkeleton({ fitViewport }: { fitViewport: boolean }) {
  return (
    <div
      className={`bg-slate-900 rounded-xl border border-slate-700 px-8 flex flex-col items-center justify-center ${
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

export default function PersonalMasterShell({
  filtros,
  contador,
  agentes,
  selectedId,
  queryString,
  fitViewport,
  children,
}: {
  filtros: React.ReactNode;
  contador: React.ReactNode;
  agentes: AgenteResumen[];
  selectedId?: string;
  queryString: string;
  fitViewport: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
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

  // Si se llega "de cero" a /personal (sin un agente ya elegido por otro
  // camino: clic en la lista, o entrando directo a /personal/[id]) y hay uno
  // anclado, se abre directo su legajo en vez de la pantalla vacía. Se deriva
  // de props/estado en vez de guardarse en un setState propio, para no
  // llamar setState de forma directa dentro del efecto (el redirect en sí sí
  // necesita el efecto, por ser una llamada real al router).
  const { anclado } = useAgenteAnclado();
  const ancladoId = anclado?.id;
  const pendienteAnclado = !selectedId && Boolean(ancladoId);

  useEffect(() => {
    if (!pendienteAnclado) return;
    startTransition(() => {
      router.replace(`/personal/${ancladoId}${queryString ? `?${queryString}` : ""}`);
    });
  }, [pendienteAnclado, ancladoId, queryString, router]);

  const hadSelection = Boolean(selectedId);

  let contenido: React.ReactNode;
  if (isPending && pendingKind === "clear") {
    contenido = <EmptyStateSkeleton fitViewport={fitViewport} />;
  } else if (isPending && pendienteAnclado) {
    contenido = <LegajoSkeleton />;
  } else if (isPending && pendingKind === "select") {
    contenido = hadSelection ? <LegajoSkeleton /> : <SelectSpinner />;
  } else {
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
      <div
        className={`grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 ${
          fitViewport ? "lg:h-full" : "items-start"
        }`}
      >
        <aside
          className={`bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col ${
            fitViewport ? "lg:h-full" : "lg:sticky lg:top-0 lg:h-[calc(100vh-6rem)]"
          }`}
        >
          {filtros}
          <div className="relative flex-1 min-h-0 flex flex-col">
            {contador}
            <ListaAgentes
              key="lista-agentes"
              agentes={agentes}
              selectedId={selectedId}
              queryString={queryString}
              onSelect={(href) => navigate(href, "select")}
            />
            {filtrosPending && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
                <span className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
              </div>
            )}
          </div>
        </aside>

        <div className={`min-w-0 ${fitViewport ? "lg:h-full" : ""}`}>{contenido}</div>
      </div>
    </PersonalNavContext.Provider>
  );
}
