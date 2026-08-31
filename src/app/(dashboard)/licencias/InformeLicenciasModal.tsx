"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import {
  CAUSA_COLOR,
  labelDeCausa,
  type AusentismoStats,
  type CausaAusentismo,
  type EjeTurno,
  type FilaPersonalRanking,
} from "@/lib/ausentismo";

// Las 6 secciones elegibles calzan 1 a 1 con las 6 tarjetas del dashboard,
// pero "Causas más frecuentes" y "Tipos de licencia más frecuentes" agregan
// por la MISMA dimensión (causa) — un ranking por causa no tiene una forma
// geométrica fija (la cantidad de causas presentes varía según el período),
// así que ahí no hay radar, sólo la tabla con su barra por fila. Si el
// usuario tilda las dos, se renderiza una sola vez — ver bloquesDelInforme
// más abajo. "Licencias por turno" sí tiene ejes fijos (A a F, igual que
// LicenciasPorTurnoCard.tsx), así que ahí el radar sí tiene sentido —
// tabla a la izquierda, mismo hexágono que el dashboard a la derecha.
type SeccionInforme = "ausentismo" | "cantidad" | "causas" | "tipos" | "personal" | "turno";
const SECCIONES: SeccionInforme[] = ["cantidad", "causas", "tipos", "personal", "turno", "ausentismo"];
const SECCION_LABEL: Record<SeccionInforme, string> = {
  ausentismo: "Ausentismo por causa (detalle mensual)",
  cantidad: "Cantidad de licencias",
  causas: "Causas más frecuentes",
  tipos: "Tipos de licencia más frecuentes",
  personal: "Personal con más licencias",
  turno: "Licencias por turno",
};

const TOP_PERSONAL = 15;
const ALTURA_PLOT = 150;
const SEGMENTOS_GRILLA = 4;

// Media móvil EXPONENCIAL para "Cantidad de licencias por mes": a diferencia
// del promedio de ventana fija que usa "Tendencia" en AusentismoCard.tsx
// (últimos 3 meses, todos con el mismo peso), acá cada punto pesa TODO el
// historial anterior con peso decreciente — no hace falta elegir un tamaño
// de ventana, y reacciona más rápido a un cambio reciente sin perder la
// suavidad de una tendencia. alpha alto = más parecido al dato crudo.
const ALPHA_MEDIA_EXPONENCIAL = 0.35;
function calcularMediaExponencial(valores: number[], alpha: number): number[] {
  const resultado: number[] = [];
  valores.forEach((v, i) => {
    resultado.push(i === 0 ? v : alpha * v + (1 - alpha) * resultado[i - 1]);
  });
  return resultado;
}
// Rojo vivo fijo: la media exponencial es una referencia, no una serie de
// la categórica del informe (que ya usa --inf-accent/--inf-accent-900 para
// las barras), así que se identifica por color propio en vez de compartir
// tono con los datos. Validado con validate_palette.js contra esos dos
// colores de barra sobre fondo blanco (ΔE > 17 en ambos, lejos del piso).
const COLOR_MEDIA_EXPONENCIAL = "#e2231a";

// Catmull-Rom → Bézier (tensión uniforme, divisor /6): igual que la línea de
// tendencia de AusentismoPorDotacionCard.tsx en el dashboard — con solo
// unos pocos puntos mensuales, un polyline recto se ve quebrado en vez de
// leerse como una media móvil lisa y continua.
function curvaSuave(puntos: { x: number; y: number }[]): string {
  if (puntos.length < 2) return "";
  if (puntos.length === 2) return `M ${puntos[0].x},${puntos[0].y} L ${puntos[1].x},${puntos[1].y}`;
  let d = `M ${puntos[0].x},${puntos[0].y}`;
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i];
    const p1 = puntos[i];
    const p2 = puntos[i + 1];
    const p3 = puntos[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// "Causas más frecuentes": barra + cuadro de cantidad/% comparten estas tres
// medidas para que sus filas queden alineadas (ver comentario en el render).
const ALTURA_FILA_CAUSA = 15;
const GAP_FILA_CAUSA = 7;
const ALTURA_CABECERA_CAUSA = 25;

// Radar de "Licencias por turno": misma geometría hexagonal que
// LicenciasPorTurnoCard.tsx (6 ejes fijos, A arriba y el resto en sentido
// horario cada 60°), pero estático — sin tween ni hover, es un documento,
// no una tarjeta interactiva.
const VB_TURNO = 260;
const CENTRO_TURNO = VB_TURNO / 2;
const RADIO_TURNO = 82;
const RADIO_LABEL_TURNO = RADIO_TURNO + 28;
const SEGMENTOS_GRILLA_TURNO = 4;
const ALTURA_LINEA_TURNO = 12;

function puntoRadarTurno(i: number, r: number, total: number): { x: number; y: number } {
  const angulo = -Math.PI / 2 + (i * 2 * Math.PI) / total;
  return { x: CENTRO_TURNO + r * Math.cos(angulo), y: CENTRO_TURNO + r * Math.sin(angulo) };
}
function anclaTextoRadar(x: number): "start" | "middle" | "end" {
  if (x > CENTRO_TURNO + 4) return "start";
  if (x < CENTRO_TURNO - 4) return "end";
  return "middle";
}
function anclaVerticalRadar(y: number): "auto" | "hanging" | "middle" {
  if (y < CENTRO_TURNO - 4) return "auto";
  if (y > CENTRO_TURNO + 4) return "hanging";
  return "middle";
}
// Letra de turno + cantidad apiladas, la que quede más cerca del punto del
// eje — mismo criterio que lineasEjeTurno en LicenciasPorTurnoCard.tsx.
function lineasRadarTurno(
  x: number,
  y: number,
  letra: string,
  valor: number
): { x: number; y: number; texto: string; esValor: boolean }[] {
  const anchorV = anclaVerticalRadar(y);
  const lineas = anchorV === "hanging" ? [String(valor), letra] : [letra, String(valor)];
  return lineas.map((texto, i) => {
    let yLinea: number;
    if (anchorV === "auto") yLinea = y - (lineas.length - 1 - i) * ALTURA_LINEA_TURNO;
    else if (anchorV === "hanging") yLinea = y + i * ALTURA_LINEA_TURNO;
    else yLinea = y - ((lineas.length - 1) / 2) * ALTURA_LINEA_TURNO + i * ALTURA_LINEA_TURNO;
    const esValor = anchorV === "hanging" ? i === 0 : i === lineas.length - 1;
    return { x, y: yLinea, texto, esValor };
  });
}

function hoyLargoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}
function hoyCortoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface DatosInforme {
  ausentismo: AusentismoStats;
  rankingPersonal: FilaPersonalRanking[];
  porTurno: EjeTurno[];
  filtroLabel: string;
}

// Vista de solo impresión (variantePrint) reusa el mismo sistema visual
// "Industry" (.inf-*, ver globals.css) que ya usaba InformeAusentismo.tsx —
// esa sección ("01 — Composición por causa", "02 — Evolución mensual",
// "03 — Detalle mensual") queda absorbida acá, repartida entre las
// secciones elegibles. Sin variantePrint (la vista previa del modal) es la
// MISMA tabla, sin la clase print-informe — .inf sin esa clase ya se
// renderiza inline en pantalla normalmente, no hace falta ningún mecanismo
// especial para el preview, solo achicarla con transform:scale afuera.
function InformeLicenciasTabla({
  secciones,
  ausentismo,
  rankingPersonal,
  porTurno,
  filtroLabel,
  variantePrint,
}: DatosInforme & { secciones: Set<SeccionInforme>; variantePrint: boolean }) {
  const { meses, causasPresentes, totalCantidad, escalaMax } = ausentismo;

  const totalPorCausa = new Map<CausaAusentismo, number>();
  for (const m of meses) {
    for (const c of causasPresentes) {
      totalPorCausa.set(c, (totalPorCausa.get(c) ?? 0) + m.porCausa[c]);
    }
  }
  const causasOrdenadas = [...causasPresentes].sort(
    (a, b) => (totalPorCausa.get(b) ?? 0) - (totalPorCausa.get(a) ?? 0)
  );
  const maxCausa = Math.max(1, ...causasOrdenadas.map((c) => totalPorCausa.get(c) ?? 0));

  const promedioMensual =
    meses.length > 0
      ? (totalCantidad / meses.length).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "—";

  const periodo = meses.length > 0 ? `${meses[0].mesLargo} – ${meses[meses.length - 1].mesLargo}` : "—";
  const nroDocumento = `LIC-${new Date().getFullYear()}`;

  // Mismo criterio que InformeAusentismo.tsx: diezmar gap/etiquetas del eje
  // cuando hay muchos meses, para que las columnas no queden tan angostas
  // que la etiqueta ("ABR '25") no entre y el navegador la parta en dos.
  const gapEje = meses.length > 10 ? 4 : meses.length > 6 ? 8 : 13.6;
  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });
  const pasoEtiqueta = meses.length > 20 ? 3 : meses.length > 10 ? 2 : 1;
  const mediaExponencial = calcularMediaExponencial(meses.map((m) => m.cantidad), ALPHA_MEDIA_EXPONENCIAL);

  const totalTurno = porTurno.reduce((acc, e) => acc + e.cantidad, 0);
  const maxTurno = Math.max(1, ...porTurno.map((e) => e.cantidad));
  const escalaMaxTurno = Math.max(5, Math.ceil(maxTurno / 5) * 5);
  const anillosTurno = Array.from({ length: SEGMENTOS_GRILLA_TURNO }, (_, i) => (i + 1) / SEGMENTOS_GRILLA_TURNO);
  const puntosPoligonoTurno = porTurno
    .map((e, i) => {
      const { x, y } = puntoRadarTurno(i, (e.cantidad / escalaMaxTurno) * RADIO_TURNO, porTurno.length);
      return `${x},${y}`;
    })
    .join(" ");
  const personalVisible = rankingPersonal.slice(0, TOP_PERSONAL);
  const maxPersonalVisible = Math.max(1, ...personalVisible.map((f) => f.totalCantidad));

  // Orden fijo de impresión — "causas"/"tipos" comparten un solo bloque
  // (la misma tabla-ranking por causa) si cualquiera de las dos está
  // tildada; el detalle mensual por causa (antes "Ausentismo por causa")
  // queda último a propósito, es la tabla más larga.
  const bloques: { id: "causas" | "cantidad" | "turno" | "personal" | "ausentismo"; titulo: string }[] = [];
  if (secciones.has("cantidad")) bloques.push({ id: "cantidad", titulo: "Cantidad de licencias por mes" });
  if (secciones.has("causas") || secciones.has("tipos")) bloques.push({ id: "causas", titulo: "Causas más frecuentes" });
  if (secciones.has("turno")) bloques.push({ id: "turno", titulo: "Licencias por turno" });
  if (secciones.has("personal")) bloques.push({ id: "personal", titulo: "Personal con más licencias" });
  if (secciones.has("ausentismo")) bloques.push({ id: "ausentismo", titulo: "Detalle mensual por causa" });

  return (
    <table className={variantePrint ? "inf print-informe" : "inf"}>
      <thead>
        <tr>
          <td>
            <div className="inf-runhead">
              <strong>D.M.C.A<span> · Monitoreo Cordobeses en Alerta</span></strong>
              <span>Informe de licencias</span>
            </div>
          </td>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td>
            <div className="inf-runfoot">
              <span>Documento de uso interno — Área de Personal</span>
              <span className="inf-rev">Rev. {hoyCortoAR()}</span>
            </div>
          </td>
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td>

      <header className="inf-head">
        <div>
          <div className="inf-kicker">Dashboard · Indicadores de gestión</div>
          <h1 className="inf-title">Informe de licencias</h1>
          <div className="inf-sub">{filtroLabel} · {periodo}</div>
        </div>
        <div className="inf-meta">
          <div>Generado</div>
          <b>{hoyLargoAR()}</b>
          <div className="inf-meta-gap">Documento</div>
          <b>{nroDocumento}</b>
        </div>
      </header>

      <section className="inf-kpis inf-kpis--3">
        <div className="bp bp--solid inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Total de licencias</div>
          <div className="inf-kpi-n">{totalCantidad}</div>
          <div className="inf-kpi-s">sin licencia ordinaria (vacaciones)</div>
        </div>
        <div className="bp inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Agentes con ausentismo</div>
          <div className="inf-kpi-n">{rankingPersonal.length}</div>
          <div className="inf-kpi-s">en el período filtrado</div>
        </div>
        <div className="bp inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Promedio mensual</div>
          <div className="inf-kpi-n">{promedioMensual}</div>
          <div className="inf-kpi-s">licencias por mes · {meses.length} meses relevados</div>
        </div>
      </section>

      {bloques.length === 0 && (
        <p className="inf-fineprint">Sin secciones seleccionadas.</p>
      )}

      {bloques.map((b, i) => (
        <section
          key={b.id}
          className="inf-sec"
          style={(b.id === "ausentismo" || b.id === "personal") && i > 0 ? { breakBefore: "page" } : undefined}
        >
          <div className="inf-sech">
            <h3>{String(i + 1).padStart(2, "0")} — {b.titulo}</h3>
            <span className="inf-line" />
          </div>

          {b.id === "causas" && (
            causasOrdenadas.length === 0 ? (
              <p className="inf-fineprint">Sin licencias en el período.</p>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--inf-8)", breakInside: "avoid" }}>
                {/* Mismo criterio visual que RankingCausasCard.tsx (barra
                    horizontal, etiqueta a la izquierda, valor al final de la
                    barra), con el mismo color por causa que el dashboard
                    (CAUSA_COLOR) — así el cuadro de la derecha puede usarlo
                    como referencia sin repetir la cantidad, que ya está al
                    final de cada barra.
                    El "cuadro" de la derecha no es un <table>: se arma con
                    los mismos ALTURA_FILA_CAUSA/GAP_FILA_CAUSA que las
                    barras a propósito, para que cada fila quede alineada
                    con su barra — un <table> real tiene su propio alto de
                    fila (line-height + padding del sistema .inf-table) que
                    no coincide con el de las barras y las desalinea a
                    partir de la segunda fila. */}
                <div style={{ flex: "1 1 0", minWidth: 0, paddingTop: ALTURA_CABECERA_CAUSA }}>
                  {causasOrdenadas.map((c) => {
                    const cantidad = totalPorCausa.get(c) ?? 0;
                    return (
                      <div
                        key={c}
                        style={{ display: "flex", alignItems: "center", gap: 8, height: ALTURA_FILA_CAUSA, marginBottom: GAP_FILA_CAUSA }}
                      >
                        <div style={{ flex: "0 0 132px", width: 132, textAlign: "right", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {labelDeCausa(c)}
                        </div>
                        <div style={{ flex: "1 1 0", minWidth: 0, height: ALTURA_FILA_CAUSA, background: "var(--inf-accent-100)", position: "relative" }}>
                          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round((cantidad / maxCausa) * 100)}%`, background: CAUSA_COLOR[c] }} />
                        </div>
                        <div style={{ flex: "0 0 26px", width: 26, fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {cantidad}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ flex: "none", width: 170, border: "1px solid var(--inf-divider)" }}>
                  <div
                    style={{
                      display: "flex", height: ALTURA_CABECERA_CAUSA, alignItems: "center", padding: "0 10px", gap: 8,
                      borderBottom: "1px solid var(--inf-divider)", fontFamily: "var(--inf-font-h)", fontSize: 10,
                      letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--inf-muted)",
                    }}
                  >
                    <span style={{ width: 8 }} />
                    <span style={{ flex: 1 }}>Causa</span>
                    <span style={{ flex: "none" }}>%</span>
                  </div>
                  {causasOrdenadas.map((c) => {
                    const cantidad = totalPorCausa.get(c) ?? 0;
                    return (
                      <div
                        key={c}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, height: ALTURA_FILA_CAUSA, marginBottom: GAP_FILA_CAUSA,
                          padding: "0 10px", fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <span style={{ flex: "none", width: 8, height: 8, borderRadius: 2, background: CAUSA_COLOR[c] }} />
                        <span style={{ flex: 1, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {labelDeCausa(c)}
                        </span>
                        <span style={{ flex: "none", fontSize: 11, fontWeight: 700, color: "var(--inf-text)" }}>
                          {totalCantidad > 0 ? Math.round((cantidad / totalCantidad) * 100) : 0}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {b.id === "cantidad" && (
            <div className="inf-chart">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: "none", width: 26, height: ALTURA_PLOT, position: "relative" }}>
                  {lineasGrilla.map(({ frac, valor }) => (
                    <span
                      key={frac}
                      style={{
                        position: "absolute", right: 0, top: `${(1 - frac) * ALTURA_PLOT}px`,
                        transform: frac === 1 ? "translateY(0)" : frac === 0 ? "translateY(-100%)" : "translateY(-50%)",
                        fontFamily: "var(--inf-font-h)", fontSize: 9.5, color: "rgba(29, 31, 32, 0.5)", whiteSpace: "nowrap",
                      }}
                    >
                      {valor}
                    </span>
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      {lineasGrilla.map(({ frac }) => (
                        <div
                          key={frac}
                          style={{
                            position: "absolute", left: 0, right: 0, top: `${(1 - frac) * ALTURA_PLOT}px`,
                            borderTop: frac === 0 ? "1.5px solid var(--inf-text)" : "1px solid var(--inf-divider)",
                          }}
                        />
                      ))}
                    </div>
                    <div className="inf-chart-plot" style={{ position: "relative", gap: gapEje }}>
                      {meses.map((m) => (
                        <div key={m.key} className="inf-col">
                          {m.cantidad > 0 && <b>{m.cantidad}</b>}
                          <i style={{ height: `${Math.max(2, (m.cantidad / escalaMax) * ALTURA_PLOT)}px` }} />
                        </div>
                      ))}
                    </div>
                    {/* Overlay de la media exponencial: las columnas de
                        .inf-chart-plot son flex 1 1 0 (ancho fluido, sin
                        píxeles fijos, a diferencia de AusentismoCard.tsx en
                        el dashboard), así que no hay un ancho de columna
                        real para calcular coordenadas — se usa un viewBox de
                        0 a 1000 en X (ignora el gap entre columnas, un
                        desvío de a lo sumo unos px por columna, imperceptible
                        para una línea de tendencia suavizada) y ALTURA_PLOT
                        real en Y (1:1, sin distorsión vertical). */}
                    <svg
                      viewBox={`0 0 1000 ${ALTURA_PLOT}`}
                      preserveAspectRatio="none"
                      style={{ position: "absolute", inset: 0, width: "100%", height: ALTURA_PLOT, pointerEvents: "none" }}
                    >
                      <path
                        d={curvaSuave(
                          mediaExponencial.map((v, i) => ({
                            x: ((i + 0.5) / meses.length) * 1000,
                            y: ALTURA_PLOT - (v / escalaMax) * ALTURA_PLOT,
                          }))
                        )}
                        fill="none"
                        stroke={COLOR_MEDIA_EXPONENCIAL}
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="inf-chart-axis" style={{ gap: gapEje }}>
                    {meses.map((m, i) => (
                      <span key={m.key} style={{ whiteSpace: "nowrap" }}>
                        {i % pasoEtiqueta === 0 || m.label.includes("'") ? m.label : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="inf-fineprint">Línea roja: media exponencial de la serie mensual.</p>
            </div>
          )}

          {b.id === "turno" && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--inf-8)", breakInside: "avoid" }}>
              <table className="inf-table" style={{ flex: "1 1 0", minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Turno</th>
                    <th className="num" style={{ width: 84 }}>Cantidad</th>
                    <th className="num" style={{ width: 52 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {totalTurno === 0 ? (
                    <tr><td colSpan={3} className="txt">Sin licencias en el período.</td></tr>
                  ) : porTurno.map((e) => (
                    <tr key={e.turno}>
                      <td className="txt">Turno {e.turno}</td>
                      <td className="num">{e.cantidad}</td>
                      <td className="num">{totalTurno > 0 ? Math.round((e.cantidad / totalTurno) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalTurno > 0 && (
                <div style={{ flex: "none", width: 300 }}>
                  <svg viewBox={`0 0 ${VB_TURNO} ${VB_TURNO}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
                    {anillosTurno.map((frac) => {
                      const puntos = porTurno
                        .map((_, i) => { const { x, y } = puntoRadarTurno(i, RADIO_TURNO * frac, porTurno.length); return `${x},${y}`; })
                        .join(" ");
                      return (
                        <polygon
                          key={frac}
                          points={puntos}
                          fill="none"
                          stroke="var(--inf-divider)"
                          strokeWidth={1}
                          opacity={frac === 1 ? 1 : 0.6}
                        />
                      );
                    })}

                    {porTurno.map((e, i) => {
                      const { x, y } = puntoRadarTurno(i, RADIO_TURNO, porTurno.length);
                      return <line key={e.turno} x1={CENTRO_TURNO} y1={CENTRO_TURNO} x2={x} y2={y} stroke="var(--inf-divider)" strokeWidth={1} />;
                    })}

                    {anillosTurno.map((frac) => (
                      <text
                        key={frac}
                        x={CENTRO_TURNO + 3}
                        y={CENTRO_TURNO - RADIO_TURNO * frac - 2}
                        fill="var(--inf-muted-2)"
                        fontSize={8}
                        fontFamily="var(--inf-font-b)"
                      >
                        {Math.round(escalaMaxTurno * frac)}
                      </text>
                    ))}

                    <polygon
                      points={puntosPoligonoTurno}
                      fill="var(--inf-accent)"
                      fillOpacity={0.18}
                      stroke="var(--inf-accent-700)"
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                    />

                    {porTurno.map((e, i) => {
                      const { x, y } = puntoRadarTurno(i, (e.cantidad / escalaMaxTurno) * RADIO_TURNO, porTurno.length);
                      return <circle key={e.turno} cx={x} cy={y} r={3} fill="var(--inf-accent-700)" stroke="var(--inf-bg)" strokeWidth={1.3} />;
                    })}

                    {porTurno.map((e, i) => {
                      const { x, y } = puntoRadarTurno(i, RADIO_LABEL_TURNO, porTurno.length);
                      const lineas = lineasRadarTurno(x, y, e.turno, e.cantidad);
                      return (
                        <g key={e.turno}>
                          {lineas.map((l, li) => (
                            <text
                              key={li}
                              x={l.x}
                              y={l.y}
                              textAnchor={anclaTextoRadar(x)}
                              dominantBaseline={anclaVerticalRadar(y)}
                              fontFamily={l.esValor ? "var(--inf-font-h)" : "var(--inf-font-b)"}
                              fontSize={l.esValor ? 10 : 11}
                              fontWeight={l.esValor ? 700 : 600}
                              fill={l.esValor ? "var(--inf-accent-700)" : "var(--inf-text)"}
                            >
                              {l.texto}
                            </text>
                          ))}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}

          {b.id === "personal" && (
            <>
              <table className="inf-table">
                <thead>
                  <tr>
                    <th className="idx" style={{ width: 28 }}>#</th>
                    <th>Agente</th>
                    <th className="num" style={{ width: 68 }}>Licencias</th>
                    <th className="num" style={{ width: 60 }}>Días</th>
                    <th className="num" style={{ width: 52 }}>%</th>
                    <th style={{ width: 90 }}>Distribución</th>
                  </tr>
                </thead>
                <tbody>
                  {personalVisible.length === 0 ? (
                    <tr><td colSpan={6} className="txt">Sin licencias en el período.</td></tr>
                  ) : personalVisible.map((f, i) => (
                    <tr key={f.agenteId}>
                      <td className="idx">{i + 1}</td>
                      <td className="txt">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Foto chica en tinta/hatch del documento (mismo
                              patrón que .inf-photo) en vez de <img> con
                              fallback en JS: bastantes fotoUrl de la carga
                              masiva original ya no resuelven a nada (ver
                              AgenteAvatar.tsx), y acá un ícono de "broken
                              image" del navegador se ve mucho peor en un PDF
                              que un cuadrito con la textura del documento. */}
                          <div
                            style={{
                              flex: "none", width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--inf-divider)",
                              backgroundColor: "var(--inf-accent-100)",
                              backgroundImage: f.fotoUrl ? `url(${f.fotoUrl})` : "repeating-linear-gradient(45deg, transparent 0 3px, rgba(89, 128, 166, 0.22) 3px 4px)",
                              backgroundSize: "cover", backgroundPosition: "center",
                            }}
                          />
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.nombreCompleto}
                          </span>
                        </div>
                      </td>
                      <td className="num">{f.totalCantidad}</td>
                      <td className="num">{f.totalDias}</td>
                      <td className="num">{totalCantidad > 0 ? Math.round((f.totalCantidad / totalCantidad) * 100) : 0}%</td>
                      <td>
                        <div className="inf-meter">
                          <span style={{ width: `${Math.round((f.totalCantidad / maxPersonalVisible) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rankingPersonal.length > TOP_PERSONAL && (
                <p className="inf-fineprint">
                  Mostrando los {TOP_PERSONAL} agentes con más licencias, de {rankingPersonal.length} en total.
                </p>
              )}
            </>
          )}

          {b.id === "ausentismo" && (
            <>
              <table className="inf-table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    {causasPresentes.map((c) => (
                      <th key={c} className="num">{labelDeCausa(c)}</th>
                    ))}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.key}>
                      <td className="txt">{m.mesLargo}</td>
                      {causasPresentes.map((c) => (
                        <td key={c} className="num">{m.porCausa[c] || "—"}</td>
                      ))}
                      <td className="num">{m.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="inf-total">
                <span>Total</span>
                <span>{totalCantidad} licencias</span>
              </div>
            </>
          )}
        </section>
      ))}

      <p className="inf-fineprint">
        &quot;Otros&quot; agrupa matrimonio, estímulo, antigüedad policial, examen en cursos no policiales, retiro voluntario, excepcional remunerada, adscripción y sanción. No incluye licencia ordinaria (vacaciones).
      </p>

          </td>
        </tr>
      </tbody>
    </table>
  );
}

// Botón + modal (mismo espíritu que GraficoDescargable.tsx: portal directo a
// document.body en el render, nunca useState(() => document.createElement(...))
// — ver memoria feedback_portal_hydration_document_check) con la lista de
// secciones a tildar y una vista previa achicada. Además, SIEMPRE montado
// (no solo cuando el modal está abierto, igual que el <InformeAusentismo>
// que reemplaza) un nodo insertado como primer hijo de <body> con la tabla
// en variantePrint — es el que realmente se imprime.
export default function InformeLicenciasModal({ ausentismo, rankingPersonal, porTurno, filtroLabel }: DatosInforme) {
  const [abierto, setAbierto] = useState(false);
  const [secciones, setSecciones] = useState<Set<SeccionInforme>>(() => new Set(SECCIONES));

  // El nodo de impresión se crea recién en el efecto, nunca en el
  // initializer de useState — mismo motivo documentado en
  // InformeAusentismo.tsx: evita un mismatch de hidratación entre el árbol
  // del servidor y el primer render del cliente.
  const [contenedorPrint, setContenedorPrint] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    document.body.insertBefore(el, document.body.firstChild);
    const raf = requestAnimationFrame(() => setContenedorPrint(el));
    return () => {
      cancelAnimationFrame(raf);
      el.remove();
    };
  }, []);

  function alternar(s: SeccionInforme) {
    setSecciones((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function imprimir() {
    // A diferencia del intento anterior: NO se cierra el modal antes de
    // imprimir. El modal es un <div> fixed/z-50 a pantalla completa
    // portalado a document.body — cerrarlo (setAbierto(false)) lo desmonta
    // de golpe, y aunque el .print-informe ya se oculta solo vía @media
    // print sin importar si el modal sigue abierto, desmontar ese overlay
    // gigante justo antes de window.print() era lo que hacía que el
    // navegador se comiera el llamado sin abrir el diálogo ni tirar error
    // (a diferencia de EstadisticasLicencias.tsx/OrganigramaChart.tsx, que
    // imprimen sin tocar ningún estado antes). Se cierra recién después,
    // una vez que el usuario ya interactuó con el diálogo de impresión.
    window.print();
    setAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--c-text-muted)] hover:text-[var(--c-text)] border border-[var(--c-line)] hover:border-[var(--c-line-strong)] rounded-md px-2.5 py-1 transition-colors"
      >
        <Printer className="w-3.5 h-3.5" strokeWidth={2} />
        Imprimir informe
      </button>

      {abierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} />

          <div className="relative bg-[var(--c-bg-elev)] rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-base font-semibold text-[var(--c-text)]">Imprimir informe</h2>
              <p className="text-sm text-[var(--c-text-muted)] mt-0.5">
                Elegí qué secciones incluir — la vista previa ya respeta los filtros generales activos ({filtroLabel}).
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 flex gap-5">
              <div className="shrink-0 w-52 flex flex-col gap-1">
                {SECCIONES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--c-bg-elev-2)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={secciones.has(s)}
                      onChange={() => alternar(s)}
                      className="accent-[var(--c-blue)]"
                    />
                    <span className="text-[12.5px] text-[var(--c-text-secondary)]">{SECCION_LABEL[s]}</span>
                  </label>
                ))}
              </div>

              <div
                className="flex-1 min-w-0 rounded-lg border border-[var(--c-line)] overflow-auto"
                style={{ background: "#f2f2f3", maxHeight: 520 }}
              >
                {/* zoom (no transform:scale) a propósito: scale no reduce el
                    tamaño de layout, así que el contenedor overflow:auto de
                    arriba mediría igual la caja sin achicar y dejaría un
                    hueco enorme vacío al lado — zoom sí achica la caja real,
                    coherente con que este informe ya depende de Chromium
                    para imprimir bien (ver comentarios largos en
                    globals.css sobre .print-informe verificados con Chrome). */}
                <div style={{ zoom: 0.42 }}>
                  <InformeLicenciasTabla
                    secciones={secciones}
                    ausentismo={ausentismo}
                    rankingPersonal={rankingPersonal}
                    porTurno={porTurno}
                    filtroLabel={filtroLabel}
                    variantePrint={false}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--c-bg-elev-2)] mt-4">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="rounded-lg border border-[var(--c-line)] bg-[var(--c-bg-elev)] hover:bg-[var(--c-bg-elev-2)] px-4 py-2 text-sm font-medium text-[var(--c-text-secondary)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={imprimir}
                disabled={secciones.size === 0}
                className="rounded-lg bg-[var(--c-blue)] hover:bg-[var(--c-blue-strong)] px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                Imprimir / Generar PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {contenedorPrint && createPortal(
        <InformeLicenciasTabla
          secciones={secciones}
          ausentismo={ausentismo}
          rankingPersonal={rankingPersonal}
          porTurno={porTurno}
          filtroLabel={filtroLabel}
          variantePrint
        />,
        contenedorPrint
      )}
    </>
  );
}
