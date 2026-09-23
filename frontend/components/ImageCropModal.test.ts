import { describe, expect, it } from "vitest";
import { cropDrawRect } from "./ImageCropModal";

// Imagen 2000×1000 en el visor 16:9 (320×180): a zoom 1 entra por alto
// (escala 0,18 → 360×180 en pantalla), así que sobran 20px a cada lado.
const base = {
  natural: { width: 2000, height: 1000 },
  scale: 0.18,
  viewportWidth: 320,
  outputWidth: 1280,
  outputHeight: 720,
};

describe("cropDrawRect", () => {
  it("sin mover, la imagen queda centrada", () => {
    const r = cropDrawRect({ ...base, offset: { x: 0, y: 0 } });
    expect(r.width).toBeCloseTo(1440);
    expect(r.x).toBeCloseTo(-80);
  });

  it("correr la foto a la derecha en el visor la corre a la derecha en lo que se sube", () => {
    // +20px en el visor = +80px en la salida (factor 4). El borde izquierdo
    // de la imagen queda en 0: se sube la parte IZQUIERDA, la que se veía.
    const r = cropDrawRect({ ...base, offset: { x: 20, y: 0 } });
    expect(r.x).toBeCloseTo(0);
  });

  it("en cuadrado (avatar) vale lo mismo", () => {
    const r = cropDrawRect({
      natural: { width: 1000, height: 1000 },
      scale: 0.26,
      offset: { x: 0, y: -10 },
      viewportWidth: 260,
      outputWidth: 640,
      outputHeight: 640,
    });
    expect(r.y).toBeLessThan(0);
    expect(r.y).toBeCloseTo(-640 * (10 / 260) * 1, 0);
  });
});
