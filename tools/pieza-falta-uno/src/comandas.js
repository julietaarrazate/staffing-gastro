// Las comandas: el atlas de papel escrito a mano y el material de papel (se curva, deja pasar la luz, se ve la tinta del otro lado).
import * as THREE from 'three';
import { rng } from './util.js';

export const ANCHO = 0.075, ALTO = 0.11; // metros: una comanda de talonario
const CW = 512, CH = 768, COLS = 4, FILAS = 2;
export const VARIANTES = COLS * FILAS;

const PEDIDOS = [
  ['Mesa 7', '2 milanesa napo', '   c/ fritas', '1 provoleta', '1 vino casa', '1 sifón'],
  ['Mesa 12', '1 bife chorizo', '   jugoso', '1 ens. mixta', '2 flan mixto', '2 cortados'],
  ['Mesa 4', '3 empanadas', '2 ravioles tuco', '1 tortilla', '   babé', '1 agua s/gas'],
  ['Mesa 9', '1 vacío', '1 puré', '1 matambre', '   a la pizza', '2 Quilmes'],
  ['Mesa 15', '2 sorrentinos', '   mixta', '1 pan', '1 panqueque', '   c/ dulce'],
  ['Mesa 2', '1 entraña', '1 fritas', '1 milanesa', '   a caballo', '1 malbec'],
  ['Barra', '4 cortados', '2 medialunas', '1 tostado', '   j y q', '1 lágrima'],
  ['Mesa 21', '6 empanadas', '1 locro', '1 humita', '2 flan', '3 sodas'],
];
// dónde la atraviesa el pinche (en coordenadas de la comanda, de 0 a 1)
export const PINCHE = Array.from({ length: VARIANTES }, (_, i) => { const r = rng(900 + i); return [0.46 + r() * 0.1, 0.42 + r() * 0.12]; });

export function atlas(fuenteMano) {
  const c = document.createElement('canvas'); c.width = CW * COLS; c.height = CH * FILAS;
  const g = c.getContext('2d');
  for (let i = 0; i < VARIANTES; i++) {
    const x0 = (i % COLS) * CW, y0 = Math.floor(i / COLS) * CH, r = rng(31 + i * 7);
    g.save(); g.translate(x0, y0);
    // silueta: borde de arriba picado (troquel) y el de abajo cortado a mano
    g.beginPath(); g.moveTo(0, 14);
    for (let x = 0; x <= CW; x += 16) g.arc(x + 8, 14, 5, Math.PI, 0, true);
    g.lineTo(CW, CH - 30);
    for (let x = CW; x >= 0; x -= 14) g.lineTo(x, CH - 22 - r() * 16);
    g.closePath(); g.clip();
    const fondo = g.createLinearGradient(0, 0, CW, CH); fondo.addColorStop(0, '#f6f1e6'); fondo.addColorStop(1, '#efe8da');
    g.fillStyle = fondo; g.fillRect(0, 0, CW, CH);
    // fibras del papel
    for (let k = 0; k < 900; k++) { g.strokeStyle = `rgba(${r() < .5 ? '120,110,90' : '255,255,250'},${0.03 + r() * 0.05})`; g.lineWidth = .6 + r(); const x = r() * CW, y = r() * CH, a = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * (3 + r() * 9), y + Math.sin(a) * (3 + r() * 9)); g.stroke(); }
    // impreso del talonario
    g.fillStyle = '#6f7f93'; g.font = '600 30px "Inter", Arial, sans-serif'; g.letterSpacing = '6px'; g.fillText('COMANDA', 34, 74);
    g.letterSpacing = '0px'; g.font = '500 28px "Inter", Arial, sans-serif'; g.fillText('N° 0' + (412 + i * 37), CW - 180, 74);
    g.strokeStyle = 'rgba(111,127,147,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 96); g.lineTo(CW - 30, 96); g.stroke();
    g.strokeStyle = 'rgba(140,160,185,.35)'; g.lineWidth = 1.5;
    for (let y = 170; y < CH - 60; y += 78) { g.beginPath(); g.moveTo(30, y); g.lineTo(CW - 30, y); g.stroke(); }
    // escrito a mano, birome azul
    const p = PEDIDOS[i];
    g.fillStyle = '#1d3a6b';
    p.forEach((l, k) => {
      g.save(); const y = 160 + k * 78 + (k === 0 ? -6 : 0); g.translate(38 + r() * 8, y); g.rotate((r() - .5) * 0.05);
      g.font = `${k === 0 ? 70 : 54}px "${fuenteMano}", cursive`; g.globalAlpha = 0.88 + r() * 0.1; g.fillText(l, 0, 0); g.restore();
    });
    g.save(); g.translate(CW - 150, CH - 70); g.rotate(-0.08); g.font = `46px "${fuenteMano}"`; g.fillText('21:' + String(10 + i * 4).padStart(2, '0'), 0, 0); g.restore();
    // el agujero del pinche, con el papel rasgado alrededor
    const [px, py] = PINCHE[i], hx = px * CW, hy = (1 - py) * CH;
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(hx, hy, 6, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + r(); g.strokeStyle = 'rgba(90,80,60,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(hx + Math.cos(a) * 6, hy + Math.sin(a) * 6); g.lineTo(hx + Math.cos(a) * (12 + r() * 10), hy + Math.sin(a) * (12 + r() * 10)); g.stroke(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Parche común de vértices: la comanda se arquea alrededor del pinche y se le levanta una punta.
const VERT_DECL = `
attribute float aVar; attribute vec4 aForma; // x: caída, y: punta levantada, z: fase, w: aleteo
attribute vec2 aPin;
float alturaPapel(vec2 q){ float rr = dot(q, q); return -aForma.x * rr + aForma.y * q.x * q.y * 18. + aForma.w * sin(q.x * 70. + aForma.z) * rr * 2.5; }
`;
const VERT_POS = `
vec3 transformed = vec3(position); vec2 q = transformed.xz - aPin; transformed.xz = q;
transformed.y = alturaPapel(q);
`;
const VERT_NOR = `
vec2 q0 = position.xz - aPin; float e = .002;
float dx = (alturaPapel(q0 + vec2(e, 0.)) - alturaPapel(q0 - vec2(e, 0.))) / (2. * e);
float dz = (alturaPapel(q0 + vec2(0., e)) - alturaPapel(q0 - vec2(0., e))) / (2. * e);
vec3 objectNormal = normalize(vec3(-dx, 1., -dz));
`;
const VERT_UV = `
#ifdef USE_MAP
vMapUv = vec2((mod(aVar, ${COLS}.) + uv.x) / ${COLS}., 1. - (floor(aVar / ${COLS}.) + 1.) / ${FILAS}. + uv.y / ${FILAS}.);
#endif
`;

export function materialPapel(mapa, { trans = 0.55, color = 0xffffff, opaco = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: mapa, color, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, alphaTest: opaco ? 0 : 0.5, envMapIntensity: 0.6 });
  m.userData.uTrans = { value: trans };
  m.onBeforeCompile = s => {
    s.uniforms.uTrans = m.userData.uTrans;
    s.vertexShader = VERT_DECL + s.vertexShader.replace('#include <beginnormal_vertex>', VERT_NOR).replace('#include <begin_vertex>', VERT_POS).replace('#include <uv_vertex>', '#include <uv_vertex>\n' + VERT_UV);
    s.fragmentShader = 'uniform float uTrans;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 tm = texture2D(map, vMapUv);
        vec3 papel = vec3(.91, .87, .79);
        vec3 cara = gl_FrontFacing ? tm.rgb : mix(papel, tm.rgb, .18);
        diffuseColor *= vec4(cara, ${opaco ? '1.' : 'tm.a'});`)
      .replace('#include <lights_fragment_begin>', `
        #undef RE_Direct
        #define RE_Direct RE_Direct_Papel
        #include <lights_fragment_begin>`)
      .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>
        void RE_Direct_Papel(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight){
          RE_Direct_Physical(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
          float b = saturate(dot(-geometryNormal, directLight.direction));
          float haz = pow(saturate(dot(-geometryViewDir, directLight.direction) * .5 + .5), 3.);
          reflectedLight.directDiffuse += (b * .8 + haz * .5) * uTrans * directLight.color * BRDF_Lambert(material.diffuseColor) * vec3(1., .93, .82);
        }`);
  };
  m.customProgramCacheKey = () => 'papel' + trans + (opaco ? 'o' : '');
  return m;
}

export function materialSombraPapel(mapa) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mapa, alphaTest: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    s.vertexShader = VERT_DECL + s.vertexShader.replace('#include <begin_vertex>', VERT_POS).replace('#include <uv_vertex>', '#include <uv_vertex>\n' + VERT_UV);
  };
  m.customProgramCacheKey = () => 'sombrapapel';
  return m;
}

// geometría instanciada de comandas: aVar, aForma y aPin por instancia
export function mallaComandas(n, segX, segZ, mat, matSombra) {
  const geo = new THREE.PlaneGeometry(ANCHO, ALTO, segX, segZ); geo.rotateX(-Math.PI / 2);
  // el origen de cada comanda queda en el agujero del pinche: aPin se resta en el sombreador
  const ig = new THREE.InstancedBufferGeometry(); ig.index = geo.index;
  for (const k of ['position', 'normal', 'uv']) ig.setAttribute(k, geo.getAttribute(k));
  const aVar = new THREE.InstancedBufferAttribute(new Float32Array(n), 1), aForma = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4), aPin = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  for (const a of [aVar, aForma, aPin]) a.setUsage(THREE.DynamicDrawUsage);
  ig.setAttribute('aVar', aVar); ig.setAttribute('aForma', aForma); ig.setAttribute('aPin', aPin);
  const m = new THREE.InstancedMesh(ig, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (matSombra) m.customDepthMaterial = matSombra;
  m.frustumCulled = false; m.count = 0;
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  return { malla: m, aVar, aForma, aPin };
}

// posición del agujero del pinche en coordenadas locales de la geometría (x, z) para cada variante
export const pinLocal = i => [(PINCHE[i][0] - .5) * ANCHO, (.5 - PINCHE[i][1]) * ALTO];
