"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * Número que cuenta de 0 a su valor la primera vez que entra en pantalla
 * ("Turnos activos", lo ganado en el mes, las cifras de la landing). Le da
 * peso a un dato que importa sin agregar nada que leer: termina en menos de
 * un segundo y no vuelve a animarse si el componente se re-renderiza con el
 * mismo valor.
 *
 * Con "reducir movimiento" muestra el valor final de entrada. Si el valor
 * cambia después de contado (llega un turno nuevo), cuenta desde el anterior.
 */
export default function CountUp({
  value,
  duration = 800,
  format = (n) => n.toLocaleString("es-AR"),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const from = useRef(reducedMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      from.current = value;
      setDisplay(value);
      return;
    }
    const start = from.current;
    if (start === value) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(start + (value - start) * eased);
      from.current = current;
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reducedMotion, value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
