"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Geometría compartida de las escenas fijadas. El mapa ocupa el MISMO lugar
 * en el pedido, en la elección y en la llegada: es el mismo barrio, y que no
 * salte entre escenas es parte de que se lea como una sola historia.
 *
 * Zonas (coordenadas del escenario, que arranca debajo del encabezado):
 * - celular: el producto arriba (desde `visTop`), la narración en los ~176px
 *   de abajo;
 * - escritorio: la narración en la columna izquierda (5/12) y el producto en
 *   la derecha (7/12).
 * Arriba a la izquierda quedan siempre el reloj y la etiqueta de la escena.
 */
export type StageBox = {
  w: number;
  h: number;
  desktop: boolean;
  visX: number;
  visW: number;
  visTop: number;
  visBottom: number;
  map: MapRect;
};

/** Rectángulo del mapa y el cuadrado de referencia (100×100) donde viven los
 *  pines. En el celular el mapa va a sangre y es más alto que ancho; el
 *  cuadrado queda centrado adentro. */
export type MapRect = { x: number; y: number; w: number; h: number; size: number; fx: number; fy: number; bleed: boolean };

export function stageBox(w: number, h: number): StageBox {
  const desktop = w >= 1024;
  const visTop = desktop ? 96 : 76;
  const visBottom = desktop ? h - 48 : h - 176;
  const visX = desktop ? Math.round(w * (5 / 12)) : 16;
  const visW = desktop ? w - visX - 48 : w - 32;
  const avail = visBottom - visTop;
  let map: MapRect;
  if (desktop) {
    const size = Math.min(visW, avail + 24);
    const x = visX + (visW - size) / 2;
    const y = visTop - 12 + (avail + 24 - size) / 2;
    map = { x, y, w: size, h: size, size, fx: x, fy: y, bleed: false };
  } else {
    const mh = avail + 40;
    const size = Math.min(w, mh);
    map = { x: 0, y: visTop - 20, w, h: mh, size, fx: (w - size) / 2, fy: visTop - 20 + (mh - size) / 2, bleed: true };
  }
  return { w, h, desktop, visX, visW, visTop, visBottom, map };
}

/** Un punto del mapa (en unidades 0–100) en coordenadas del escenario. */
export function mapPoint(m: MapRect, u: number, v: number) {
  return { x: m.fx + (u / 100) * m.size, y: m.fy + (v / 100) * m.size };
}

/** Celular centrado en la zona del producto (o en `x` si se pasa). */
export const PHONE_W = 274;
export const PHONE_H = 554;
export function phoneRect(b: StageBox, align: "center" | "right" = "center") {
  const avail = b.visBottom - b.visTop;
  const s = Math.min(b.desktop ? 1.08 : 1, (avail + 40) / PHONE_H, b.visW / PHONE_W);
  const x = align === "right" ? b.visX + b.visW - PHONE_W * s : b.visX + (b.visW - PHONE_W * s) / 2;
  return { x, y: b.visTop - 20 + (avail + 40 - PHONE_H * s) / 2, s };
}

/**
 * Mide el escenario y recalcula la composición cuando cambia de tamaño.
 * Devuelve el valor para el render y un ref para los cálculos que corren en
 * cada evento de scroll (sin re-render).
 */
export function useStageLayout<L>(
  stageRef: RefObject<HTMLElement | null>,
  compute: (w: number, h: number) => L,
  observe: RefObject<HTMLElement | null>[] = []
) {
  const [layout, setLayout] = useState<L>(() => compute(390, 788));
  const ref = useRef<L>(layout);
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const next = compute(stage.clientWidth, stage.clientHeight);
      ref.current = next;
      setLayout(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    observe.forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageRef]);
  return { layout, ref };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeIn = (t: number) => t * t * t;
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
