// Las palabras en pantalla: una por vez, entran subiendo y enfocándose (sobre un lienzo que el revelado compone arriba de todo).
// También el cierre: el «oído» plano (vector de la marca) y la dirección del sitio.
import * as THREE from 'three';

export async function crearLetras(W, H, fuente, { logo = null, mono = 'Inter' } = {}) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.premultiplyAlpha = false; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const esc = W / 720;
  let img = null; if (logo) { img = new Image(); img.src = logo; await img.decode(); }
  return {
    tex,
    dibujar(items, { x = 0.085, y = 0.25, color = '#f4eee3' } = {}) {
      g.clearRect(0, 0, W, H);
      // ancho de cada renglón centrado, para ubicar la primera palabra
      const renglones = {};
      for (const it of items) if (it.centro) { g.font = `${it.tam * esc}px "${fuente}"`; renglones[it.tam] = (renglones[it.tam] || 0) + g.measureText(it.txt + ' ').width; }
      let cx = x * W;
      for (const it of items) {
        g.save(); g.globalAlpha = Math.max(0, Math.min(1, it.alfa)); g.filter = it.blur > 0.15 ? `blur(${(it.blur * esc).toFixed(2)}px)` : 'none';
        g.shadowColor = 'rgba(0,0,0,0.45)';
        if (it.logo && img) {
          const w = W * 0.46, h = w * img.height / img.width; g.shadowBlur = 30 * esc; g.drawImage(img, (W - w) / 2, H * 0.47, w, h);
        } else if (it.mono) {
          g.font = `500 ${it.tam * esc}px "${mono}"`; g.fillStyle = color; g.textAlign = 'center'; g.shadowBlur = 14 * esc; g.letterSpacing = `${2 * esc}px`; g.fillText(it.txt, W / 2, H * 0.47 + W * 0.46 * (img ? img.height / img.width : 0.35) + 70 * esc);
        } else {
          const tam = it.tam * esc; g.font = `${tam}px "${fuente}"`;
          if (it.k === 0) cx = it.centro ? (W - (renglones[it.tam] || 0) + g.measureText(' ').width) / 2 : x * W;
          g.shadowBlur = tam * 0.5; g.shadowOffsetY = tam * 0.04; g.fillStyle = color;
          g.fillText(it.txt, cx, (it.centro ? 0.36 : it.y ?? y) * H + it.dy * esc);
          g.restore(); g.save(); g.font = `${tam}px "${fuente}"`;
          cx += g.measureText(it.txt + ' ').width;
        }
        g.restore();
      }
      tex.needsUpdate = true;
      return tex;
    },
  };
}
