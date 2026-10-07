"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  transform,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

/** Margen alrededor de cada umbral: sin esto, un scroll que se queda justo en
 *  el borde hace titilar el estado de un lado al otro. */
export const HYSTERESIS = 0.012;

/**
 * Paso discreto a partir del progreso, con histéresis. `stops` son los
 * umbrales en orden creciente; el paso es cuántos se pasaron (0…stops.length).
 * Exportada aparte para testearla sin DOM.
 */
export function stepFor(p: number, current: number, stops: readonly number[], h = HYSTERESIS): number {
  let next = current;
  while (next < stops.length && p >= stops[next] + h) next++;
  while (next > 0 && p < stops[next - 1] - h) next--;
  return next;
}

/**
 * Motor de una escena fijada: el progreso continuo (0→1 mientras la sección
 * pasa por la pantalla) para lo que se mueve con el dedo, y un paso discreto
 * para lo que cambia de estado (una push que cae, un botón que se aprieta).
 *
 * `offset: ["start start", "end end"]` exige que la sección sea MÁS ALTA que
 * la pantalla; si no, el progreso sale errático (el glitch que documentaba
 * ScrollHeroShowcase, de la landing anterior). Las secciones de la historia miden siempre más de
 * 100svh.
 *
 * `jumped` dice si el último cambio de paso saltó más de uno (un flick):
 * las animaciones por tiempo lo usan para no reproducir los intermedios.
 */
export function useStage(
  ref: RefObject<HTMLElement | null>,
  stops: readonly number[]
): { progress: MotionValue<number>; step: number; jumped: boolean } {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [state, setState] = useState({ step: 0, jumped: false });
  const stepRef = useRef(0);

  const update = (p: number) => {
    const next = stepFor(p, stepRef.current, stops);
    if (next !== stepRef.current) {
      const jumped = Math.abs(next - stepRef.current) > 1;
      stepRef.current = next;
      setState({ step: next, jumped });
    }
  };

  useMotionValueEvent(scrollYProgress, "change", update);
  // Si la página abre ya scrolleada (volver atrás, un ancla), el evento de
  // cambio no llega hasta el primer scroll: se sincroniza al montar.
  useEffect(() => {
    update(scrollYProgress.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { progress: scrollYProgress, ...state };
}

/**
 * ¿Se arma la versión animada? Arranca en `false` en el servidor Y en el
 * primer render del navegador (mismo HTML, sin error de hidratación); recién
 * después de montar pasa a `true` si el visitante no pidió reducir el
 * movimiento. La versión estática es la misma historia en cuadros apilados:
 * es lo que ven los buscadores, quien no tiene JavaScript y quien reduce el
 * movimiento.
 */
export function useEnhanced(): boolean {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted && reduced !== true;
}

/** Interpolación lineal acotada, para cálculos en eventos de progreso. */
export function seg(p: number, from: number, to: number): number {
  if (to === from) return p >= to ? 1 : 0;
  return Math.min(1, Math.max(0, (p - from) / (to - from)));
}

/**
 * `useTransform(progreso, [entrada], [salida])`, pero siempre calculado en JS.
 *
 * motion 13 "acelera" la forma con arrays cuando la fuente es un `useScroll`
 * con `target`: la convierte en una animación nativa atada a un ViewTimeline.
 * Dentro de un escenario `sticky` esa animación no seguía al scroll (el hero
 * quedaba visible encima de la noche, medido en Chromium 2026-10-06). La forma
 * con función no se acelera, así que todas las escenas pasan por acá.
 */
export function useRange(value: MotionValue<number>, input: number[], output: number[]): MotionValue<number> {
  // Los arrays llegan nuevos en cada render: se memoiza por su contenido.
  const inKey = input.join();
  const outKey = output.join();
  const map = useMemo(
    () => transform(inKey.split(",").map(Number), outKey.split(",").map(Number)),
    [inKey, outKey]
  );
  return useTransform(value, (v: number) => map(v));
}

/**
 * Lleva el scroll hasta un punto del progreso de una escena. Lo usan los
 * botones de la historia ("Completar", "Asignar"…): apretarlos avanza la
 * escena moviendo la página, así el estado siempre coincide con el scroll y
 * nunca se secuestra el scroll del visitante.
 */
export function scrollToProgress(el: HTMLElement | null, p: number) {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const travel = Math.max(0, el.offsetHeight - window.innerHeight);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: Math.round(top + travel * p), behavior: reduce ? "auto" : "smooth" });
}
