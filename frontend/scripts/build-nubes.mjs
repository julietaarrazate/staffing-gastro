// Modela las nubes del cielo de la app (ADR-0028, «tercera vuelta»): una unión
// suave de esferas con luz de arriba a la izquierda y sombra celeste, como de
// arcilla, guardada con transparencia. Correr a mano si se cambia una forma:
//   node scripts/build-nubes.mjs
//
// El relieve se calcula acá, en Node, y se codifica con `sharp`: no hace falta
// navegador. Escribe public/cielo/nube-{a,b,c}.webp (unos 10 KB cada una).
// Formas: a = cúmulo, b = chica, c = banco largo. Cada esfera es [x, y, radio].
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const FORMAS = {
  a: { w: 420, h: 250, c: [[92, 160, 50], [146, 128, 62], [214, 108, 78], [288, 132, 62], [338, 162, 44], [204, 168, 58], [124, 174, 44], [272, 174, 48], [176, 86, 34], [252, 82, 38]] },
  b: { w: 340, h: 240, c: [[116, 132, 58], [176, 104, 70], [236, 132, 54], [170, 160, 56], [92, 160, 38], [268, 160, 36], [142, 78, 30]] },
  c: { w: 580, h: 210, c: [[58, 130, 38], [112, 108, 54], [178, 96, 62], [250, 106, 56], [322, 98, 60], [392, 110, 52], [452, 126, 42], [508, 136, 30], [150, 138, 48], [286, 140, 50], [410, 142, 40], [214, 70, 28], [352, 64, 30]] },
};

const E = 2; // se modela al doble y la imagen sale a ese tamaño
const mix = (a, b, t) => a + (b - a) * t;
const ss = (a, b, v) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function modelar(f) {
  const W = f.w * E;
  const H = f.h * E;
  const alto = new Float32Array(W * H);
  const masa = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = 0;
      for (const [cx, cy, r] of f.c) {
        const dx = x - cx * E;
        const dy = y - cy * E;
        const R = r * E;
        const q = R * R - dx * dx - dy * dy;
        if (q > 0) h = Math.max(h, Math.sqrt(q));
      }
      alto[y * W + x] = h;
      masa[y * W + x] = h;
    }
  }
  // Suaviza el mapa de altura (tres pasadas de caja): las uniones quedan blandas.
  const tmp = new Float32Array(W * H);
  const RAD = (f.suave || 7) * E;
  const caja = (src, dst, paso, largo, lineas, salto) => {
    for (let l = 0; l < lineas; l++) {
      const base = l * salto;
      let s = 0;
      for (let k = -RAD; k <= RAD; k++) s += src[base + Math.min(Math.max(k, 0), largo - 1) * paso];
      for (let k = 0; k < largo; k++) {
        dst[base + k * paso] = s / (2 * RAD + 1);
        s += src[base + Math.min(k + RAD + 1, largo - 1) * paso] - src[base + Math.max(k - RAD, 0) * paso];
      }
    }
  };
  for (let p = 0; p < 3; p++) {
    caja(alto, tmp, 1, W, H, W);
    caja(tmp, alto, W, H, W, 1);
  }
  const px = Buffer.alloc(W * H * 4); // RGBA, transparente
  const L = [-0.42, -0.66, 0.62];
  const ln = Math.hypot(...L);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const h = masa[i];
      if (h <= 0) continue;
      const gx = (alto[i + 1] - alto[i - 1]) / 2;
      const gy = (alto[i + W] - alto[i - W]) / 2;
      const n = Math.hypot(gx, gy, 1);
      const d = (-gx * L[0] - gy * L[1] + L[2]) / (n * ln);
      const media = Math.pow(d * 0.5 + 0.5, 1.15);
      const t = ss(0.34, 0.8, media);
      // sombra celeste -> blanco; lo que mira hacia abajo, un poco más hondo
      const abajo = ss(0.15, 0.9, gy / n) * (1 - t);
      const o = i * 4;
      px[o] = Math.round(mix(mix(150, 118, abajo), 255, t));
      px[o + 1] = Math.round(mix(mix(192, 168, abajo), 255, t));
      px[o + 2] = Math.round(mix(mix(232, 220, abajo), 255, t));
      px[o + 3] = Math.round(255 * ss(0, 9 * E, h));
    }
  }
  return { px, W, H };
}

const salida = new URL("../public/cielo/", import.meta.url);
await mkdir(salida, { recursive: true });
for (const [k, f] of Object.entries(FORMAS)) {
  const { px, W, H } = modelar(f);
  const archivo = new URL(`nube-${k}.webp`, salida);
  const info = await sharp(px, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 80, alphaQuality: 90 })
    .toFile(archivo.pathname);
  console.log(`nube-${k}.webp ${W}x${H} ${info.size} bytes`);
}
