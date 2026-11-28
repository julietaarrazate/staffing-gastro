// «Falta uno», la toma entera (68 s). Un solo mundo y una sola cámara que viaja; cada momento es función del tiempo t.
// Los textos salen del guion privado (trabajo/entrada/guion.json).
import * as THREE from 'three';
import { lerp, sat, smooth, smoother, easeOut, easeIn, deriva, kelvin, curva, ruta, rebote } from './util.js';
import { crearCocina, crearAzotea, TECHO, LOSA, PISO } from './cocina.js';
import { crearCiudad, crearCielo, crearNubes } from './ciudad.js';
import { crearPila, GOLPES, vaivenX, vaivenZ, crece, ROOF } from './pila.js';
import { crearSalon, FACHADA } from './salon.js';
import { crearEnfrente, crearTalonario, crearHoja, crearSello, crearConfeti, crearFlechas, crearBici, crearCopas, ENFRENTE } from './objetos.js';

export const DURACION = 68;
export const camY3 = (...a) => p3.y(...a); // la altura de la cámara en la escena 3 (para el viento)
const T3 = 10; // la escena 3 empieza a los 10 s
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- la cámara de la escena 3 (la pila): la misma de la escena terminada ----------
const p3 = {
  y: curva([[0, 0.2], [0.55, 0.19], [2.2, 0.177], [3.55, 0.168], [4.65, 0.162], [5.55, 0.157], [6.6, 0.152], [7.3, 0.16], [7.7, 0.19], [7.95, 0.48], [8.08, 1.3], [8.2, 2.3], [8.32, 2.88], [8.42, 3.3], [8.5, 3.75], [8.64, 5.6], [8.85, 10.5], [9.1, 18.5], [9.6, 25.4], [10.3, 27.6], [11.5, 60]]),
  d: curva([[0, 0.56], [0.55, 0.51], [2.2, 0.46], [3.55, 0.43], [4.65, 0.4], [5.55, 0.37], [7.3, 0.35], [7.7, 0.42], [7.95, 0.68], [8.2, 0.9], [8.6, 1.3], [9.3, 1.9], [10.3, 2.2]]),
  a: curva([[0, -0.42], [2.2, -0.24], [4.65, -0.02], [6.6, 0.15], [7.5, 0.22], [8.2, 0.5], [9.0, 0.88], [10.3, 1.08]]),
  p: curva([[0, -0.28], [2.2, -0.25], [4.65, -0.22], [5.55, -0.2], [6.6, -0.16], [7.3, -0.1], [7.9, 0.26], [8.17, 0.5], [8.45, 0.42], [8.95, 0.4], [9.35, 0.62], [9.75, 1.0], [10.1, 1.2], [10.3, 1.25]]),
  f: curva([[0, 36], [6.0, 36], [7.6, 41], [8.2, 53], [9.0, 56], [10.3, 62]]),
  r: curva([[0, 0], [7.9, 0], [8.2, -0.08], [8.8, 0.05], [9.4, 0.12], [10.3, 0.42]]),
};
const PALABRAS3 = [0.55, 2.2, 3.55, 4.65, 5.55];
function camPila(t) {
  let y = p3.y(t), dist = p3.d(t), ang = p3.a(t), pit = p3.p(t), fov = p3.f(t), rol = p3.r(t);
  const vuelo = smooth(7.8, 8.6, t), amp = lerp(0.0016, 0.05, vuelo);
  y += deriva(t, 1) * amp; ang += deriva(t * 0.8, 4) * lerp(0.006, 0.02, vuelo);
  pit += deriva(t * 1.1, 7) * lerp(0.004, 0.012, vuelo); rol += deriva(t * 0.9, 9) * lerp(0.003, 0.012, vuelo);
  for (let k = 0; k < 9; k++) { const dt = t - GOLPES[k]; if (dt > 0 && dt < 0.4) { y -= 0.0012 * Math.exp(-dt * 22) * Math.cos(dt * 70); pit += 0.004 * Math.exp(-dt * 20) * Math.sin(dt * 60); } }
  for (const T of PALABRAS3) { const u = t - T; if (u > 0) { dist -= 0.018 * smooth(0, 0.3, u); fov -= 1.6 * Math.exp(-u * 5) * smooth(0, 0.04, u); } }
  const hx = vaivenX(y, t) * 0.6, hz = vaivenZ(y, t) * 0.6;
  return { pos: V3(hx + Math.sin(ang) * dist, y, hz + Math.cos(ang) * dist), look: V3(hx * 1.4, y + Math.tan(pit) * dist, hz * 1.4), fov, roll: rol, yaw: 0.04 * (1 - smooth(6.6, 7.9, t)) };
}

// ---------- recorridos de las otras escenas: [t, x, y, z] para la cámara y para el punto que mira ----------
const pila0 = camPila(0), pila1 = camPila(10.3), pila1b = camPila(10.25);
const v1 = pila1.pos.clone().sub(pila1b.pos).multiplyScalar(1 / 0.05);
const R = {
  // 1 y 2: la calle, la puerta, el salón, el delantal, el celular, el pinche
  pos12: ruta([[0, -1.6, -0.25, 23.6], [1.6, -1.1, -0.05, 21.2], [3.0, -0.45, 0.2, 17.6], [4.1, -0.05, 0.38, 13.8], [4.65, 0.05, 0.45, 12.0], [5.4, 0.2, 0.55, 9.4], [6.3, 0.15, 0.7, 6.2], [7.2, -1.25, 0.92, 1.55], [8.0, -0.85, 0.42, 0.62], [8.6, -0.55, 0.24, 0.36], [9.25, -0.5, 0.23, 0.38], [9.65, -0.3, 0.21, 0.52], [10, pila0.pos.x, pila0.pos.y, pila0.pos.z]]),
  look12: ruta([[0, 0, 2.2, 12], [1.6, 0, 1.6, 12], [3.0, 0, 0.9, 12], [4.1, 0, 0.55, 10], [4.65, 0.1, 0.45, 7], [5.4, -0.2, 0.3, 5], [6.3, -1.2, 0.65, 2.2], [7.2, -2.0, 0.72, 0.46], [8.0, -0.6, 0.0, 0.22], [8.6, -0.46, 0.0, 0.17], [9.25, -0.45, 0.0, 0.16], [9.65, -0.05, 0.07, 0.02], [10, pila0.look.x, pila0.look.y, pila0.look.z]]),
  fov12: curva([[0, 44], [4.6, 46], [6.3, 42], [8.5, 38], [10, 36]]),
  // 4: sube entre las nubes, sale arriba, mira la punta y después el barrio
  pos4: ruta([[20.3, pila1.pos.x, pila1.pos.y, pila1.pos.z], [20.5, pila1.pos.x + v1.x * 0.2, pila1.pos.y + v1.y * 0.2, pila1.pos.z + v1.z * 0.2], [21.6, 14, 95, 22], [22.6, 30, 165, 40], [23.6, 48, 228, 62], [24.8, 60, 262, 80], [26, 66, 272, 88]]),
  look4: ruta([[20.3, pila1.look.x, pila1.look.y, pila1.look.z], [21.6, 10, 200, 10], [22.8, 12, 330, 8], [24.2, 10, 320, 4], [25.2, 30, 60, 40], [26, 40, 0, 50]]),
  // 5: picada por un hueco de las nubes hasta la ventana oscura de enfrente
  pos5: ruta([[26, 66, 272, 88], [27.1, 40, 150, 60], [28.1, 16, 40, 18], [28.9, 6.6, 12, 16.5], [29.6, 6.0, 7.1, 22.6], [30.15, 6.0, 6.7, 25.3], [30.7, 6.0, 6.45, 25.62], [32.4, 5.97, 6.3, 25.86], [33.1, 5.96, 6.17, 26.02]]),
  look5: ruta([[26, 40, 0, 50], [27.1, 20, 0, 30], [28.1, 7, 4, 26], [28.9, 6, 6.6, 26], [29.6, 6.0, 6.5, 26.4], [30.7, 5.95, 6.07, 26.12], [33.1, 5.95, 6.07, 26.12]]),
  // 6: el talonario bajo la lámpara
  pos6: ruta([[33.2, 0.52, 0.2, 0.34], [35.0, 0.5, 0.17, 0.3], [36.6, 0.48, 0.16, 0.29]]),
  look6: ruta([[33.2, 0.42, 0.01, 0.1], [36.6, 0.42, 0.012, 0.1]]),
  // la comanda que vuela: del pase, por el salón, sale por la puerta, recorre el barrio y vuelve a la puerta de enfrente
  hoja: ruta([[36.9, 0.42, 0.0125, 0.1], [37.4, 0.32, 0.55, 0.55], [38.0, 0.2, 1.55, 3.6], [38.6, 0.0, 1.45, 8.0], [39.0, 0.0, 1.2, 12.3], [39.45, 0.6, 3.6, 15.8], [40.2, 9, 20, 20], [41.0, 32, 44, 10], [42.0, 72, 58, -30], [43.0, 116, 62, -56], [44.0, 152, 58, -8], [45.0, 120, 50, 58], [45.8, 60, 34, 40], [46.5, 18, 12, 26], [47.0, 4.4, 1.6, 23.6], [47.45, 3.15, PISO + 0.17, 24.75]]),
  // 8: la puerta que se abre, la flecha y el viaje de vuelta hasta el pinche
  pos8: ruta([[47.0, 1.4, 0.2, 18.8], [47.8, 1.0, -0.42, 16.2], [49.8, 0.9, -0.45, 15.9], [51.2, 0.55, -0.3, 13.9], [52.0, 0.15, 0.15, 11.3], [52.6, 0.0, 0.35, 6.0], [53.1, 0.05, 0.3, 1.6], [53.6, 0.12, 0.38, 0.45]]),
  look8: ruta([[47.0, 3.2, 0.2, 24.8], [47.8, 3.0, 0.4, 25.3], [49.8, 2.4, -0.3, 22.0], [50.5, -3.5, -0.2, 16.5], [51.2, 0.0, 0.5, 12.0], [52.0, 0.0, 0.4, 6.0], [52.6, 0.0, 0.25, 1.5], [53.1, 0.0, 0.15, 0.0], [53.6, 0.0, 0.15, 0.0]]),
  // 9, 10 y 11: el sello, el salón de arriba, el techo y el cielo
  pos9: ruta([[53.6, 0.12, 0.38, 0.45], [54.3, 0.06, 0.52, 0.26], [54.9, 0.05, 0.47, 0.22], [55.6, 0.12, 0.5, 0.4], [57.0, 0.3, 0.55, 0.85], [57.8, 0.55, 0.62, 1.05], [58.6, -0.8, 1.4, 3.6], [59.4, -2.28, 1.9, 5.74], [62.8, -2.3, 1.95, 5.72], [63.5, -2.3, 3.6, 5.72], [64.4, -2.3, 9, 5.72], [66, -2.3, 30, 5.72], [68.5, -2.3, 42, 5.72]]),
  look9: ruta([[53.6, 0.0, 0.15, 0.0], [54.3, 0.0, 0.16, 0.0], [54.9, 0.0, 0.16, 0.0], [55.6, 0.0, 0.3, 0.0], [57.0, 0.4, 0.05, 0.1], [57.8, 0.6, 0.02, 0.25], [58.6, -1.8, -0.2, 5.0], [59.4, -2.3, -0.2, 5.7], [62.8, -2.3, -0.2, 5.7], [63.5, -2.3, 2, 5.7], [64.4, -2.3, 9, -20], [65.4, -2.3, 60, -60], [68.5, -2.3, 120, -70]]),
};
const UP_CENITAL = new THREE.Vector3(0, 0, -1);

export async function crearPieza(motor, guion) {
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(40, motor.W / motor.H, 0.01, 60);
  const pm = new THREE.PMREMGenerator(motor.renderer);
  const amb = (fondo, paneles, suelo) => { const s = new THREE.Scene(); s.background = fondo; for (const [w, h, col, x, y, z, ry, rx] of paneles) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); s.add(m); } if (suelo) { const m = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: suelo, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = -5; s.add(m); } return pm.fromScene(s, 0.03).texture; };
  const cal = (k, m) => new THREE.Color(...kelvin(k)).multiplyScalar(m);
  const ambCocina = amb(new THREE.Color(0.03, 0.024, 0.02), [[1.6, 0.25, cal(2200, 7), 0, 0.65, 0, 0, Math.PI / 2], [1.4, 0.06, cal(5400, 5), -0.9, 1.75, -2], [8, 0.3, cal(2500, 1.5), 0, 2.4, 3, 0, Math.PI / 2]], null);
  const ambNoche = amb(new THREE.Color(0.03, 0.05, 0.11), [], new THREE.Color(0.05, 0.05, 0.065));
  const ambTarde = amb(new THREE.Color(0.25, 0.3, 0.45), [[40, 8, new THREE.Color(1.2, 0.6, 0.3), 0, 3, -30]], new THREE.Color(0.12, 0.1, 0.09));
  const ambCuarto = amb(new THREE.Color(0.01, 0.012, 0.018), [[2, 1.5, new THREE.Color(0.08, 0.1, 0.16), 0, 1, -3]], null);

  const cocina = crearCocina(escena);
  crearAzotea(escena);
  const ciudad = crearCiudad(escena);
  const cielo = crearCielo(escena);
  const nubes = crearNubes(motor);
  const salon = crearSalon(escena, guion);
  const enfrente = crearEnfrente(escena, guion);
  const pila = crearPila(escena, camara);
  const talonario = crearTalonario(escena, guion);
  const hoja = crearHoja(escena, talonario.tx);
  const sello = await crearSello(escena);
  const confeti = crearConfeti(escena);
  const flechas = crearFlechas(escena);
  const bici = crearBici(escena);
  const copas = crearCopas(escena, V3(-2.3, PISO, 5.7));

  // la luz de la noche
  const luna = new THREE.DirectionalLight(new THREE.Color(...kelvin(9000)), 0); escena.add(luna, luna.target);
  luna.castShadow = true; luna.shadow.mapSize.set(2048, 2048); Object.assign(luna.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 140 }); luna.shadow.bias = -0.0004; luna.shadow.normalBias = 0.02; luna.shadow.radius = 3;
  const sol = new THREE.DirectionalLight(new THREE.Color(1.0, 0.55, 0.3), 0); sol.position.set(-20, 6, -40); escena.add(sol);
  const hemi = new THREE.HemisphereLight(0x34508c, 0x3e3c44, 0); escena.add(hemi);
  const luzHueco = new THREE.PointLight(new THREE.Color(...kelvin(2300)), 0, 9, 2); luzHueco.position.set(0, ROOF - 0.15, 0); escena.add(luzHueco);

  // el celular del pase: vibra con el mensaje; el de enfrente: dos llamadas sin respuesta (y el aviso del corte «Voy»)
  salon.tel.estados = [[8.15, 9.85, 'mensaje', 1.6]]; salon.tel.vibras.push(8.15, 8.75);
  enfrente.tel.estados = [[29.9, 31.15, 'llamada', 1.7], [31.55, 32.55, 'llamada', 1.7], [70.4, 74, 'aviso', 1.7]]; enfrente.tel.vibras.push(29.9, 30.4, 31.55, 32.05, 70.4);

  const est = { afuera: false, adentroBodegon: true, foco: 1, apertura: 0, cuarto: false };
  const enBodegon = p => Math.abs(p.x) < 4.33 && p.z > -18 && p.z < FACHADA && p.y < ROOF;
  const enCuarto = p => p.x > 3.9 && p.x < 8.1 && p.z > ENFRENTE.z - 0.05 && p.z < ENFRENTE.z + 4.1 && p.y > enfrente.pisoSala && p.y < enfrente.pisoSala + 2.9;

  function ponerCamara(t) {
    let pos, look, fov = 50, roll = 0, yaw = 0, up = null;
    if (t < T3) { const a = R.pos12(t), b = R.look12(t); pos = V3(...a); look = V3(...b); fov = R.fov12(t); roll = deriva(t * 0.6, 3) * 0.008; }
    else if (t < 20.3) { const c = camPila(t - T3); pos = c.pos; look = c.look; fov = c.fov; roll = c.roll; yaw = c.yaw; }
    else if (t < 26) { pos = V3(...R.pos4(t)); look = V3(...R.look4(t)); fov = lerp(62, 50, smooth(20.3, 23.5, t)); roll = lerp(0.42, 0, smooth(20.3, 22.5, t)) + deriva(t, 2) * 0.02; }
    else if (t < 33.2) { pos = V3(...R.pos5(t)); look = V3(...R.look5(t)); fov = lerp(50, 40, smooth(28.5, 30.5, t)); roll = lerp(0, -0.35, smooth(26.3, 27.6, t)) * (1 - smooth(28.2, 29.5, t)) + deriva(t, 5) * 0.01; }
    else if (t < 36.9) { pos = V3(...R.pos6(t)); look = V3(...R.look6(t)); fov = 38; roll = deriva(t * 0.7, 6) * 0.01; }
    else if (t < 47.0) {
      const h = V3(...R.hoja(t)), h2 = V3(...R.hoja(t + 0.12)), dir = h2.clone().sub(h); if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1); dir.normalize();
      const atras = lerp(0.7, 6.5, smooth(39.0, 40.5, t)) * (1 - 0.6 * smooth(46.0, 47, t)), arriba = lerp(0.18, 3.2, smooth(39.0, 40.5, t));
      pos = h.clone().addScaledVector(dir, -atras); pos.y += arriba; look = h.clone().addScaledVector(dir, 0.6);
      fov = lerp(44, 58, smooth(39, 40.5, t)); roll = -dir.x * 0.25 * smooth(39.5, 41, t) + deriva(t, 8) * 0.02;
      // al final se acomoda para mirar la puerta de enfrente
      const fin = smooth(46.2, 47.0, t); pos.lerp(V3(...R.pos8(47.0)), fin); look.lerp(V3(...R.look8(47.0)), fin); fov = lerp(fov, 44, fin);
    }
    else if (t < 53.6) { pos = V3(...R.pos8(t)); look = V3(...R.look8(t)); fov = lerp(44, 40, smooth(51, 53.4, t)); roll = deriva(t * 0.8, 9) * 0.01; }
    else if (t >= 69.5) { const u = smooth(69.5, 73.6, t); pos = V3(5.975, lerp(6.34, 6.24, u), lerp(25.84, 25.95, u)); look = V3(5.95, 6.07, 26.12); fov = 40; roll = deriva(t * 0.6, 12) * 0.008; }
    else { pos = V3(...R.pos9(t)); look = V3(...R.look9(t)); fov = lerp(40, 50, smooth(57, 59.4, t)); fov = lerp(fov, 60, smooth(63, 65, t)); const cen = smooth(58.4, 59.4, t) * (1 - smooth(62.9, 64.2, t)); up = V3(0, 1 - cen, -cen).normalize(); roll = smooth(59.4, 62.8, t) * 0.25 * (1 - smooth(62.9, 64.2, t)); }
    // empujones de cámara en los golpes fuertes
    for (const [T0, a] of [[54.6, 0.006], [8.15, 0.0015], [8.75, 0.0015]]) { const u = t - T0; if (u > 0 && u < 0.5) pos.y -= a * Math.exp(-u * 14) * Math.cos(u * 60); }
    camara.position.copy(pos); camara.up.copy(up || V3(0, 1, 0)); camara.lookAt(look); if (yaw) camara.rotateY(yaw); camara.rotateZ(roll);
    camara.fov = fov;
    const afuera = !enBodegon(pos) && !enCuarto(pos) && !(t >= 33.2 && t < 36.9);
    est.afuera = afuera; est.cuarto = enCuarto(pos); est.adentroBodegon = enBodegon(pos);
    camara.near = pos.y > 40 ? 0.5 : afuera ? 0.05 : 0.01; camara.far = afuera ? 25000 : 80;
    camara.updateProjectionMatrix(); camara.updateMatrixWorld();
  }

  // la profundidad de campo: a qué mira cada momento
  const focoEn = t => {
    if (t < 4.6) return [V3(0, 0.8, 12.2), 2.5];
    if (t < 10) return [t < 7.8 ? V3(-2.0, 0.75, 0.46) : t < 9.4 ? V3(-0.46, 0.01, 0.17) : V3(0, 0.06, 0), lerp(4, 9, smooth(5, 6.5, t))];
    if (t < 20.3) return [V3(0, Math.max(pila.estado.tope, 0.04), 0), lerp(10, 0, smooth(T3 + 7.35, T3 + 7.9, t))];
    if (t < 29.8) return [V3(0, 0, 0), 0];
    if (t < 33.2) return [V3(5.95, 6.07, 26.12), 11];
    if (t < 36.9) return [V3(0.42, 0.012, 0.1), 12];
    if (t < 47.0) return [V3(...R.hoja(t)), lerp(6, 0, smooth(38.8, 39.6, t))];
    if (t < 53.6) return [t < 51 ? V3(3.0, 0.2, 24.8) : V3(0, 0.3, 12), lerp(3, 6, smooth(51.5, 53.4, t))];
    if (t < 57.2) return [V3(0, 0.16, 0), 10];
    if (t < 63) return [t < 58.6 ? V3(0.6, 0.02, 0.4) : V3(-2.3, -0.17, 5.7), t < 58.6 ? 7 : 4];
    if (t >= 69.5) return [V3(5.95, 6.07, 26.12), 11];
    return [V3(0, 0, 0), 0];
  };

  const tarde = t => 1 - smooth(4.8, 16, t);
  const luces = []; escena.traverse(o => { if (o.isLight) luces.push(o); });
  return {
    escena, camara, estado: est,
    poner(t) {
      ponerCamara(t);
      const tl = t - T3;
      pila.poner(tl);
      cocina.poner(t, motor.H);
      salon.poner(t, { adentro: smooth(0.7, 1.5, t) * 0.75 + 0.25, calle: smooth(1.2, 2.2, t) * 0.8 + 0.2 });
      // la escena 5: el cuarto; la 8: la puerta que se abre y la persona que cruza
      enfrente.poner(t, { puerta: smooth(47.4, 48.3, t), sale: sat((t - 48.2) / 1.3), paso: sat((t - 50.0) / 2.6) });
      // el talonario: escribe, se arranca y la hoja vuela
      const prog = sat((t - 33.7) / 2.7);
      talonario.poner(t, { prog, escribe: t > 33.6 && t < 36.4, visible: t > 32.8 && t < 40 });
      talonario.hoja.visible = t < 36.9;
      const hv = t >= 36.9 && t < 49.5; hoja.malla.visible = hv;
      if (hv) {
        const p = V3(...R.hoja(Math.min(t, 47.45))), p2 = V3(...R.hoja(Math.min(t + 0.1, 47.46))), dir = p2.sub(p);
        hoja.malla.position.copy(p); const vuela = sat((t - 36.9) / 0.4) * (1 - smooth(47.3, 47.5, t));
        hoja.malla.rotation.set(Math.sin(t * 3.1) * 0.6 * vuela, Math.atan2(dir.x, dir.z) + Math.sin(t * 1.7) * 0.4 * vuela, Math.sin(t * 2.3 + 1) * 0.7 * vuela);
        hoja.u.uT.value = t; hoja.u.uAleteo.value = 0.6 * vuela; hoja.mat.emissiveIntensity = 0.06 * smooth(39, 40, t);
        hoja.malla.scale.setScalar(lerp(1, 10, smooth(39.2, 40.4, t) * (1 - smooth(46.0, 47.2, t))));
      }
      // la ola de luces del barrio (escena 7): primero una ventana, después todas
      const hp = V3(...R.hoja(Math.min(Math.max(t, 40.2), 44))); const radio = t < 40.3 ? 0 : t < 43.2 ? lerp(0, 22, easeOut((t - 40.3) / 2.9, 2)) : 22 + Math.pow(Math.max(0, t - 43.2), 2.2) * 260;
      ciudad.matEd.uniforms.uOla.value.set(hp.x, hp.z, radio, 0); ciudad.matC.uniforms.uOla.value.set(hp.x, hp.z, radio, 0); ciudad.matC.uniforms.uT.value = t; ciudad.matC.uniforms.uPx.value = motor.H;
      ciudad.matEd.uniforms.uUmbral.value = lerp(0.7, 0.9, smooth(37, 39.5, t));
      // escena 8: flechas y bici
      flechas.ponerCamino(sat((t - 49.2) / 1.4), (1 - smooth(52.6, 53.2, t)) * (t > 49 ? 1 : 0));
      bici.poner(lerp(-40, 45, sat((t - 50.4) / 1.4)), FACHADA + 5.0, t > 50.3 && t < 51.9);
      // escena 4: la flecha en la punta de la torre
      const tope = crece(Math.min(tl, 15)), puntaP = V3(vaivenX(tope, tl), tope + 6, vaivenZ(tope, tl));
      flechas.ponerPunta(puntaP, camara.position, smooth(23.3, 23.9, t) * (1 - smooth(25.4, 26, t)), 9 + 2 * Math.sin(t * 3));
      // escena 9: el sello cae sobre la comanda del pinche; papel picado
      const TS = 54.6, us = t - TS; sello.grupo.visible = t > TS - 0.35 && t < 63;
      if (sello.grupo.visible) { const cae = us < 0 ? easeIn(1 + us / 0.35, 2) : 1; sello.grupo.position.set(0.0, 0.168 + (1 - cae) * 0.45 + Math.max(0, -rebote(us, 3, 9)) * 0.01, 0.0); sello.grupo.rotation.set(us < 0 ? 0.25 * (-us / 0.35) : 0, -0.3, us < 0 ? 0.1 * (-us / 0.35) : 0); sello.frente.material.emissiveIntensity = 0; }
      confeti.poner(t, 53.4);
      // escena 10: los platos salen por el pase; las copas brindan
      cocina.platos.forEach((p, i) => { const u = sat((t - 57.15 - i * 0.12) / 0.6), v = sat((t - 57.9 - i * 0.12) / 0.6); p.position.z = [-0.06, 0.02, -0.1][i] + 0.42 * easeOut(u, 2) + 0.4 * v; p.position.y = 0.6 * easeIn(v, 2); });
      copas.poner(t, 60.4);
      // el cielo: del atardecer a la noche
      cielo.domo.position.copy(camara.position); cielo.mat.uniforms.uTarde.value = tarde(t);
      ciudad.matF.uniforms.uPx.value = motor.H;
      ciudad.niebla.uNiebla.value.setRGB(lerp(0.035, 0.22, tarde(t)), lerp(0.045, 0.16, tarde(t)), lerp(0.08, 0.16, tarde(t))); ciudad.niebla.uDens.value = lerp(0.00055, 0.0009, tarde(t));
      const af = est.afuera;
      escena.environment = est.cuarto ? ambCuarto : af ? (tarde(t) > 0.4 ? ambTarde : ambNoche) : ambCocina;
      const noche = 1 - tarde(t);
      luna.intensity = af ? 2.3 * noche : 0; sol.intensity = af ? 1.6 * tarde(t) : 0; hemi.intensity = af ? lerp(0.9, 0.4, noche) : est.cuarto ? 0.05 : 0.1;
      if (af) { const c = camara.position, cy = Math.max(c.y, 2) + 4; const cx = t > T3 && t < 26 ? vaivenX(cy, tl) : c.x, cz = t > T3 && t < 26 ? vaivenZ(cy, tl) : c.z; luna.target.position.set(cx, cy, cz); luna.position.copy(luna.target.position).add(V3(-34, 52, 30)); luna.target.updateMatrixWorld(); }
      luzHueco.intensity = af && t > 18 && t < 30 ? 2.5 : 0;
      pila.matPapel.userData.uTrans.value = af ? 0.9 : 0.6;
      const [fp, ap] = focoEn(t); est.foco = Math.max(0.05, camara.position.distanceTo(fp)); est.apertura = ap;
      // las luces apagadas no cuentan (menos trabajo por cuadro): las de adentro se apagan cuando la cámara está lejos
      const lejos = camara.position.distanceTo(V3(0, 1, 4)) > 70;
      for (const l of luces) { const deAdentro = l.parent === cocina.grupo || l.parent === salon.grupo; l.visible = l.intensity > 0 && !(lejos && deAdentro && !l.isHemisphereLight); }
    },
    despuesOpaco(rr, rt, t) { if (est.afuera && camara.position.y > 3) nubes.dibujar(rr, rt, camara, t, 0.5, [vaivenX(130, t - T3), vaivenZ(130, t - T3)]); },
    revelado(t) {
      const af = est.afuera ? 1 : 0, cu = est.cuarto ? 1 : 0, ta = tarde(t);
      const exp = (cu ? 1.7 : af ? lerp(1.35, 1.0, ta) : 0.82) * (1 - 0.3 * smooth(53.9, 54.4, t) * (1 - smooth(56.6, 57.4, t)));
      const negro = Math.max(smooth(32.75, 33.15, t) * (1 - smooth(33.25, 33.75, t)), smooth(67.6, 68, t) * 0);
      return {
        exposicion: exp, bloom: af ? 0.5 : 0.32, umbral: af ? 1.2 : 2.1, radio: 0.85,
        contraste: af ? 1.04 : 1.07, saturacion: af ? 1.1 : 1.04, vineta: af ? 0.26 : 0.36, grano: 0.034, ca: 0.012, halacion: af ? 0.3 : 0.45,
        lift: af ? [0.006, 0.012, 0.03] : [0.004, 0.009, 0.02], gain: af ? [1.03, 1.0, 1.0] : [1.03, 1.0, 0.95],
        foco: est.foco, apertura: est.apertura, negro,
      };
    },
    obturador(t) { return (t > T3 + 8.2 && t < 29.8) || (t > 39 && t < 47) || (t > 63.2 && t < 65) ? 1 / 100 : 1 / 60; },
    subcuadros(t) {
      const tl = t - T3;
      if (t >= T3 && t < 20.3) { let k = 3; for (const g of GOLPES) if (Math.abs(tl - g) < 0.18) k = 8; if (tl > 7.6 && tl < 9.4) k = 8; else if (tl >= 9.4) k = 5; return k; }
      if ((t > 3.8 && t < 5.6) || (t > 20.3 && t < 23.6) || (t > 26.4 && t < 30.2) || (t > 51.2 && t < 53.7) || (t > 54.4 && t < 54.9) || (t > 63 && t < 64.8)) return 8;
      if ((t > 36.8 && t < 47.2) || (t > 57 && t < 59.6)) return 6;
      return 3;
    },
    letras(t) {
      const items = [];
      for (const p of guion.palabras || []) {
        const { t: t0, hasta: t1, texto, tam, centro, y } = p;
        if (t < t0 - 0.05 || t > t1 + 0.2) continue;
        const sale = sat((t - t1) / 0.18);
        texto.split(' ').forEach((w, k) => {
          const u = sat((t - t0 - k * 0.13) / 0.42), e1 = easeOut(u, 3);
          items.push({ txt: w, tam, k, centro, y, alfa: e1 * (1 - sale), blur: (1 - e1) * 9 + sale * 10, dy: (1 - e1) * tam * 0.32 - sale * tam * 0.25 });
        });
      }
      // el cierre: «oído» plano y la dirección
      const f = t < 69 ? sat((t - 65.3) / 0.6) : 0;
      if (f > 0) items.push({ logo: true, alfa: easeOut(f, 3), blur: (1 - easeOut(f, 3)) * 8 }, { txt: guion.sitio || '', tam: 34, mono: true, alfa: sat((t - 65.9) / 0.5), blur: 0 });
      return items;
    },
  };
}
