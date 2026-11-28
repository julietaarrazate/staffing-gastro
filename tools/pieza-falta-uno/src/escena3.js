// Escena 3 de «Falta uno»: «Una mesa. Otra. Otra. Otra. Otra.»
// Cada «otra» clava una comanda en el pinche; la pila crece, la cámara sube con ella, atraviesa el techo y la pila sigue hasta el cielo.
// Todo es función del tiempo t (segundos desde el comienzo de la escena).
import * as THREE from 'three';
import { clamp, lerp, sat, smooth, easeOut, easeIn, rng, deriva, rebote, kelvin, curva } from './util.js';
import { atlas, materialPapel, materialSombraPapel, mallaComandas, pinLocal, VARIANTES, ANCHO } from './comandas.js';
import { crearCocina, crearAzotea, TECHO, LOSA } from './cocina.js';
import { crearCiudad, crearCielo, crearNubes } from './ciudad.js';
import { siluetaMano } from './texturas.js';

export const DURACION = 10;
// los golpes con palabra y los que siguen, cada vez más seguidos
export const GOLPES = [0.55, 2.2, 3.55, 4.65, 5.55, 6.15, 6.6, 6.93, 7.17, 7.34, 7.46, 7.55, 7.62, 7.67];
export const PALABRAS = [[0.55, 'Una mesa.'], [2.2, 'Otra.'], [3.55, 'Otra.'], [4.65, 'Otra.'], [5.55, 'Otra.']];
const BASE = 0.0125; // donde apoya la primera comanda (arriba de la base del pinche)
const ROOF = TECHO + LOSA;

// escala de la comanda según la altura: arriba de la azotea crece, y en perspectiva la torre se ve pareja hasta las nubes
export const escalaPapel = h => h < ROOF ? 1 : 1 + Math.pow((h - ROOF) / 12, 1.3);
const separacion = h => (h < ROOF ? 0.0034 + 0.0018 * smooth(0.3, 3, h) : 0.006) * escalaPapel(h);

// altura de la punta de la pila después del último golpe a mano (escala logarítmica)
export const crece = curva([[7.67, 0.06], [7.8, 0.1], [7.95, 0.55], [8.08, 1.75], [8.17, 3.05], [8.25, 4.6], [8.5, 12], [8.9, 34], [9.4, 88], [10, 165], [10.6, 240]], { log: true });

// cámara: altura, distancia al eje de la pila, giro alrededor, inclinación, campo de visión, rolido
export const camY = curva([[0, 0.094], [5.6, 0.112], [6.2, 0.118], [7.3, 0.135], [7.7, 0.19], [7.95, 0.48], [8.08, 1.38], [8.17, 2.52], [8.24, 3.66], [8.4, 7.4], [8.7, 14.4], [9.1, 20.8], [9.6, 25.4], [10.3, 27.6]]);
const camD = curva([[0, 0.44], [5.6, 0.37], [7.3, 0.36], [7.95, 0.52], [8.2, 0.72], [8.6, 1.7], [9.4, 3.4], [10.3, 4.2]]);
const camA = curva([[0, -0.05], [5.6, 0.05], [7.5, 0.1], [8.2, 0.42], [9.0, 0.82], [10.3, 1.02]]);
const camP = curva([[0, -0.1], [5.6, -0.075], [7.3, -0.02], [7.9, 0.26], [8.17, 0.52], [8.4, 0.58], [9.0, 0.6], [10.3, 0.64]]);
const camF = curva([[0, 36], [6.0, 36], [7.6, 41], [8.2, 53], [9.0, 56], [10.3, 58]]);
const camR = curva([[0, 0], [7.9, 0], [8.2, -0.08], [8.8, 0.05], [9.6, 0.11], [10.3, 0.13]]);

export async function crearEscena3(motor) {
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(36, motor.W / motor.H, 0.01, 60);
  const r = rng(7);

  // ambientes de reflejo: el de la cocina y el de la noche
  const pm = new THREE.PMREMGenerator(motor.renderer);
  const ambCocina = (() => {
    const s = new THREE.Scene(); s.background = new THREE.Color(0.02, 0.016, 0.014);
    const caja = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.025, 0.022), side: THREE.BackSide })); caja.position.y = 1.5; s.add(caja);
    const panel = (w, h, col, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    const [a, b, c] = kelvin(2200), [d, e, f] = kelvin(5400);
    panel(1.6, 0.25, new THREE.Color(a, b, c).multiplyScalar(7), 0, 0.65, 0, 0, Math.PI / 2);
    panel(1.4, 0.06, new THREE.Color(d, e, f).multiplyScalar(5), -0.9, 1.75, -2);
    for (let i = 0; i < 8; i++) panel(0.15, 0.15, new THREE.Color(a, b, c).multiplyScalar(2), -3 + i * 0.8, 2.2, 1 + (i % 3), 0, Math.PI / 2);
    return pm.fromScene(s, 0.02).texture;
  })();
  const ambNoche = (() => {
    const s = new THREE.Scene(); s.background = new THREE.Color(0.02, 0.035, 0.08);
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 0.07, 0.04), side: THREE.DoubleSide })); suelo.rotation.x = -Math.PI / 2; suelo.position.y = -5; s.add(suelo);
    return pm.fromScene(s, 0.04).texture;
  })();
  escena.environment = ambCocina;

  const cocina = crearCocina(escena);
  crearAzotea(escena);
  const ciudad = crearCiudad(escena);
  const cielo = crearCielo(escena);
  const nubes = crearNubes(motor);

  // luz de afuera: luna fría desde arriba y el cielo
  const luna = new THREE.DirectionalLight(new THREE.Color(...kelvin(9000)), 0.0); luna.position.set(-30, 80, 40); escena.add(luna, luna.target);
  luna.castShadow = true; luna.shadow.mapSize.set(2048, 2048); Object.assign(luna.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 140 }); luna.shadow.bias = -0.0004; luna.shadow.normalBias = 0.02; luna.shadow.radius = 3;
  const hemi = new THREE.HemisphereLight(0x22386a, 0x7a4420, 0.0); escena.add(hemi);
  const luzHueco = new THREE.PointLight(new THREE.Color(...kelvin(2300)), 0, 9, 2); luzHueco.position.set(0, ROOF - 0.15, 0); escena.add(luzHueco);

  // comandas
  const mapa = atlas('Mansalva');
  const matPapel = materialPapel(mapa, { trans: 0.6 }), matSombra = materialSombraPapel(mapa);
  // alturas de reposo de cada comanda y el momento en que cae
  const Y = [], TL = [];
  for (let h = BASE + 0.0017, i = 0; h < 260; i++) { Y.push(h); h += separacion(h); }
  for (let i = 0; i < Y.length; i++) {
    if (i < GOLPES.length) { TL.push(GOLPES[i]); continue; }
    let a = 7.67, b = 12; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; crece(m) < Y[i] ? a = m : b = m; } TL.push((a + b) / 2);
  }
  const N = Y.length;
  const datos = Array.from({ length: N }, (_, i) => ({
    v: i < 5 ? [0, 2, 5, 1, 3][i] : Math.floor(r() * VARIANTES), giro: r() * Math.PI * 2, tx: (r() - .5) * 0.07, tz: (r() - .5) * 0.07,
    caida: 0.7 + r() * 1.6, punta: (r() - .5) * 0.35, fase: r() * 6.28, tono: [0.97 + r() * 0.03, 0.95 + r() * 0.04, 0.9 + r() * 0.07],
  }));
  // comandas que el viento arranca de la torre y se llevan volando
  const sueltas = Array.from({ length: 110 }, () => {
    const hd = 6 + Math.pow(r(), 1.4) * 150; let a = 7.67, b = 12; for (let k = 0; k < 40; k++) { const m = (a + b) / 2; crece(m) < hd ? a = m : b = m; }
    return { hd, td: (a + b) / 2 + 0.05 + r() * 0.6, v: [2 + r() * 5, (r() - .35) * 1.6, (r() - .5) * 4], w: [r() * 6, r() * 6, r() * 6], var: Math.floor(r() * VARIANTES), fase: r() * 6 };
  });
  const cerca = mallaComandas(1200, 10, 14, matPapel, matSombra); cerca.malla.castShadow = true; cerca.malla.receiveShadow = true;
  const lejos = mallaComandas(N + 120, 1, 1, matPapel, matSombra); lejos.malla.receiveShadow = true; lejos.malla.castShadow = true;
  escena.add(cerca.malla, lejos.malla);

  // la mano: sólo su sombra, en la capa que ve la luz y no la cámara
  const manoTex = siluetaMano();
  const mano = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ alphaMap: manoTex, alphaTest: 0.5, transparent: false }));
  mano.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: manoTex, alphaTest: 0.5 });
  mano.layers.set(1); mano.castShadow = true; escena.add(mano);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const vaivenX = (h, t) => h < ROOF ? 0 : Math.pow((h - ROOF) / 60, 1.6) * 3.2 * Math.sin(t * 0.55 + h * 0.018) + Math.pow((h - ROOF) / 60, 1.2) * 0.9;
  const vaivenZ = (h, t) => h < ROOF ? 0 : Math.pow((h - ROOF) / 60, 1.6) * 2.4 * Math.sin(t * 0.43 + h * 0.023 + 1.3);
  const topeA = t => { let k = 0; while (k < N && TL[k] <= t) k++; return k; }; // comandas ya clavadas

  const estado = { t: 0, tope: BASE };
  function ponerComandas(t) {
    const caidas = topeA(t), camPos = camara.position;
    let nc = 0, nl = 0;
    // la última comanda clavada marca la punta de la pila
    estado.tope = caidas ? Y[caidas - 1] : BASE;
    for (let i = 0; i < N; i++) {
      const Ti = TL[i], manual = i < GOLPES.length, dur = manual ? 0.14 : 0.1;
      if (t < Ti - dur) break;
      const d = datos[i], h = Y[i], sc = escalaPapel(h);
      let y = h, ox = 0, oz = 0, tilX = d.tx, tilZ = d.tz, giro = d.giro, aleteo = 0;
      // aplastamiento de la pila con cada golpe a mano
      for (let k = Math.max(i, 0); k < Math.min(GOLPES.length, i + 6); k++) { const dt = t - GOLPES[k]; if (dt > 0 && dt < 0.6) y -= 0.0035 * Math.exp(-(k - i) / 2.5) * Math.exp(-dt * 16) * Math.cos(dt * 42); }
      if (t < Ti) { // cayendo
        const u = (t - (Ti - dur)) / dur; y = h + (manual ? 0.32 : 0.22 * sc) * (1 - easeIn(u, 1.7));
        tilX += (1 - u) * 0.35 * Math.sin(d.fase); tilZ += (1 - u) * 0.3 * Math.cos(d.fase); giro += (1 - u) * 0.6; aleteo = 0.5;
      } else {
        const dt = t - Ti; tilX += rebote(dt, 6, 7) * 0.12 * Math.sin(d.fase); tilZ += rebote(dt, 5, 7) * 0.1 * Math.cos(d.fase); aleteo = 0.55 * Math.exp(-dt * 5);
      }
      if (h > ROOF) { tilX += Math.sin(t * 1.7 + i) * 0.08; tilZ += Math.cos(t * 1.3 + i * 0.7) * 0.08; aleteo += 0.25; giro += Math.sin(t * 0.3 + i) * 0.1; }
      ox = vaivenX(h, t); oz = vaivenZ(h, t);
      const hondo = Math.max(0, caidas - 1 - i); // cuántas tiene encima
      const caidaPapel = d.caida * (0.25 + 0.75 * Math.exp(-hondo / 5)) / sc;
      p.set(ox, y, oz); e.set(tilX, giro, tilZ, 'YXZ'); q.setFromEuler(e); s.set(sc, sc, sc); m4.compose(p, q, s);
      const dist = camPos.distanceTo(p);
      const L = dist < 3.5 * sc && nc < 1200 ? cerca : lejos, j = L === cerca ? nc++ : nl++;
      L.malla.setMatrixAt(j, m4); L.aVar.array[j] = d.v;
      L.aForma.array.set([caidaPapel, d.punta / sc, d.fase + t * (h > ROOF ? 3 : 0), aleteo], j * 4);
      const pl = pinLocal(d.v); L.aPin.array.set(pl, j * 2);
      L.malla.instanceColor.array.set(d.tono, j * 3);
    }
    for (const sl of sueltas) {
      const u = t - sl.td; if (u <= 0) continue;
      const sc = escalaPapel(sl.hd);
      p.set(vaivenX(sl.hd, t) + sl.v[0] * u * sc * 0.5, sl.hd + sl.v[1] * u * sc * 0.4 + Math.sin(u * 2 + sl.fase) * 0.3 * sc, vaivenZ(sl.hd, t) + sl.v[2] * u * sc * 0.5);
      e.set(sl.w[0] * u, sl.fase + sl.w[1] * u, sl.w[2] * u, 'YXZ'); q.setFromEuler(e); s.set(sc, sc, sc); m4.compose(p, q, s);
      const L = camPos.distanceTo(p) < 3.5 * sc && nc < 1200 ? cerca : lejos, j = L === cerca ? nc++ : nl++;
      L.malla.setMatrixAt(j, m4); L.aVar.array[j] = sl.var; L.aForma.array.set([0.8 / sc, 0.4 / sc, sl.fase + t * 4, 0.6], j * 4); L.aPin.array.set(pinLocal(sl.var), j * 2); L.malla.instanceColor.array.set([1, 0.98, 0.95], j * 3);
    }
    for (const [L, n] of [[cerca, nc], [lejos, nl]]) { L.malla.count = n; L.malla.instanceMatrix.needsUpdate = true; L.aVar.needsUpdate = L.aForma.needsUpdate = L.aPin.needsUpdate = true; L.malla.instanceColor.needsUpdate = true; }
  }

  function ponerMano(t) {
    // la mano baja con la comanda, aprieta y se va (golpes con mano: los primeros nueve)
    let vis = false;
    for (let k = 0; k < 9; k++) {
      const u = t - GOLPES[k]; if (u < -0.32 || u > 0.34) continue;
      const h = Y[k] + 0.012; vis = true;
      const ida = easeOut((u + 0.32) / 0.32, 2.2), vuelta = easeIn(u / 0.34, 1.6);
      const x = u < 0 ? lerp(0.05, 0.012, ida) : lerp(0.012, 0.08, vuelta);
      const y = u < 0 ? lerp(h + 0.28, h + 0.03, ida) : lerp(h + 0.03, h + 0.3, vuelta);
      const z = u < 0 ? lerp(0.3, 0.05, ida) : lerp(0.05, 0.32, vuelta);
      mano.position.set(x, y, z); mano.rotation.set(-Math.PI / 2 + 0.25, 0, 0.5 + k * 0.17);
    }
    mano.visible = vis;
  }

  function ponerCamara(t) {
    const tope = estado.tope;
    let y = camY(t), dist = camD(t), ang = camA(t), pit = camP(t), fov = camF(t), rol = camR(t);
    // en mano: deriva suave, más amplia cuando la toma vuela
    const vuelo = smooth(7.8, 8.6, t), amp = lerp(0.0016, 0.05, vuelo);
    y += deriva(t, 1) * amp; ang += deriva(t * 0.8, 4) * lerp(0.006, 0.02, vuelo);
    pit += deriva(t * 1.1, 7) * lerp(0.004, 0.012, vuelo); rol += deriva(t * 0.9, 9) * lerp(0.003, 0.012, vuelo);
    // sacudón de cada golpe a mano
    for (let k = 0; k < 9; k++) { const dt = t - GOLPES[k]; if (dt > 0 && dt < 0.4) { y -= 0.0012 * Math.exp(-dt * 22) * Math.cos(dt * 70); pit += 0.004 * Math.exp(-dt * 20) * Math.sin(dt * 60); } }
    const hx = vaivenX(y, t) * 0.6, hz = vaivenZ(y, t) * 0.6;
    camara.position.set(hx + Math.sin(ang) * dist, y, hz + Math.cos(ang) * dist);
    const mira = new THREE.Vector3(hx * 1.4, y + Math.tan(pit) * dist, hz * 1.4);
    camara.up.set(0, 1, 0); camara.lookAt(mira); camara.rotateY(0.04 * (1 - smooth(6.6, 7.9, t))); camara.rotateZ(rol);
    camara.fov = fov;
    // adentro, plano cercano chico; afuera, lejano grande
    const afuera = y > TECHO + 0.1;
    camara.near = afuera ? 0.15 : 0.01; camara.far = afuera ? 25000 : 60;
    camara.updateProjectionMatrix(); camara.updateMatrixWorld();
    estado.foco = Math.max(0.05, camara.position.distanceTo(new THREE.Vector3(0, Math.max(tope, 0.04), 0)));
    estado.afuera = afuera;
    void tope;
  }

  return {
    escena, camara, estado,
    poner(t) {
      estado.t = t;
      ponerCamara(t); ponerComandas(t); ponerMano(t);
      cocina.poner(t, motor.H);
      cielo.domo.position.copy(camara.position);
      ciudad.matF.uniforms.uPx.value = motor.H;
      const afuera = estado.afuera;
      escena.environment = afuera ? ambNoche : ambCocina;
      luna.intensity = afuera ? 1.1 : 0; hemi.intensity = afuera ? 0.32 : 0.1;
      if (afuera) { const cy = camara.position.y + 4; luna.target.position.set(vaivenX(cy, t), cy, vaivenZ(cy, t)); luna.position.copy(luna.target.position).add(new THREE.Vector3(-34, 52, 30)); luna.target.updateMatrixWorld(); luna.shadow.camera.updateProjectionMatrix(); }
      luzHueco.intensity = afuera ? 2.5 : 0;
      matPapel.userData.uTrans.value = afuera ? 0.9 : 0.6;
    },
    despuesOpaco(rr, rt, t) { if (estado.afuera) nubes.dibujar(rr, rt, camara, t, 0.58, [vaivenX(130, t), vaivenZ(130, t)]); },
    revelado(t) {
      const a = smooth(8.1, 8.5, t);
      return {
        exposicion: lerp(0.9, 1.35, a), bloom: lerp(0.3, 0.5, a), umbral: lerp(2.2, 1.2, a), radio: 0.85,
        contraste: lerp(1.07, 1.04, a), saturacion: lerp(1.04, 1.1, a), vineta: lerp(0.36, 0.26, a), grano: 0.034, ca: 0.012, halacion: lerp(0.45, 0.3, a),
        lift: [lerp(0.004, 0.006, a), lerp(0.009, 0.012, a), lerp(0.02, 0.03, a)], gain: [1.03, 1.0, lerp(0.95, 1.0, a)],
        foco: estado.foco, apertura: lerp(15, 0, smooth(7.6, 8.15, t)),
        negro: 0,
      };
    },
    subcuadros(t) {
      let k = 3;
      for (const g of GOLPES) if (Math.abs(t - g) < 0.18) k = 8;
      if (t > 7.6 && t < 9.4) k = 8; else if (t >= 9.4) k = 5;
      return k;
    },
    letras(t) {
      // palabra por palabra: suben y se enfocan; cada «otra» más grande
      const items = [];
      for (let i = 0; i < PALABRAS.length; i++) {
        const [t0, txt] = PALABRAS[i], t1 = i + 1 < PALABRAS.length ? PALABRAS[i + 1][0] : 6.35;
        if (t < t0 - 0.05 || t > t1 + 0.25) continue;
        const tam = [56, 64, 78, 96, 120][i];
        const sale = sat((t - t1) / 0.22);
        txt.split(' ').forEach((w, k) => {
          const u = sat((t - t0 - k * 0.13) / 0.42), e1 = easeOut(u, 3);
          items.push({ txt: w, tam, k, alfa: e1 * (1 - sale), blur: (1 - e1) * 9 + sale * 10, dy: (1 - e1) * tam * 0.32 - sale * tam * 0.25 });
        });
      }
      return items;
    },
  };
}
