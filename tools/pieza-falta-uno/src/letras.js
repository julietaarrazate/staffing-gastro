// Las palabras en pantalla: una por vez, entran subiendo y enfocándose (sobre un lienzo que el revelado compone arriba de todo).
import * as THREE from 'three';

export function crearLetras(W, H, fuente) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.NoColorSpace; tex.premultiplyAlpha = false; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const esc = W / 720;
  return {
    tex,
    dibujar(items, { x = 0.085, y = 0.25, color = '#f4eee3' } = {}) {
      g.clearRect(0, 0, W, H);
      let cx = x * W;
      for (const it of items) {
        const tam = it.tam * esc; g.font = `${tam}px "${fuente}"`;
        if (it.k === 0) cx = x * W;
        g.save();
        g.globalAlpha = Math.max(0, Math.min(1, it.alfa));
        g.filter = it.blur > 0.15 ? `blur(${(it.blur * esc).toFixed(2)}px)` : 'none';
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = tam * 0.5; g.shadowOffsetY = tam * 0.04;
        g.fillStyle = color; g.fillText(it.txt, cx, y * H + it.dy * esc);
        g.restore();
        cx += g.measureText(it.txt + ' ').width;
      }
      tex.needsUpdate = true;
      return tex;
    },
  };
}
