// La pila de comandas: se clava golpe a golpe en el pinche, sube hasta el cielo y, al final, se desarma en papel picado.
// Recibe el tiempo local de la escena 3 (t - 10). Todo es función del tiempo.
import * as THREE from 'three';
import { lerp, smooth, easeIn, easeOut, rng, rebote, curva } from './util.js';
import { atlas, materialPapel, materialSombraPapel, mallaComandas, pinLocal, VARIANTES } from './comandas.js';
import { TECHO, LOSA, PISO as PISO_PILA } from './cocina.js';
import { siluetaMano } from './texturas.js';

export const GOLPES = [0.55, 2.2, 3.55, 4.65, 5.55, 6.15, 6.6, 6.93, 7.17, 7.34, 7.46, 7.55, 7.62, 7.67];
const BASE = 0.0125;
export const ROOF = TECHO + LOSA;
export const escalaPapel = h => h < ROOF ? 1 : 1 + Math.pow((h - ROOF) / 7, 1.3);
const separacion = h => (h < ROOF ? lerp(0.0058, 0.004, smooth(0.08, 0.5, h)) + 0.0014 * smooth(0.5, 3, h) : 0.006 + 0.006 * smooth(ROOF, ROOF + 6, h)) * escalaPapel(h);
export const crece = curva([[7.67, 0.12], [7.8, 0.16], [7.95, 0.55], [8.08, 1.75], [8.17, 3.05], [8.25, 4.6], [8.5, 12], [8.9, 34], [9.4, 88], [10, 165], [10.6, 240], [11.6, 300], [13, 330], [15, 340]], { log: true });
export const vaivenX = (h, t) => h < ROOF ? 0 : Math.pow((h - ROOF) / 60, 1.6) * 3.2 * Math.sin(t * 0.55 + h * 0.018) + Math.pow((h - ROOF) / 60, 1.2) * 0.9;
export const vaivenZ = (h, t) => h < ROOF ? 0 : Math.pow((h - ROOF) / 60, 1.6) * 2.4 * Math.sin(t * 0.43 + h * 0.023 + 1.3);
// la torre se desarma desde arriba (tiempo local)
export const DESARME = 43.6; // afuera, de arriba hacia abajo
export const DESARME_ADENTRO = 42.55; // adentro, la columna sobre el pinche cae sobre el mostrador

export function crearPila(escena, camara, { desde = -1 } = {}) {
  const r = rng(7);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  // comandas
  const mapa = atlas('Mansalva');
  const matPapel = materialPapel(mapa, { trans: 0.6 }), matSombra = materialSombraPapel(mapa);
  // alturas de reposo de cada comanda y el momento en que cae
  const Y = [], TL = [];
  for (let h = BASE + 0.0017, i = 0; h < 345; i++) { Y.push(h); h += i < 5 ? 0.0115 : separacion(h); }
  for (let i = 0; i < Y.length; i++) {
    if (i < GOLPES.length) { TL.push(GOLPES[i]); continue; }
    let a = 7.67, b = 16; for (let k = 0; k < 50; k++) { const m = (a + b) / 2; crece(m) < Y[i] ? a = m : b = m; } TL.push((a + b) / 2);
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
  const matLejos = materialPapel(mapa, { trans: 0.6, opaco: true }); matLejos.userData.uTrans = matPapel.userData.uTrans;
  const lejos = mallaComandas(N + 120, 1, 1, matLejos, matSombra); lejos.malla.receiveShadow = true; lejos.malla.castShadow = true;
  escena.add(cerca.malla, lejos.malla);
  // comandas esperando, colgadas de la barra del fondo
  const colgadas = mallaComandas(9, 6, 8, matPapel, matSombra); colgadas.malla.castShadow = colgadas.malla.receiveShadow = true;
  [-1.12, -0.86, -0.6, -0.36, 0.3, 0.55, 0.82, 1.05, 1.31].forEach((x, i) => {
    const v = (i * 3 + 1) % VARIANTES; e.set(Math.PI / 2 + (r() - .5) * 0.12, (r() - .5) * 0.3, (r() - .5) * 0.08, 'XYZ'); q.setFromEuler(e);
    m4.compose(p.set(x, 0.488, -0.232), q, s.set(1, 1, 1)); colgadas.malla.setMatrixAt(i, m4); colgadas.aVar.array[i] = v;
    colgadas.aForma.array.set([0.25, (r() - .5) * 0.4, r() * 6, 0], i * 4); colgadas.aPin.array.set([0, -0.11 / 2 + 0.006], i * 2); colgadas.malla.instanceColor.array.set([1, .97, .92], i * 3);
  });
  colgadas.malla.count = 9; escena.add(colgadas.malla);

  // la mano: sólo su sombra, en la capa que ve la luz y no la cámara
  const manoTex = siluetaMano();
  const mano = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.MeshBasicMaterial({ alphaMap: manoTex, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, colorWrite: false, depthWrite: false }));
  mano.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: manoTex, alphaTest: 0.5, side: THREE.DoubleSide });
  mano.castShadow = true; mano.frustumCulled = false; escena.add(mano); // no se dibuja: sólo proyecta sombra

  const topeA = t => { let k = 0; while (k < N && TL[k] <= t) k++; return k; }; // comandas ya clavadas

  const estado = { t: 0, tope: BASE };
  function ponerComandas(t) {
    const caidas = topeA(t), camPos = camara.position;
    let nc = 0, nl = 0;
    // la última comanda clavada marca la punta de la pila
    estado.tope = caidas ? Y[caidas - 1] : BASE;
    for (let i = 0; i < N; i++) {
      const Ti = TL[i], manual = i < GOLPES.length, dur = manual ? 0.14 : 0.055;
      if (t < Ti - dur) break;
      const d = datos[i], h = Y[i], sc = escalaPapel(h);
      let y = h, ox = 0, oz = 0, tilX = d.tx, tilZ = d.tz, giro = d.giro, aleteo = 0;
      // aplastamiento de la pila con cada golpe a mano
      for (let k = Math.max(i, 0); k < Math.min(GOLPES.length, i + 6); k++) { const dt = t - GOLPES[k]; if (dt > 0 && dt < 0.6) y -= 0.006 * Math.exp(-(k - i) / 2.5) * Math.exp(-dt * 16) * Math.cos(dt * 42); }
      if (t < Ti) { // cayendo
        const u = (t - (Ti - dur)) / dur; y = h + (manual ? 0.32 : 0.05 * sc) * (1 - easeIn(u, 1.7));
        tilX += (1 - u) * 0.35 * Math.sin(d.fase); tilZ += (1 - u) * 0.3 * Math.cos(d.fase); giro += (1 - u) * 0.6; aleteo = 0.5;
      } else {
        const dt = t - Ti; tilX += rebote(dt, 6, 7) * 0.12 * Math.sin(d.fase); tilZ += rebote(dt, 5, 7) * 0.1 * Math.cos(d.fase); aleteo = 0.55 * Math.exp(-dt * 5);
      }
      if (h > ROOF) { const f = smooth(ROOF, ROOF + 6, h); tilX += d.tx * 1.6 * f + Math.sin(t * 1.7 + i) * 0.12 * f; tilZ += d.tz * 1.6 * f + Math.cos(t * 1.3 + i * 0.7) * 0.12 * f; aleteo += 0.25; giro += Math.sin(t * 0.3 + i) * 0.1; }
      ox = vaivenX(h, t); oz = vaivenZ(h, t);
      if (h > 0.165 && h <= ROOF + 0.5 && t > DESARME_ADENTRO) {
        const suelta = DESARME_ADENTRO + (1 - h / (ROOF + 0.5)) * 0.5 + (d.fase % 1) * 0.15, u = t - suelta;
        if (u > 0) {
          const a = d.giro, rad = 0.12 + (d.fase % 1) * 0.5, sale = 1 - Math.exp(-u * 1.6);
          ox += Math.cos(a) * rad * sale; oz += Math.sin(a) * rad * sale * 0.8;
          const piso = (Math.abs(ox) < 1.65 && Math.abs(oz) < 0.34) ? 0.002 + (i % 7) * 0.0006 : PISO_PILA + 0.002;
          y = Math.max(piso, h - 1.7 * (u - 0.45 * (1 - Math.exp(-u * 2.2))));
          const enPiso = y <= piso + 1e-4; tilX = enPiso ? d.tx * 0.3 : tilX + u * 3.1; tilZ = enPiso ? d.tz * 0.3 : tilZ + u * 2.3; aleteo = enPiso ? 0 : 0.6;
        }
      }
      if (h > ROOF + 0.5 && t > DESARME) {
        const suelta = DESARME + (1 - Math.min(1, (h - ROOF) / 330)) * 2.2 + d.fase * 0.05, u = t - suelta;
        if (u > 0) { const g = Math.min(u, 6); y -= (1.6 + 1.2 * sc * 0.08) * g * g * 0.35 / (1 + g * 0.4); ox += Math.sin(d.fase * 3) * u * sc * 0.6; oz += Math.cos(d.fase * 5) * u * sc * 0.6; tilX += u * (2 + d.fase); tilZ += u * (1.5 + d.fase * 0.7); aleteo = 0.7; }
      }
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
      const x = u < 0 ? lerp(-0.06, 0.015, ida) : lerp(0.015, -0.05, vuelta);
      const y = u < 0 ? lerp(h + 0.36, h + 0.035, ida) : lerp(h + 0.035, h + 0.34, vuelta);
      const z = u < 0 ? lerp(-0.05, 0.01, ida) : lerp(0.01, -0.07, vuelta);
      mano.position.set(x, y, z); mano.rotation.set(-Math.PI / 2 + 0.12, 0, 2.4 + k * 0.17);
    }
    mano.visible = vis;
  }


  return {
    estado, mapa, matPapel, matSombra, Y, TL,
    poner(t) { estado.t = t; ponerComandas(t); ponerMano(t); },
  };
}
