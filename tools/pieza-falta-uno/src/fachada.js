// La fachada porteña de estilo francés (versión 2): el bodegón en la planta baja de un edificio de piedra París,
// dos pisos de ventanas francesas con balcones de hierro forjado, molduras, cornisa con dentículos y mansarda
// de pizarra con buhardillas; la planta baja pintada, con letras de fileteado en las vidrieras y tomates en el alféizar.
// La vereda: mesitas con mantel a cuadros, sifón de malla roja, cerveza y vermú. Adentro: bovedilla de ladrillo y ventiladores de techo.
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

// letras de fileteado pintadas en el vidrio: dorado con sombra roja, filete en volutas y flores (alfa)
function texLetras(a, b) {
  const [c, g] = lienzo(1024, 404);
  const oro = y0 => { const f = g.createLinearGradient(0, y0 - 80, 0, y0 + 20); f.addColorStop(0, '#fff1b0'); f.addColorStop(0.45, '#e2b04a'); f.addColorStop(0.55, '#b8812a'); f.addColorStop(1, '#f2d27a'); return f; };
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  // el título
  g.font = '150px "Young Serif", Georgia, serif';
  g.fillStyle = '#7a1a14'; g.fillText(a, 512 + 7, 232 + 7);
  g.strokeStyle = '#2a140a'; g.lineWidth = 10; g.strokeText(a, 512, 232);
  g.fillStyle = oro(232); g.fillText(a, 512, 232);
  g.strokeStyle = 'rgba(255,250,230,.7)'; g.lineWidth = 2; g.strokeText(a, 512 - 2, 232 - 2);
  const ancho = g.measureText(a).width;
  // la bajada
  g.font = '58px "Young Serif", Georgia, serif'; g.strokeStyle = '#2a140a'; g.lineWidth = 7; g.strokeText(b, 512, 318); g.fillStyle = '#f3ead2'; g.fillText(b, 512, 318);
  // volutas a los dos lados
  const voluta = (x0, y0, s) => {
    const pts = []; for (let i = 0; i <= 60; i++) { const u = i / 60, ang = u * Math.PI * 3.2, rad = 70 * (1 - u * 0.82); pts.push([x0 + s * (u * 90 + Math.cos(ang) * rad * 0.6), y0 - Math.sin(ang) * rad * 0.55]); }
    for (const [w, col] of [[13, '#2a140a'], [8, '#e8b84e']]) for (let i = 1; i < pts.length; i++) { g.strokeStyle = col; g.lineWidth = w * (1 - i / pts.length * 0.75); g.lineCap = 'round'; g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke(); }
    // hojita celeste y flor roja
    g.save(); g.translate(x0 + s * 30, y0 + 42); g.rotate(s * 0.5); g.fillStyle = '#5fa8c8'; g.strokeStyle = '#2a140a'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 26, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
    g.fillStyle = '#c8281c'; for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x0 - s * 12 + Math.cos(an) * 11, y0 - 50 + Math.sin(an) * 11, 8, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#f2d27a'; g.beginPath(); g.arc(x0 - s * 12, y0 - 50, 6, 0, Math.PI * 2); g.fill();
  };
  const bx = Math.min(330, ancho / 2 + 40); voluta(512 - bx, 190, -1); voluta(512 + bx, 190, 1);
  // filete fino de marco
  g.strokeStyle = '#e8b84e'; g.lineWidth = 4; g.strokeRect(14, 14, 996, 376); g.strokeStyle = '#2a140a'; g.lineWidth = 2; g.strokeRect(22, 22, 980, 360);
  return textura(c);
}
// el cartel del bar: madera verde oscura, letras doradas con sombra roja y un filete fino (como los cafés viejos)
export function texCartelPorteno(nombre, bajada = '') {
  const [c, g] = lienzo(1024, 256);
  const f = g.createLinearGradient(0, 0, 0, 256); f.addColorStop(0, '#1f3d30'); f.addColorStop(1, '#142a20'); g.fillStyle = f; g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = '#d9a83f'; g.lineWidth = 5; g.strokeRect(16, 16, 992, 224); g.strokeStyle = 'rgba(217,168,63,.6)'; g.lineWidth = 2; g.strokeRect(28, 28, 968, 200);
  for (const [x, y, sx, sy] of [[28, 28, 1, 1], [996, 28, -1, 1], [28, 228, 1, -1], [996, 228, -1, -1]]) { g.strokeStyle = '#d9a83f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + sy * 40); g.bezierCurveTo(x + sx * 10, y + sy * 10, x + sx * 30, y + sy * 4, x + sx * 50, y); g.stroke(); g.beginPath(); g.arc(x + sx * 22, y + sy * 22, 6, 0, Math.PI * 2); g.stroke(); }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const yT = bajada ? 160 : 182; g.font = `${bajada ? 132 : 150}px "Young Serif", Georgia, serif`;
  g.fillStyle = '#7a1a14'; g.fillText(nombre, 512 + 6, yT + 6); g.strokeStyle = '#0c1a13'; g.lineWidth = 8; g.strokeText(nombre, 512, yT);
  const o = g.createLinearGradient(0, yT - 100, 0, yT + 10); o.addColorStop(0, '#fff0b0'); o.addColorStop(0.5, '#e0ac48'); o.addColorStop(0.56, '#b37c26'); o.addColorStop(1, '#f0cf78'); g.fillStyle = o; g.fillText(nombre, 512, yT);
  if (bajada) { g.font = '40px "Young Serif", Georgia, serif'; g.fillStyle = '#efe4c8'; g.letterSpacing = '10px'; g.fillText(bajada.toUpperCase(), 512, 214); }
  return textura(c);
}
function texCuadros(col) {
  const [c, g] = lienzo(256, 256); g.fillStyle = '#f1ece2'; g.fillRect(0, 0, 256, 256); g.fillStyle = col; g.globalAlpha = 0.55;
  for (let i = 0; i < 8; i += 2) { g.fillRect(i * 32, 0, 32, 256); g.fillRect(0, i * 32, 256, 32); }
  g.globalAlpha = 1; const t = textura(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 2.5); return t;
}
function texMalla() {
  const [c, g] = lienzo(256, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff';
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 9, 256); for (let y = 0; y < 256; y += 40) g.fillRect(0, y, 256, 9);
  const t = textura(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}
function texLadrillo() {
  const [c, g] = lienzo(512, 512), r = rng(77); g.fillStyle = '#3a2a22'; g.fillRect(0, 0, 512, 512);
  for (let fila = 0; fila < 16; fila++) for (let k = -1; k < 5; k++) { const x = k * 128 + (fila % 2) * 64 + 3, y = fila * 32 + 3, v = r(); g.fillStyle = `rgb(${120 + v * 50 | 0},${58 + v * 22 | 0},${40 + v * 14 | 0})`; g.fillRect(x, y, 122, 26); g.fillStyle = `rgba(0,0,0,${r() * 0.25})`; g.fillRect(x, y + 18, 122, 8); }
  const t = textura(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function crearFachadaFrancesa(g, { matMaderaOsc, guion = {} }) {
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
  const matPB = new THREE.MeshStandardMaterial({ map: T.revoque('#c9958b', 45), roughness: 0.9 }); // la planta baja, pintada de rosa viejo
  for (const x of [-1.27, 1.27]) { caja(0.34, 3.34, 0.1, matPB, x, PISO + 1.67, zf + 0.05); caja(0.44, 0.5, 0.16, matPB, x, PISO + 0.4, zf + 0.08); }
  for (const x of [-4.15, 4.15]) { caja(0.36, 4.45, 0.12, matPB, x, PISO + 2.22, zf + 0.06); caja(0.46, 0.5, 0.18, matPB, x, PISO + 0.4, zf + 0.09); caja(0.46, 0.16, 0.2, matPB, x, 3.36, zf + 0.1); }
  for (const x of [-2.55, 2.55]) caja(1.95, 0.08, 0.14, matPB, x, 0.0, zf + 0.07); // alféizar de las vidrieras
  const matVerde = new THREE.MeshStandardMaterial({ color: 0x1d3a2e, roughness: 0.45 });
  for (const x of [-2.55, 2.55]) { caja(1.7, 0.8, 0.05, matVerde, x, -0.4, zf + 0.025); for (const dx of [-0.42, 0.42]) { const p = caja(0.66, 0.5, 0.03, matVerde, x + dx, -0.4, zf + 0.06); p.material = matVerde; } }
  // las vidrieras con letras de fileteado pintadas en el vidrio
  (guion.vidrieras || []).slice(0, 2).forEach(([a, b], i) => {
    const t = texLetras(a, b), m = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.64), new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.35, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }));
    m.position.set(i ? 2.55 : -2.55, 1.79, 12.05); g.add(m);
  });
  // tomates en el alféizar de la vidriera izquierda
  { const n = 26, im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ roughness: 0.32 }), n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), cols = ['#b8231a', '#d4521c', '#e2a21f', '#a51b12', '#c93a1a', '#e6c03a'];
    for (let i = 0; i < n; i++) { const rr = 0.032 + r() * 0.016, x = -3.38 + (i + r() * 0.4) * (1.66 / n), z = zf + 0.04 + (r() - 0.5) * 0.06; q.setFromEuler(new THREE.Euler(0, r() * 6, 0)); m4.compose(new THREE.Vector3(x, 0.04 + rr * 0.8, z), q, new THREE.Vector3(rr, rr * 0.82, rr)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(cols[Math.floor(r() * cols.length)])); }
    im.castShadow = true; g.add(im); }

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

  // la vereda: mesitas de madera con mantel a cuadros, sillas de madera curvada, sifón de malla roja, cerveza, vermú y aceitunas
  const yV = PISO + 0.15, lathe = pts => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 20);
  const matVidrio = new THREE.MeshStandardMaterial({ color: 0xd8e4e6, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 2.5 });
  const matBirra = new THREE.MeshStandardMaterial({ color: 0xd98a1c, roughness: 0.15, transparent: true, opacity: 0.85, emissive: 0x5a2a00, emissiveIntensity: 0.2 });
  const matEspuma = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 });
  const matPorron = new THREE.MeshStandardMaterial({ color: 0x3b1d08, roughness: 0.08, metalness: 0.1, envMapIntensity: 2 });
  const matEtiqueta = new THREE.MeshStandardMaterial({ color: 0xa8cbe2, roughness: 0.6 });
  const matRojo = new THREE.MeshStandardMaterial({ color: 0xc41e16, roughness: 0.35 });
  const matMalla = new THREE.MeshStandardMaterial({ color: 0xc41e16, roughness: 0.4, alphaMap: texMalla(), alphaTest: 0.5, side: THREE.DoubleSide });
  const matVermu = new THREE.MeshStandardMaterial({ color: 0x4a0a0c, roughness: 0.15, transparent: true, opacity: 0.9 });
  const matLoza = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.25 });
  const gPorron = lathe([[0, 0], [0.038, 0], [0.04, 0.01], [0.04, 0.2], [0.03, 0.245], [0.014, 0.28], [0.014, 0.32], [0, 0.32]]);
  MESAS_VEREDA.forEach(([mx, mz], k) => {
    const m = new THREE.Group(); m.position.set(mx, yV, mz); g.add(m);
    const tapa = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.62), matMaderaOsc)); tapa.position.y = 0.72; m.add(tapa);
    for (const [lx, lz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) { const le = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), matMaderaOsc)); le.position.set(lx, 0.36, lz); m.add(le); }
    // el mantel a cuadros: arriba y los cuatro faldones
    const tm = texCuadros(k === 1 ? '#b3241c' : '#2f6b3a'), matM = new THREE.MeshStandardMaterial({ map: tm, roughness: 0.85, side: THREE.DoubleSide });
    const sup = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.006, 0.8), matM)); sup.position.y = 0.738; m.add(sup);
    for (let j = 0; j < 4; j++) { const f = sombra(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), matM)); const a = j * Math.PI / 2; f.position.set(Math.sin(a) * 0.402, 0.64, Math.cos(a) * 0.402); f.rotation.set(0, a, 0); f.rotateX(-0.06); m.add(f); }
    const yT = 0.741;
    // porrón de cerveza con etiqueta celeste (sin marca), dos vasos
    const po = sombra(new THREE.Mesh(gPorron, matPorron)); po.position.set(-0.18, yT, -0.12); m.add(po);
    const et = new THREE.Mesh(new THREE.CylinderGeometry(0.0405, 0.0405, 0.08, 20, 1, true), matEtiqueta); et.position.set(-0.18, yT + 0.11, -0.12); m.add(et);
    for (const [vx, vz] of [[-0.02, 0.16], [0.16, -0.14]]) {
      const v = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.13, 16), matVidrio)); v.position.set(vx, yT + 0.065, vz); m.add(v);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.028, 0.1, 16), k === 2 ? matVermu : matBirra); b.position.set(vx, yT + 0.052, vz); m.add(b);
      if (k !== 2) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 16), matEspuma); e.position.set(vx, yT + 0.111, vz); m.add(e); }
    }
    // el sifón de malla roja
    if (k !== 1) {
      const sx = 0.17, sz = 0.13;
      const cu = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.21, 20), matVidrio)); cu.position.set(sx, yT + 0.105, sz); m.add(cu);
      const ma = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.2, 24, 1, true), matMalla); ma.position.set(sx, yT + 0.105, sz); m.add(ma);
      const ca = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.042, 0.07, 16), matRojo)); ca.position.set(sx, yT + 0.245, sz); m.add(ca);
      const pi = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.025, 0.09), matRojo)); pi.position.set(sx, yT + 0.27, sz - 0.05); pi.rotation.x = 0.3; m.add(pi);
      const pa = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.07), matRojo)); pa.position.set(sx, yT + 0.3, sz + 0.02); pa.rotation.x = -0.5; m.add(pa);
    }
    // aceitunas en un platito
    const pl = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 24), matLoza)); pl.position.set(0.0, yT + 0.006, -0.02); m.add(pl);
    for (let j = 0; j < 9; j++) { const a = r() * 6.28, d = r() * 0.045, o = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshStandardMaterial({ color: r() < 0.5 ? 0x6b7a22 : 0x3a1a14, roughness: 0.25 })); o.scale.set(1, 0.85, 1.25); o.position.set(Math.cos(a) * d, yT + 0.022, -0.02 + Math.sin(a) * d); m.add(o); }
    for (const s of [-1, 1]) {
      const si = new THREE.Group(); si.position.set(s * 0.5, 0, 0); si.rotation.y = s * Math.PI / 2; m.add(si);
      const asiento = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), matMaderaOsc)); asiento.position.y = 0.46; si.add(asiento);
      const resp = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI), matMaderaOsc)); resp.position.set(0, 0.62, 0.16); si.add(resp);
      for (const [lx, lz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) { const le = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), matMaderaOsc); le.position.set(lx, 0.23, lz); si.add(le); }
    }
  });

  // adentro: bovedilla de ladrillo entre perfiles de hierro (tapa el cielorraso de vigas) y dos ventiladores de techo
  const TECHO_S = 3.05, z0 = 0.45, z1 = 11.8, paso = 0.95;
  { const nz = Math.round((z1 - z0) / paso), geo = new THREE.PlaneGeometry(ANCHO * 2, z1 - z0, 1, nz * 12); geo.rotateX(Math.PI / 2);
    const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) { const zz = pos.getZ(i) + (z1 - z0) / 2, u = (zz % paso) / paso; pos.setY(i, -0.13 * (1 - Math.sin(Math.PI * u))); }
    geo.computeVertexNormals(); const tl = texLadrillo(); tl.repeat.set(ANCHO * 2 / 1.2, (z1 - z0) / 1.2);
    const bov = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tl, roughness: 0.92, side: THREE.DoubleSide })); bov.position.set(0, TECHO_S - 0.23, (z0 + z1) / 2); bov.receiveShadow = true; g.add(bov);
    for (let i = 0; i <= nz; i++) caja(ANCHO * 2, 0.1, 0.07, matHierro, 0, TECHO_S - 0.41, z0 + i * paso); }
  const aspas = [];
  for (const zz of [4.6, 8.9]) {
    const v = new THREE.Group(); v.position.set(0, TECHO_S - 0.95, zz); g.add(v);
    const vara = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 8), matHierro); vara.position.y = 0.3; v.add(vara);
    const motor = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 20), matHierro)); v.add(motor);
    const rot = new THREE.Group(); v.add(rot); aspas.push(rot);
    for (let j = 0; j < 4; j++) { const a = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.13), matMaderaOsc)); const an = j * Math.PI / 2; a.position.set(Math.cos(an) * 0.4, -0.03, Math.sin(an) * 0.4); a.rotation.set(0.12, -an, 0); rot.add(a); }
  }
  return { poner(t) { aspas.forEach((a, i) => { a.rotation.y = t * (2.4 + i * 0.3) + i; }); } };
}

