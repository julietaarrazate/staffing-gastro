// «Falta uno», versión 2 (58 s): la porteña y cotidiana. Sin torre ni ciudad de rascacielos: un bodegón de barrio
// un viernes a la noche, la fila en la vereda, el servicio que se tranca por un mozo que no llega, el pedido que sale
// a la cuadra, alguien que contesta «Voy» y todo empieza a fluir: el sello «¡Oído!», las comandas que salen, la fila que entra.
// Mismo mundo y mismas piezas que la primera (pieza.js), otra línea de tiempo. Los textos salen de trabajo/entrada/guion2.json (privado).
import * as THREE from 'three';
import { lerp, sat, smooth, smoother, easeOut, easeIn, deriva, kelvin, ruta, rebote, curva } from './util.js';
import { crearCocina, PISO } from './cocina.js';
import { crearCiudad, crearCielo } from './ciudad.js';
import { crearPila, GOLPES, vaivenX, vaivenZ } from './pila.js';
import { crearSalon, FACHADA } from './salon.js';
import { MESAS_VEREDA } from './fachada.js';
import { crearEnfrente, crearTalonario, crearHoja, crearSello, crearConfeti, crearFlechas, crearBici, crearCopas, crearGente, crearReloj, ENFRENTE } from './objetos.js';
import { camPila, R as R1 } from './pieza.js';

export const DURACION = 58;
const T3 = 9.0; // las comandas empiezan a los 9 s
const T_SALE = 43.2; // las comandas dejan el pinche, en orden
const TS = 41.0; // el sello «¡Oído!» y la campanita
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const tv12 = t => (t < 4.65 ? t : 4.65 + (t - 4.65) * (5.35 / 4.35)); // la calle y el salón de la primera, un poco más rápido

// ---------- recorridos: [t, x, y, z] ----------
const c76 = camPila(7.6);
const R = {
  // 4: se abre la toma: el pinche rebalsa, la cámara lo rodea por abajo de la lámpara y mira el salón desde la cocina
  pos4: ruta([[16.6, c76.pos.x, c76.pos.y, c76.pos.z], [17.2, 0.3, 0.3, 0.6], [17.9, 0.5, 0.33, 0.12], [18.5, 0.36, 0.33, -0.36], [19.1, 0.12, 0.38, -0.62], [20.0, 0.12, 0.42, -0.86], [21.0, 0.15, 0.44, -0.96],
    // y se mete otra vez por el pase hasta el talonario
    [21.35, 0.0, 0.36, -0.32], [21.6, 0.4, 0.27, 0.44], [21.85, 0.52, 0.2, 0.34]]),
  look4: ruta([[16.6, c76.look.x, c76.look.y, c76.look.z], [17.2, 0.0, 0.08, 0.0], [17.9, 0.0, 0.1, 0.0], [18.5, 0.0, 0.11, 0.0], [19.1, 0.02, 0.14, 0.4], [20.0, 0.25, 0.3, 9], [21.0, 0.3, 0.3, 10],
    [21.35, 0.2, 0.15, 3], [21.6, 0.42, 0.02, 0.1], [21.85, 0.42, 0.01, 0.1]]),
  // 5: el talonario bajo la lámpara (la primera, 11,4 s antes)
  pos6: ruta([[21.85, 0.52, 0.2, 0.34], [23.6, 0.5, 0.17, 0.3], [25.2, 0.48, 0.16, 0.29]]),
  look6: ruta([[21.85, 0.42, 0.01, 0.1], [25.2, 0.42, 0.012, 0.1]]),
  // la hoja: del pase, por el salón, sale por la puerta, cruza la calle a la altura de los balcones y entra por la ventana de enfrente
  hoja: ruta([[25.5, 0.42, 0.0125, 0.1], [26.0, 0.32, 0.55, 0.55], [26.6, 0.2, 1.55, 3.6], [27.2, 0.0, 1.45, 8.0], [27.6, 0.0, 1.2, 12.3], [28.2, 0.9, 2.2, 15.4], [28.9, 2.6, 4.2, 19.0], [29.6, 4.6, 5.9, 22.6], [30.2, 5.7, 6.45, 24.9], [30.6, 5.85, 6.35, 25.6], [31.0, 5.78, 6.12, 25.95], [31.25, 5.76, 6.077, 26.0]]),
  // 6: la cámara termina en el cuarto, sobre el celular
  pos5: ruta([[30.0, 5.3, 6.4, 23.6], [30.6, 6.0, 6.55, 25.2], [31.2, 5.98, 6.4, 25.7], [32.6, 5.97, 6.3, 25.86], [33.4, 5.96, 6.2, 25.98]]),
  look5: ruta([[30.0, 5.75, 6.35, 25.4], [30.6, 5.8, 6.15, 25.95], [31.2, 5.95, 6.07, 26.12], [33.4, 5.95, 6.07, 26.12]]),
  // 9 y 10: el sello, los platos, la mesa del brindis (la primera, 13,6 s antes; un poco más arriba: la pila es más alta)
  pos9: ruta([[40.0, 0.12, 0.4, 0.45], [40.7, 0.06, 0.545, 0.26], [41.3, 0.05, 0.495, 0.22], [42.0, 0.12, 0.52, 0.4], [43.4, 0.3, 0.55, 0.85], [44.2, 0.55, 0.62, 1.05], [45.0, -0.8, 1.4, 3.6], [45.8, -2.28, 1.9, 5.74], [49.2, -2.3, 1.95, 5.72]]),
  look9: ruta([[40.0, 0.0, 0.17, 0.0], [40.7, 0.0, 0.185, 0.0], [41.3, 0.0, 0.185, 0.0], [42.0, 0.0, 0.32, 0.0], [43.4, 0.4, 0.05, 0.1], [44.2, 0.6, 0.02, 0.25], [45.0, -1.8, -0.2, 5.0], [45.8, -2.3, -0.2, 5.7], [49.2, -2.3, -0.2, 5.7]]),
  // 11: afuera, la vereda sin fila, y la cámara que sube al cielo
  // 11: la vereda (mesitas a la izquierda, la fila que entra a la derecha) y la grúa que sube por la fachada hasta el cielo
  pos10: ruta([[49.2, 0.2, -0.15, 21.6], [51.6, 0.2, 0.0, 20.9], [53.5, 0.25, 3.0, 19.8], [55.4, 0.35, 9.5, 18.6], [58.0, 0.4, 13.5, 17.8]]),
  look10: ruta([[49.2, -0.1, 1.0, 12], [51.6, -0.1, 1.2, 12], [53.5, 0.1, 4.6, 12], [55.4, 0.3, 12.5, 10], [58.0, 0.3, 16.5, 4]]),
};
const D8 = 13.6; // «Voy.»: la escena 8 de la primera, 13,6 s antes
const r8 = t => t + D8;

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
  const ciudad = crearCiudad(escena, { bajo: true });
  const cielo = crearCielo(escena);
  const salon = crearSalon(escena, guion, { frances: true });
  const enfrente = crearEnfrente(escena, guion);
  const pila = crearPila(escena, camara, { sinTorre: true, tSale: T_SALE - T3 });
  const talonario = crearTalonario(escena, guion);
  const hoja = crearHoja(escena, talonario.tx);
  const sello = await crearSello(escena);
  const confeti = crearConfeti(escena);
  const flechas = crearFlechas(escena);
  const bici = crearBici(escena);
  const copas = crearCopas(escena, V3(-2.3, PISO, 5.7));
  const reloj = crearReloj(escena, V3(0, 2.25, FACHADA - 0.2), Math.PI, 0.22);

  // ---------- la gente (siluetas a contraluz) ----------
  const L = [];
  // la fila en la vereda: al final entra, de a uno
  for (let i = 0; i < 9; i++) {
    const qx = 1.35 + i * 0.62 + Math.sin(i * 3.1) * 0.12, qz = FACHADA + 0.75 + Math.sin(i * 1.7) * 0.25, y = PISO + 0.15, s = i % 2 ? 1 : -1;
    const tp = 49.5 + i * 0.3, ts = tp - (qx - 0.45) / 1.4;
    L.push({ x: qx, y, z: qz, espejo: i % 3 === 0, ruta: [[ts, qx, qz, y], [tp, 0.45, FACHADA + 0.55, y], [tp + 0.55, 0.25 * s, FACHADA - 0.4, PISO], [tp + 1.3, 1.7 * s, FACHADA - 1.4, PISO]], hasta: tp + 1.3 });
  }
  // el salón lleno; los de la mesa (2.1, 8.5) se levantan y se van
  const seVan = [];
  for (const [mx, mz] of [[-2.3, 3.1], [2.1, 3.3], [-2.3, 5.7], [2.1, 5.9], [-2.3, 8.3], [2.1, 8.5], [-2.2, 10.7], [2.0, 10.8]]) for (const [dx, dz] of [[0, 0.66], [0.66, 0], [-0.66, 0], [0, -0.66]]) {
    if ((mx * 7 + dx * 3 + dz * 5 + 10) % 3 <= 0.5) continue;
    const p = { x: mx + dx, y: PISO + 0.2, z: mz + dz, sentada: true };
    if (mx === 2.1 && mz === 8.5 && seVan.length < 2) { p.hasta = 19.0; seVan.push(p); }
    L.push(p);
  }
  seVan.forEach((p, k) => L.push({ x: p.x, y: PISO, z: p.z, desde: 19.0, hasta: 21.6, ruta: [[19.15 + k * 0.25, p.x, p.z], [20.9 + k * 0.25, 0.35 - k * 0.3, FACHADA - 0.5], [21.6 + k * 0.25, 0.1 - k * 0.3, FACHADA + 0.6]] }));
  // la vereda: gente sentada en las mesitas de mármol (se quedan toda la noche)
  MESAS_VEREDA.forEach(([mx, mz], i) => { for (const s of [-1, 1]) if (i !== 2 || s < 0) L.push({ x: mx + s * 0.5, y: PISO + 0.35, z: mz, sentada: true }); });
  // gente de pie: esperando mesa junto a la puerta y en la barra del pase
  for (const [x, z] of [[-2.2, 11.0], [-1.5, 11.3], [1.3, 11.1]]) L.push({ x, y: PISO, z });
  for (const [x, z] of [[1.5, 1.6], [2.4, 1.75]]) L.push({ x, y: PISO, z });
  const gente = crearGente(escena, L);

  // ---------- luces de la noche ----------
  const luna = new THREE.DirectionalLight(new THREE.Color(...kelvin(9000)), 0); escena.add(luna, luna.target);
  luna.castShadow = true; luna.shadow.mapSize.set(2048, 2048); Object.assign(luna.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 140 }); luna.shadow.bias = -0.0004; luna.shadow.normalBias = 0.02; luna.shadow.radius = 3;
  const sol = new THREE.DirectionalLight(new THREE.Color(1.0, 0.55, 0.3), 0); sol.position.set(-20, 6, -40); escena.add(sol);
  const hemi = new THREE.HemisphereLight(0x34508c, 0x3e3c44, 0); escena.add(hemi);

  // el celular del pase: «No llego»; el de enfrente: el aviso del pedido
  salon.tel.estados = [[7.5, 8.88, 'mensaje', 1.6]]; salon.tel.vibras.push(7.5, 7.98);
  enfrente.tel.estados = [[31.35, 33.6, 'aviso', 1.7]]; enfrente.tel.vibras.push(31.35, 31.85);

  const est = { afuera: false, adentroBodegon: true, foco: 1, apertura: 0, cuarto: false };
  const enBodegon = p => Math.abs(p.x) < 4.33 && p.z > -18 && p.z < FACHADA && p.y < 3.4;
  const enCuarto = p => p.x > 3.9 && p.x < 8.1 && p.z > ENFRENTE.z - 0.05 && p.z < ENFRENTE.z + 4.1 && p.y > enfrente.pisoSala && p.y < enfrente.pisoSala + 2.9;

  const hojaEn = t => V3(...R.hoja(Math.min(Math.max(t, 25.5), 31.25)));
  function ponerCamara(t) {
    let pos, look, fov = 50, roll = 0, yaw = 0, up = null;
    if (t < T3) { const u = tv12(t); pos = V3(...R1.pos12(u)); look = V3(...R1.look12(u)); fov = R1.fov12(u); roll = deriva(u * 0.6, 3) * 0.008; }
    else if (t < 16.6) { const c = camPila(t - T3); pos = c.pos; look = c.look; fov = c.fov; roll = c.roll; yaw = c.yaw; }
    else if (t < 21.85) { pos = V3(...R.pos4(t)); look = V3(...R.look4(t)); fov = lerp(lerp(41, 46, smooth(16.6, 18.5, t)), 38, smooth(21.0, 21.8, t)); roll = deriva(t * 0.7, 4) * 0.012 + Math.sin(Math.PI * sat((t - 17.4) / 2)) * 0.06; }
    else if (t < 25.5) { pos = V3(...R.pos6(t)); look = V3(...R.look6(t)); fov = 38; roll = deriva(t * 0.7, 6) * 0.01; }
    else if (t < 33.4) {
      const h = hojaEn(t), h2 = hojaEn(t + 0.12), dir = h2.clone().sub(h); if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1); dir.normalize();
      const afuera = smooth(27.4, 28.6, t), atras = lerp(0.7, 1.7, afuera), arriba = lerp(0.18, 0.45, afuera);
      pos = h.clone().addScaledVector(dir, -atras); pos.y += arriba; look = h.clone().addScaledVector(dir, 0.6);
      fov = lerp(44, 52, afuera); roll = -dir.x * 0.22 * afuera + deriva(t, 8) * 0.015;
      // al principio la cámara del talonario mira subir la hoja y recién después la sigue (si no, queda abajo del mostrador)
      pos = V3(...R.pos6(25.2)).lerp(pos, smooth(25.55, 26.35, t)); look = V3(0.42, 0.012, 0.1).lerp(h, smooth(25.45, 25.75, t)).lerp(look, smooth(25.9, 26.4, t));
      // al final la cámara entra por la ventana y se queda sobre el celular
      const fin = smooth(29.9, 30.8, t); pos.lerp(V3(...R.pos5(t)), fin); look.lerp(V3(...R.look5(t)), fin); fov = lerp(fov, 40, fin); roll *= 1 - fin;
    }
    else if (t < 40.0) { pos = V3(...R1.pos8(r8(t))); look = V3(...R1.look8(r8(t))); fov = lerp(44, 40, smooth(37.4, 39.8, t)); roll = deriva(t * 0.8, 9) * 0.01; }
    else if (t < 49.2) { pos = V3(...R.pos9(t)); look = V3(...R.look9(t)); fov = lerp(40, 50, smooth(43.4, 45.8, t)); const cen = smooth(44.8, 45.8, t); up = V3(0, 1 - cen, -cen).normalize(); roll = smooth(45.8, 49.2, t) * 0.25; }
    else { pos = V3(...R.pos10(t)); look = V3(...R.look10(t)); fov = lerp(56, 54, smooth(52, 56, t)); roll = deriva(t * 0.5, 13) * 0.006; }
    for (const [T0, a] of [[TS, 0.006], [7.5, 0.0015], [7.98, 0.0015]]) { const u = t - T0; if (u > 0 && u < 0.5) pos.y -= a * Math.exp(-u * 14) * Math.cos(u * 60); }
    camara.position.copy(pos); camara.up.copy(up || V3(0, 1, 0)); camara.lookAt(look); if (yaw) camara.rotateY(yaw); camara.rotateZ(roll);
    camara.fov = fov;
    const cu = enCuarto(pos), bo = enBodegon(pos), afuera = !bo && !cu;
    est.afuera = afuera; est.cuarto = cu; est.adentroBodegon = bo;
    camara.near = pos.y > 40 ? 0.5 : afuera ? 0.05 : 0.01; camara.far = afuera ? 25000 : 80;
    camara.updateProjectionMatrix(); camara.updateMatrixWorld();
  }

  // la profundidad de campo
  const focoEn = t => {
    if (t < 4.6) return [V3(0, 0.8, 12.2), 2.5];
    if (t >= 49.2) return [V3(0, lerp(0.9, 11, smooth(52, 56, t)), 12.2), 1.5];
    if (t < T3) { const u = tv12(t); return [u < 7.8 ? V3(-2.0, 0.75, 0.46) : u < 9.4 ? V3(-0.46, 0.01, 0.17) : V3(0, 0.06, 0), lerp(4, 9, smooth(5, 6.5, u))]; }
    if (t < 16.6) return [V3(0, Math.max(pila.estado.tope, 0.04), 0), 10];
    if (t < 21.0) return [V3(0, 0.08, 0).lerp(V3(0.3, 0.3, 9.5), smooth(19.0, 20.2, t)), lerp(7, 3.5, smooth(19.0, 20.2, t))];
    if (t < 25.5) return [V3(0.42, 0.012, 0.1), t < 21.8 ? 2 : 12];
    if (t < 30.8) return [hojaEn(t), lerp(7, 3, smooth(27.4, 28.2, t))];
    if (t < 33.4) return [V3(5.95, 6.07, 26.12), 11];
    if (t < 40.0) return [r8(t) < 51 ? V3(3.0, 0.2, 24.8) : V3(0, 0.3, 12), lerp(3, 6, smooth(37.9, 39.8, t))];
    if (t < 43.6) return [V3(0, pila.estado.tope, 0), 10];
    if (t < 49.2) return [t < 45.0 ? V3(0.6, 0.02, 0.4) : V3(-2.3, -0.17, 5.7), t < 45.0 ? 7 : 4];
    return [V3(0.6, 0.9, 12.2), 1.5];
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
      reloj.poner(20.97 + 0.002 * t + 0.66 * smoother(17.0, 20.9, t));
      // «Voy.»: la puerta de enfrente, la persona (sólo su sombra), la flecha y la bici
      enfrente.poner(t, { puerta: smooth(33.8, 34.7, t), sale: sat((t - 34.6) / 1.3), paso: sat((t - 36.4) / 2.6) });
      // el talonario: escribe, se arranca y la hoja vuela
      talonario.poner(t, { prog: sat((t - 22.3) / 2.7), escribe: t > 22.2 && t < 25.0, visible: t > 21.0 && t < 28.6 });
      talonario.hoja.visible = t < 25.5;
      const hv = t >= 25.5 && t < 33.4; hoja.malla.visible = hv;
      if (hv) {
        const p = hojaEn(t), p2 = hojaEn(t + 0.1), dir = p2.sub(p);
        hoja.malla.position.copy(p); const vuela = sat((t - 25.5) / 0.4) * (1 - smooth(31.0, 31.25, t));
        hoja.malla.rotation.set(Math.sin(t * 3.1) * 0.6 * vuela, Math.atan2(dir.x, dir.z) + Math.sin(t * 1.7) * 0.4 * vuela, Math.sin(t * 2.3 + 1) * 0.7 * vuela);
        hoja.u.uT.value = t; hoja.u.uAleteo.value = 0.6 * vuela; hoja.mat.emissiveIntensity = 0.05 * smooth(27.4, 28.2, t) * (1 - smooth(30.6, 31.2, t));
        hoja.malla.scale.setScalar(lerp(1, 1.8, smooth(27.6, 28.4, t) * (1 - smooth(29.9, 30.7, t))));
      }
      // el aviso llega a la cuadra: se prenden las ventanas alrededor del bodegón
      const radio = t < 27.7 ? 0 : lerp(0, 75, easeOut(sat((t - 27.7) / 2.4), 2));
      ciudad.matEd.uniforms.uOla.value.set(0, FACHADA + 0.5, radio, 0); ciudad.matC.uniforms.uOla.value.set(0, FACHADA + 0.5, radio, 0); ciudad.matC.uniforms.uT.value = t; ciudad.matC.uniforms.uPx.value = motor.H;
      ciudad.matEd.uniforms.uUmbral.value = lerp(0.7, 0.9, smooth(25.5, 27.5, t));
      flechas.ponerCamino(sat((t - 35.6) / 1.4), (1 - smooth(39.0, 39.6, t)) * (t > 35.4 && t < 40 ? 1 : 0));
      flechas.ponerPunta(V3(0, -50, 0), camara.position, 0, 1);
      bici.poner(lerp(-40, 45, sat((t - 36.8) / 1.4)), FACHADA + 5.0, t > 36.7 && t < 38.3);
      // «¡Oído!»: el sello cae sobre la comanda de arriba del pinche; cuando sale el servicio, se va con ella
      const us = t - TS; sello.grupo.visible = t > TS - 0.35 && t < T_SALE + 0.7;
      if (sello.grupo.visible) {
        const cae = us < 0 ? easeIn(1 + us / 0.35, 2) : 1, sv = Math.max(0, t - T_SALE);
        sello.grupo.position.set(sv * sv * 3.2, pila.estado.tope + 0.003 + (1 - cae) * 0.45 + Math.max(0, -rebote(us, 3, 9)) * 0.01 + sv * 0.7, 0.0);
        sello.grupo.rotation.set(us < 0 ? 0.25 * (-us / 0.35) : 0, -0.3, (us < 0 ? 0.1 * (-us / 0.35) : 0) + sv * 2.2); sello.frente.material.emissiveIntensity = 0;
      }
      confeti.poner(t, 39.8);
      // «Sale.»: los platos salen por el pase; brindis en la mesa
      cocina.platos.forEach((p, i) => { const u = sat((t - 43.55 - i * 0.12) / 0.6), v = sat((t - 44.3 - i * 0.12) / 0.6); p.position.z = [-0.06, 0.02, -0.1][i] + 0.42 * easeOut(u, 2) + 0.4 * v; p.position.y = 0.6 * easeIn(v, 2); });
      copas.poner(t, 46.8);
      gente.poner(t, camara.position);
      // el cielo: del atardecer a la noche
      cielo.domo.position.copy(camara.position); cielo.mat.uniforms.uTarde.value = tarde(t);
      ciudad.matF.uniforms.uPx.value = motor.H;
      ciudad.niebla.uNiebla.value.setRGB(lerp(0.035, 0.22, tarde(t)), lerp(0.045, 0.16, tarde(t)), lerp(0.08, 0.16, tarde(t))); ciudad.niebla.uDens.value = lerp(0.00055, 0.0009, tarde(t));
      const af = est.afuera;
      escena.environment = est.cuarto ? ambCuarto : af ? (tarde(t) > 0.4 ? ambTarde : ambNoche) : ambCocina;
      const noche = 1 - tarde(t);
      luna.intensity = af ? 2.3 * noche : 0; sol.intensity = af ? 1.6 * tarde(t) : 0; hemi.intensity = af ? lerp(0.9, 0.4, noche) : est.cuarto ? 0.05 : 0.1;
      if (af) { const c = camara.position; luna.target.position.set(c.x, Math.max(c.y, 2) + 4, c.z); luna.position.copy(luna.target.position).add(V3(-34, 52, 30)); luna.target.updateMatrixWorld(); }
      pila.matPapel.userData.uTrans.value = af ? 0.9 : 0.6;
      const [fp, ap] = focoEn(t); est.foco = Math.max(0.05, camara.position.distanceTo(fp)); est.apertura = ap;
      const lejos = camara.position.distanceTo(V3(0, 1, 4)) > 70;
      for (const l of luces) { const deAdentro = (l.parent === cocina.grupo || l.parent === salon.grupo) && !l.userData.fachada; l.visible = l.intensity > 0 && !(lejos && deAdentro && !l.isHemisphereLight) && !(l.userData.fachada && !est.afuera); }
    },
    revelado(t) {
      const af = est.afuera ? 1 : 0, cu = est.cuarto ? 1 : 0, ta = tarde(t);
      const exp = (cu ? 1.7 : af ? lerp(1.35, 1.0, ta) : 0.82) * (1 - 0.3 * smooth(40.3, 40.8, t) * (1 - smooth(43.0, 43.8, t)));
      // dos cortes por negro: del cuarto a la calle (33,4) y de la mesa a la vereda (49,2)
      const negro = Math.max(smooth(33.12, 33.38, t) * (1 - smooth(33.42, 33.7, t)), smooth(48.95, 49.18, t) * (1 - smooth(49.22, 49.5, t)));
      return {
        exposicion: exp, bloom: af ? 0.5 : 0.32, umbral: af ? 1.2 : 2.1, radio: 0.85,
        contraste: af ? 1.04 : 1.07, saturacion: af ? 1.1 : 1.04, vineta: af ? 0.26 : 0.36, grano: 0.034, ca: 0.012, halacion: af ? 0.3 : 0.45,
        lift: af ? [0.006, 0.012, 0.03] : [0.004, 0.009, 0.02], gain: af ? [1.03, 1.0, 1.0] : [1.03, 1.0, 0.95],
        foco: est.foco, apertura: est.apertura, negro,
      };
    },
    obturador(t) { return (t > 16.6 && t < 18.6) || (t > 20.9 && t < 21.9) || (t > 25.4 && t < 30.8) || (t > 37.5 && t < 40.1) ? 1 / 100 : 1 / 60; },
    subcuadros(t) {
      const tl = t - T3;
      if (t >= T3 && t < 16.6) { let k = 3; for (const g of GOLPES) if (Math.abs(tl - g) < 0.18) k = 8; return k; }
      if ((t > 3.8 && t < 5.4) || (t > 20.9 && t < 21.9) || (t > 37.6 && t < 40.1) || (t > 40.8 && t < 41.3)) return 8;
      if ((t >= 16.6 && t < 19.2) || (t > 25.4 && t < 30.8) || (t > 43.1 && t < 46.0)) return 6;
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
      const f = sat((t - 55.2) / 0.6);
      if (f > 0) items.push({ logo: true, alfa: easeOut(f, 3), blur: (1 - easeOut(f, 3)) * 8 }, { txt: guion.sitio || '', tam: 34, mono: true, alfa: sat((t - 55.8) / 0.5), blur: 0 });
      return items;
    },
  };
}
