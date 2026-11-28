// La fachada porteña de estilo francés (versión 2): el bodegón en la planta baja de un edificio de piedra París,
// dos pisos de ventanas francesas con balcones de hierro forjado, molduras, cornisa con dentículos y mansarda
// de pizarra con buhardillas. Y la vereda: mesitas de mármol con sillas de madera curvada.
import * as THREE from 'three';
import { rng } from './util.js';
import * as T from './texturas.js';
import { PISO } from './cocina.js';

const ANCHO = 4.33;
export const Y1 = 3.6, ALTO_PISO = 3.3, YC = Y1 + 2 * ALTO_PISO; // primer piso, altura de cada piso, base de la cornisa
export const MESAS_VEREDA = [[-1.95, 13.5], [-3.4, 13.5], [-5.5, 13.5]]; // x, z (la fachada está en z = 12)
const VENTANAS = [-2.6, 0, 2.6];

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const textura = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

// una ventana francesa vista de afuera: dos hojas con vidrios repartidos, cortina detrás (prendida o apagada)
function texVentana(prendida, semilla) {
  const [c, g] = lienzo(256, 512), r = rng(semilla);
  if (prendida) {
    const f = g.createLinearGradient(0, 0, 0, 512); f.addColorStop(0, '#f6c784'); f.addColorStop(0.6, '#d78f45'); f.addColorStop(1, '#8a4c22'); g.fillStyle = f; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 14; i++) { const x = r() * 256; g.fillStyle = `rgba(255,236,200,${0.08 + r() * 0.12})`; g.fillRect(x, 0, 6 + r() * 14, 512); } // pliegues de la cortina
    g.fillStyle = 'rgba(60,30,12,.35)'; g.fillRect(0, 380, 256, 132);
  } else {
    const f = g.createLinearGradient(0, 0, 256, 512); f.addColorStop(0, '#1b2433'); f.addColorStop(0.5, '#0a0e15'); f.addColorStop(1, '#121a26'); g.fillStyle = f; g.fillRect(0, 0, 256, 512);
    g.fillStyle = 'rgba(140,160,190,.08)'; g.beginPath(); g.moveTo(0, 120); g.lineTo(256, 0); g.lineTo(256, 60); g.lineTo(0, 200); g.fill(); // reflejo
  }
  g.fillStyle = '#2a1d14'; g.fillRect(0, 0, 256, 14); g.fillRect(0, 498, 256, 14); g.fillRect(0, 0, 14, 512); g.fillRect(242, 0, 14, 512); g.fillRect(122, 0, 12, 512);
  for (const y of [128, 256, 384]) g.fillRect(0, y - 4, 256, 8);
  for (const x of [68, 188]) g.fillRect(x - 3, 0, 6, 512);
  return textura(c);
}
// persiana de madera, cerrada o abierta contra la pared
function texPersiana() {
  const [c, g] = lienzo(128, 512); g.fillStyle = '#34473d'; g.fillRect(0, 0, 128, 512);
  for (let y = 10; y < 502; y += 12) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(8, y, 112, 3); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(8, y + 3, 112, 2); }
  g.strokeStyle = '#1f2b25'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 504);
  return textura(c);
}
// la baranda de hierro forjado: barrotes, pasamanos y una guarda de anillos (alfa: blanco es hierro)
function texBaranda() {
  const [c, g] = lienzo(256, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  g.fillRect(0, 0, 256, 14); g.fillRect(0, 238, 256, 12); g.fillRect(0, 84, 256, 6); g.fillRect(0, 168, 256, 6);
  for (let x = 4; x < 256; x += 21.33) g.fillRect(x, 0, 4, 256);
  g.lineWidth = 5; for (let x = 32; x < 256; x += 64) { g.beginPath(); g.arc(x, 129, 26, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x, 129, 9, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 4; for (let x = 0; x < 256; x += 64) { g.beginPath(); g.moveTo(x, 40); g.bezierCurveTo(x + 20, 20, x + 44, 60, x + 64, 40); g.stroke(); g.beginPath(); g.moveTo(x, 214); g.bezierCurveTo(x + 20, 234, x + 44, 194, x + 64, 214); g.stroke(); }
  const t = textura(c, false); t.wrapS = THREE.RepeatWrapping; return t;
}
// pizarra en escamas para la mansarda
function texPizarra() {
  const [c, g] = lienzo(256, 256); g.fillStyle = '#2f3843'; g.fillRect(0, 0, 256, 256);
  for (let fila = 0; fila < 12; fila++) for (let k = -1; k < 10; k++) {
    const x = k * 28 + (fila % 2) * 14, y = fila * 22; g.fillStyle = `hsl(212, 14%, ${20 + ((k * 7 + fila * 3) % 5) * 1.6}%)`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 28, y); g.lineTo(x + 28, y + 14); g.arc(x + 14, y + 14, 14, 0, Math.PI); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke();
  }
  const t = textura(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function crearFachadaFrancesa(g, { matMaderaOsc }) {
  const r = rng(515), zf = 12 + 0.16; // frente de la fachada
  const sombra = o => { o.castShadow = true; o.receiveShadow = true; return o; };
  const matPiedra = new THREE.MeshStandardMaterial({ map: T.revoque('#d3c7ae', 41), roughness: 0.9 });
  const matMoldura = new THREE.MeshStandardMaterial({ map: T.revoque('#ddd2ba', 43), roughness: 0.85 });
  const matMedianera = new THREE.MeshStandardMaterial({ map: T.revoque('#8f867a', 44), roughness: 0.97 });
  const matHierro = new THREE.MeshStandardMaterial({ color: 0x141618, metalness: 0.65, roughness: 0.45 });
  const matPizarra = new THREE.MeshStandardMaterial({ map: texPizarra(), color: 0xb8c2cc, metalness: 0.25, roughness: 0.55 });
  const matPersiana = new THREE.MeshStandardMaterial({ map: texPersiana(), roughness: 0.7 });
  const caja = (w, h, d, mat, x, y, z) => { const m = sombra(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); m.position.set(x, y, z); g.add(m); return m; };

  // planta baja: pilastras a los lados de la puerta (hasta la moldura del cartel) y en las puntas (hasta la cornisa)
  for (const x of [-1.27, 1.27]) { caja(0.34, 3.34, 0.1, matMoldura, x, PISO + 1.67, zf + 0.05); caja(0.44, 0.5, 0.16, matMoldura, x, PISO + 0.4, zf + 0.08); }
  for (const x of [-4.15, 4.15]) { caja(0.36, 4.45, 0.12, matMoldura, x, PISO + 2.22, zf + 0.06); caja(0.46, 0.5, 0.18, matMoldura, x, PISO + 0.4, zf + 0.09); caja(0.46, 0.16, 0.2, matMoldura, x, 3.36, zf + 0.1); }
  for (const x of [-2.55, 2.55]) caja(1.95, 0.08, 0.14, matMoldura, x, 0.0, zf + 0.07); // alféizar de las vidrieras

  // los dos pisos de arriba: pared de piedra con seis huecos
  const forma = new THREE.Shape(); forma.moveTo(-ANCHO, Y1); forma.lineTo(ANCHO, Y1); forma.lineTo(ANCHO, YC); forma.lineTo(-ANCHO, YC); forma.closePath();
  const huecos = [];
  for (let f = 0; f < 2; f++) for (const cx of VENTANAS) {
    const yb = Y1 + f * ALTO_PISO + 0.08, yt = yb + 2.35, x0 = cx - 0.56, x1 = cx + 0.56; huecos.push({ f, cx, yb, yt });
    const h = new THREE.Path(); h.moveTo(x0, yb); h.lineTo(x1, yb); h.lineTo(x1, yt); h.lineTo(x0, yt); h.closePath(); forma.holes.push(h);
  }
  const pared = sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.32, bevelEnabled: false }), matPiedra)); pared.position.z = 12 - 0.16; g.add(pared);
  // el volumen de atrás (medianeras) para que el edificio tenga cuerpo
  caja(ANCHO * 2, YC + 0.42 - Y1, 11.3, matMedianera, 0, (YC + 0.42 + Y1) / 2, 0.5 + 11.3 / 2 - 0.15);

  // ventanas: unas prendidas con la persiana abierta, otras con la persiana cerrada
  const texPr = [texVentana(true, 1), texVentana(true, 2)], texAp = texVentana(false, 3);
  const prendidas = [true, false, true, false, true, true];
  huecos.forEach((h, i) => {
    const on = prendidas[i], alto = h.yt - h.yb;
    const vid = new THREE.Mesh(new THREE.PlaneGeometry(1.12, alto), on
      ? new THREE.MeshStandardMaterial({ map: texPr[i % 2], emissive: 0xffffff, emissiveMap: texPr[i % 2], emissiveIntensity: 0.9 + r() * 0.5, roughness: 0.3 })
      : new THREE.MeshStandardMaterial({ map: texAp, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.6 }));
    vid.position.set(h.cx, (h.yb + h.yt) / 2, 12 - 0.06); g.add(vid);
    if (on) { const luz = new THREE.PointLight(0xffb066, 0.9, 3.2, 2); luz.position.set(h.cx, h.yb + 1.2, 12 + 0.7); luz.userData.fachada = true; g.add(luz); }
    // chambrana
    caja(0.1, alto + 0.1, 0.07, matMoldura, h.cx - 0.61, (h.yb + h.yt) / 2, zf + 0.035); caja(0.1, alto + 0.1, 0.07, matMoldura, h.cx + 0.61, (h.yb + h.yt) / 2, zf + 0.035);
    // persianas
    if (on) for (const s of [-1, 1]) caja(0.56, alto, 0.035, matPersiana, h.cx + s * 0.95, (h.yb + h.yt) / 2, zf + 0.02);
    else for (const s of [-1, 1]) caja(0.555, alto, 0.035, matPersiana, h.cx + s * 0.28, (h.yb + h.yt) / 2, 12 + 0.06);
    // remate: frontón triangular en el primer piso, cornisita con clave en el segundo
    if (h.f === 0) {
      const tri = new THREE.Shape(); tri.moveTo(-0.78, 0); tri.lineTo(0.78, 0); tri.lineTo(0, 0.36); tri.closePath();
      const fr = sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.16, bevelEnabled: false }), matMoldura)); fr.position.set(h.cx, h.yt + 0.17, zf); g.add(fr);
      caja(1.66, 0.1, 0.22, matMoldura, h.cx, h.yt + 0.12, zf + 0.11);
    } else { caja(1.5, 0.1, 0.2, matMoldura, h.cx, h.yt + 0.14, zf + 0.1); caja(0.2, 0.3, 0.1, matMoldura, h.cx, h.yt + 0.03, zf + 0.05); }
  });

  // balcones de hierro: corrido en el primer piso, uno por ventana en el segundo
  const tb = texBaranda(), matBar = new THREE.MeshStandardMaterial({ color: 0x141618, metalness: 0.65, roughness: 0.45, alphaMap: tb, alphaTest: 0.5, side: THREE.DoubleSide });
  const baranda = (w, x, y, z, ry = 0) => {
    const t = tb.clone(); t.needsUpdate = true; t.repeat.set(w / 1.0, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.95), matBar.clone()); m.material.alphaMap = t; m.position.set(x, y + 0.475, z); m.rotation.y = ry;
    m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide }); g.add(m);
  };
  caja(ANCHO * 2 + 0.24, 0.14, 0.8, matMoldura, 0, Y1 - 0.07, zf + 0.4);
  for (const x of [-3.9, -1.95, -0.65, 0.65, 1.95, 3.9]) { const m = caja(0.16, 0.36, 0.6, matMoldura, x, Y1 - 0.32, zf + 0.3); m.scale.set(1, 1, 1); }
  baranda(ANCHO * 2 + 0.2, 0, Y1, zf + 0.78); baranda(0.78, -ANCHO - 0.1, Y1, zf + 0.39, Math.PI / 2); baranda(0.78, ANCHO + 0.1, Y1, zf + 0.39, Math.PI / 2);
  for (const cx of VENTANAS) {
    const y = Y1 + ALTO_PISO; caja(1.5, 0.12, 0.5, matMoldura, cx, y - 0.06, zf + 0.25);
    for (const s of [-0.5, 0.5]) caja(0.12, 0.26, 0.4, matMoldura, cx + s, y - 0.24, zf + 0.2);
    baranda(1.5, cx, y, zf + 0.48); baranda(0.48, cx - 0.75, y, zf + 0.24, Math.PI / 2); baranda(0.48, cx + 0.75, y, zf + 0.24, Math.PI / 2);
  }
  // molduras horizontales y la cornisa grande con dentículos y ménsulas
  caja(ANCHO * 2 + 0.1, 0.12, 0.12, matMoldura, 0, Y1 + ALTO_PISO - 0.2, zf + 0.06);
  caja(ANCHO * 2 + 0.5, 0.42, 0.55, matMoldura, 0, YC + 0.21, zf + 0.27);
  caja(ANCHO * 2 + 0.3, 0.12, 0.3, matMoldura, 0, YC - 0.06, zf + 0.15);
  { const dg = new THREE.BoxGeometry(0.07, 0.1, 0.1), n = Math.floor((ANCHO * 2) / 0.16), im = new THREE.InstancedMesh(dg, matMoldura, n), m4 = new THREE.Matrix4(); for (let i = 0; i < n; i++) { m4.makeTranslation(-ANCHO + 0.08 + i * 0.16, YC - 0.17, zf + 0.05); im.setMatrixAt(i, m4); } im.castShadow = true; g.add(im); }
  for (let i = 0; i < 11; i++) caja(0.12, 0.2, 0.42, matMoldura, -ANCHO + 0.2 + i * (ANCHO * 2 - 0.4) / 10, YC - 0.02, zf + 0.21);

  // la mansarda de pizarra con tres buhardillas
  const yM = YC + 0.42;
  { const p = new THREE.Shape(); p.moveTo(0, 0); p.lineTo(0, 0.08); p.lineTo(0.95, 2.4); p.lineTo(9.5, 2.4); p.lineTo(9.5, 0); p.closePath();
    const geo = new THREE.ExtrudeGeometry(p, { depth: ANCHO * 2 + 0.1, bevelEnabled: false }); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9, uv.getY(i) * 0.9);
    const m = sombra(new THREE.Mesh(geo, matPizarra)); m.rotation.y = Math.PI / 2; m.position.set(-ANCHO - 0.05, yM, zf + 0.1); g.add(m); }
  caja(ANCHO * 2 + 0.2, 0.06, 0.08, matHierro, 0, yM + 2.42, zf + 0.1 - 0.95); // la cresta de zinc
  const texBuh = texVentana(true, 7);
  VENTANAS.forEach((cx, i) => {
    const zb = zf + 0.1 - 0.55, yb = yM + 0.25;
    caja(1.0, 1.45, 0.9, matPiedra, cx, yb + 0.72, zb - 0.45 + 0.02);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.95), i === 1 ? new THREE.MeshStandardMaterial({ map: texBuh, emissive: 0xffffff, emissiveMap: texBuh, emissiveIntensity: 1.1, roughness: 0.3 }) : new THREE.MeshStandardMaterial({ map: texAp, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.6 }));
    v.position.set(cx, yb + 0.66, zb + 0.005); g.add(v);
    caja(0.1, 1.05, 0.06, matMoldura, cx - 0.35, yb + 0.66, zb + 0.03); caja(0.1, 1.05, 0.06, matMoldura, cx + 0.35, yb + 0.66, zb + 0.03);
    const tri = new THREE.Shape(); tri.moveTo(-0.62, 0); tri.lineTo(0.62, 0); tri.lineTo(0, 0.46); tri.closePath();
    const te = sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.0, bevelEnabled: false }), matPizarra)); te.position.set(cx, yb + 1.45, zb - 0.95); g.add(te);
    const fr = sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false }), matMoldura)); fr.position.set(cx, yb + 1.45, zb + 0.0); g.add(fr);
  });

  // la vereda: mesitas de mármol, sillas de madera curvada, vasos y un sifón
  const matMarmol = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.22 });
  const matVaso = new THREE.MeshStandardMaterial({ color: 0xd8e4e6, roughness: 0.05, transparent: true, opacity: 0.4, envMapIntensity: 2.5 });
  const matVino = new THREE.MeshStandardMaterial({ color: 0x3a0610, roughness: 0.2, transparent: true, opacity: 0.85 });
  const yV = PISO + 0.15;
  for (const [mx, mz] of MESAS_VEREDA) {
    const m = new THREE.Group(); m.position.set(mx, yV, mz); g.add(m);
    const tapa = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 32), matMarmol)); tapa.position.y = 0.74; m.add(tapa);
    const pie = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.72, 10), matHierro)); pie.position.y = 0.36; m.add(pie);
    const base = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.03, 20), matHierro)); base.position.y = 0.015; m.add(base);
    for (const [vx, vz] of [[-0.12, 0.05], [0.13, -0.06]]) { const va = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.1, 16), matVaso)); va.position.set(vx, 0.805, vz); m.add(va); const vi = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.027, 0.05, 16), matVino); vi.position.set(vx, 0.785, vz); m.add(vi); }
    for (const s of [-1, 1]) {
      const si = new THREE.Group(); si.position.set(s * 0.5, 0, 0); si.rotation.y = s * Math.PI / 2; m.add(si);
      const asiento = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), matMaderaOsc)); asiento.position.y = 0.46; si.add(asiento);
      const resp = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), matMaderaOsc)); resp.position.set(0, 0.62, 0.16); si.add(resp);
      for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { const le = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), matMaderaOsc); le.position.set(lx, 0.23, lz); si.add(le); }
    }
  }
}
