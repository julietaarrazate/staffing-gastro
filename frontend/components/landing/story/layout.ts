"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Geometría compartida de las escenas fijadas. El mapa ocupa el MISMO lugar
 * en el pedido, en la elección y en la llegada: es el mismo barrio, y que no
 * salte entre escenas es parte de que se lea como una sola historia.
 *
 * Zonas (coordenadas del escenario, que arranca debajo del encabezado):
 * - celular: el producto arriba (desde `visTop`), la narración abajo, con el
 *   alto que mide (`narrH`; ver `Narration`): con el titular a 48px ocupa de
 *   dos a cuatro líneas según el estado y un número fijo ya no alcanzaba;
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

/** Margen de la narración contra el borde de abajo (`bottom-7` en las escenas)
 *  y aire entre el producto y el titular, en el celular. */
export const NARR_BOTTOM = 28;
const NARR_GAP = 20;

export function stageBox(w: number, h: number, narrH = 148): StageBox {
  const desktop = w >= 1024;
  const visTop = desktop ? 96 : 76;
  const visBottom = desktop ? h - 48 : h - (narrH + NARR_BOTTOM + NARR_GAP);
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
    // Termina 16px arriba del titular (antes lo tocaba: "Ubicaciones
    // aproximadas" quedaba pegado al texto de 48px).
    const mh = avail + 24;
    const size = Math.min(w, mh);
    map = { x: 0, y: visTop - 20, w, h: mh, size, fx: (w - size) / 2, fy: visTop - 20 + (mh - size) / 2, bleed: true };
  }
  return { w, h, desktop, visX, visW, visTop, visBottom, map };
}

/** Un punto del mapa (en unidades 0–100) en coordenadas del escenario. */
export function mapPoint(m: MapRect, u: number, v: number) {
  return { x: m.fx + (u / 100) * m.size, y: m.fy + (v / 100) * m.size };
}

/** Celular centrado en la zona del producto (o en `x` si se pasa). En el
 *  celular arranca debajo de la etiqueta de la escena ("Lo que ve Lucía"),
 *  que si no quedaba tapada por el marco cuando el celular se achica. */
export const PHONE_W = 274;
export const PHONE_H = 554;
export function phoneRect(b: StageBox, align: "center" | "right" = "center") {
  const top = b.desktop ? b.visTop - 20 : b.visTop - 6;
  const room = (b.desktop ? b.visBottom + 20 : b.visBottom + 8) - top;
  const s = Math.min(b.desktop ? 1.08 : 1, room / PHONE_H, b.visW / PHONE_W);
  const x = align === "right" ? b.visX + b.visW - PHONE_W * s : b.visX + (b.visW - PHONE_W * s) / 2;
  return { x, y: top + (room - PHONE_H * s) / 2, s };
}

/** Alto de cada estado de la narración (ver `Narration`), en orden. Sirve
 *  para que una escena le dé al producto el lugar que deja el texto de ESE
 *  momento: con el titular a 48px, un estado de tres líneas no tiene por qué
 *  achicar los cuadros de los estados de dos. */
export function narrHeights(el: HTMLElement | null): number[] {
  if (!el) return [];
  return Array.from(el.querySelectorAll<HTMLElement>("[data-narr-item]")).map((n) => n.offsetHeight);
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
