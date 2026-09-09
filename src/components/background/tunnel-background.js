/**
 * Fondo animado "túnel de datos" — DMCA / Dirección Monitoreo Cordobeses en Alerta
 *
 * Motor sin dependencias: dibuja glifos de software (bases de datos, bloques de
 * código, tablas, endpoints, grafos de commits, pipelines) viajando hacia la
 * cámara sobre un canvas 2D. No usa imágenes ni video: el peso de red es 0.
 *
 * Uso:
 *   import { createTunnelBackground } from './tunnel-background.js';
 *   const bg = createTunnelBackground(canvasEl, { density: 0.5, palette: 'blue' });
 *   // ...
 *   bg.destroy();
 *
 * El canvas debe estar posicionado por CSS (por ejemplo `position:absolute; inset:0`)
 * dentro de un contenedor con `position:relative; overflow:hidden`. El motor mide
 * el canvas y ajusta su backing store solo.
 */

const NEAR = 62;
const FAR = 7000;

const DEFAULTS = {
  density: 0.5,      // 0.15 – 1.6 · cantidad de objetos
  speed: 0.75,       // 0.1 – 2 · velocidad de avance
  glow: 0.7,         // 0 – 1.6 · halo de los objetos brillantes
  palette: 'blue',   // 'blue' | 'blueOrange' | 'blueCyan'
  fps: 33,           // tope de cuadros por segundo
  maxDpr: 1.5,       // tope de densidad de píxel (rendimiento)
  pauseWhenHidden: true,
  respectReducedMotion: true
};

const PALETTES = {
  blue: { line: '150,178,206', paper: '212,229,246', blue: '104,172,250', warm: '104,172,250' },
  blueOrange: { line: '150,178,206', paper: '212,229,246', blue: '104,172,250', warm: '255,120,48' },
  blueCyan: { line: '150,178,206', paper: '212,229,246', blue: '104,172,250', warm: '84,232,222' }
};

export function createTunnelBackground(canvas, options = {}) {
  if (!canvas) throw new Error('createTunnelBackground: falta el canvas');
  const opts = { ...DEFAULTS, ...options };
  const ctx = canvas.getContext('2d');

  let w = 320, h = 320, f = 640, dpr = 1;
  let items = [];
  let t0 = performance.now();
  let last = t0;
  let raf = 0;
  let paused = false;
  let destroyed = false;

  // ---------------------------------------------------------------- medida
  function resize() {
    const r = canvas.getBoundingClientRect();
    w = r.width > 1 ? r.width : 320;
    h = r.height > 1 ? r.height : 320;
    dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.max(640, w * 0.66);
  }

  // ---------------------------------------------------- construcción escena
  function build() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const ri = (a, b) => Math.round(rnd(a, b));
    const W = 1560, H = 920, G = 104;
    const snap = (v) => Math.round(v / G) * G;
    const d = Math.max(0.15, Math.min(1.6, opts.density));
    const C = PALETTES[opts.palette] || PALETTES.blue;
    const out = [];
    const spawnZ = () => NEAR + (FAR - NEAR) * Math.pow(Math.random(), 0.5);
    const push = (o) => out.push(Object.assign({ dots: [], lw: 1, bright: false, maxRel: 0, z: spawnZ() }, o));

    const rect = (s, x0, y0, x1, y1) => {
      s.push([x0, y0, 0, x1, y0, 0], [x1, y0, 0, x1, y1, 0], [x1, y1, 0, x0, y1, 0], [x0, y1, 0, x0, y0, 0]);
    };
    const arc = (s, cx, cy, rx, ry, a0, a1, n) => {
      let p = null;
      for (let k = 0; k <= n; k++) {
        const a = a0 + (a1 - a0) * (k / n);
        const q = [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
        if (p) s.push([p[0], p[1], 0, q[0], q[1], 0]);
        p = q;
      }
    };
    const row = (s, x, y, len, unit) => {
      let o = 0;
      while (o < len) {
        const wl = Math.min(rnd(unit * 1.2, unit * 4), len - o);
        s.push([x + o, y, 0, x + o + wl, y, 0]);
        o += wl + unit * 0.9;
      }
    };
    const arrow = (s, x0, y0, x1, y1) => {
      s.push([x0, y0, 0, x1, y1, 0]);
      const a = Math.atan2(y1 - y0, x1 - x0), hd = G * 0.16;
      s.push([x1, y1, 0, x1 - Math.cos(a - 0.4) * hd, y1 - Math.sin(a - 0.4) * hd, 0]);
      s.push([x1, y1, 0, x1 - Math.cos(a + 0.4) * hd, y1 - Math.sin(a + 0.4) * hd, 0]);
    };
    const brace = (s, x, y, hh, dir) => {
      const t = G * 0.16 * dir;
      s.push([x, y, 0, x + t, y + hh * 0.1, 0], [x + t, y + hh * 0.1, 0, x + t, y + hh * 0.4, 0]);
      s.push([x + t, y + hh * 0.4, 0, x + t * 1.7, y + hh * 0.5, 0], [x + t * 1.7, y + hh * 0.5, 0, x + t, y + hh * 0.6, 0]);
      s.push([x + t, y + hh * 0.6, 0, x + t, y + hh * 0.9, 0], [x + t, y + hh * 0.9, 0, x, y + hh, 0]);
    };

    const glyphs = [];

    // 1 · base de datos — discos apilados, registros, primary key y etiqueta
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const rx = G * rnd(0.85, 1.45), ry = rx * 0.28;
      const discs = ri(2, 4), band = G * 0.46;
      arc(s, x, y, rx, ry, 0, Math.PI * 2, 24);
      let cyy = y;
      for (let k = 0; k < discs; k++) {
        const nb = cyy + band;
        s.push([x - rx, cyy, 0, x - rx, nb, 0], [x + rx, cyy, 0, x + rx, nb, 0]);
        arc(s, x, nb, rx, ry, 0, Math.PI, 16);
        row(s, x - rx * 0.5, cyy + band * 0.55, rx * 1.05, G * 0.15);
        cyy = nb;
      }
      const ky = y + band * 0.5;
      arc(s, x - rx * 0.62, ky, G * 0.07, G * 0.07, 0, Math.PI * 2, 9);
      s.push([x - rx * 0.55, ky, 0, x - rx * 0.3, ky, 0], [x - rx * 0.38, ky, 0, x - rx * 0.38, ky + G * 0.07, 0]);
      dots.push([x + rx + G * 0.3, y, G * 0.07, C.blue]);
      row(s, x + rx + G * 0.3, y + G * 0.26, rx * 0.85, G * 0.17);
      row(s, x + rx + G * 0.3, y + G * 0.5, rx * 0.55, G * 0.17);
      return { segs: s, dots, col: C.line, lw: 1.15, bright: true };
    });

    // 2 · ventana de app
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const ww = ri(2, 4) * G, hh = ri(1, 2.6) * G;
      rect(s, x, y, x + ww, y + hh);
      s.push([x, y + G * 0.7, 0, x + ww, y + G * 0.7, 0]);
      for (let k = 0; k < 3; k++) dots.push([x + G * (0.35 + k * 0.28), y + G * 0.35, G * 0.06, C.line]);
      const rows = ri(2, 5);
      for (let k = 1; k <= rows; k++) row(s, x + G * 0.45, y + G * 0.7 + (hh - G * 0.7) * (k / (rows + 1)), ww - G * 0.9, G * 0.24);
      if (Math.random() < 0.5) dots.push([x + ww - G * 0.4, y + G * 0.35, G * 0.07, C.blue]);
      return { segs: s, dots, col: C.paper, lw: 1, bright: true };
    });

    // 3 · terminal
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const ww = ri(2, 3.4) * G, hh = rnd(1, 1.8) * G;
      rect(s, x, y, x + ww, y + hh);
      const lines = ri(2, 4);
      for (let k = 0; k < lines; k++) {
        const ly = y + G * 0.6 + k * G * 0.55;
        s.push([x + G * 0.4, ly - G * 0.12, 0, x + G * 0.56, ly, 0], [x + G * 0.56, ly, 0, x + G * 0.4, ly + G * 0.12, 0]);
        row(s, x + G * 0.75, ly, ww * rnd(0.35, 0.75), G * 0.22);
      }
      const cy0 = y + G * 0.6 + lines * G * 0.55;
      s.push([x + G * 0.4, cy0, 0, x + G * 0.62, cy0, 0]);
      dots.push([x + G * 0.8, cy0, G * 0.08, C.warm]);
      return { segs: s, dots, col: C.line, lw: 1, bright: true };
    });

    // 4 · tabla de resultados
    glyphs.push((x, y) => {
      const s = [];
      const cols = ri(3, 5), rows = ri(3, 6);
      const cw = G * rnd(1.1, 2), rh = G * 0.5;
      const ww = cols * cw, hh = rows * rh;
      rect(s, x, y, x + ww, y + hh);
      s.push([x, y + rh, 0, x + ww, y + rh, 0]);
      for (let k = 1; k < cols; k++) s.push([x + k * cw, y, 0, x + k * cw, y + hh, 0]);
      for (let k = 2; k <= rows; k++) s.push([x, y + k * rh, 0, x + ww, y + k * rh, 0]);
      for (let k = 0; k < cols; k++) row(s, x + k * cw + G * 0.18, y + rh * 0.55, cw - G * 0.36, G * 0.22);
      return { segs: s, dots: [], col: C.line, lw: 0.95 };
    });

    // 5 · grafo de servicios
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const n = ri(3, 5), pts = [];
      for (let k = 0; k < n; k++) pts.push([x + snap(rnd(0, 5)) * G, y + snap(rnd(0, 4)) * G]);
      for (let k = 0; k < n - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        s.push([a[0], a[1], 0, b[0], a[1], 0], [b[0], a[1], 0, b[0], b[1], 0]);
      }
      pts.forEach((p, k) => dots.push([p[0], p[1], G * (k === 0 ? 0.1 : 0.07), k === 0 ? C.blue : C.line]));
      return { segs: s, dots, col: C.line, lw: 1, bright: true };
    });

    // 6 · grafo de commits
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const n = ri(4, 7), step = G * 0.6, bx = x + G * 0.9;
      s.push([x, y, 0, x, y + (n - 1) * step, 0]);
      for (let k = 0; k < n; k++) dots.push([x, y + k * step, G * 0.075, k === n - 1 ? C.warm : C.line]);
      const b0 = ri(1, n - 3), b1 = b0 + 2;
      s.push([x, y + b0 * step, 0, bx, y + (b0 + 0.5) * step, 0]);
      s.push([bx, y + (b0 + 0.5) * step, 0, bx, y + (b1 - 0.5) * step, 0]);
      s.push([bx, y + (b1 - 0.5) * step, 0, x, y + b1 * step, 0]);
      dots.push([bx, y + (b0 + 0.5) * step, G * 0.07, C.blue]);
      return { segs: s, dots, col: C.line, lw: 1.1, bright: true };
    });

    // 7 · llaves de código
    glyphs.push((x, y) => {
      const s = [];
      const hh = rnd(0.8, 1.8) * G, ww = rnd(1.4, 2.8) * G, t = G * 0.22;
      s.push([x + t, y, 0, x, y, 0], [x, y, 0, x, y + hh, 0], [x, y + hh, 0, x + t, y + hh, 0]);
      s.push([x + ww - t, y, 0, x + ww, y, 0], [x + ww, y, 0, x + ww, y + hh, 0], [x + ww, y + hh, 0, x + ww - t, y + hh, 0]);
      const rows = ri(1, 3);
      for (let k = 1; k <= rows; k++) row(s, x + t * 2, y + hh * (k / (rows + 1)), ww - t * 4, G * 0.24);
      return { segs: s, dots: [], col: C.paper, lw: 1.1 };
    });

    // 8 · barras de métrica
    glyphs.push((x, y) => {
      const s = [], n = ri(5, 10), bw = G * 0.3;
      s.push([x, y, 0, x + n * bw * 1.6, y, 0]);
      for (let k = 0; k < n; k++) {
        const bh = G * rnd(0.3, 1.9), bx = x + k * bw * 1.6;
        s.push([bx, y, 0, bx, y - bh, 0], [bx + bw, y, 0, bx + bw, y - bh, 0], [bx, y - bh, 0, bx + bw, y - bh, 0]);
      }
      return { segs: s, dots: [], col: Math.random() < 0.5 ? C.warm : C.line, lw: 1.1, bright: true };
    });

    // 9 · campo de formulario
    glyphs.push((x, y) => {
      const s = [], ww = rnd(0.9, 2.2) * G, hh = G * 0.34;
      rect(s, x, y, x + ww, y + hh);
      row(s, x + G * 0.2, y + hh * 0.55, ww * rnd(0.3, 0.7), G * 0.22);
      return { segs: s, dots: [], col: C.line, lw: 0.95 };
    });

    // 10 · replica set
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const rx = G * 0.42, ry = rx * 0.3, band = G * 0.3;
      const cyl = (px, py, accent) => {
        arc(s, px, py, rx, ry, 0, Math.PI * 2, 16);
        s.push([px - rx, py, 0, px - rx, py + band, 0], [px + rx, py, 0, px + rx, py + band, 0]);
        arc(s, px, py + band, rx, ry, 0, Math.PI, 12);
        if (accent) dots.push([px, py - ry - G * 0.16, G * 0.06, C.warm]);
      };
      cyl(x, y, true);
      const n = ri(2, 3);
      for (let k = 0; k < n; k++) {
        const px = x + (k - (n - 1) / 2) * G * 1.35, py = y + G * 1.3;
        cyl(px, py, false);
        arrow(s, x, y + band + ry + G * 0.1, px, py - ry - G * 0.1);
      }
      return { segs: s, dots, col: C.line, lw: 1.05, bright: true };
    });

    // 11 · bloque de código
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const lines = ri(4, 9), lh = G * 0.34, ww = G * rnd(2.4, 4.4);
      brace(s, x, y, lines * lh, 1);
      brace(s, x + ww, y, lines * lh, -1);
      for (let k = 0; k < lines; k++) {
        const ind = (k === 0 || k === lines - 1) ? 0 : ri(1, 3);
        const lx = x + G * 0.38 + ind * G * 0.26;
        const lw2 = Math.max(G * 0.3, (ww - G * 0.7 - ind * G * 0.26) * rnd(0.4, 1));
        s.push([lx, y + k * lh + lh * 0.5, 0, lx + G * 0.2, y + k * lh + lh * 0.5, 0]);
        row(s, lx + G * 0.3, y + k * lh + lh * 0.5, lw2, G * 0.14);
      }
      dots.push([x + G * 0.38, y + lh * (ri(1, lines - 1) + 0.5), G * 0.05, C.warm]);
      return { segs: s, dots, col: C.paper, lw: 1, bright: true };
    });

    // 12 · árbol JSON / config
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const rows = ri(3, 7), lh = G * 0.32;
      s.push([x, y, 0, x + G * 0.14, y, 0], [x, y, 0, x, y + rows * lh, 0], [x, y + rows * lh, 0, x + G * 0.14, y + rows * lh, 0]);
      for (let k = 0; k < rows; k++) {
        const ind = ri(0, 2), lx = x + G * 0.34 + ind * G * 0.24, ly = y + (k + 0.5) * lh;
        row(s, lx, ly, G * rnd(0.3, 0.7), G * 0.14);
        dots.push([lx + G * 0.8, ly, G * 0.035, C.line]);
        row(s, lx + G * 0.95, ly, G * rnd(0.25, 0.8), G * 0.14);
      }
      return { segs: s, dots, col: C.line, lw: 0.95 };
    });

    // 13 · firma de función
    glyphs.push((x, y) => {
      const s = [];
      row(s, x, y, G * rnd(0.4, 0.9), G * 0.16);
      const px = x + G * 1.05;
      arc(s, px + G * 0.1, y, G * 0.12, G * 0.2, Math.PI * 0.55, Math.PI * 1.45, 6);
      const pw = G * rnd(0.5, 1.2);
      row(s, px + G * 0.22, y, pw, G * 0.14);
      arc(s, px + G * 0.32 + pw, y, G * 0.12, G * 0.2, -Math.PI * 0.45, Math.PI * 0.45, 6);
      arrow(s, px + G * 0.55 + pw, y, px + G * 1.05 + pw, y);
      row(s, px + G * 1.2 + pw, y, G * rnd(0.3, 0.6), G * 0.14);
      return { segs: s, dots: [], col: C.paper, lw: 1, bright: true };
    });

    // 14 · condicional
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const rx = G * rnd(0.45, 0.8), ry = rx * 0.62;
      s.push([x, y - ry, 0, x + rx, y, 0], [x + rx, y, 0, x, y + ry, 0], [x, y + ry, 0, x - rx, y, 0], [x - rx, y, 0, x, y - ry, 0]);
      row(s, x - rx * 0.45, y, rx * 0.9, G * 0.13);
      arrow(s, x + rx, y, x + rx + G * 0.7, y);
      arrow(s, x, y + ry, x, y + ry + G * 0.7);
      dots.push([x + rx + G * 0.85, y, G * 0.05, C.blue]);
      dots.push([x, y + ry + G * 0.85, G * 0.05, C.warm]);
      return { segs: s, dots, col: C.line, lw: 1.05, bright: true };
    });

    // 15 · endpoint
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const hh = G * 0.34, mw = G * rnd(0.35, 0.6), ww = G * rnd(2, 3.6);
      rect(s, x, y, x + ww, y + hh);
      s.push([x + mw, y, 0, x + mw, y + hh, 0]);
      row(s, x + G * 0.07, y + hh * 0.55, mw - G * 0.14, G * 0.12);
      row(s, x + mw + G * 0.12, y + hh * 0.55, ww - mw - G * 0.24, G * 0.14);
      dots.push([x + ww + G * 0.22, y + hh * 0.5, G * 0.05, Math.random() < 0.5 ? C.blue : C.warm]);
      return { segs: s, dots, col: C.line, lw: 1 };
    });

    // 16 · pipeline
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const n = ri(3, 5), bw = G * 0.5, gap = G * 0.42;
      for (let k = 0; k < n; k++) {
        const bx = x + k * (bw + gap);
        rect(s, bx, y, bx + bw, y + bw * 0.62);
        row(s, bx + G * 0.08, y + bw * 0.34, bw - G * 0.16, G * 0.12);
        if (k < n - 1) arrow(s, bx + bw, y + bw * 0.31, bx + bw + gap, y + bw * 0.31);
      }
      dots.push([x + (n - 1) * (bw + gap) + bw * 0.5, y - G * 0.18, G * 0.05, C.warm]);
      return { segs: s, dots, col: C.line, lw: 1, bright: true };
    });

    // 17 · par de tags
    glyphs.push((x, y) => {
      const s = [], k = G * 0.26;
      s.push([x + k, y - k, 0, x, y, 0], [x, y, 0, x + k, y + k, 0]);
      s.push([x + k * 1.5, y + k, 0, x + k * 2.6, y - k, 0]);
      s.push([x + k * 3.1, y - k, 0, x + k * 4.1, y, 0], [x + k * 4.1, y, 0, x + k * 3.1, y + k, 0]);
      return { segs: s, dots: [], col: C.paper, lw: 1.2, bright: true };
    });

    // 18 · hunk de diff
    glyphs.push((x, y) => {
      const s = [], dots = [];
      const rows = ri(3, 7), lh = G * 0.28;
      for (let k = 0; k < rows; k++) {
        const ly = y + k * lh, kind = Math.random();
        const m = G * 0.1;
        s.push([x, ly, 0, x + m, ly, 0]);
        if (kind < 0.4) s.push([x + m * 0.5, ly - m * 0.5, 0, x + m * 0.5, ly + m * 0.5, 0]);
        row(s, x + G * 0.24, ly, G * rnd(0.4, 1.6), G * 0.13);
        if (kind < 0.18) dots.push([x - G * 0.14, ly, G * 0.035, C.warm]);
      }
      return { segs: s, dots, col: C.line, lw: 0.95 };
    });

    const zones = ['L', 'R', 'T', 'B', 'L', 'R', 'C'];
    const place = (s) => {
      if (s === 'L') return { x: snap(-rnd(0.45, 1.35) * W), y: snap(rnd(-1.1, 1.1) * H) };
      if (s === 'R') return { x: snap(rnd(0.45, 1.35) * W), y: snap(rnd(-1.1, 1.1) * H) };
      if (s === 'T') return { x: snap(rnd(-1.2, 1.2) * W), y: snap(-rnd(0.5, 1.25) * H) };
      if (s === 'B') return { x: snap(rnd(-1.2, 1.2) * W), y: snap(rnd(0.5, 1.25) * H) };
      return { x: snap(rnd(-0.3, 0.3) * W), y: snap(rnd(-0.3, 0.3) * H) };
    };

    // la base de datos es el glifo protagonista; el resto acompaña
    const weights = [5, 2, 2, 2, 2, 2, 1, 1, 1, 3, 4, 3, 3, 2, 2, 2, 2, 2];
    const bag = [];
    weights.forEach((n, i) => { for (let k = 0; k < n; k++) bag.push(i); });
    for (let i = 0; i < Math.round(62 * d); i++) {
      const p = place(zones[Math.floor(Math.random() * zones.length)]);
      push(glyphs[bag[Math.floor(Math.random() * bag.length)]](p.x, p.y));
    }

    // rieles de profundidad — son los que transmiten el movimiento
    for (let i = 0; i < Math.round(150 * d); i++) {
      const p = place(zones[Math.floor(Math.random() * zones.length)]);
      const len = rnd(300, 2200);
      push({ segs: [[p.x, p.y, 0, p.x, p.y, len]], col: C.line, lw: rnd(0.4, 0.9), maxRel: len });
    }

    // marcas de grilla
    for (let i = 0; i < Math.round(70 * d); i++) {
      const p = place(zones[Math.floor(Math.random() * zones.length)]);
      const l = G * rnd(0.3, 1.1);
      const vert = Math.random() < 0.5;
      push({
        segs: [vert ? [p.x, p.y - l, 0, p.x, p.y + l, 0] : [p.x - l, p.y, 0, p.x + l, p.y, 0]],
        col: C.line, lw: rnd(0.5, 1)
      });
    }

    // paquetes viajando por el túnel
    for (let i = 0; i < Math.round(26 * d); i++) {
      const p = place(zones[Math.floor(Math.random() * zones.length)]);
      push({ segs: [], dots: [[p.x, p.y, G * rnd(0.05, 0.1), Math.random() < 0.55 ? C.blue : C.warm]], col: C.blue, bright: true });
    }

    items = out;
  }

  // ------------------------------------------------------------------ dibujo
  function draw(t) {
    const glow = Math.max(0, Math.min(1.6, opts.glow));

    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    bg.addColorStop(0, '#0a1522');
    bg.addColorStop(0.34, '#050d16');
    bg.addColorStop(0.72, '#03070d');
    bg.addColorStop(1, '#020407');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const camx = Math.sin(t * 0.11) * 110, camy = Math.cos(t * 0.08) * 78;
    const roll = Math.sin(t * 0.05) * 0.035;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const cx = w / 2, cy = h / 2;

    const pr = (x, y, z) => {
      if (z <= NEAR) return null;
      const X = x - camx, Y = y - camy;
      const k = f / z;
      return [cx + (X * cr - Y * sr) * k, cy + (X * sr + Y * cr) * k];
    };

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    for (const it of items) {
      const zf = it.z;
      let a = 1;
      if (zf > FAR - 2400) a = Math.max(0, (FAR - zf) / 2400);
      if (zf < NEAR + 380) a *= Math.max(0, (zf - NEAR) / 380);
      if (a <= 0.012) continue;
      const scale = f / Math.max(NEAR, zf);
      a *= Math.max(0.14, Math.min(1, 1.38 - scale * 0.5));
      const base = a * (it.bright ? 0.9 : 0.52);

      if (it.segs.length) {
        if (glow > 0.05 && it.bright) {
          ctx.strokeStyle = 'rgba(' + it.col + ',' + (base * 0.1 * glow).toFixed(3) + ')';
          ctx.lineWidth = Math.max(1.2, it.lw * scale * 4);
          ctx.beginPath();
          for (const s of it.segs) {
            const p1 = pr(s[0], s[1], it.z + s[2]), p2 = pr(s[3], s[4], it.z + s[5]);
            if (p1 && p2) { ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); }
          }
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(' + it.col + ',' + base.toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.65, Math.min(2.4, it.lw * scale * 1.15));
        ctx.beginPath();
        for (const s of it.segs) {
          const p1 = pr(s[0], s[1], it.z + s[2]), p2 = pr(s[3], s[4], it.z + s[5]);
          if (!p1 || !p2) continue;
          if (Math.abs(p1[0] - p2[0]) > w * 4 || Math.abs(p1[1] - p2[1]) > h * 4) continue;
          ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
        }
        ctx.stroke();
      }

      for (const dd of it.dots) {
        const p = pr(dd[0], dd[1], it.z);
        if (!p) continue;
        const r = Math.max(0.6, dd[2] * scale);
        ctx.fillStyle = 'rgba(' + dd[3] + ',' + (a * 0.85).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fill();
        if (glow > 0.05) {
          const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 7);
          g.addColorStop(0, 'rgba(' + dd[3] + ',' + (a * 0.2 * glow).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + dd[3] + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p[0], p[1], r * 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // -------------------------------------------------------------------- loop
  const reduced = opts.respectReducedMotion
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const budget = 1000 / Math.max(10, opts.fps);

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (paused) { last = now; return; }
    if (now - last < budget) return;

    const rct = canvas.getBoundingClientRect();
    if (rct.width > 1 && (Math.abs(rct.width - w) > 1 || Math.abs(rct.height - h) > 1)) resize();

    const dt = Math.min(64, now - last) / 1000;
    last = now;
    const t = (now - t0) / 1000;
    const spd = opts.speed * (reduced ? 110 : 540) * (1 + 0.14 * Math.sin(t * 0.4));
    for (const it of items) {
      it.z -= spd * dt;
      if (it.z + it.maxRel < NEAR) it.z = FAR + Math.random() * 400;
    }
    draw(t);
  }

  // ------------------------------------------------------------ observadores
  resize();
  build();

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas.parentElement || canvas);

  const io = new IntersectionObserver((e) => { paused = !e[0].isIntersecting; }, { threshold: 0 });
  io.observe(canvas.parentElement || canvas);

  const onVis = () => { if (opts.pauseWhenHidden) paused = document.hidden; };
  document.addEventListener('visibilitychange', onVis);

  raf = requestAnimationFrame(frame);

  return {
    /** Cambia opciones en caliente. density/palette reconstruyen la escena. */
    setOptions(next = {}) {
      const rebuild = ('density' in next && next.density !== opts.density)
        || ('palette' in next && next.palette !== opts.palette);
      Object.assign(opts, next);
      if (rebuild) build();
    },
    pause() { paused = true; },
    resume() { paused = false; last = performance.now(); },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      items = [];
    }
  };
}

export default createTunnelBackground;
