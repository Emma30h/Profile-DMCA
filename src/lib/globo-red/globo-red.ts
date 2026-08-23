import * as THREE from "three";
import { llToVec, landPoints, scatter, CITIES, LINKS, arcCurve } from "./globe-network";

// Globo terráqueo de puntos con una red animada, puramente decorativo: gira
// solo (sin arrastrar/zoom) y no reacciona a clicks — a propósito no se
// importa OrbitControls acá para no sumar ese peso al bundle.

export interface GloboRedColors {
  oceano?: string;
  tierra?: string;
  red?: string;
  nodo?: string;
  resplandor?: string;
}

export interface GloboRedOptions {
  background?: string;
  spinSpeed?: number;
  tilt?: number;
  startRotation?: number;
  zoom?: number;
  colors?: GloboRedColors;
  nodes?: [string, number, number][];
  links?: [number, number][];
}

export interface GloboRedInstance {
  pause: () => void;
  resume: () => void;
  dispose: () => void;
}

export function mountGloboRed(container: HTMLElement, opts: GloboRedOptions = {}): GloboRedInstance {
  const {
    background = "transparent",
    spinSpeed = 0.055,
    tilt = -0.24,
    startRotation = 2.05,
    zoom = 1,
    colors = {},
    nodes = CITIES,
    links = LINKS,
  } = opts;

  const C = {
    oceano: "#20303f", tierra: "#e6ebef", red: "#5980a6", nodo: "#9fc0dd",
    resplandor: "#2d4c6b", ...colors,
  };
  const R = 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: background === "transparent" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (background !== "transparent") scene.background = new THREE.Color(background);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 1.0, 3.15 / zoom);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  const mats = {
    oceano: new THREE.MeshStandardMaterial({ color: C.oceano, roughness: 0.72, metalness: 0.15 }),
    tierra: new THREE.MeshStandardMaterial({ color: C.tierra, roughness: 0.45, metalness: 0.1 }),
    red: new THREE.MeshStandardMaterial({ color: C.red, roughness: 0.35, metalness: 0.25, emissive: C.resplandor, emissiveIntensity: 0.5 }),
    nodo: new THREE.MeshStandardMaterial({ color: C.nodo, roughness: 0.25, metalness: 0.2, emissive: C.red, emissiveIntensity: 0.9 }),
  };

  const model = new THREE.Group();
  model.rotation.z = tilt;
  const spin = new THREE.Group();
  spin.rotation.y = startRotation;
  model.add(spin);
  scene.add(model);

  const oceano = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), mats.oceano);
  spin.add(oceano);

  const ecuador = new THREE.Mesh(new THREE.TorusGeometry(R * 1.001, 0.0022, 8, 220), mats.red);
  ecuador.rotation.x = Math.PI / 2;
  spin.add(ecuador);

  const bead = new THREE.SphereGeometry(0.0088, 8, 6);
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const beadMats = landPoints(2.3).map(([lat, lon]) => {
    const p = llToVec(lat, lon, R + 0.006);
    q.setFromUnitVectors(up, p.clone().normalize());
    return new THREE.Matrix4().compose(p, q, one);
  });
  const puntos = new THREE.Mesh(scatter(bead, beadMats), mats.tierra);
  spin.add(puntos);

  const nodeGeo = new THREE.SphereGeometry(0.016, 16, 12);
  const nodePos = nodes.map(([, lat, lon]) => {
    const p = llToVec(lat, lon, R + 0.012);
    const m = new THREE.Mesh(nodeGeo, mats.nodo);
    m.position.copy(p);
    spin.add(m);
    return p;
  });

  const arcs = new THREE.Group();
  const pulses: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; t: number; speed: number; gap: number; wait: number }[] = [];
  const pulseGeo = new THREE.SphereGeometry(0.019, 14, 10);
  links.forEach(([a, b]) => {
    if (!nodePos[a] || !nodePos[b]) return;
    const curve = arcCurve(nodePos[a], nodePos[b]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.0033, 6, false), mats.red);
    arcs.add(tube);
    const p = new THREE.Mesh(pulseGeo, mats.nodo);
    arcs.add(p);
    pulses.push({ mesh: p, curve, t: Math.random(), speed: 0.16 + Math.random() * 0.22, gap: 0.5 + Math.random() * 1.4, wait: Math.random() * 2 });
  });
  spin.add(arcs);

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let raf = 0;
  let last = performance.now();
  let running = true;
  function tick(now: number) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    spin.rotation.y += spinSpeed * dt;
    for (const p of pulses) {
      if (p.wait > 0) { p.wait -= dt; p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      p.t += p.speed * dt;
      if (p.t >= 1) { p.t = 0; p.wait = p.gap; }
      p.mesh.position.copy(p.curve.getPoint(p.t));
      p.mesh.scale.setScalar(0.55 + Math.sin(p.t * Math.PI) * 0.9);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  // Pausa cuando el contenedor no está visible (ahorra batería/GPU).
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) resume(); else pause(); });
  io.observe(container);
  function pause() { if (running) { running = false; cancelAnimationFrame(raf); } }
  function resume() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); } }

  return {
    pause,
    resume,
    dispose() {
      pause();
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      Object.values(mats).forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
