"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ZoomIn, ZoomOut, Maximize2, ArrowUp, Download } from "lucide-react";
import AgenteAvatar from "@/components/AgenteAvatar";

export interface Persona {
  orden: string;
  rango: string;
  nombre: string;
  licencia: boolean;
  fotoUrl: string | null;
  sexo: string | null;
}

export interface SectorNodo {
  id: string;
  parent: string;
  tipo: "dept" | "div";
  titulo: string;
  roster: Persona[];
}

export interface CentroInfo {
  id: string;
  titulo: string;
  jefe?: Persona;
}

// ─── Geometría del árbol ────────────────────────────────────────────────────
// Diagrama estático (sin drag/zoom): las posiciones se calculan a partir de
// los datos recibidos por props (ver organigrama/lib.ts), en vez de vivir
// hardcodeadas acá — la nómina se administra desde /configuracion/organigrama.
const ORG_W = 240;
const ORG_H = 76;
const JEFE_H = 66;
const DIV_W = 240;
const DIV_H = 66;
const PERSONA_W = 240;
const PERSONA_H = 78;
const GAP_Y = 12;
const GAP_DIV = 22;
const COL_GAP = 64;
const ROW_GAP = 48;
const PADDING = 30;

interface CajaBase {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface CajaOrg extends CajaBase {
  kind: "org";
  titulo: string;
}
interface CajaJefe extends CajaBase {
  kind: "jefe";
  persona: Persona;
}
interface CajaDiv extends CajaBase {
  kind: "div";
  titulo: string;
}
interface CajaPersona extends CajaBase {
  kind: "persona";
  persona: Persona;
  esJefe: boolean;
}
type Caja = CajaOrg | CajaJefe | CajaDiv | CajaPersona;

function trazoAngular(x1: number, y1: number, xTronco: number, y2: number, x2: number): string {
  return `M ${x1} ${y1} H ${xTronco} V ${y2} H ${x2}`;
}

function layoutFila(
  sectores: SectorNodo[],
  orgId: string,
  orgTitulo: string,
  jefe: Persona | undefined,
  xOrg: number,
  yTop: number,
  cajas: Caja[],
  lineas: string[]
): { bottom: number; orgBox: CajaOrg } {
  const divisiones = sectores.filter((s) => s.parent === orgId && s.tipo === "div");
  const subDepts = sectores.filter((s) => s.parent === orgId && s.tipo === "dept");

  const xDiv = xOrg + ORG_W + COL_GAP;
  const xTroncoDiv = xOrg + ORG_W + COL_GAP / 2;

  let yCursor = yTop;
  const bloquesDivision: { div: CajaDiv; personas: CajaPersona[] }[] = [];
  divisiones.forEach((sector) => {
    const n = sector.roster.length;
    const alturaPersonas = Math.max(n, 1) * PERSONA_H + (Math.max(n, 1) - 1) * GAP_Y;
    const xPersona = xDiv + DIV_W + COL_GAP;
    const personas: CajaPersona[] = sector.roster.map((p, i) => ({
      kind: "persona",
      x: xPersona,
      y: yCursor + i * (PERSONA_H + GAP_Y),
      w: PERSONA_W,
      h: PERSONA_H,
      persona: p,
      esJefe: i === 0,
    }));
    const divBox: CajaDiv = {
      kind: "div",
      x: xDiv,
      y: yCursor + alturaPersonas / 2 - DIV_H / 2,
      w: DIV_W,
      h: DIV_H,
      titulo: sector.titulo,
    };
    bloquesDivision.push({ div: divBox, personas });
    yCursor += alturaPersonas + GAP_DIV;
  });
  const divsTotalHeight = divisiones.length > 0 ? yCursor - GAP_DIV - yTop : 0;

  const orgStackHeight = ORG_H + (jefe ? GAP_Y + JEFE_H : 0);
  const rowHeight = Math.max(divsTotalHeight, orgStackHeight);

  // Se alinea el centro de la caja de organización (no del stack completo
  // org+jefatura) con el centro del bloque de divisiones, para que ambas
  // queden a la misma altura — clamp para que la jefatura nunca se salga de
  // la fila cuando el bloque de divisiones no deja tanto margen.
  const orgYCentrado = yTop + rowHeight / 2 - ORG_H / 2;
  const orgYMax = yTop + rowHeight - orgStackHeight;
  const orgY = Math.min(Math.max(orgYCentrado, yTop), Math.max(orgYMax, yTop));
  const orgBox: CajaOrg = { kind: "org", x: xOrg, y: orgY, w: ORG_W, h: ORG_H, titulo: orgTitulo };
  cajas.push(orgBox);

  if (jefe) {
    const jefeBox: CajaJefe = { kind: "jefe", x: xOrg, y: orgY + ORG_H + GAP_Y, w: ORG_W, h: JEFE_H, persona: jefe };
    cajas.push(jefeBox);
    lineas.push(`M ${orgBox.x + orgBox.w / 2} ${orgBox.y + orgBox.h} V ${jefeBox.y}`);
  }

  const offset = (rowHeight - divsTotalHeight) / 2;
  bloquesDivision.forEach(({ div, personas }) => {
    div.y += offset;
    lineas.push(
      trazoAngular(orgBox.x + orgBox.w, orgBox.y + orgBox.h / 2, xTroncoDiv, div.y + div.h / 2, div.x)
    );
    cajas.push(div);

    const xTroncoPersona = div.x + div.w + COL_GAP / 2;
    personas.forEach((p) => {
      p.y += offset;
      lineas.push(
        trazoAngular(div.x + div.w, div.y + div.h / 2, xTroncoPersona, p.y + p.h / 2, p.x)
      );
      cajas.push(p);
    });
  });

  let bottom = yTop + rowHeight;

  // Sub-departamentos (ej. Alerta Ciudadana bajo la Dirección): una fila
  // nueva más abajo, conectada por una línea que baja desde el borde
  // izquierdo del padre — igual al esquema de referencia. Sale por fuera de
  // la caja (a la izquierda, no por abajo) para no pasar pegada/superpuesta
  // al borde de la caja de jefatura que queda justo debajo del org.
  subDepts.forEach((sub) => {
    const yNext = bottom + ROW_GAP;
    const { bottom: subBottom, orgBox: subOrgBox } = layoutFila(
      sectores, sub.id, sub.titulo, sub.roster[0], xOrg, yNext, cajas, lineas
    );
    const xTroncoSub = orgBox.x - COL_GAP / 3;
    lineas.push(
      `M ${orgBox.x} ${orgBox.y + orgBox.h / 2} H ${xTroncoSub} V ${subOrgBox.y + subOrgBox.h / 2} H ${subOrgBox.x}`
    );
    bottom = subBottom;
  });

  return { bottom, orgBox };
}

function construirLayout(
  centro: CentroInfo,
  sectores: SectorNodo[]
): { cajas: Caja[]; lineas: string[]; width: number; height: number } {
  const cajas: Caja[] = [];
  const lineas: string[] = [];
  const { bottom } = layoutFila(sectores, centro.id, centro.titulo, centro.jefe, PADDING, PADDING, cajas, lineas);
  const maxX = Math.max(...cajas.map((c) => c.x + c.w));
  return { cajas, lineas, width: maxX + PADDING, height: bottom + PADDING };
}

const ESTILO_CAJA: Record<Caja["kind"], string> = {
  org: "bg-slate-700 border-slate-500 text-slate-50",
  jefe: "bg-emerald-800 border-emerald-500 text-emerald-50",
  div: "bg-amber-800 border-amber-500 text-amber-50",
  persona: "", // se resuelve según esJefe, ver renderCaja
};

function EtiquetaLicencia() {
  return <div className="text-[9px] mt-0.5 font-medium text-amber-300">En licencia</div>;
}

function renderCaja(caja: Caja, incluirFotos: boolean) {
  const base = "absolute rounded-lg border px-3 py-2 flex flex-col justify-center overflow-hidden";
  const style = { left: caja.x, top: caja.y, width: caja.w, height: caja.h };

  if (caja.kind === "org") {
    return (
      <div key={`org-${caja.titulo}`} className={`${base} ${ESTILO_CAJA.org} items-center text-center`} style={style}>
        <span className="text-[12.5px] font-bold leading-tight">{caja.titulo}</span>
      </div>
    );
  }
  if (caja.kind === "div") {
    return (
      <div key={`div-${caja.titulo}`} className={`${base} ${ESTILO_CAJA.div} items-center text-center`} style={style}>
        <span className="text-[11.5px] font-bold leading-tight">{caja.titulo}</span>
      </div>
    );
  }
  const baseFila = "absolute rounded-lg border px-2 py-1.5 flex items-center gap-1.5 overflow-hidden";

  if (caja.kind === "jefe") {
    return (
      <div key={`jefe-${caja.persona.nombre}`} className={`${baseFila} ${ESTILO_CAJA.jefe}`} style={style}>
        {incluirFotos && (
          <AgenteAvatar fotoUrl={caja.persona.fotoUrl} sexo={caja.persona.sexo} sizeClassName="h-9 w-9 rounded-full shrink-0" />
        )}
        <div className="min-w-0">
          <span className="text-[11px] font-semibold leading-tight">
            {caja.persona.rango} {caja.persona.nombre}
          </span>
          {caja.persona.licencia && <EtiquetaLicencia />}
        </div>
      </div>
    );
  }
  // persona
  const colorPersona = caja.esJefe
    ? "bg-emerald-800 border-emerald-500 text-emerald-50"
    : "bg-orange-800 border-orange-600 text-orange-50";
  return (
    <div key={`persona-${caja.persona.nombre}`} className={`${baseFila} ${colorPersona}`} style={style}>
      {incluirFotos && (
        <AgenteAvatar fotoUrl={caja.persona.fotoUrl} sexo={caja.persona.sexo} sizeClassName="h-9 w-9 rounded-full shrink-0" />
      )}
      <div className="min-w-0">
        {caja.persona.orden && (
          <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">{caja.persona.orden}</span>
        )}
        <span className="text-[11px] font-semibold leading-tight">
          {caja.persona.rango} {caja.persona.nombre}
        </span>
        {caja.persona.licencia && <EtiquetaLicencia />}
      </div>
    </div>
  );
}

// ─── Vista mobile ───────────────────────────────────────────────────────────
// El flowchart horizontal no entra en una pantalla angosta (ni reduciendo la
// escala queda legible), así que en mobile se muestra la misma jerarquía como
// una lista vertical con sangría, sin líneas — la lectura es de arriba hacia
// abajo en vez de izquierda a derecha, pero los datos son los mismos.
const ESTILO_MOBIL: Record<Exclude<Caja["kind"], "persona">, string> = {
  org: "bg-slate-700 border-slate-500 text-slate-50",
  jefe: "bg-emerald-800 border-emerald-500 text-emerald-50",
  div: "bg-amber-800 border-amber-500 text-amber-50",
};

function TarjetaPersonaMobil({ persona, esJefe }: { persona: Persona; esJefe?: boolean }) {
  const color = esJefe
    ? ESTILO_MOBIL.jefe
    : "bg-orange-800 border-orange-600 text-orange-50";
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-center gap-2.5 ${color}`}>
      <AgenteAvatar fotoUrl={persona.fotoUrl} sexo={persona.sexo} sizeClassName="h-10 w-10 rounded-full shrink-0" />
      <div className="min-w-0">
        {persona.orden && (
          <div className="text-[9px] font-bold uppercase tracking-wide opacity-70">{persona.orden}</div>
        )}
        <div className="text-[12px] font-semibold leading-tight">
          {persona.rango} {persona.nombre}
        </div>
        {persona.licencia && <div className="text-[10px] mt-0.5 font-medium text-amber-300">En licencia</div>}
      </div>
    </div>
  );
}

function FilaMobil({
  sectores,
  orgId,
  titulo,
  jefe,
}: {
  sectores: SectorNodo[];
  orgId: string;
  titulo: string;
  jefe?: Persona;
}) {
  const divisiones = sectores.filter((s) => s.parent === orgId && s.tipo === "div");
  const subDepts = sectores.filter((s) => s.parent === orgId && s.tipo === "dept");

  return (
    <div className="space-y-2.5">
      <div className={`rounded-lg border px-3 py-2.5 ${ESTILO_MOBIL.org}`}>
        <span className="text-[13px] font-bold leading-tight">{titulo}</span>
      </div>
      {jefe && (
        <div className="ml-4">
          <TarjetaPersonaMobil persona={jefe} esJefe />
        </div>
      )}
      {divisiones.length > 0 && (
        <div className="ml-4 space-y-2.5 border-l-2 border-slate-800 pl-3.5">
          {divisiones.map((div) => (
            <div key={div.id} className="space-y-2">
              <div className={`rounded-lg border px-3 py-2 ${ESTILO_MOBIL.div}`}>
                <span className="text-[12px] font-bold leading-tight">{div.titulo}</span>
              </div>
              <div className="ml-4 space-y-1.5 border-l-2 border-slate-800 pl-3.5">
                {div.roster.length > 0 ? (
                  div.roster.map((p, i) => <TarjetaPersonaMobil key={p.nombre} persona={p} esJefe={i === 0} />)
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Sin nómina cargada</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {subDepts.map((sub) => (
        <FilaMobil key={sub.id} sectores={sectores} orgId={sub.id} titulo={sub.titulo} jefe={sub.roster[0]} />
      ))}
    </div>
  );
}

// ─── Ajuste de escala (desktop) ─────────────────────────────────────────────
// El layout se calcula en píxeles fijos; para que entre completo en la altura
// disponible sin scroll se lo escala como una imagen "contain" — nunca por
// encima de 1 (no agrandar en pantallas grandes) ni por debajo de un piso
// legible (a partir de ahí se prefiere dejar scroll a que el texto quede
// ilegible).
const ESCALA_MIN = 0.55;

function useEscalaAjustada(ancho: number, alto: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const recalcular = () => {
      const factor = Math.min(el.clientWidth / ancho, el.clientHeight / alto, 1);
      setEscala(Math.max(factor, ESCALA_MIN));
    };
    recalcular();
    const ro = new ResizeObserver(recalcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ancho, alto]);

  return [ref, escala];
}

// ─── Pan con click izquierdo o derecho ──────────────────────────────────────
// El scroll nativo (overflow-auto) ya permite recorrer el diagrama cuando el
// zoom saca contenido de la vista, pero arrastrar con el mouse es más directo
// que perseguir las scrollbars. Mueve scrollLeft/scrollTop a mano en vez de
// depender de un transform propio, así conviven sin pisarse con el scroll
// nativo (rueda del mouse, trackpad, teclado) que el navegador ya maneja.
// Con el derecho hay que además suprimir el menú contextual nativo, que si
// no aparecería al soltar el botón.
function usePanArrastre(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let arrastrando = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 && e.button !== 2) return; // click izquierdo o derecho
      arrastrando = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = el!.scrollLeft;
      startScrollTop = el!.scrollTop;
      el!.setPointerCapture(e.pointerId);
      el!.style.cursor = "grabbing";
      el!.style.userSelect = "none";
    }
    function onPointerMove(e: PointerEvent) {
      if (!arrastrando) return;
      el!.scrollLeft = startScrollLeft - (e.clientX - startX);
      el!.scrollTop = startScrollTop - (e.clientY - startY);
    }
    function onPointerUp(e: PointerEvent) {
      if (!arrastrando) return;
      arrastrando = false;
      try {
        el!.releasePointerCapture(e.pointerId);
      } catch {
        // ignorar si ya se liberó
      }
      el!.style.cursor = "grab";
      el!.style.userSelect = "";
    }
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [ref]);
}

// ─── Volver arriba (mobile) ─────────────────────────────────────────────────
// La lista mobile es una sola página larga (crece con el contenido, no tiene
// scroll propio — el que scrollea es <main> del layout), así que bajando
// mucho no hay forma de volver al principio sin arrastrar todo a mano. El
// marcador arriba de todo permite detectar cuándo salió de vista, sin
// importar cuál sea el ancestro que realmente scrollea.
function useMostrarBotonArriba(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setMostrar(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return mostrar;
}

function LogoMarcaDeAgua({ width, height }: { width: number; height: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <Image src="/logo-ojos-en-alerta-blanco.png" alt="" width={width} height={height} className="opacity-10 grayscale" />
    </div>
  );
}

// ─── Zoom manual ────────────────────────────────────────────────────────────
// El ajuste automático (useEscalaAjustada) prioriza que entre todo sin
// scroll, pero eso puede dejar el texto chico en pantallas más bajas. Este
// multiplicador se aplica encima de esa escala "base" — 1 = tal cual quedó
// ajustado, hasta 2.5x para leer cómodo, con scroll nativo del contenedor
// para recorrer lo que no entre.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_PASO = 0.25;

function ControlesZoom({
  factorZoom,
  onAcercar,
  onAlejar,
  onRestablecer,
}: {
  factorZoom: number;
  onAcercar: () => void;
  onAlejar: () => void;
  onRestablecer: () => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/95 shadow-lg p-1">
      <button
        type="button"
        onClick={onAlejar}
        disabled={factorZoom <= ZOOM_MIN}
        className="p-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Alejar"
      >
        <ZoomOut className="w-4 h-4" strokeWidth={2} />
      </button>
      <span className="w-11 text-center text-xs font-medium text-slate-400 tabular-nums">
        {Math.round(factorZoom * 100)}%
      </span>
      <button
        type="button"
        onClick={onAcercar}
        disabled={factorZoom >= ZOOM_MAX}
        className="p-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Acercar"
      >
        <ZoomIn className="w-4 h-4" strokeWidth={2} />
      </button>
      <span className="w-px h-4 bg-slate-700 mx-0.5" />
      <button
        type="button"
        onClick={onRestablecer}
        disabled={factorZoom === 1}
        className="p-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Restablecer zoom"
      >
        <Maximize2 className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export default function OrganigramaChart({
  centro,
  sectores,
}: {
  centro: CentroInfo | null;
  sectores: SectorNodo[];
}) {
  const layout = useMemo(() => (centro ? construirLayout(centro, sectores) : null), [centro, sectores]);
  const [contenedorRef, escalaAuto] = useEscalaAjustada(layout?.width ?? 1, layout?.height ?? 1);
  const [factorZoom, setFactorZoom] = useState(1);
  const [incluirFotos, setIncluirFotos] = useState(true);
  const escala = escalaAuto * factorZoom;
  usePanArrastre(contenedorRef);

  const topMobilRef = useRef<HTMLDivElement>(null);
  const mostrarBotonArriba = useMostrarBotonArriba(topMobilRef);

  const exportRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);

  // html2canvas-pro (no el html2canvas clásico: éste no sabe parsear los
  // colores oklch() que usa la paleta por defecto de Tailwind v4) rasteriza
  // el nodo fuera de pantalla de abajo, a tamaño completo (sin el scale del
  // zoom ni el achique de impresión) para que la imagen salga nítida.
  async function descargarImagen() {
    if (!exportRef.current) return;
    setDescargando(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(exportRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No se pudo generar la imagen");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `organigrama-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo descargar la imagen del organigrama.");
    } finally {
      setDescargando(false);
    }
  }

  if (!centro || !layout) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 bg-slate-900 rounded-xl border border-slate-700 text-center px-8">
        <p className="text-slate-300 font-semibold">Todavía no hay estructura cargada</p>
        <p className="text-sm text-slate-500">Configurala desde &quot;Editar organigrama&quot;.</p>
      </div>
    );
  }

  // Ancho aproximado disponible en una hoja horizontal (A4/Carta) con los
  // márgenes de @page print-organigrama — se achica el diagrama para que
  // entre a lo ancho de una página; a lo alto puede paginar sin problema
  // porque el bloque de impresión no usa position:fixed.
  const printScale = Math.min(1, 1000 / layout.width);

  return (
    <div className="h-full flex flex-col gap-2.5">
      {/* Sólo impresión: se revela vía .print-organigrama en globals.css,
          igual mecánica que .print-informe pero sin recortar el alto. */}
      <div className="print-organigrama">
        <div style={{ width: layout.width * printScale, height: layout.height * printScale }}>
          <div
            className="relative"
            style={{ width: layout.width, height: layout.height, transform: `scale(${printScale})`, transformOrigin: "top left" }}
          >
            <svg width={layout.width} height={layout.height} className="absolute inset-0 pointer-events-none">
              {layout.lineas.map((d) => (
                <path key={d} d={d} fill="none" stroke="#475569" strokeWidth={2} />
              ))}
            </svg>
            {layout.cajas.map((c) => renderCaja(c, incluirFotos))}
          </div>
        </div>
      </div>

      {/* Fuera de pantalla (no display:none: html2canvas necesita que el
          nodo esté realmente en el layout para poder rasterizarlo), a
          tamaño completo sin el scale del zoom ni el achique de impresión,
          para que la imagen descargada salga nítida. */}
      <div className="fixed left-[-99999px] top-0 pointer-events-none" aria-hidden="true">
        <div ref={exportRef} className="relative bg-white" style={{ width: layout.width, height: layout.height }}>
          <svg width={layout.width} height={layout.height} className="absolute inset-0 pointer-events-none">
            {layout.lineas.map((d) => (
              <path key={d} d={d} fill="none" stroke="#475569" strokeWidth={2} />
            ))}
          </svg>
          {layout.cajas.map((c) => renderCaja(c, incluirFotos))}
        </div>
      </div>

      {/* Controles de impresión/descarga — se ocultan solos al imprimir,
          junto con el resto de la UI de pantalla (no llevan la clase
          print-organigrama). */}
      <div className="shrink-0 flex items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={incluirFotos}
            onChange={(e) => setIncluirFotos(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-500 cursor-pointer focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
          />
          Incluir fotos
        </label>
        <button
          type="button"
          onClick={descargarImagen}
          disabled={descargando}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={2} />
          {descargando ? "Generando…" : "Descargar imagen"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-slate-100 bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          🖨️ Imprimir
        </button>
      </div>

      <div className="flex-1 min-h-0">
      {/* Desktop: el flowchart completo, escalado para entrar sin scroll. */}
      <div className="hidden lg:flex relative h-full flex-col bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <LogoMarcaDeAgua width={320} height={245} />
        <ControlesZoom
          factorZoom={factorZoom}
          onAcercar={() => setFactorZoom((f) => Math.min(f + ZOOM_PASO, ZOOM_MAX))}
          onAlejar={() => setFactorZoom((f) => Math.max(f - ZOOM_PASO, ZOOM_MIN))}
          onRestablecer={() => setFactorZoom(1)}
        />
        <div
          ref={contenedorRef}
          // Con zoom manual (factorZoom > 1) el contenido puede ser más grande
          // que el contenedor — ahí se saca el centrado con flex, porque
          // combinado con overflow-auto deja el borde "de antes del centro"
          // inalcanzable con scroll (bug conocido de flex/grid + scroll).
          className={`flex-1 min-h-0 overflow-auto bg-slate-950 ${
            factorZoom > 1 ? "" : "flex items-center justify-center"
          }`}
          style={{ backgroundImage: "radial-gradient(circle, #334155 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        >
          <div style={{ width: layout.width * escala, height: layout.height * escala }}>
            <div
              className="relative"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${escala})`,
                transformOrigin: "top left",
              }}
            >
              <svg width={layout.width} height={layout.height} className="absolute inset-0 pointer-events-none">
                {layout.lineas.map((d) => (
                  <path key={d} d={d} fill="none" stroke="#475569" strokeWidth={2} />
                ))}
              </svg>
              {layout.cajas.map((c) => renderCaja(c, true))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: misma jerarquía, como lista vertical con sangría. */}
      <div className="lg:hidden relative bg-slate-900 rounded-xl border border-slate-700 p-4 overflow-hidden">
        <div ref={topMobilRef} />
        <LogoMarcaDeAgua width={200} height={153} />
        <div className="relative">
          <FilaMobil sectores={sectores} orgId={centro.id} titulo={centro.titulo} jefe={centro.jefe} />
        </div>
        {mostrarBotonArriba && (
          <button
            type="button"
            onClick={() => topMobilRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="fixed bottom-5 right-5 z-20 flex items-center justify-center h-11 w-11 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
            aria-label="Volver al inicio del organigrama"
          >
            <ArrowUp className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
