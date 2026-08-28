"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AusentismoMensual, CausaAusentismo } from "@/lib/ausentismo";

function hoyLargoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

function hoyCortoAR() {
  return new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface Props {
  meses: AusentismoMensual[];
  causasPresentes: CausaAusentismo[];
  totalPorCausa: Map<CausaAusentismo, number>;
  totalCantidad: number;
  picoIndex: number;
  escalaMax: number;
  labelDeCausa: (c: CausaAusentismo) => string;
}

// Vista de solo impresión: mismo sistema visual "Industry" (.inf-*, ver
// globals.css) que ya usa el informe de ausentismo por legajo en
// EstadisticasLicencias.tsx — se reusa la hoja de estilos entera (no hace
// falta CSS nuevo), solo cambia el contenido. Se oculta en pantalla
// (.print-informe) y se inserta como primer hijo de <body> para que no
// queden páginas en blanco antes del informe al imprimir (mismo mecanismo,
// ver el comentario largo en globals.css sobre por qué position:fixed no
// alcanza acá).
export default function InformeAusentismo({
  meses,
  causasPresentes,
  totalPorCausa,
  totalCantidad,
  picoIndex,
  escalaMax,
  labelDeCausa,
}: Props) {
  // El nodo se crea recién en el efecto (no en el initializer de useState,
  // como tenía la primera versión): un initializer que chequea
  // `typeof document` devuelve `null` en el server y un div real en el
  // primer render del cliente — esos son valores DISTINTOS ya en el render
  // de hidratación, antes de que corra ningún efecto, y React lo detecta
  // como mismatch (justamente el caso "server/client branch" del error de
  // hidratación). Arrancando en `null` en ambos lados y recién creando el
  // div en el efecto, el primer render (servidor Y cliente) coincide
  // siempre — mismo patrón ya usado en NominaBuilderBtn.tsx.
  const [contenedor, setContenedor] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    document.body.insertBefore(el, document.body.firstChild);
    // El setState no puede quedar síncrono en el cuerpo del efecto (lint
    // set-state-in-effect de este repo, ver useCountUp.ts) — envolverlo en
    // un rAF también sirve para separarlo del commit de montaje del efecto.
    const raf = requestAnimationFrame(() => setContenedor(el));
    return () => {
      cancelAnimationFrame(raf);
      el.remove();
    };
  }, []);

  if (!contenedor) return null;

  const periodo = meses.length > 0 ? `${meses[0].mesLargo} – ${meses[meses.length - 1].mesLargo}` : "—";
  const nroDocumento = `AUS-CAUSA-${new Date().getFullYear()}`;

  const causasOrdenadas = [...causasPresentes].sort(
    (a, b) => (totalPorCausa.get(b) ?? 0) - (totalPorCausa.get(a) ?? 0)
  );
  const lider = causasOrdenadas[0] as CausaAusentismo | undefined;
  const totalLider = lider ? totalPorCausa.get(lider) ?? 0 : 0;
  const pctLider = lider && totalCantidad > 0 ? Math.round((totalLider / totalCantidad) * 100) : 0;
  const maxCausa = Math.max(1, ...causasOrdenadas.map((c) => totalPorCausa.get(c) ?? 0));

  const promedioMensual =
    meses.length > 0
      ? (totalCantidad / meses.length).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : "—";

  // El ancho de página es fijo (A4, 184mm de contenido) pero la cantidad de
  // meses no: con el gap por defecto de .inf-chart-plot/.inf-chart-axis
  // (var(--inf-4), 13.6px) una serie larga como "abr '25 – ago '26" (17
  // columnas) se come casi un tercio del ancho solo en gaps, angostando
  // tanto las columnas que la etiqueta "ABR '25" (más larga que un mes
  // suelto) no entra y el navegador la parte en dos líneas. Se achica el
  // gap a mano cuando hay muchos meses, y además se "diezman" las
  // etiquetas del eje (se muestra 1 de cada N) — ambas cosas ya son
  // prácticas estándar de cualquier librería de gráficos ante ejes densos,
  // no un parche puntual. Las etiquetas con año (inicio de serie / enero)
  // se muestran siempre, aunque no les toque turno, porque marcan un corte
  // real en la serie.
  const gapEje = meses.length > 10 ? 4 : meses.length > 6 ? 8 : 13.6;

  // Líneas de referencia del eje Y (mismo criterio que el gráfico en
  // pantalla, AusentismoCard.tsx): sin esto, en el papel no hay forma de
  // estimar de qué magnitud se habla más que comparando barras a ojo.
  const ALTURA_PLOT = 150;
  const SEGMENTOS_GRILLA = 4;
  const lineasGrilla = Array.from({ length: SEGMENTOS_GRILLA + 1 }, (_, i) => {
    const frac = i / SEGMENTOS_GRILLA;
    return { frac, valor: Math.round(escalaMax * frac) };
  });
  const pasoEtiqueta = meses.length > 20 ? 3 : meses.length > 10 ? 2 : 1;

  return createPortal(
    <table className="inf print-informe">
      <thead>
        <tr>
          <td>
            <div className="inf-runhead">
              <strong>D.M.C.A<span> · Monitoreo Cordobeses en Alerta</span></strong>
              <span>Informe de ausentismo por causa</span>
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
          <h1 className="inf-title">Ausentismo por causa</h1>
          <div className="inf-sub">{periodo}</div>
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
          <div className="inf-kpi-l">Causa principal</div>
          <div className="inf-kpi-n" style={{ fontSize: 26 }}>{lider ? labelDeCausa(lider) : "—"}</div>
          <div className="inf-kpi-s">{lider ? `${pctLider}% del total` : "sin registros"}</div>
        </div>
        <div className="bp inf-kpi">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <div className="inf-kpi-l">Promedio mensual</div>
          <div className="inf-kpi-n">{promedioMensual}</div>
          <div className="inf-kpi-s">licencias por mes · {meses.length} meses relevados</div>
        </div>
      </section>

      <section className="inf-sec">
        <div className="inf-sech">
          <h3>01 — Composición por causa</h3>
          <span className="inf-line" />
        </div>
        <table className="inf-table">
          <thead>
            <tr>
              <th style={{ whiteSpace: "nowrap" }}>Causa</th>
              <th className="num" style={{ width: 84, whiteSpace: "nowrap" }}>Cantidad</th>
              <th className="num" style={{ width: 52, whiteSpace: "nowrap" }}>%</th>
            </tr>
          </thead>
          <tbody>
            {causasOrdenadas.length === 0 ? (
              <tr><td colSpan={3} className="txt">Sin licencias en el período.</td></tr>
            ) : causasOrdenadas.map((c) => (
              <tr key={c}>
                <td className="txt" style={{ whiteSpace: "nowrap" }}>{labelDeCausa(c)}</td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{totalPorCausa.get(c) ?? 0}</td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>{totalCantidad > 0 ? Math.round(((totalPorCausa.get(c) ?? 0) / totalCantidad) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lider && (
          <>
            <div className="inf-meter" style={{ marginTop: "var(--inf-3)" }}>
              <span style={{ width: `${Math.round((totalLider / maxCausa) * 100)}%` }} />
            </div>
            <div className="inf-total" style={{ borderTop: "none", marginTop: "var(--inf-1)", paddingTop: 0, fontSize: 10 }}>
              <span>{labelDeCausa(lider)}</span>
              <span>{pctLider} %</span>
            </div>
          </>
        )}
      </section>

      <section className="inf-sec">
        <div className="inf-sech">
          <h3>02 — Evolución mensual</h3>
          <span className="inf-line" />
          <span className="inf-flag">{meses.length} meses</span>
        </div>
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
                        // La línea de "0" ES la línea de base — se dibuja
                        // sólida y oscura, pegada al borde inferior de las
                        // barras (no una línea aparte más abajo, que dejaba
                        // un hueco entre las barras y la línea sin sentido:
                        // la línea de base tiene que tocar las barras).
                        borderTop: frac === 0 ? "1.5px solid var(--inf-text)" : "1px solid var(--inf-divider)",
                      }}
                    />
                  ))}
                </div>
                <div className="inf-chart-plot" style={{ position: "relative", gap: gapEje }}>
                  {meses.map((m, i) => (
                    <div key={m.key} className={i === picoIndex ? "inf-col inf-col--peak" : "inf-col"}>
                      {m.cantidad > 0 && <b>{m.cantidad}</b>}
                      <i style={{ height: `${Math.max(2, (m.cantidad / escalaMax) * ALTURA_PLOT)}px` }} />
                    </div>
                  ))}
                </div>
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
        </div>
      </section>

      <section className="inf-sec" style={{ breakBefore: "page" }}>
        <div className="inf-sech">
          <h3>03 — Detalle mensual</h3>
          <span className="inf-line" />
        </div>
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
      </section>

      <p className="inf-fineprint">
        &quot;Otros&quot; agrupa matrimonio, estímulo, antigüedad policial, examen en cursos no policiales, retiro voluntario, excepcional remunerada, adscripción y sanción. No incluye licencia ordinaria (vacaciones).
      </p>

          </td>
        </tr>
      </tbody>
    </table>,
    contenedor
  );
}
