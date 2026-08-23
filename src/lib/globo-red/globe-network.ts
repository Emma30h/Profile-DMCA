import * as THREE from "three";

// Geometría procedural del globo: continentes muestreados como puntos,
// ciudades y enlaces de red. Sin assets externos (todo se calcula acá).

const D = Math.PI / 180;
const R = 1.0;

export function llToVec(lat: number, lon: number, r: number = R): THREE.Vector3 {
  const p = (90 - lat) * D;
  const t = (lon + 180) * D;
  return new THREE.Vector3(
    -r * Math.sin(p) * Math.cos(t),
    r * Math.cos(p),
    r * Math.sin(p) * Math.sin(t),
  );
}

// Contornos continentales aproximados, pares [lon, lat]. Alcanza para leerse
// como La Tierra a resolución de puntos; no es un relevamiento preciso.
const LAND: [number, number][][] = [
  // Africa
  [[-17,15],[-16,21],[-13,27],[-9,31],[-6,35],[0,36],[10,34],[20,32],[25,32],[32,31],[35,28],[39,15],[43,11],[51,12],[48,5],[41,-1],[40,-10],[35,-20],[32,-26],[28,-33],[20,-35],[15,-28],[12,-18],[13,-9],[9,-1],[5,4],[-4,5],[-8,4],[-13,9]],
  // Eurasia
  [[-9,39],[-9,43],[-2,44],[0,49],[4,52],[8,54],[12,55],[10,58],[5,60],[10,64],[18,69],[28,71],[40,68],[60,70],[75,73],[90,75],[105,77],[120,73],[135,72],[150,70],[170,68],[180,66],[178,64],[170,60],[163,58],[156,50],[140,54],[135,44],[130,42],[126,38],[122,31],[110,21],[105,10],[100,8],[97,16],[92,21],[88,22],[84,18],[80,13],[78,8],[73,18],[70,22],[66,25],[60,25],[57,22],[52,17],[45,13],[43,15],[38,22],[35,28],[34,31],[36,36],[30,37],[27,40],[24,38],[20,40],[13,45],[12,44],[8,44],[3,42],[0,40],[-6,36]],
  // North America
  [[-168,66],[-166,60],[-165,55],[-153,58],[-145,60],[-135,58],[-130,52],[-124,46],[-122,37],[-117,32],[-114,30],[-110,24],[-105,20],[-95,16],[-92,15],[-87,13],[-83,9],[-79,9],[-83,15],[-88,21],[-92,19],[-95,19],[-97,26],[-93,29],[-89,29],[-84,30],[-82,26],[-81,31],[-76,35],[-74,40],[-70,43],[-66,45],[-60,47],[-56,51],[-64,60],[-70,63],[-80,68],[-95,68],[-110,68],[-125,70],[-140,70],[-155,71],[-165,68]],
  // South America
  [[-77,8],[-72,12],[-62,11],[-52,5],[-50,0],[-44,-2],[-38,-5],[-35,-8],[-39,-17],[-48,-25],[-53,-34],[-57,-38],[-62,-40],[-65,-45],[-68,-52],[-75,-52],[-73,-45],[-75,-37],[-71,-30],[-70,-20],[-75,-15],[-81,-6],[-80,-2],[-78,2]],
  // Australia
  [[113,-22],[114,-26],[116,-32],[123,-34],[130,-32],[137,-35],[141,-38],[146,-39],[150,-37],[153,-30],[153,-25],[146,-19],[142,-11],[136,-12],[130,-11],[125,-14],[122,-18]],
  // Greenland
  [[-45,60],[-50,64],[-53,68],[-58,72],[-55,76],[-45,82],[-30,83],[-22,76],[-25,70],[-38,65]],
  // Madagascar
  [[43,-12],[50,-15],[50,-25],[45,-25],[43,-19]],
  // Japan
  [[130,32],[132,34],[136,35],[140,36],[142,40],[145,44],[141,45],[139,41],[136,37],[133,34]],
  // Britain & Ireland
  [[-6,50],[-2,51],[0,53],[-2,58],[-5,58],[-6,55],[-10,54],[-10,51]],
  // New Guinea
  [[131,-1],[141,-2],[147,-6],[150,-10],[143,-9],[137,-8],[132,-5]],
  // Borneo
  [[109,2],[117,7],[119,1],[116,-4],[110,-3]],
  // Sumatra
  [[95,5],[99,3],[106,-6],[103,-5],[97,0]],
  // Java
  [[105,-6],[114,-7],[114,-9],[106,-8]],
  // Sulawesi + Philippines (blocks)
  [[119,1],[125,1],[125,-5],[120,-5]],
  [[120,6],[126,8],[126,14],[121,18],[119,14]],
  // New Zealand
  [[173,-35],[178,-38],[177,-41],[172,-41]],
  [[168,-44],[174,-41],[171,-46],[166,-46]],
  // Iceland
  [[-24,65],[-14,65],[-15,67],[-22,67]],
  // Cuba / Hispaniola
  [[-85,22],[-76,20],[-74,20],[-80,23]],
  [[-72,18],[-68,18],[-68,20],[-72,20]],
  // Sri Lanka
  [[80,6],[82,7],[81,9],[80,9]],
  // Tasmania
  [[145,-41],[148,-41],[147,-43],[145,-43]],
  // Svalbard
  [[13,77],[24,78],[20,80],[12,79]],
];

const HOLES: [number, number][][] = [
  [[-95,51],[-78,52],[-78,63],[-95,64]],        // Hudson Bay
  [[28,41],[41,41],[41,46],[28,46]],            // Black Sea
  [[47,37],[54,38],[54,47],[47,46]],            // Caspian
  [[30,-2],[34,-2],[34,-8],[30,-8]],            // Lago Victoria/Tanganyika
  [[12,54],[22,55],[22,60],[12,60]],            // Báltico
];

function inPoly(lon: number, lat: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function isLand(lat: number, lon: number): boolean {
  if (lat < -63) return lat > -85; // Casquete antártico
  for (const h of HOLES) if (inPoly(lon, lat, h)) return false;
  for (const p of LAND) if (inPoly(lon, lat, p)) return true;
  return false;
}

/** Muestreo aproximadamente equiareal de celdas de tierra. */
export function landPoints(stepDeg: number = 2.4): [number, number][] {
  const out: [number, number][] = [];
  for (let lat = -86; lat <= 84; lat += stepDeg) {
    const c = Math.max(Math.cos(lat * D), 0.08);
    const lonStep = stepDeg / c;
    for (let lon = -180; lon < 180; lon += lonStep) {
      if (isLand(lat, lon)) out.push([lat, lon]);
    }
  }
  return out;
}

/** Fusiona muchas copias transformadas de una geometría en una sola. */
export function scatter(base: THREE.BufferGeometry, matrices: THREE.Matrix4[]): THREE.BufferGeometry {
  const src = base.index ? base.toNonIndexed() : base;
  const sp = src.attributes.position.array as Float32Array;
  const sn = src.attributes.normal.array as Float32Array;
  const n = sp.length;
  const pos = new Float32Array(n * matrices.length);
  const nor = new Float32Array(n * matrices.length);
  const v = new THREE.Vector3();
  const nv = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  matrices.forEach((m, k) => {
    nm.getNormalMatrix(m);
    const o = k * n;
    for (let i = 0; i < n; i += 3) {
      v.set(sp[i], sp[i + 1], sp[i + 2]).applyMatrix4(m);
      nv.set(sn[i], sn[i + 1], sn[i + 2]).applyMatrix3(nm).normalize();
      pos[o + i] = v.x; pos[o + i + 1] = v.y; pos[o + i + 2] = v.z;
      nor[o + i] = nv.x; nor[o + i + 1] = nv.y; nor[o + i + 2] = nv.z;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return g;
}

export const CITIES: [string, number, number][] = [
  ["Nueva York", 40.7, -74.0], ["Londres", 51.5, -0.1], ["San Francisco", 37.8, -122.4],
  ["Sao Paulo", -23.5, -46.6], ["Lagos", 6.5, 3.4], ["El Cairo", 30.0, 31.2],
  ["Johannesburgo", -26.2, 28.0], ["Moscu", 55.7, 37.6], ["Delhi", 28.6, 77.2],
  ["Singapur", 1.3, 103.8], ["Tokio", 35.7, 139.7], ["Sidney", -33.9, 151.2],
  ["Ciudad de Mexico", 19.4, -99.1], ["Dubai", 25.2, 55.3], ["Shanghai", 31.2, 121.5],
];

export const LINKS: [number, number][] = [
  [0,1],[0,2],[0,12],[0,3],[1,5],[1,7],[1,4],[4,6],[5,8],[7,8],[8,9],[9,10],
  [9,11],[10,14],[14,8],[2,10],[2,12],[3,4],[6,11],[13,8],[13,1],[12,3],[11,9],[14,7],
];

export function arcCurve(a: THREE.Vector3, b: THREE.Vector3, lift: number = 0.3): THREE.QuadraticBezierCurve3 {
  const mid = a.clone().add(b).normalize();
  const gap = a.distanceTo(b);
  mid.multiplyScalar(R + gap * lift);
  return new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
}
