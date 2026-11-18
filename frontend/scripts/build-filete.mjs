// El dibujo de los adornos del «oído» fileteado (2026-11-18): volutas
// celestes con cuerpo, filete dorado, flores y la cinta celeste y blanca.
// Es un dibujo propio en la tradición del filete porteño.
//
// Todo son pinceladas: una línea central y un ancho que cambia a lo largo
// (el pincel del fileteador). Cada pincelada lleva su cuerpo, una franja de
// sombra del lado opuesto a la luz, una media luz y un brillo. El relieve
// duro es la silueta del dibujo repetida en diagonal, y la sombra proyectada
// la misma silueta desenfocada. La luz viene de arriba a la izquierda, igual
// que el relieve de la letra.
//
// Dos niveles de carga: `medio` (el final de la landing y la bienvenida) y
// `cargado` (la miniatura al compartir).
//
//   node scripts/build-filete.mjs          escribe todo
//   node scripts/build-filete.mjs --check  falla si lo commiteado quedó viejo
//
// Escribe:
//   components/landing/filete-adornos.ts          el nivel medio, para Filete.tsx
//   ../docs/design-system/marca/oido-filete.svg   el medio en vector, letra a trazos
//   ../docs/design-system/marca/oido-filete-cargado.svg
//   assets/og/filete-oido.png                     el cargado, 1200 px de ancho, en
//                                                 paleta (medidas en lib/og.ts)
//
// Para cambiar el dibujo se toca este archivo y se vuelve a correr; nada de lo
// que escribe se edita a mano.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const X0 = 410; // eje de simetría (el centro de la palabra)
const LUZ = [0.45, 0.893]; // hacia dónde cae la sombra
const r1 = (n) => Math.round(n * 10) / 10;
const num = (n) => String(r1(n)).replace(/^(-?)0\./, "$1.");

/** Polígono cerrado como camino SVG compacto (deltas relativos). */
function camino(poly) {
  let px = r1(poly[0][0]), py = r1(poly[0][1]);
  let o = `M${num(px)} ${num(py)}l`;
  let primero = true;
  for (let i = 1; i < poly.length; i++) {
    const x = r1(poly[i][0]), y = r1(poly[i][1]);
    const dx = num(x - px), dy = num(y - py);
    if (dx === "0" && dy === "0") continue;
    o += (primero || dx.startsWith("-") ? "" : " ") + dx + (dy.startsWith("-") ? "" : " ") + dy;
    primero = false;
    px = x; py = y;
  }
  return o + "z";
}

function bez(p0, p1, p2, p3, n = 18, punta = 1) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = 1 - Math.pow(1 - i / n, punta), u = 1 - t;
    o.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return o;
}
/** Espiral que se cierra, girando en sentido horario en pantalla. */
function espiral(cx, cy, r0, rf, a0, vueltas, n = 34) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = ((a0 + 360 * vueltas * t) * Math.PI) / 180;
    const r = r0 * Math.pow(rf / r0, t);
    o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return o;
}
function largos(pts) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return s;
}
function normales(pts) {
  return pts.map((_, i) => {
    const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  });
}
function correr(pts, dist) {
  const s = largos(pts), n = normales(pts), T = s[s.length - 1] || 1;
  return pts.map((p, i) => {
    const k = typeof dist === "function" ? dist(s[i] / T) : dist;
    return [p[0] + n[i][0] * k, p[1] + n[i][1] * k];
  });
}
function pincel(pts, ancho) {
  return correr(pts, (t) => ancho(t) / 2).concat(correr(pts, (t) => -ancho(t) / 2).reverse());
}
/**
 * Franja de luz o de sombra adentro de una pincelada: se corre hacia el lado
 * que mira a la luz (signo -1) o al opuesto (+1), y se afina donde el trazo
 * corre paralelo a la luz. Así una espiral queda iluminada como un caño.
 */
function franja(pts, ancho, signo, kCorre, kAncho, de = 0, a = 1) {
  const s = largos(pts), n = normales(pts), T = s[s.length - 1] || 1;
  const izq = [], der = [];
  pts.forEach((p, i) => {
    const t = s[i] / T;
    if (t < de || t > a) return;
    const w = ancho(t), c = n[i][0] * LUZ[0] + n[i][1] * LUZ[1];
    const punta = Math.min(1, (t - de) / 0.08, (a - t) / 0.08);
    const corre = signo * c * kCorre * w;
    const h = (Math.pow(Math.abs(c), 0.75) * kAncho * w * Math.max(0, punta)) / 2;
    const cx = p[0] + n[i][0] * corre, cy = p[1] + n[i][1] * corre;
    izq.push([cx + n[i][0] * h, cy + n[i][1] * h]);
    der.push([cx - n[i][0] * h, cy - n[i][1] * h]);
  });
  return izq.concat(der.reverse());
}
const suave = (t) => t * t * (3 - 2 * t);
/** Perfil de filete: parejo, afinado en las dos puntas. */
const huso = (w, punta = 0.22) => (t) => w * (punta + (1 - punta) * Math.pow(Math.sin(Math.PI * t), 0.45));
/** Perfil de lóbulo: nace fino y termina gordo, con la punta redonda. */
const lobulo = (w) => (t) => (t < 0.7 ? w * (0.22 + 0.78 * suave(t / 0.7)) : w * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.7) / 0.3, 2))));
const tramo = (pts, a, b) => pts.slice(Math.round(a * (pts.length - 1)), Math.round(b * (pts.length - 1)) + 1);

// ── Pintura ────────────────────────────────────────────────────────────────
const PINTURA = {
  cel: 'fill="url(#__ID__-cel)" stroke="#0f3a5b" stroke-width="1.5" stroke-linejoin="round"',
  celS: 'fill="#0d4a7c" opacity=".48"',
  celM: 'fill="#fff" opacity=".32"',
  oro: 'fill="url(#__ID__-oro)" stroke="#7a4d08" stroke-width="1.1" stroke-linejoin="round"',
  oroS: 'fill="#7a4d08" opacity=".5"',
  oroF: 'fill="url(#__ID__-oro)" stroke="#9a6410" stroke-width=".9" stroke-linejoin="round"',
  oroFM: 'fill="#fff6cf" opacity=".7"',
  oroM: 'fill="#fff6cf" opacity=".5"',
  luz: 'fill="#fff" opacity=".92"',
  florA: 'fill="url(#__ID__-florA)" stroke="#5e0b14" stroke-width="1.3" stroke-linejoin="round"',
  florB: 'fill="url(#__ID__-florB)" stroke="#8a2443" stroke-width="1.2" stroke-linejoin="round"',
  florAS: 'fill="#5e0b14" opacity=".38"',
  florBS: 'fill="#8a2443" opacity=".34"',
  boton: 'fill="url(#__ID__-boton)" stroke="#0f3a5b" stroke-width="1.2"',
  punto: 'fill="#0f3a5b"',
  cCel: 'fill="#6fb0df"',
  cBla: 'fill="#fff"',
  cCel2: 'fill="#4a8fbf"',
  cBla2: 'fill="#c9deed"',
  cS: 'fill="#0d4a7c" opacity=".2"',
  cBorde: 'fill="none" stroke="#0f3a5b" stroke-width="1.5" stroke-linejoin="round"',
};
const SIN_BORDE = new Set(["celS", "celM", "oroS", "oroM", "oroFM", "luz", "florAS", "florBS", "punto", "cBla", "cCel2", "cBla2", "cS"]);

/** Las pinturas que son cuerpo: su contorno arma la silueta del relieve. */
const CUERPO = new Set(["cel", "oro", "oroF", "cCel"]);

/**
 * Lista de pinceladas → SVG, juntando las seguidas de la misma pintura.
 * Devuelve el dibujo y su silueta (los cuerpos, sin luces ni sombras), que
 * se repite corrida para el relieve duro y la sombra proyectada.
 */
function pintar(items) {
  let arte = "", silCaminos = "", silOtros = "", i = 0;
  while (i < items.length) {
    const k = items[i][0];
    if (k === "crudo") { arte += items[i][1]; silOtros += items[i][2] || ""; i++; continue; }
    let j = i;
    const tanda = [];
    while (j < items.length && items[j][0] === k) tanda.push(items[j++][1]);
    const caminos = tanda.filter((x) => !x.startsWith("<"));
    const otros = tanda.filter((x) => x.startsWith("<"));
    let dentro = otros.join("");
    if (caminos.length) dentro += SIN_BORDE.has(k) ? `<path d="${caminos.join("")}"/>` : caminos.map((c) => `<path d="${c}"/>`).join("");
    arte += `<g ${PINTURA[k]}>${dentro}</g>`;
    if (CUERPO.has(k)) { silCaminos += caminos.join(""); silOtros += otros.join(""); }
    i = j;
  }
  return { arte, sil: (silCaminos ? `<path d="${silCaminos}"/>` : "") + silOtros };
}
const circ = (x, y, r) => `<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}"/>`;

/** Una pincelada con volumen: cuerpo, sombra, media luz y brillo. */
function volumen(pts, ancho, tinta, { brillo = true, sombra = true, de = 0.04, a = 0.97 } = {}) {
  const it = [[tinta, camino(pincel(pts, ancho))]];
  if (sombra) it.push([tinta + "S", camino(franja(pts, ancho, 1, 0.24, 0.46, de, a))]);
  it.push([tinta + "M", camino(franja(pts, ancho, -1, 0.17, 0.5, de, a))]);
  if (brillo) it.push(["luz", camino(franja(pts, ancho, -1, 0.3, 0.15, de + 0.06, a - 0.06))]);
  return it;
}
function bola(p, r, tinta) {
  return [[tinta, circ(p[0], p[1], r)], [tinta + "S", circ(p[0] + r * 0.2, p[1] + r * 0.28, r * 0.62)], ["luz", circ(p[0] - r * 0.3, p[1] - r * 0.34, r * 0.3)]];
}

/**
 * La voluta: un tallo que sale del centro, se engrosa y se enrosca hacia la
 * palabra, con un ala de hojas que baja por el costado. Marco local: x hacia
 * afuera, y hacia la palabra; `sx`, `sy` la llevan a su esquina.
 */
function voluta({ ax, ay, sx, sy, L, alto = 18, r0, rf = 4, vueltas = 1.45, w, hoja: conHoja = false, ala = 0, tinta = "cel", filete = 0, yT = -6 }) {
  const T = (p) => [ax + sx * p[0], ay + sy * p[1]];
  const sp = espiral(L, yT + r0, r0, rf, -90, vueltas);
  const t0 = [sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]];
  const tl = Math.hypot(t0[0], t0[1]);
  const lomo = bez([0, 0], [L * 0.36, -alto], [sp[0][0] - (t0[0] / tl) * L * 0.34, sp[0][1] - (t0[1] / tl) * L * 0.34], sp[0], 20);
  const eje = lomo.concat(sp.slice(1));
  const s = largos(eje), tS = s[lomo.length - 1] / s[s.length - 1];
  const ancho = (t) => Math.min(1, Math.sqrt(t / 0.012)) * (t < tS ? w * (0.3 + 0.7 * suave(t / tS)) : w * (1 - 0.68 * ((t - tS) / (1 - tS))));
  const k = w / 14, q = r0 / 24;
  let it = [], finos = [];

  const R = [L + r0 * 0.5, yT + r0 * 1.62];
  const ALA = [
    { de: [2, -4], p: [[26, 8], [32, 46], [14, 72]], w: 19 },
    { de: [-4, 0], p: [[11, 12], [14, 36], [-2, 54]], w: 16 },
    { de: [-10, 0], p: [[-2, 10], [-2, 24], [-15, 37]], w: 12.5 },
  ];
  for (const H of ALA.slice(0, ala)) {
    const c = bez([R[0] + H.de[0] * q, R[1] + H.de[1] * q], ...H.p.map((z) => [R[0] + z[0] * q, R[1] + z[1] * q]), 20, 1.7).map(T);
    it = it.concat(volumen(c, lobulo(H.w * q), tinta, { de: 0.22 }));
    // el arranque de cada hoja queda en sombra: nace de atrás de la espiral
    it.push([tinta + "S", camino(pincel(tramo(c, 0, 0.42), (t) => lobulo(H.w * q)(t * 0.42) * (1 - t) * 0.9))]);
  }
  if (conHoja) {
    const A = lomo[Math.round(0.52 * (lomo.length - 1))];
    const c = bez(A, ...[[2, -15], [16, -25], [33, -19]].map((z) => [A[0] + z[0] * k, A[1] + z[1] * k]), 18, 1.7).map(T);
    it = it.concat(volumen(c, lobulo(11 * k), tinta, { de: 0.25 }));
  }
  it = it.concat(volumen(eje.map(T), ancho, tinta));
  it = it.concat(bola(T(eje[eje.length - 1]), w * (tinta === "cel" ? 0.42 : 0.38), tinta));
  if (filete) {
    const f = correr(tramo(lomo, 0.08, 0.9), (t) => w * 0.62 + filete * 1.4 + 3 * Math.sin(Math.PI * t)).map(T);
    finos = finos.concat(volumen(f, huso(filete), "oroF", { brillo: false, sombra: false }), bola(f[0], filete * 0.8, "oro"), bola(f[f.length - 1], filete * 0.8, "oro"));
  }
  return { it, finos };
}

function perla(x, y, r) {
  return bola([x, y], r, "oro");
}
/** Hoja suelta celeste, para acompañar flores. */
function hoja(x, y, ang, largo, w) {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const eje = bez([0, 0], [largo * 0.3, -largo * 0.22], [largo * 0.7, -largo * 0.2], [largo, 0], 18, 1.7).map((p) => [x + p[0] * c - p[1] * s, y + p[0] * s + p[1] * c]);
  return volumen(eje, lobulo(w), "cel", { de: 0.2 }).concat([["celS", camino(pincel(tramo(eje, 0, 0.4), (t) => lobulo(w)(t * 0.4) * (1 - t) * 0.9))]]);
}

/** Flor de frente: cinco pétalos con muesca, pliegue, brillo y botón azul. */
function flor(x, y, r, tipo, giro = 0) {
  const P = (n) => num(n * r);
  const petalo = `M0 0C${P(-0.46)} ${P(-0.2)} ${P(-0.66)} ${P(-0.8)} ${P(-0.32)} ${P(-1.02)}C${P(-0.16)} ${P(-1.12)} ${P(-0.04)} ${P(-1.04)} 0 ${P(-0.9)}C${P(0.04)} ${P(-1.04)} ${P(0.16)} ${P(-1.12)} ${P(0.32)} ${P(-1.02)}C${P(0.66)} ${P(-0.8)} ${P(0.46)} ${P(-0.2)} 0 0Z`;
  // pliegue: media luna oscura del lado derecho del pétalo y cuña en la base
  const pliegue = `M${P(0.3)} ${P(-1)}C${P(0.6)} ${P(-0.8)} ${P(0.44)} ${P(-0.22)} ${P(0.04)} ${P(-0.04)}C${P(0.3)} ${P(-0.3)} ${P(0.42)} ${P(-0.7)} ${P(0.3)} ${P(-1)}Z`;
  const base = `M0 ${P(-0.08)}C${P(-0.16)} ${P(-0.2)} ${P(-0.14)} ${P(-0.5)} 0 ${P(-0.64)}C${P(0.14)} ${P(-0.5)} ${P(0.16)} ${P(-0.2)} 0 ${P(-0.08)}Z`;
  const brillo = `M${P(-0.32)} ${P(-0.5)}C${P(-0.4)} ${P(-0.72)} ${P(-0.33)} ${P(-0.9)} ${P(-0.2)} ${P(-0.95)}C${P(-0.25)} ${P(-0.8)} ${P(-0.24)} ${P(-0.64)} ${P(-0.32)} ${P(-0.5)}Z`;
  const k = tipo === "a" ? "florA" : "florB";
  let o = `<g transform="translate(${num(x)} ${num(y)})">`;
  for (const a of [0, 72, 144, 216, 288]) {
    o += `<g transform="rotate(${a + giro})"><path ${PINTURA[k]} d="${petalo}"/><path ${PINTURA[k + "S"]} d="${pliegue}${base}"/><path ${PINTURA.luz} d="${brillo}"/></g>`;
  }
  o += `<circle ${PINTURA[k + "S"]} r="${P(0.4)}"/><circle ${PINTURA.boton} r="${P(0.27)}"/>`;
  o += `<g ${PINTURA.punto}>${[0, 60, 120, 180, 240, 300].map((a) => circ(Math.cos((a * Math.PI) / 180) * r * 0.14, Math.sin((a * Math.PI) / 180) * r * 0.14, r * 0.045)).join("")}</g>`;
  o += `<circle ${PINTURA.luz} cx="${P(-0.09)}" cy="${P(-0.11)}" r="${P(0.07)}"/></g>`;
  const sil = `<g transform="translate(${num(x)} ${num(y)})">${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a + giro})" d="${petalo}"/>`).join("")}</g>`;
  return [["crudo", o, sil]];
}

/** La cinta celeste y blanca: tres franjas, onda, pliegues y colas con muesca. */
function cinta(y, medio = 100, cola = 50, h = 11) {
  const eje = bez([X0 - medio, y - 9], [X0 - medio * 0.45, y + 15], [X0 + medio * 0.45, y + 15], [X0 + medio, y - 9], 24);
  const banda = (pts, a, b) => correr(pts, a).concat(correr(pts, b).reverse());
  let it = [];
  for (const s of [-1, 1]) {
    const c = bez([X0 + s * (medio - 22), y + 10], [X0 + s * (medio + 6), y + 20], [X0 + s * (medio + cola * 0.55), y + 6], [X0 + s * (medio + cola), y + 14], 10);
    const fin = c[c.length - 1], ant = c[c.length - 3];
    const tl = Math.hypot(fin[0] - ant[0], fin[1] - ant[1]);
    const muesca = [fin[0] - ((fin[0] - ant[0]) / tl) * h * 1.1, fin[1] - ((fin[1] - ant[1]) / tl) * h * 1.1];
    const borde = camino(correr(c, h).concat([muesca], correr(c, -h).reverse()));
    const id = `__ID__-cola${s > 0 ? "d" : "i"}`;
    it.push(["crudo", `<clipPath id="${id}"><path d="${borde}"/></clipPath><g clip-path="url(#${id})"><path ${PINTURA.cCel2} d="${camino(banda(c, h + 1, -h - 1))}"/><path ${PINTURA.cBla2} d="${camino(banda(c, h / 3, -h / 3))}"/><path ${PINTURA.cS} d="${camino(banda(tramo(c, 0, 0.45), h + 1, -h - 1))}"/></g><path ${PINTURA.cBorde} d="${borde}"/>`, `<path d="${borde}"/>`]);
  }
  const borde = camino(banda(eje, h, -h));
  it.push(["cCel", borde], ["cBla", camino(banda(eje, h / 3, -h / 3))]);
  // volumen de la tela: sombra en el canto de abajo y en los dos pliegues, luz arriba
  it.push(["cS", camino(banda(eje, h, h * 0.52)) + camino(banda(tramo(eje, 0, 0.16), h, -h)) + camino(banda(tramo(eje, 0.84, 1), h, -h))]);
  it.push(["luz", camino(pincel(correr(tramo(eje, 0.14, 0.86), -h * 0.72), huso(1.8, 0.1)))]);
  it.push(["cBorde", borde]);
  return it;
}

const espejo = (f) => [-1, 1].map((sx) => f(sx));

/** Nivel medio: el final de la landing y la bienvenida. */
function medio() {
  const arriba = espejo((sx) => voluta({ ax: X0 + sx * 36, ay: 68, sx, sy: 1, L: 202, alto: 30, r0: 26, vueltas: 1.5, w: 16, ala: 2, filete: 4.6, yT: -8 }));
  const abajo = espejo((sx) => voluta({ ax: X0 + sx * 34, ay: 345, sx, sy: -1, L: 202, alto: 16, r0: 23, vueltas: 1.5, w: 14.5, ala: 2, filete: 4.4, yT: -4 }));
  const vs = arriba.concat(abajo);
  let grueso = [].concat(...vs.map((v) => v.it));
  grueso = grueso.concat(hoja(X0 - 8, 62, 198, 42, 17), hoja(X0 + 8, 62, -18, 42, 17), flor(X0, 58, 28, "a"));
  grueso = grueso.concat(hoja(X0 - 6, 346, 166, 30, 12), hoja(X0 + 6, 346, 14, 30, 12), flor(X0, 346, 16, "b", 36));
  let fino = [].concat(...vs.map((v) => v.finos));
  for (const sx of [-1, 1]) fino = fino.concat(perla(X0 + sx * 298, 206, 4.2), perla(X0 + sx * 291, 189, 2.8), perla(X0 + sx * 291, 223, 2.8));
  return { grueso, fino, caja: "62 18 696 362" };
}

/** Nivel cargado: la miniatura al compartir. */
function cargado() {
  const rulos = espejo((sx) => voluta({ ax: X0 + sx * 62, ay: 30, sx, sy: -1, L: 142, alto: -6, r0: 9, rf: 2.6, vueltas: 1.2, w: 5.5, tinta: "oro", yT: -2 }));
  const arriba = espejo((sx) => voluta({ ax: X0 + sx * 48, ay: 72, sx, sy: 1, L: 192, alto: 32, r0: 28, vueltas: 1.55, w: 18, hoja: true, ala: 3, filete: 4.8, yT: -8 }));
  const abajo = espejo((sx) => voluta({ ax: X0 + sx * 40, ay: 362, sx, sy: -1, L: 198, alto: 14, r0: 25, vueltas: 1.55, w: 16, ala: 3, filete: 4.6, yT: -4 }));
  const vs = arriba.concat(abajo);
  let grueso = [].concat(...vs.map((v) => v.it));
  for (const sx of [-1, 1]) grueso = grueso.concat(hoja(X0 + sx * 304, 212, sx > 0 ? -72 : 252, 28, 12), hoja(X0 + sx * 304, 212, sx > 0 ? 72 : 108, 28, 12), flor(X0 + sx * 302, 212, 18, "b", sx * 18));
  grueso = grueso.concat(cinta(318));
  grueso = grueso.concat(hoja(X0 - 6, 364, 166, 32, 13), hoja(X0 + 6, 364, 14, 32, 13), flor(X0, 364, 17, "b", 36));
  grueso = grueso.concat(hoja(X0 - 30, 70, 200, 34, 15), hoja(X0 + 30, 70, -20, 34, 15), flor(X0 - 36, 68, 17, "b", -20), flor(X0 + 36, 68, 17, "b", 20), flor(X0, 58, 30, "a"));
  let fino = [].concat(...rulos.map((v) => v.it), ...vs.map((v) => v.finos));
  for (const sx of [-1, 1]) fino = fino.concat(perla(X0 + sx * 44, 22, 3), perla(X0 + sx * 328, 212, 3.4));
  return { grueso, fino, caja: "62 6 696 392" };
}

/** Degradés y desenfoque de la sombra. `__ID__` se reemplaza por el id de cada copia. */
const DEFS = `<linearGradient id="__ID__-cel" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#d6eefc"/><stop offset=".45" stop-color="#74b8e8"/><stop offset="1" stop-color="#2b7cc0"/></linearGradient><linearGradient id="__ID__-oro" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fbe69a"/><stop offset=".5" stop-color="#eebb4a"/><stop offset="1" stop-color="#c98a1a"/></linearGradient><linearGradient id="__ID__-florA" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="#8f1420"/><stop offset=".55" stop-color="#d8262f"/><stop offset="1" stop-color="#f2685f"/></linearGradient><linearGradient id="__ID__-florB" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="#c9486b"/><stop offset=".55" stop-color="#f29bb0"/><stop offset="1" stop-color="#fde3e8"/></linearGradient><radialGradient id="__ID__-boton" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#9ac9e7"/><stop offset="1" stop-color="#1c5478"/></radialGradient><filter id="__ID__-difusaG" x="-10%" y="-12%" width="122%" height="130%"><feGaussianBlur stdDeviation="4.5"/></filter><filter id="__ID__-difusaF" x="-10%" y="-25%" width="120%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter>`;

const AZUL_RELIEVE = "#0f3a5b";

/**
 * Una capa con su profundidad: la sombra proyectada (la silueta desenfocada
 * y corrida), el relieve duro (la silueta repetida en diagonal) y el dibujo.
 * El desenfoque va sólo en la sombra: Safari dibuja en baja resolución lo
 * que pasa por un filtro, y el dibujo tiene que quedar nítido.
 */
function capa(items, nombre, { pasos, paso, sombra, opacidad }) {
  const { arte, sil } = pintar(items);
  const id = `__ID__-sil${nombre}`;
  let o = `<defs><g id="${id}" fill="${AZUL_RELIEVE}" stroke="${AZUL_RELIEVE}" stroke-width="1.5" stroke-linejoin="round">${sil}</g></defs>`;
  o += `<use href="#${id}" x="${sombra[0]}" y="${sombra[1]}" opacity="${opacidad}" filter="url(#__ID__-difusa${nombre})"/>`;
  for (let k = pasos; k >= 1; k--) o += `<use href="#${id}" x="${num(k * paso)}" y="${num(k * paso)}"/>`;
  return o + arte;
}

/** El SVG de los adornos de un nivel (sin la letra), con `__ID__` por reemplazar. */
export function adornos(nivel) {
  const n = nivel === "cargado" ? cargado() : medio();
  const fino = capa(n.fino, "F", { pasos: 2, paso: 1, sombra: [3, 5], opacidad: ".32" });
  const grueso = capa(n.grueso, "G", { pasos: 3, paso: 1.2, sombra: [5, 9], opacidad: ".4" });
  return { caja: n.caja, svg: `<defs>${DEFS}</defs>${fino}${grueso}` };
}

// ── Salidas ────────────────────────────────────────────────────────────────
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARCA = join(RAIZ, "..", "docs", "design-system", "marca");
export const ID = "__ID__";
export const PNG_ANCHO = 1200;

/** El módulo que importa Filete.tsx. */
export function moduloTs() {
  const a = adornos("medio");
  return `// GENERADO por scripts/build-filete.mjs. No editar a mano: cambiar el script y correrlo.
// Los adornos del «oído» fileteado, nivel medio (final de la landing y bienvenida).
// \`${ID}\` se reemplaza por el id de cada copia del dibujo (Filete.tsx).

/** El viewBox del dibujo con adornos. */
export const ADORNOS_CAJA = ${JSON.stringify(a.caja)};

export const ADORNOS_SVG =
  ${JSON.stringify(a.svg)};
`;
}

/** La letra a trazos sale del vector de la marca sola (no depende de la fuente). */
function letraATrazos() {
  const marca = readFileSync(join(MARCA, "oido-filete-marca.svg"), "utf8");
  const m = marca.match(/<path id="m-t" d="([^"]+)"/);
  if (!m) throw new Error("No encuentro la letra a trazos en oido-filete-marca.svg");
  return m[1];
}

/** El dibujo completo, autónomo: adornos + la letra a trazos con su relieve. */
export function vector(nivel) {
  const a = adornos(nivel);
  // La marca sola se dibuja en (320, 200); la firma, en (410, 253).
  let letra = `<defs><path id="f-t" transform="translate(90 53)" d="${letraATrazos()}"/><linearGradient id="f-cara" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff9dc"/><stop offset="1" stop-color="#f2dc9a"/></linearGradient><clipPath id="f-recorte"><use href="#f-t"/></clipPath></defs>`;
  letra += `<use href="#f-t" x="20" y="20" fill="#c98a1a" opacity="0.5"/>`;
  for (let k = 14; k >= 1; k--) {
    const c = k > 6 ? "#14456a" : "#1c5478";
    letra += `<use href="#f-t" x="${k}" y="${k}" fill="${c}" stroke="${c}" stroke-width="2"/>`;
  }
  letra += `<use href="#f-t" x="2.2" y="2.2" fill="#c98a1a"/><use href="#f-t" fill="url(#f-cara)" stroke="#14456a" stroke-width="5" paint-order="stroke"/><g clip-path="url(#f-recorte)"><use href="#f-t" fill="none" stroke="#ffffff" stroke-width="16"/><use href="#f-t" fill="none" stroke="url(#f-cara)" stroke-width="10"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${a.caja}" role="img" aria-label="Oído"><title>Oído</title>${a.svg.replaceAll(`${ID}-`, "a-")}${letra}</svg>\n`;
}

async function png() {
  const { default: sharp } = await import("sharp");
  const svg = Buffer.from(vector("cargado"));
  const [, , ancho] = adornos("cargado").caja.split(" ").map(Number);
  return sharp(svg, { density: (72 * PNG_ANCHO) / ancho })
    .resize({ width: PNG_ANCHO })
    .png({ palette: true, colours: 256, dither: 1, effort: 10 })
    .toBuffer();
}

const SALIDAS = [
  [join(RAIZ, "components", "landing", "filete-adornos.ts"), moduloTs],
  [join(MARCA, "oido-filete.svg"), () => vector("medio")],
  [join(MARCA, "oido-filete-cargado.svg"), () => vector("cargado")],
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--check")) {
    const viejos = SALIDAS.filter(([ruta, f]) => readFileSync(ruta, "utf8") !== f()).map(([ruta]) => ruta);
    if (viejos.length) {
      console.error(`Quedaron viejos (correr node scripts/build-filete.mjs):\n${viejos.join("\n")}`);
      process.exit(1);
    }
    console.log("[filete] al día");
  } else {
    for (const [ruta, f] of SALIDAS) writeFileSync(ruta, f());
    writeFileSync(join(RAIZ, "assets", "og", "filete-oido.png"), await png());
    console.log("[filete] escritos el módulo, los dos vectores y el PNG de la miniatura");
  }
}
