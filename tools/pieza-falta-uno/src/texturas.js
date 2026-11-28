// Texturas dibujadas por código (canvas): acero cepillado, azulejos, baldosas de azotea, revoque, madera.
import * as THREE from 'three';
import { rng } from './util.js';

const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { srgb = true, rep = [1, 1] } = {}) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };

export function aceroCepillado() {
  const [c, g] = lienzo(1024, 512), r = rng(5);
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 2600; i++) { const y = r() * 512, v = 110 + r() * 60; g.strokeStyle = `rgba(${v},${v},${v},${0.15 + r() * 0.25})`; g.lineWidth = .5 + r() * 1.2; g.beginPath(); g.moveTo(r() * 1024 - 200, y); g.lineTo(r() * 1024 + 200, y + (r() - .5) * 2); g.stroke(); }
  // rayones y manchas de trapo
  for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(190,190,190,${0.2 + r() * 0.3})`; g.lineWidth = .7; g.beginPath(); const x = r() * 1024, y = r() * 512; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 120, y + (r() - .5) * 40); g.stroke(); }
  for (let i = 0; i < 18; i++) { const x = r() * 1024, y = r() * 512, rad = 40 + r() * 120; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(200,200,200,.18)'); gr.addColorStop(1, 'rgba(200,200,200,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  return tex(c, { srgb: false });
}

export function azulejos() {
  const [c, g] = lienzo(1024, 1024), r = rng(11);
  g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, 1024, 1024); // pastina
  const W = 128, H = 64;
  for (let y = 0; y < 1024; y += H) for (let x = -((y / H) % 2) * W / 2; x < 1024; x += W) {
    const v = 232 + r() * 14, j = r() * 6;
    const gr = g.createLinearGradient(x, y, x, y + H); gr.addColorStop(0, `rgb(${v},${v - 2},${v - 6 - j})`); gr.addColorStop(1, `rgb(${v - 14},${v - 16},${v - 20 - j})`);
    g.fillStyle = gr; g.fillRect(x + 3, y + 3, W - 6, H - 6);
  }
  return tex(c, { rep: [6, 4] });
}

export function baldosas() {
  const [c, g] = lienzo(1024, 1024), r = rng(23);
  g.fillStyle = '#4a3029'; g.fillRect(0, 0, 1024, 1024);
  const S = 128;
  for (let y = 0; y < 1024; y += S) for (let x = 0; x < 1024; x += S) {
    const h = 12 + r() * 10, l = 30 + r() * 10; g.fillStyle = `hsl(${h},${38 + r() * 10}%,${l}%)`; g.fillRect(x + 3, y + 3, S - 6, S - 6);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(0,0,0,${r() * .12})`; g.fillRect(x + r() * S, y + r() * S, 2 + r() * 8, 2 + r() * 8); }
  }
  // musgo y manchas de agua
  for (let i = 0; i < 30; i++) { const x = r() * 1024, y = r() * 1024, rad = 30 + r() * 110, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(20,18,15,.35)'); gr.addColorStop(1, 'rgba(20,18,15,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  return tex(c, { rep: [5, 12] });
}

export function revoque(base = '#6d675f', seed = 3) {
  const [c, g] = lienzo(512, 512), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { const v = r() < .5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${r() * .05})`; g.fillRect(r() * 512, r() * 512, 1 + r() * 4, 1 + r() * 4); }
  for (let i = 0; i < 26; i++) { const x = r() * 512, w = 6 + r() * 30; const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, w, 200 + r() * 300); }
  return tex(c, { rep: [3, 3] });
}

export function madera() {
  const [c, g] = lienzo(256, 1024), r = rng(41);
  g.fillStyle = '#3a2518'; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(${r() < .5 ? '20,10,5' : '90,60,40'},${.12 + r() * .2})`; g.lineWidth = 1 + r() * 3; const x = r() * 256; g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= 1024; y += 64) g.lineTo(x + Math.sin(y * .01 + i) * 6, y); g.stroke(); }
  return tex(c, { rep: [1, 2] });
}

// silueta de una mano que sostiene una comanda (sólo proyecta sombra; nunca se ve)
export function siluetaMano() {
  const [c, g] = lienzo(512, 512);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(150, 512); g.bezierCurveTo(140, 400, 150, 330, 190, 280); // muñeca
  g.bezierCurveTo(150, 250, 110, 210, 92, 168); g.bezierCurveTo(84, 150, 104, 140, 118, 156); g.bezierCurveTo(150, 190, 180, 215, 210, 230); // pulgar
  g.lineTo(214, 120); g.bezierCurveTo(214, 96, 244, 96, 246, 120); g.lineTo(252, 214); // índice
  g.lineTo(264, 96); g.bezierCurveTo(266, 70, 298, 72, 296, 98); g.lineTo(290, 214); // mayor
  g.lineTo(316, 112); g.bezierCurveTo(320, 90, 350, 94, 346, 118); g.lineTo(326, 226); // anular
  g.lineTo(360, 150); g.bezierCurveTo(368, 132, 394, 140, 386, 162); g.bezierCurveTo(370, 230, 350, 290, 330, 330); // meñique
  g.bezierCurveTo(320, 400, 330, 450, 340, 512);
  g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// textura de humo/vapor
export function humo() {
  const [c, g] = lienzo(256, 256), r = rng(77);
  for (let i = 0; i < 70; i++) { const x = 64 + r() * 128, y = 64 + r() * 128, rad = 20 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${.05 + r() * .08})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
