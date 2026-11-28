// Los objetos de las escenas 4 a 11: el edificio de enfrente (la habitación oscura y la puerta que se abre),
// el talonario y la birome, la comanda que vuela, el sello «¡Oído!», el papel picado, las flechas, la bici y las copas.
import * as THREE from 'three';
import { rng, kelvin, smooth, easeOut, easeIn, rebote, lerp, sat } from './util.js';
import * as T from './texturas.js';
import { PISO } from './cocina.js';
import { crearCelular } from './salon.js';

const AMBAR = new THREE.Color(1.0, 0.46, 0.05);
const invisible = () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const silueta = (alto = 1.72) => {
  const g = new THREE.Group(), m = invisible();
  const parte = (geo, x, y, z, sx = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, 1, sz); o.castShadow = true; o.frustumCulled = false; g.add(o); return o; };
  parte(new THREE.CapsuleGeometry(0.19, 0.5, 4, 10), 0, alto * 0.62, 0, 1, 0.6);
  parte(new THREE.SphereGeometry(0.11, 12, 10), 0, alto * 0.93, 0);
  const pi = parte(new THREE.CapsuleGeometry(0.07, 0.72, 4, 8), -0.1, alto * 0.25, 0), pd = parte(new THREE.CapsuleGeometry(0.07, 0.72, 4, 8), 0.1, alto * 0.25, 0);
  const bi = parte(new THREE.CapsuleGeometry(0.05, 0.55, 4, 8), -0.25, alto * 0.6, 0), bd = parte(new THREE.CapsuleGeometry(0.05, 0.55, 4, 8), 0.25, alto * 0.6, 0);
  return { g, pi, pd, bi, bd, paso(f) { pi.rotation.x = Math.sin(f) * 0.45; pd.rotation.x = -Math.sin(f) * 0.45; bi.rotation.x = -Math.sin(f) * 0.35; bd.rotation.x = Math.sin(f) * 0.35; } };
};

// ---------- el edificio de enfrente ----------
export const ENFRENTE = { z: 25.4, ventana: [5.2, 5.7, 6.8, 7.4], puerta: [2.4, 3.6] };
export function crearEnfrente(escena, guion) {
  const g = new THREE.Group(); escena.add(g);
  const r = rng(505), z0 = ENFRENTE.z, x0 = 1.5, x1 = 10.5, alto = 14;
  // fachada pintada: ventanas con marco, algunas prendidas
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1536; const k = c.getContext('2d');
  k.fillStyle = '#6f675d'; k.fillRect(0, 0, 1024, 1536);
  for (let i = 0; i < 5000; i++) { k.fillStyle = `rgba(0,0,0,${Math.random() * .06})`; k.fillRect(Math.random() * 1024, Math.random() * 1536, 2 + Math.random() * 6, 2 + Math.random() * 6); }
  const aPix = (x, y) => [(x - x0) / (x1 - x0) * 1024, (1 - (y - PISO) / alto) * 1536];
  const emis = document.createElement('canvas'); emis.width = 256; emis.height = 384; const ke = emis.getContext('2d'); ke.fillStyle = '#000'; ke.fillRect(0, 0, 256, 384);
  for (let piso = 1; piso < 4; piso++) for (const vx of [2.5, 6.0, 9.0]) {
    const y0 = PISO + piso * 3.3 + 0.9; if (piso === 2 && vx === 6.0) continue; // la ventana real
    const [px, py] = aPix(vx - 0.8, y0 + 1.7), [qx, qy] = aPix(vx + 0.8, y0);
    k.fillStyle = '#2b2520'; k.fillRect(px - 8, py - 8, qx - px + 16, qy - py + 16);
    const prendida = r() < 0.35; k.fillStyle = prendida ? '#d9a35a' : '#1b2230'; k.fillRect(px, py, qx - px, qy - py);
    k.fillStyle = '#2b2520'; k.fillRect((px + qx) / 2 - 4, py, 8, qy - py);
    if (prendida) { ke.fillStyle = '#ffb060'; ke.fillRect(px / 4, py / 4, (qx - px) / 4, (qy - py) / 4); }
    // balcón
    k.fillStyle = '#26221e'; k.fillRect(px - 30, qy + 4, qx - px + 60, 10); for (let b = px - 26; b < qx + 30; b += 14) k.fillRect(b, qy - 60, 3, 64);
  }
  { const [px, py] = aPix(6.6, PISO + 2.4), [qx, qy] = aPix(9.6, PISO + 0.15); k.fillStyle = '#3c3f44'; k.fillRect(px, py, qx - px, qy - py); k.fillStyle = 'rgba(0,0,0,.35)'; for (let y = py; y < qy; y += 10) k.fillRect(px, y, qx - px, 3); } // persiana de un local
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; const te = new THREE.CanvasTexture(emis); te.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.95, emissive: 0xffffff, emissiveMap: te, emissiveIntensity: 1.2 });
  const forma = new THREE.Shape(); forma.moveTo(x0, PISO); forma.lineTo(x1, PISO); forma.lineTo(x1, PISO + alto); forma.lineTo(x0, PISO + alto); forma.closePath();
  const [vx0, vy0, vx1, vy1] = ENFRENTE.ventana, [px0, px1] = ENFRENTE.puerta;
  const X = x => x0 + x1 - x; // la fachada se gira media vuelta: el mundo x queda en X(x) de la forma
  const h1 = new THREE.Path(); h1.moveTo(X(vx1), vy0); h1.lineTo(X(vx0), vy0); h1.lineTo(X(vx0), vy1); h1.lineTo(X(vx1), vy1); h1.closePath(); forma.holes.push(h1);
  const h2 = new THREE.Path(); h2.moveTo(X(px1), PISO + 0.15); h2.lineTo(X(px0), PISO + 0.15); h2.lineTo(X(px0), PISO + 2.55); h2.lineTo(X(px1), PISO + 2.55); h2.closePath(); forma.holes.push(h2);
  const geo = new THREE.ShapeGeometry(forma); // UV a mano: x e y del mundo
  const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) uv.setXY(i, 1 - (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - PISO) / alto);
  const fachada = new THREE.Mesh(geo, mat); fachada.rotation.y = Math.PI; fachada.position.set(x0 + x1, 0, z0); fachada.receiveShadow = true; g.add(fachada);
  // el resto del edificio: caja detrás de la fachada (sin tapa adelante)
  const matOsc = new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 1 });
  for (const [w, h, d, x, y, z] of [[0.2, alto, 15, x0, PISO + alto / 2, z0 + 7.5], [0.2, alto, 15, x1, PISO + alto / 2, z0 + 7.5], [x1 - x0, 0.2, 15, (x0 + x1) / 2, PISO + alto, z0 + 7.5]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matOsc); b.position.set(x, y, z); g.add(b); }
  // la habitación oscura detrás de la ventana
  const sala = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.9, 4), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.95, side: THREE.BackSide }));
  sala.position.set(6, vy0 - 0.4 + 1.45, z0 + 2.05); sala.receiveShadow = true; g.add(sala);
  const pisoSala = vy0 - 0.4;
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), new THREE.MeshStandardMaterial({ map: T.madera(), color: 0x6a4a34, roughness: 0.5 })); mesa.position.set(6, pisoSala + 0.74, z0 + 0.75); mesa.receiveShadow = true; g.add(mesa);
  const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.72, 8), matOsc); pata.position.set(6, pisoSala + 0.36, z0 + 0.75); g.add(pata);
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xccd8dc, transparent: true, opacity: 0.3, roughness: 0.05 })); vaso.position.set(6.22, pisoSala + 0.81, z0 + 0.62); g.add(vaso);
  const llaves = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16), new THREE.MeshStandardMaterial({ color: 0xb0a070, metalness: 1, roughness: 0.3 })); llaves.rotation.x = Math.PI / 2; llaves.position.set(5.8, pisoSala + 0.762, z0 + 0.9); g.add(llaves);
  const marco = new THREE.MeshStandardMaterial({ color: 0x241d17, roughness: 0.7 });
  for (const [w, h, x, y] of [[1.7, 0.08, 6, vy1], [1.7, 0.08, 6, vy0], [0.08, 1.8, vx0, (vy0 + vy1) / 2], [0.08, 1.8, vx1, (vy0 + vy1) / 2], [0.05, 1.7, 6, (vy0 + vy1) / 2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), marco); b.position.set(x, y, z0 - 0.02); g.add(b); }
  const tel = crearCelular(guion); tel.grupo.position.set(5.95, pisoSala + 0.762, z0 + 0.72); tel.grupo.rotation.y = Math.PI + 0.25; g.add(tel.grupo);
  const luzTel = new THREE.PointLight(new THREE.Color(0.6, 0.75, 1.0), 0, 2.2, 2); luzTel.position.set(5.95, pisoSala + 0.95, z0 + 0.72); g.add(luzTel);
  const luzCalle = new THREE.SpotLight(new THREE.Color(...kelvin(3400)), 0.6, 9, 0.5, 0.8, 2); luzCalle.position.set(6, vy1 + 0.6, z0 - 3); luzCalle.target.position.set(6, pisoSala + 0.7, z0 + 1.6); g.add(luzCalle, luzCalle.target);

  // la puerta de calle: se abre y sale una luz cálida con una sombra larga
  const hoja = new THREE.Group(); hoja.position.set(px0, PISO + 0.15, z0 + 0.05); g.add(hoja);
  const tabla = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.06), new THREE.MeshStandardMaterial({ map: T.madera(), color: 0x4a3020, roughness: 0.6 })); tabla.position.set(0.6, 1.2, 0); hoja.add(tabla);
  const zaguan = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.45, 3), new THREE.MeshStandardMaterial({ color: 0xd8c4a0, roughness: 0.9, side: THREE.BackSide, emissive: new THREE.Color(...kelvin(2600)), emissiveIntensity: 0 }));
  zaguan.position.set((px0 + px1) / 2, PISO + 0.15 + 1.22, z0 + 1.55); g.add(zaguan);
  const luzZaguan = new THREE.SpotLight(new THREE.Color(...kelvin(2700)), 0, 40, 0.75, 0.5, 1.6); luzZaguan.position.set((px0 + px1) / 2, PISO + 2.3, z0 + 2.6); luzZaguan.target.position.set((px0 + px1) / 2 - 0.6, PISO, z0 - 10);
  luzZaguan.castShadow = true; luzZaguan.shadow.mapSize.set(2048, 2048); luzZaguan.shadow.camera.near = 0.2; luzZaguan.shadow.camera.far = 40; luzZaguan.shadow.radius = 3; luzZaguan.shadow.bias = -0.0005; g.add(luzZaguan, luzZaguan.target);
  const persona = silueta(); persona.g.position.set((px0 + px1) / 2, PISO + 0.15, z0 + 0.9); g.add(persona.g);

  return {
    grupo: g, tel, luzTel, sala, hoja, luzZaguan, zaguan, persona, pisoSala,
    poner(t, { puerta = 0, sale = 0, paso = 0, brillo = 0 } = {}) {
      tel.poner(t); luzTel.intensity = tel.pantalla.emissiveIntensity * 0.25;
      hoja.rotation.y = -1.35 * puerta; zaguan.material.emissiveIntensity = 0.35 * puerta; luzZaguan.intensity = 42 * puerta;
      // la persona: del zaguán a la vereda, y después cruza hacia el bodegón
      const p0 = new THREE.Vector3((px0 + px1) / 2, PISO + 0.15, z0 + 0.9), p1 = new THREE.Vector3((px0 + px1) / 2 - 0.2, PISO + 0.15, z0 - 1.2), p2 = new THREE.Vector3(0.3, PISO, 13.2);
      const q = sale < 1 ? p0.clone().lerp(p1, easeOut(sale, 2)) : p1.clone().lerp(p2, paso);
      persona.g.position.copy(q); persona.g.rotation.y = sale < 1 ? Math.PI : Math.atan2(p2.x - p1.x, p2.z - p1.z);
      persona.paso((sale < 1 ? sale * 3 : 3 + paso * 22));
      void brillo;
    },
  };
}

// ---------- el talonario, la birome y la comanda escrita ----------
export function crearTalonario(escena, guion) {
  const g = new THREE.Group(); g.position.set(0.42, 0, 0.1); g.rotation.y = -0.18; escena.add(g);
  const bloque = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.115), new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.9 })); bloque.position.y = 0.006; bloque.castShadow = bloque.receiveShadow = true; g.add(bloque);
  const c = document.createElement('canvas'); c.width = 512; c.height = 768; const k = c.getContext('2d');
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const lineas = guion.comanda || [];
  const dibujar = prog => {
    k.fillStyle = '#f5f0e5'; k.fillRect(0, 0, 512, 768);
    for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(120,110,90,${Math.random() * .05})`; k.fillRect(Math.random() * 512, Math.random() * 768, 1 + Math.random() * 3, 1); }
    k.fillStyle = '#6f7f93'; k.font = '600 30px "Inter", Arial, sans-serif'; k.letterSpacing = '6px'; k.fillText('COMANDA', 34, 74); k.letterSpacing = '0px';
    k.strokeStyle = 'rgba(111,127,147,.55)'; k.lineWidth = 2; k.beginPath(); k.moveTo(30, 96); k.lineTo(482, 96); k.stroke();
    k.strokeStyle = 'rgba(140,160,185,.35)'; k.lineWidth = 1.5; for (let y = 200; y < 720; y += 120) { k.beginPath(); k.moveTo(30, y); k.lineTo(482, y); k.stroke(); }
    k.fillStyle = '#1d3a6b';
    let punta = [40, 190];
    lineas.forEach((l, i) => {
      const u = sat(prog * lineas.length - i); if (u <= 0) return;
      k.font = `${i === 0 ? 92 : 78}px "Mansalva", cursive`; const w = k.measureText(l).width;
      k.save(); k.beginPath(); k.rect(30, 110 + i * 120, 40 + w * u, 120); k.clip(); k.fillText(l, 40, 190 + i * 120); k.restore();
      punta = [40 + w * u, 175 + i * 120];
    });
    tx.needsUpdate = true; return punta;
  };
  const hoja = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.115), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8, side: THREE.DoubleSide }));
  hoja.rotation.x = -Math.PI / 2; hoja.position.y = 0.0125; hoja.receiveShadow = true; hoja.castShadow = true; g.add(hoja);
  // la birome
  const birome = new THREE.Group(); g.add(birome);
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0xdde7ee, roughness: 0.15, transparent: true, opacity: 0.75 })); cuerpo.position.y = 0.075; birome.add(cuerpo);
  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0x1e4fa0, roughness: 0.4 })); tapa.position.y = 0.145; birome.add(tapa);
  const carga = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x1e4fa0 })); carga.position.y = 0.075; birome.add(carga);
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.0042, 0.012, 8), new THREE.MeshStandardMaterial({ color: 0xc0c0c4, metalness: 1, roughness: 0.3 })); punta.rotation.x = Math.PI; punta.position.y = 0.006; birome.add(punta);
  for (const o of [cuerpo, tapa, punta]) o.castShadow = true;
  // la sombra de la mano que escribe
  const manoTex = T.siluetaMano();
  const mano = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ alphaMap: manoTex, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false }));
  mano.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: manoTex, alphaTest: 0.5, side: THREE.DoubleSide }); mano.castShadow = true; mano.frustumCulled = false; g.add(mano);
  dibujar(0);
  return {
    grupo: g, hoja, tx, birome, mano,
    // prog: 0 a 1 de lo escrito; arranca: 0 a 1 la hoja se levanta (después la maneja la comanda que vuela)
    poner(t, { prog = 0, escribe = false, visible = true } = {}) {
      g.visible = visible; if (!visible) return;
      const [px, py] = dibujar(prog);
      const lx = (px / 512 - 0.5) * 0.08, lz = (py / 768 - 0.5) * 0.115;
      const tiembla = escribe ? Math.sin(t * 38) * 0.0012 : 0, sube = escribe ? 0 : 0.02;
      birome.position.set(lx + tiembla, 0.0125 + sube, lz + Math.cos(t * 31) * 0.0009);
      birome.rotation.set(-0.55, 0, -0.5);
      mano.position.set(lx + 0.05, 0.09 + sube, lz + 0.06); mano.rotation.set(-Math.PI / 2 + 0.2, 0, 2.2);
    },
  };
}

// ---------- la comanda que vuela (con lo escrito) ----------
export function crearHoja(escena, tx) {
  const geo = new THREE.PlaneGeometry(0.08, 0.115, 8, 12); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0 });
  const u = { uT: { value: 0 }, uAleteo: { value: 0 } };
  mat.onBeforeCompile = s => { s.uniforms.uT = u.uT; s.uniforms.uAleteo = u.uAleteo; s.vertexShader = 'uniform float uT, uAleteo;\n' + s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
      transformed.y += uAleteo * (sin(position.x * 70. + uT * 17.) * 0.012 + sin(position.z * 45. - uT * 13.) * 0.016) * (abs(position.x) + abs(position.z)) * 8.;`); };
  mat.customProgramCacheKey = () => 'hoja-vuela';
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.frustumCulled = false; escena.add(m);
  return { malla: m, u, mat };
}

// ---------- el sello «¡Oído!» fileteado ----------
export async function crearSello(escena, url = '/marca/oido-filete-cinta.svg') {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = 1820; c.height = 551; c.getContext('2d').drawImage(img, 0, 0, 1820, 551);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const w = 0.26, h = w * 551 / 1820;
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: 0.08, roughness: 0.45, metalness: 0.05, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.0 }));
  frente.rotation.x = -Math.PI / 2; frente.castShadow = true;
  const g = new THREE.Group(); g.add(frente); g.visible = false; escena.add(g);
  return { grupo: g, frente, ancho: w };
}

// ---------- papel picado ----------
export function crearConfeti(escena, n = 900) {
  const r = rng(606);
  const geo = new THREE.PlaneGeometry(0.022, 0.03); const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide });
  const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.castShadow = false; escena.add(m);
  const cols = [[0.96, 0.93, 0.86], [1, 1, 1], [0.56, 0.74, 0.9], [0.96, 0.93, 0.86], [0.92, 0.88, 0.8], [0.98, 0.62, 0.18]];
  // salen por el agujero del techo (x, z cerca de 0) y se abren al caer
  const d = Array.from({ length: n }, (_, i) => { const a = r() * Math.PI * 2, rr = Math.pow(r(), 0.6); return { a, dx: Math.cos(a) * (0.3 + rr * 1.6), dz: Math.sin(a) * (0.3 + rr * 1.3), x0: (r() - .5) * 0.32, z0: (r() - .5) * 0.32, dl: Math.pow(r(), 1.3) * 3.2, v: 0.55 + r() * 0.5, f: r() * 6, w: [r() * 8, r() * 8, r() * 8], col: cols[i % cols.length] }; });
  d.forEach((p, i) => m.setColorAt(i, new THREE.Color(...p.col)));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  return {
    malla: m,
    poner(t, t0, { escala = 1 } = {}) {
      const u = t - t0; m.visible = u > 0; if (!m.visible) return;
      d.forEach((c, i) => {
        const uu = u - c.dl; if (uu <= 0) { p.set(0, -50, 0); m4.compose(p, q, s.setScalar(0.0001)); m.setMatrixAt(i, m4); return; }
        const abre = 1 - Math.exp(-uu * 0.55), x = c.x0 + c.dx * abre, z = c.z0 + c.dz * abre;
        let y = 3.04 - c.v * uu; const piso = (Math.abs(x) < 1.7 && Math.abs(z) < 0.36) ? 0.003 + (i % 5) * 0.0005 : PISO + 0.003;
        const enPiso = y <= piso; y = Math.max(piso, y);
        p.set(x + Math.sin(uu * 1.7 + c.f) * 0.12 * (enPiso ? 0 : 1), y, z + Math.cos(uu * 1.3 + c.f) * 0.1 * (enPiso ? 0 : 1));
        e.set(enPiso ? -Math.PI / 2 : c.w[0] * uu, c.f + (enPiso ? 0 : c.w[1] * uu), enPiso ? 0 : c.w[2] * uu); q.setFromEuler(e); s.setScalar(escala); m4.compose(p, q, s); m.setMatrixAt(i, m4);
      });
      m.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- la flecha ámbar: en la punta de la torre y, después, el camino en las baldosas ----------
export function crearFlechas(escena) {
  const mat = new THREE.MeshBasicMaterial({ color: AMBAR.clone().multiplyScalar(6), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const forma = new THREE.Shape(); forma.moveTo(0, 0); forma.lineTo(-0.5, 0.55); forma.lineTo(-0.18, 0.55); forma.lineTo(-0.18, 1.4); forma.lineTo(0.18, 1.4); forma.lineTo(0.18, 0.55); forma.lineTo(0.5, 0.55); forma.closePath();
  const punta = new THREE.Mesh(new THREE.ShapeGeometry(forma), mat); punta.frustumCulled = false; escena.add(punta);
  // el camino: chevrones sobre la vereda y la calle, desde la puerta de enfrente hasta la del bodegón
  const chev = new THREE.Shape(); chev.moveTo(0, 0.12); chev.lineTo(-0.16, -0.06); chev.lineTo(-0.1, -0.06); chev.lineTo(0, 0.04); chev.lineTo(0.1, -0.06); chev.lineTo(0.16, -0.06); chev.closePath();
  const gChev = new THREE.ShapeGeometry(chev); gChev.rotateX(-Math.PI / 2);
  const camino = [], a = new THREE.Vector3(3.0, PISO + 0.155, 24.6), b = new THREE.Vector3(0.0, PISO + 0.155, 12.3);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), p = a.clone().lerp(b, u); const enCalle = p.z < 22.4 && p.z > 15; if (enCalle) p.y = PISO + 0.005;
    const m = new THREE.Mesh(gChev, new THREE.MeshBasicMaterial({ color: AMBAR.clone().multiplyScalar(5), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI; m.scale.setScalar(1.4); escena.add(m); camino.push(m);
  }
  return {
    punta, camino,
    ponerPunta(pos, cam, alfa, tam) { punta.visible = alfa > 0.01; mat.opacity = alfa; punta.position.copy(pos); punta.scale.setScalar(tam); punta.lookAt(cam); punta.rotateZ(Math.PI); },
    ponerCamino(prog, alfa = 1) { camino.forEach((m, i) => { const u = sat(prog * (N + 4) - i); m.material.opacity = alfa * u * (0.75 + 0.25 * (i % 2)); m.visible = u > 0 && alfa > 0; }); },
  };
}

// ---------- una bici que pasa: luz delantera y trasera ----------
export function crearBici(escena) {
  const g = new THREE.Group(); escena.add(g);
  const del = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(40) })); del.position.set(0.85, 1.0, 0); g.add(del);
  const tra = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.05, 0.03).multiplyScalar(18) })); tra.position.set(-0.85, 0.85, 0); g.add(tra);
  const matCuadro = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5, metalness: 0.4 });
  for (const x of [-0.55, 0.55]) { const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 28), matCuadro); rueda.position.set(x, 0.34, 0); g.add(rueda); }
  const cuadro = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.04), matCuadro); cuadro.position.set(0, 0.62, 0); cuadro.rotation.z = 0.15; g.add(cuadro);
  const luz = new THREE.SpotLight(new THREE.Color(1, 0.95, 0.85), 0, 14, 0.45, 0.7, 2); luz.position.set(0.9, 1.0, 0); luz.target.position.set(6, 0, 0); g.add(luz, luz.target);
  return { g, luz, poner(x, z, on) { g.visible = on; g.position.set(x, PISO, z); luz.intensity = on ? 18 : 0; } };
}

// ---------- copas que brindan (las manos, sólo en sombra) ----------
export function crearCopas(escena, centro) {
  const g = new THREE.Group(); g.position.copy(centro); escena.add(g);
  const pts = [[0, 0], [0.035, 0], [0.036, 0.004], [0.004, 0.012], [0.004, 0.09], [0.03, 0.11], [0.042, 0.15], [0.04, 0.19], [0.038, 0.19], [0.04, 0.15], [0.028, 0.112], [0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, 24);
  const matCopa = new THREE.MeshStandardMaterial({ color: 0xdfeaec, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.4, envMapIntensity: 3 });
  const matVino = new THREE.MeshStandardMaterial({ color: 0x4a0712, roughness: 0.15, transparent: true, opacity: 0.88 });
  const manoTex = T.siluetaMano();
  const copas = [0, 1, 2, 3].map(i => {
    const a = i / 4 * Math.PI * 2 + 0.4, base = new THREE.Vector3(Math.cos(a) * 0.3, 0.783, Math.sin(a) * 0.3);
    const c = new THREE.Group(); g.add(c);
    const vidrio = new THREE.Mesh(geo, matCopa); vidrio.castShadow = true; c.add(vidrio);
    const vino = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.026, 0.035, 16), matVino); vino.position.y = 0.13; c.add(vino);
    const mano = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ alphaMap: manoTex, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false }));
    mano.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: manoTex, alphaTest: 0.5, side: THREE.DoubleSide }); mano.castShadow = true; mano.frustumCulled = false;
    mano.position.set(-Math.cos(a) * 0.06, 0.07, -Math.sin(a) * 0.06); mano.rotation.set(0, -a + Math.PI / 2, Math.PI / 2); c.add(mano);
    return { c, base, a };
  });
  return {
    g, copas,
    poner(t, t0) { // t0: el choque
      for (const k of copas) {
        const u = t - t0; const sube = smooth(-1.2, -0.3, u) * (1 - smooth(0.5, 1.4, u));
        const hacia = new THREE.Vector3(-Math.cos(k.a), 0, -Math.sin(k.a)).multiplyScalar(0.22 * sube);
        k.c.position.copy(k.base).add(hacia); k.c.position.y += 0.2 * sube;
        const choque = u > 0 ? rebote(u, 9, 9) * 0.05 : 0; k.c.rotation.set(-0.18 * sube * Math.cos(k.a) + choque, 0, 0.18 * sube * Math.sin(k.a));
      }
    },
  };
}

// ---------- gente: siluetas a contraluz (dibujadas, no muñecos) ----------
// Cada persona es un recorte oscuro con forma real de persona, de pie o sentada, sobre un plano que mira a la cámara.
function dibujarPersona(g, W, H, r, sentada, trazo = false) {
  const s = H / 1000, cx = W / 2, alt = 0.92 + r() * 0.12;
  g.save(); g.translate(cx, H); g.scale(s, s);
  const y = v => -v * alt; // de abajo hacia arriba
  g.beginPath();
  if (!sentada) {
    const abrigo = r() < 0.6, cart = r() < 0.4, pelo = r();
    // piernas
    g.moveTo(-70, 0); g.lineTo(-62, y(420)); g.lineTo(-10, y(430)); g.lineTo(-4, 0); g.closePath();
    g.moveTo(8, 0); g.lineTo(14, y(430)); g.lineTo(66, y(420)); g.lineTo(74, 0); g.closePath();
    // torso con hombros redondeados (abrigo largo o campera)
    const base = abrigo ? 300 : 430, ancho = 120 + r() * 30;
    g.moveTo(-ancho * 0.85, y(base)); g.bezierCurveTo(-ancho, y(560), -ancho * 1.05, y(700), -ancho * 0.9, y(760));
    g.bezierCurveTo(-ancho * 0.7, y(800), -40, y(805), -30, y(815)); g.lineTo(30, y(815));
    g.bezierCurveTo(40, y(805), ancho * 0.7, y(800), ancho * 0.9, y(760)); g.bezierCurveTo(ancho * 1.05, y(700), ancho, y(560), ancho * 0.85, y(base)); g.closePath();
    // brazos
    g.moveTo(-ancho * 0.95, y(750)); g.bezierCurveTo(-ancho * 1.2, y(620), -ancho * 1.15, y(520), -ancho * 1.05, y(450)); g.lineTo(-ancho * 0.85, y(460)); g.bezierCurveTo(-ancho * 0.9, y(560), -ancho * 0.85, y(650), -ancho * 0.75, y(740)); g.closePath();
    const tel = r() < 0.35;
    if (tel) { g.moveTo(ancho * 0.9, y(750)); g.bezierCurveTo(ancho * 1.15, y(640), ancho * 0.9, y(600), ancho * 0.3, y(640)); g.lineTo(ancho * 0.28, y(600)); g.bezierCurveTo(ancho * 0.9, y(560), ancho * 1.05, y(620), ancho * 0.75, y(740)); g.closePath(); g.rect(ancho * 0.1, y(675), 34, 60); }
    else { g.moveTo(ancho * 0.95, y(750)); g.bezierCurveTo(ancho * 1.2, y(620), ancho * 1.15, y(520), ancho * 1.05, y(450)); g.lineTo(ancho * 0.85, y(460)); g.bezierCurveTo(ancho * 0.9, y(560), ancho * 0.85, y(650), ancho * 0.75, y(740)); g.closePath(); }
    if (cart) { g.moveTo(-ancho * 1.1, y(560)); g.lineTo(-ancho * 1.45, y(470)); g.lineTo(-ancho * 1.45, y(380)); g.lineTo(-ancho * 1.0, y(380)); g.closePath(); }
    // cuello y cabeza (algo de pelo o gorra)
    g.rect(-26, y(870), 52, 70);
    g.ellipse(0, y(925), 62, 78 * alt, 0, 0, Math.PI * 2);
    if (pelo < 0.3) g.ellipse(-30, y(905), 30, 60, 0.4, 0, Math.PI * 2); // pelo atado
    else if (pelo < 0.5) { g.ellipse(0, y(975), 72, 26, 0, 0, Math.PI * 2); g.rect(0, y(975), 100, 14); } // gorra
  } else {
    // sentada, de espaldas: cabeza, hombros, espalda y un brazo apoyado
    const ancho = 150 + r() * 40;
    g.moveTo(-ancho, 0); g.bezierCurveTo(-ancho * 1.05, y(200), -ancho * 1.1, y(330), -ancho * 0.9, y(380));
    g.bezierCurveTo(-ancho * 0.6, y(420), -40, y(425), -30, y(440)); g.lineTo(30, y(440));
    g.bezierCurveTo(40, y(425), ancho * 0.6, y(420), ancho * 0.9, y(380)); g.bezierCurveTo(ancho * 1.1, y(330), ancho * 1.05, y(200), ancho, 0); g.closePath();
    g.rect(-28, y(500), 56, 80); g.ellipse(0, y(560), 66, 80, 0, 0, Math.PI * 2);
    if (r() < 0.4) g.ellipse(-24, y(530), 40, 70, 0.3, 0, Math.PI * 2);
    g.moveTo(ancho * 0.8, y(360)); g.bezierCurveTo(ancho * 1.3, y(300), ancho * 1.4, y(200), ancho * 1.2, y(120)); g.lineTo(ancho * 0.95, y(150)); g.bezierCurveTo(ancho * 1.05, y(230), ancho * 0.95, y(280), ancho * 0.7, y(330)); g.closePath();
  }
  if (trazo) g.stroke(); else g.fill('nonzero'); g.restore();
}

export function crearGente(escena, lugares) {
  // lugares: [{ x, y, z, alto, sentada, ry }]
  const g = new THREE.Group(); escena.add(g);
  const r = rng(808), cols = [0x0d0f14, 0x121014, 0x0f1311, 0x16100f, 0x101218];
  const personas = lugares.map((L, i) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const k = c.getContext('2d'); k.fillStyle = '#fff';
    dibujarPersona(k, 256, 512, rng(900 + i * 13), L.sentada);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.NoColorSpace;
    // el color: ropa oscura con un filo de luz cálida de un lado (contraluz)
    const cc = document.createElement('canvas'); cc.width = 256; cc.height = 512; const kc = cc.getContext('2d');
    const ropa = ['#0c0e13', '#130c0d', '#0d110f', '#11100e', '#0e0e12'][i % 5]; kc.fillStyle = ropa; kc.fillRect(0, 0, 256, 512);
    kc.save(); kc.globalCompositeOperation = 'source-over'; kc.filter = 'blur(5px)'; kc.strokeStyle = 'rgba(255,160,80,.5)'; kc.lineWidth = 5; kc.translate(-6, 0);
    dibujarPersona(kc, 256, 512, rng(900 + i * 13), L.sentada, true); kc.restore();
    kc.globalCompositeOperation = 'destination-in'; kc.drawImage(c, 0, 0);
    const txc = new THREE.CanvasTexture(cc); txc.colorSpace = THREE.SRGBColorSpace;
    const alto = L.alto || (L.sentada ? 0.95 : 1.62 + r() * 0.22);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(alto * 0.5, alto), new THREE.MeshStandardMaterial({ map: txc, alphaMap: tx, alphaTest: 0.4, roughness: 0.95, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: txc, emissiveIntensity: 0.1 }));
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: tx, alphaTest: 0.4, side: THREE.DoubleSide });
    m.castShadow = true; m.position.set(L.x, L.y + alto / 2, L.z); if (L.espejo) m.scale.x = -1; g.add(m);
    return { m, L, f: r() * 6 };
  });
  return {
    grupo: g,
    poner(t, cam) {
      for (const p of personas) {
        let x = p.L.x, z = p.L.z, anda = 0, yR = null;
        const R = p.L.ruta;
        if (R) { if (t <= R[0][0]) { x = R[0][1]; z = R[0][2]; } else if (t >= R[R.length - 1][0]) { x = R[R.length - 1][1]; z = R[R.length - 1][2]; } else { let k = 0; while (t > R[k + 1][0]) k++; const u = (t - R[k][0]) / (R[k + 1][0] - R[k][0]); x = R[k][1] + (R[k + 1][1] - R[k][1]) * u; z = R[k][2] + (R[k + 1][2] - R[k][2]) * u; if (R[k].length > 3) yR = R[k][3] + (R[k + 1][3] - R[k][3]) * u; anda = 1; } }
        p.m.visible = !(p.L.hasta && t > p.L.hasta) && !(p.L.desde && t < p.L.desde);
        const dx = cam.x - x, dz = cam.z - z; p.m.rotation.y = Math.atan2(dx, dz);
        p.m.position.set(x + (p.L.sentada || anda ? 0 : Math.sin(t * 0.4 + p.f) * 0.02), (yR ?? p.L.y) + p.m.geometry.parameters.height / 2 + (anda ? Math.abs(Math.sin(t * 9 + p.f)) * 0.025 : Math.sin(t * 1.3 + p.f) * 0.004), z);
        p.m.rotation.z = anda ? Math.sin(t * 9 + p.f) * 0.03 : 0;
      }
    },
  };
}

// ---------- el reloj de pared del salón (versión 2): las agujas corren mientras se cae la noche ----------
export function crearReloj(escena, pos, rotY = 0, radio = 0.26) {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rotY; escena.add(g);
  const c = document.createElement('canvas'); c.width = c.height = 512; const k = c.getContext('2d');
  k.fillStyle = '#efe6d2'; k.beginPath(); k.arc(256, 256, 250, 0, Math.PI * 2); k.fill();
  k.fillStyle = '#1b1712'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.font = '500 54px "Young Serif", Georgia, serif';
  for (let h = 1; h <= 12; h++) { const a = h / 12 * Math.PI * 2; k.fillText(String(h), 256 + Math.sin(a) * 190, 256 - Math.cos(a) * 190); }
  for (let m = 0; m < 60; m++) { const a = m / 60 * Math.PI * 2, l = m % 5 ? 10 : 22; k.lineWidth = m % 5 ? 3 : 6; k.strokeStyle = '#1b1712'; k.beginPath(); k.moveTo(256 + Math.sin(a) * 238, 256 - Math.cos(a) * 238); k.lineTo(256 + Math.sin(a) * (238 - l), 256 - Math.cos(a) * (238 - l)); k.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const cara = new THREE.Mesh(new THREE.CircleGeometry(radio, 48), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.05 })); g.add(cara);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(radio * 1.02, radio * 0.07, 10, 48), new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.4, metalness: 0.2 })); g.add(aro);
  const matA = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.5 });
  const aguja = (largo, ancho) => { const p = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, largo, 0.006), matA); m.position.y = largo / 2 - largo * 0.12; p.add(m); p.position.z = 0.012; g.add(p); return p; };
  const hh = aguja(radio * 0.55, radio * 0.07), mm = aguja(radio * 0.82, radio * 0.045);
  return { grupo: g, poner(horas) { mm.rotation.z = -(horas % 1) * Math.PI * 2; hh.rotation.z = -((horas % 12) / 12) * Math.PI * 2; } };
}

// ---------- el sello de goma (versión 2): mango de madera, taco y goma; deja «¡Oído!» en tinta azul en la comanda ----------
export async function crearSelloGoma(escena, url = '/marca/oido-filete-cinta.svg') {
  const img = new Image(); img.src = url; await img.decode();
  // la tinta: las caras de las letras del «¡Oído!» (sin el volumen de colores), con un marco redondeado y el grano de un sello real
  const W = 1000, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const lw = 840, lh = lw * 551 / 1820, tmp = document.createElement('canvas'); tmp.width = lw; tmp.height = Math.round(lh); const tg = tmp.getContext('2d'); tg.drawImage(img, 0, 0, lw, lh);
  const d = tg.getImageData(0, 0, tmp.width, tmp.height), px = d.data, r = rng(4321);
  for (let i = 0; i < px.length; i += 4) { const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255, a = px[i + 3] / 255; const k = a * Math.min(1, Math.max(0, (lum - 0.62) / 0.16)); px[i] = 18; px[i + 1] = 58; px[i + 2] = 165; px[i + 3] = 255 * k * (0.78 + r() * 0.22); }
  tg.putImageData(d, 0, 0);
  g.drawImage(tmp, (W - lw) / 2, (H - lh) / 2 + 6);
  g.strokeStyle = 'rgba(18,58,165,.92)'; g.lineWidth = 16; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 46); g.stroke(); g.lineWidth = 5; g.beginPath(); g.roundRect(40, 40, W - 80, H - 80, 30); g.stroke();
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; g.beginPath(); g.arc(r() * W, r() * H, 0.6 + r() * 2.6, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(r() * W, r() * H, 40 + r() * 90, 8 + r() * 20, r() * 3, 0, Math.PI * 2); g.fill(); } // donde la goma apoyó menos
  g.globalCompositeOperation = 'source-over';
  // el sello: mango torneado, taco de madera y la goma roja
  const grupo = new THREE.Group(); grupo.visible = false; escena.add(grupo);
  const mad = new THREE.MeshStandardMaterial({ map: T.madera(), color: 0x9a6a44, roughness: 0.45 });
  const perfil = [[0, 0], [0.012, 0], [0.012, 0.012], [0.008, 0.02], [0.008, 0.05], [0.016, 0.062], [0.018, 0.075], [0.012, 0.086], [0, 0.088]].map(([x, y]) => new THREE.Vector2(x, y));
  const mango = new THREE.Mesh(new THREE.LatheGeometry(perfil, 24), mad); mango.position.y = 0.024; mango.castShadow = true; grupo.add(mango);
  const taco = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.022, 0.036), mad); taco.position.y = 0.013; taco.castShadow = true; grupo.add(taco);
  const goma = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.032), new THREE.MeshStandardMaterial({ color: 0x5a1712, roughness: 0.8 })); goma.position.y = 0.002; goma.castShadow = true; grupo.add(goma);
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.012), new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.6 })); placa.position.set(0, 0.016, 0.0181); grupo.add(placa); // etiqueta en el canto
  return { grupo, tinta: c };
}
